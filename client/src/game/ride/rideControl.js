import { Vector3 } from 'three'

import { MPH, PULL_SECONDS, ridePace, speedoSpeed, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { coinMultiplier, distanceCoins, rideReward } from '@shared/logic'
import { rideLayout } from '@shared/course'
import { createRide, rideStats, stepRide } from '@shared/ride'
import { LAUNCH_PAD, PULL_BACK, RIDE_RETURN, SPAWN } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { watchRewardedAd } from '../../bloxity/services'
import { actions } from '../../net/actions'
import { getGame } from '../../store/game'
import { flyCoins } from '../../ui/coinsFly'
import { fadeThrough } from '../../ui/fade'
import { iconUrl } from '../../ui/icons'
import { burst } from '../fx/fxQueue'
import { spawnPopup } from '../fx/popups'
import { runtime } from '../runtime'
import { COURSE, WORLD } from './course'
import { slidePitch, slidePoint, wallRoll } from './path'

/** Position reports to the authority while riding. */
const REPORT_MS = 200
/** Once the ride's over, the results card waits this long for the authority's numbers. */
const RESULT_WAIT_MS = 2500
/** Back in the lobby: this long into the dance, the Coins start flying home. */
const FLY_HOME_MS = 550
/** Where the sled waits on the pad, un-pulled: just short of the band. */
const REST_Z = LAUNCH_PAD.z - 4.2

/**
 * Your ride, read every frame by the player, the camera, the slingshot, the slide's
 * coins and walls and the HUD (through its own 10 Hz poll, never React state per frame).
 *
 * Phases: 'pull' (sat on your sled on the slingshot, pulling the band back), 'ride'
 * (sliding - the shared ride simulation, stepped every frame with your input),
 * 'result' (stopped: the results card, then CLAIM takes you home). Your logical
 * position stays on the slingshot's pad all along (it's what the server checks); only
 * what's drawn goes down the slide, and where that is we report as we go.
 */
export const ride = {
  active: false,
  phase: 'pull',
  /** 0-1, how far the band is pulled back; whether it's being held. */
  power: 0,
  holding: false,
  /** The shared simulation (shared/ride.js) once launched. */
  sim: null,
  /** Where the sled is drawn, and how it's tipped. */
  position: new Vector3(),
  pitch: 0,
  roll: 0,
  /** Speed (m/s), coins picked up this ride and what they're worth so far. */
  speed: 0,
  /** The speedometer's reading (mph). */
  mph: 0,
  coins: 0,
  earned: 0,
  /** When the last BOOST! / SMASH! happened, for the banners. */
  boostAt: 0,
  smashAt: 0,
  finishAt: 0,
  /** Your best in this world before the ride, and when you passed it (NEW BEST!). */
  best: 0,
  bestAt: 0,
  /** When the ride stopped (and the camera swings round to you). */
  stoppedAt: 0,
  /** Set once the ride's been told to the authority, so it isn't twice. */
  ended: false,
  /** Bricks smashed this ride, by wall index (the walls draw them flying). */
  smashed: new Map(),
  /** This ride's number: sent with it, echoed in the server's answers about it. */
  id: 0,
}

let reportTimer = null
let resultTimer = null
let lastReport = { s: NaN, at: 0 }
/** Input handed to the simulation each frame (reused). */
const simInput = { steer: 0, jump: false, rocket: false }

const round2 = (v) => Math.round(v * 100) / 100

/** Deferred to a timer: reached from the frame loop, which must never update React state. */
const later = (fn) => setTimeout(fn, 0)
// Read when used: the 3D coin replaces the SVG one once it's rendered.
const COIN = () => iconUrl('coin')
const COIN_GRADIENT = 'linear-gradient(180deg, #fff6a3 0%, #ffcf2e 45%, #f08c00 100%)'

function clearTimers() {
  clearInterval(reportTimer)
  clearTimeout(resultTimer)
  reportTimer = null
  resultTimer = null
}

function report() {
  const sim = ride.sim
  if (!sim) return
  const s = Math.round(sim.s * 100) / 100
  const now = performance.now()
  if (s === lastReport.s && now - lastReport.at < 4000) return
  lastReport = { s, at: now }
  actions.rideAt(s, Math.round(sim.x * 100) / 100, Math.round((sim.y - COURSE.groundAt(sim.s, sim.x)) * 100) / 100)
}

/** Puts the sled on the pad, pulled back `power` of the way. */
function placeOnPad() {
  ride.position.set(LAUNCH_PAD.x, 0, REST_Z + ride.power * PULL_BACK)
  ride.pitch = 0
  ride.roll = 0
}

/**
 * Gets on the slingshot: PLAY (from anywhere - a quick fade to the pad) or the pad's
 * own prompt. Your sled waits for you to pull it back.
 */
export function enterSlingshot() {
  const game = getGame()
  if (ride.active || game.phase !== 'lobby') return
  const p = runtime.player.position
  if (Math.hypot(p.x - LAUNCH_PAD.x, p.z - LAUNCH_PAD.z) > LAUNCH_PAD.radius + 1) fadeThrough(boardSlingshot)
  else boardSlingshot()
}

/** Onto the slingshot's pad, sat on your sled, the band slack. */
function boardSlingshot() {
  const game = getGame()
  // Your best so far in this world: passing it down the slide is a NEW BEST!
  const best = game.profile.best?.[game.profile.world] ?? 0
  Object.assign(ride, { active: true, phase: 'pull', power: 0, holding: false, sim: null, speed: 0, coins: 0, earned: 0, ended: false, stoppedAt: 0, best, bestAt: 0 })
  ride.smashed.clear()
  placeOnPad()
  const player = runtime.player
  player.position.set(LAUNCH_PAD.x, 0, LAUNCH_PAD.z)
  player.yaw = Math.PI
  player.frozen = true
  runtime.camera.mode = 'ride'
  runtime.focus = ride.position
  game.setPhase('pull')
}

/**
 * A race you joined starts (RaceHost): straight onto the slingshot if you're in the
 * lobby, and off at full stretch on the race sled, everyone together. Mid-ride or on a
 * results card, you sit this one out.
 */
export function raceGo(start) {
  const game = getGame()
  if (ride.active && ride.phase !== 'pull') return
  if (!ride.active) {
    if (game.phase !== 'lobby') return
    boardSlingshot()
  }
  ride.power = 1
  placeOnPad()
  launch(start)
}

/** Off the slingshot without riding (the X). */
export function leaveSlingshot() {
  if (!ride.active || ride.phase !== 'pull') return
  ride.active = false
  runtime.player.frozen = false
  runtime.player.position.set(RIDE_RETURN.x, 0, RIDE_RETURN.z)
  runtime.camera.mode = 'follow'
  runtime.camera.yaw = 0
  runtime.camera.snap = true
  runtime.focus = null
  sfx.stretch(0)
  getGame().setPhase('lobby')
}

/** The pull overlay's mouse button or finger, held down on the screen. */
let pointerHeld = false

/** Holding (or letting go of) the band with the mouse or a finger, while on the slingshot. */
export function holdBand(down) {
  pointerHeld = Boolean(down) && ride.active && ride.phase === 'pull'
}

/**
 * Let go: you fly off down the slide with as much as you pulled - or, in a race
 * (`race`: its id and the race sled's stats), on the race sled with the race's layout.
 */
function launch(race = null) {
  const profile = getGame().profile
  pointerHeld = false
  ride.holding = false
  ride.race = race ? race.id : 0
  // This ride's own coin and boost layout: the race's (the same for every racer), or a fresh one.
  ride.layout = race ? race.id : 1 + Math.floor(Math.random() * 2 ** 30)
  ride.sim = createRide(race ? race.stats : rideStats(profile), rideLayout(COURSE, ride.layout), ride.power)
  // SPACE pulled the band: it doesn't jump you the moment you're off.
  ride.sim.jumpArmed = false
  ride.phase = 'ride'
  ride.earned = 0
  ride.coins = 0
  lastReport = { s: NaN, at: 0 }
  ride.id += 1
  actions.startRide(ride.id, ride.race || undefined)
  reportTimer = setInterval(report, REPORT_MS)
  sfx.stretch(0)
  sfx.launch(ride.power)
  sfx.slideStart()
  burst({ x: ride.position.x, y: 0.6, z: ride.position.z, count: 26, palette: 'confetti', speed: 6 })
  later(() => getGame().setPhase('ride'))
}

/**
 * Moves the pull or the ride on by `delta` seconds. `input` is `{ steer, jump, rocket }`;
 * called by the player's frame loop while `ride.active`.
 */
export function advanceRide(delta, input) {
  if (!ride.active) return
  if (ride.phase === 'pull') {
    // Hold (SPACE, or a finger or the mouse on the screen) to pull; let go to fly.
    if (input.hold || pointerHeld) ride.holding = true
    else if (ride.holding) {
      ride.holding = false
      if (ride.power > 0.08) {
        launch()
        return
      }
    }
    if (ride.holding) ride.power = Math.min(1, ride.power + delta / PULL_SECONDS)
    else ride.power = Math.max(0, ride.power - delta * 3)
    placeOnPad()
    sfx.stretch(ride.holding ? ride.power : 0)
    return
  }
  const sim = ride.sim
  if (!sim) return
  if (ride.phase === 'ride') {
    simInput.steer = input.steer
    simInput.jump = input.jump
    simInput.rocket = input.rocket
    // In steps of at most 1/60 s, so even the fastest sled sweeps its pickups finely.
    const steps = Math.ceil(delta * 60 - 1e-6)
    for (let i = 0; i < steps; i += 1) stepRide(sim, simInput, delta / steps)
    for (const event of sim.events) onEvent(event)
    sim.events.length = 0
    if (sim.done && !ride.ended) stop()
  }
  slidePoint(sim.s, sim.x, sim.y - COURSE.groundAt(sim.s, sim.x), ride.position)
  const k = 1 - Math.exp(-10 * delta)
  ride.pitch += ((sim.airborne ? Math.max(-0.5, Math.min(0.4, -sim.vy * 0.03)) : slidePitch(sim.s)) - ride.pitch) * k
  ride.roll += (wallRoll(sim.x) - ride.roll) * k
  // How fast you're really moving (m/s): for the camera's widening and the wind.
  ride.speed = ride.phase === 'ride' ? sim.v * ridePace(sim.course.world) : 0
  // What the speedometer reads (its own scale: see SPEEDO_PACE).
  ride.mph = ride.phase === 'ride' ? speedoSpeed(sim.v, sim.course.world) * MPH : 0
  // Past your best: a cheer, once a ride (not on the first few, before there is a best).
  if (ride.phase === 'ride' && !ride.race && !ride.bestAt && ride.best >= 30 && sim.s > ride.best) {
    ride.bestAt = performance.now()
    headWord('NEW BEST!', 4.4, GOLD_WORD, 1.25)
    burst({ x: ride.position.x, y: ride.position.y + 2, z: ride.position.z, count: 40, palette: 'gold', speed: 9 })
    sfx.newBest()
  }
  // As the server will pay it (logic.rideReward): the pickups and the distance, and what
  // INCOME and your trail add to them.
  const base = ride.coins * (WORLDS[WORLD]?.coin ?? 1) + distanceCoins(WORLD, Math.min(sim.s, COURSE.length))
  ride.earned = base + Math.round(base * (coinMultiplier(getGame().profile) - 1))
  if (ride.phase === 'ride') sfx.slideSet(sim.v / 30, sim.airborne, sim.burning)
}

const _at = new Vector3()

const BOOST_WORD = 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)'
const SMASH_WORD = 'linear-gradient(180deg, #ffb0a8 0%, #ff4a3b 50%, #d4142a 100%)'
const GOLD_WORD = 'linear-gradient(180deg, #fffaa8 0%, #ffd52a 45%, #ff9c00 100%)'

/** A word rising from just above your sled's head, and moving with it (BOOST!, SMASH!, NEW BEST!). */
function headWord(text, height, gradient, scale = 1) {
  const p = ride.position
  spawnPopup(text, _at.set(p.x, p.y + height, p.z), { follow: p, gradient, scale })
}

/** One thing that happened on the slide, from the simulation. */
function onEvent([type, index]) {
  const now = performance.now()
  switch (type) {
    case 'coin': {
      ride.coins += 1
      actions.collectCoin(index, round2(ride.sim.s))
      // The HUD's running total and the sound say it: no popup, so the view stays clear.
      sfx.coin()
      break
    }
    case 'diamond': {
      actions.collectDiamond(index, round2(ride.sim.s))
      burst({ x: ride.position.x, y: ride.position.y + 1.6, z: ride.position.z, count: 30, palette: 'power', speed: 7 })
      sfx.diamond()
      break
    }
    case 'boost':
      ride.boostAt = now
      headWord('BOOST!', 2.6, BOOST_WORD)
      actions.rideHit('boost', index, round2(ride.sim.s))
      sfx.boost()
      break
    case 'smash': {
      ride.smashAt = now
      headWord('SMASH!', 3.5, SMASH_WORD)
      ride.smashed.set(index, now)
      actions.rideHit('wall', index, round2(ride.sim.s))
      sfx.smash()
      const wall = COURSE.walls[index]
      slidePoint(wall.s, wall.x, 1.2, _at)
      burst({ x: _at.x, y: _at.y, z: _at.z, count: 24, palette: 'confetti', speed: 8 })
      break
    }
    case 'jump':
      sfx.jump()
      break
    case 'land':
      if (index > 0.3) sfx.jumpLand()
      break
    case 'rocket':
      if (index) sfx.rocketOn()
      else sfx.rocketOff()
      break
    case 'finish':
      ride.finishAt = now
      sfx.wins()
      burst({ x: ride.position.x, y: ride.position.y + 2, z: ride.position.z, count: 80, palette: 'gold', speed: 11 })
      break
    default:
      break
  }
}

/** The sled's stopped (or END): tell the authority, and wait for the results. */
function stop() {
  const sim = ride.sim
  if (!sim || ride.ended) return
  ride.ended = true
  ride.phase = 'result'
  ride.stoppedAt = performance.now()
  ride.speed = 0
  clearInterval(reportTimer)
  reportTimer = null
  report()
  actions.endRide(round2(sim.s), ride.id)
  sfx.slideStop()
  sfx.rocketOff()
  // If the authority's numbers don't come (a dropped connection), show ours.
  const distance = Math.min(sim.s, COURSE.length)
  resultTimer = setTimeout(() => {
    const game = getGame()
    if (game.phase !== 'ride' && game.result) return
    const reward = rideReward(game.profile, { world: WORLD, distance, pickups: ride.coins })
    const best = game.profile.best[WORLD] ?? 0
    showResult({ world: WORLD, distance: Math.floor(distance), best, newBest: distance > best, gained: Math.max(0, Math.floor(distance - best)), finished: distance >= COURSE.length, ...reward, local: true })
  }, RESULT_WAIT_MS)
}

/** END: stop right here. */
export function endRide() {
  if (!ride.active) return
  if (ride.phase === 'pull') {
    leaveSlingshot()
    return
  }
  if (ride.phase === 'ride') {
    ride.sim.v = 0
    stop()
  }
}

function showResult(result) {
  clearTimeout(resultTimer)
  later(() => {
    getGame().setResult(result)
    getGame().setPhase('result')
  })
}

/** The authority's results for the ride that just ended (ignored if they're about an earlier one). */
export function rideResult(result) {
  if (!ride.active || (result.id !== undefined && result.id !== ride.id)) return
  if (ride.phase === 'ride') stop()
  showResult(result)
}

/** CLAIM (or CLAIM 3x, after its ad): home to the lobby, the Coins flying to the counter. */
export async function claimResult(triple = false) {
  const game = getGame()
  const result = game.result
  if (!result) return
  if (triple) {
    const watched = await watchRewardedAd('triple-coins')
    if (!watched.ok) {
      if (watched.status !== 'skipped') game.showToast('No ad right now - try again soon!')
      return
    }
  }
  // Coins the server hasn't confirmed (it never answered) aren't flown home as if paid.
  if (result.local) {
    fadeThrough(() => finishRide(0))
    return
  }
  game.holdCoins(game.profile.coins - result.total)
  fadeThrough(() => finishRide(result.total))
}

/** The authority ended the ride itself (refused, timed out, reset) - this one, not an earlier one. */
export function rideEndedByServer(reason, id) {
  if (!ride.active || (id !== undefined && id !== ride.id)) return
  if (reason === 'refused') {
    getGame().showToast('Stand on the slingshot pad to ride!')
    fadeThrough(() => finishRide(0))
    return
  }
  if (ride.phase === 'ride') stop()
}

/**
 * Back in the lobby: on the boardwalk facing the slingshot, camera behind you -
 * dancing, with `coins` flying home to the HUD.
 */
export function finishRide(coins = 0) {
  clearTimers()
  ride.active = false
  ride.sim = null
  sfx.slideStop()
  sfx.rocketOff()
  sfx.stretch(0)
  runtime.focus = null
  const player = runtime.player
  player.position.set(RIDE_RETURN.x, 0, RIDE_RETURN.z)
  player.yaw = Math.PI
  player.frozen = false
  player.danceAt = coins > 0 ? performance.now() : 0
  if (coins > 0) {
    burst({ x: RIDE_RETURN.x, y: 1.4, z: RIDE_RETURN.z, count: 60, palette: 'confetti', speed: 8 })
    spawnPopup(`+${formatNumber(coins)}`, _at.set(RIDE_RETURN.x, 2.6, RIDE_RETURN.z), { iconUrl: COIN(), scale: 1.6, life: 2200, gradient: COIN_GRADIENT })
    setTimeout(() => flyCoins(coins), FLY_HOME_MS)
  } else {
    getGame().showCoins()
  }
  runtime.camera.mode = 'follow'
  runtime.camera.yaw = 0
  runtime.camera.snap = true
  const game = getGame()
  game.setResult(null)
  game.setPhase('lobby')
}

/**
 * Boxity's "Reset Character": straight back. On the slingshot or down the slide, that's
 * the lobby (a ride's banked); in the lobby, the spawn point.
 */
export function resetCharacter() {
  if (ride.active) {
    if (ride.phase === 'pull') leaveSlingshot()
    else if (ride.phase === 'ride') endRide()
    return
  }
  actions.respawn()
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = Math.PI
}

/** Speed as the speedometer shows it. */
export const speedMph = () => Math.round(ride.mph ?? 0)
