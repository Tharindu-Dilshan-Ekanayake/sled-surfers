import {
  AIR_DRAG,
  BOOST_SPEED,
  GRAVITY,
  JUMP_SPEED,
  launchSpeed,
  ROCKET,
  rocketCans,
  rocketThrust,
  SLEDS,
  FIRST_SLED,
  SMASH_KEEP,
  ridePace,
  SNOW_DRAG,
  STEER_PER_SPEED,
  STEER_SPEED,
  STOP_SECONDS,
  STOP_SPEED,
} from './balance.js'
import { FLOOR_HALF, RIDE_HALF, RUN_OUT, wallSlope } from './course.js'

/**
 * A sled ride down a course (course.js), as a pure step function: the client calls
 * `stepRide` every frame with that frame's input; the very same maths runs in tests
 * and in the balancing simulation. No three.js, no DOM, no allocation per step.
 *
 * State is along the slide: `s` metres down it, `x` across, `y` the height of the sled
 * (on the floor, or above it in the air), `v` speed down the slide, `vx` across, `vy`
 * up. Things that happen (a coin, a boost, a smash, a jump...) are pushed onto
 * `ride.events` as `[type, index]` for whoever's watching to drain.
 */

/** What your gear makes of a ride. */
export function rideStats(profile) {
  const up = profile.upgrades ?? {}
  const sled = SLEDS[profile.sled] ?? SLEDS[FIRST_SLED]
  return {
    launch: launchSpeed(up.slingshot ?? 1),
    glide: sled.glide,
    cans: rocketCans(up.rocket ?? 1),
    thrust: rocketThrust(up.rocket ?? 1),
    burn: ROCKET.burn,
  }
}

/**
 * The fastest a ride with these stats could ever go in `world` (real m/s: its pace included),
 * with room to spare: what the server holds reported progress to.
 */
export const maxRideSpeed = (stats, world) => (stats.launch * 1.6 + stats.thrust * stats.burn * 1.5 + BOOST_SPEED * 3 + 40) * ridePace(world)

/** A new ride with `stats`, launched with `power` (0-1) of a full pull. */
export function createRide(stats, course, power = 1) {
  const p = Math.min(1, Math.max(0.25, power))
  return {
    stats,
    course,
    s: 0,
    x: 0,
    y: course.groundAt(0, 0),
    v: stats.launch * p,
    vx: 0,
    vy: 0,
    airborne: false,
    /** Seconds in the air this hop, and whether SPACE has been let go since the last jump. */
    airTime: 0,
    jumpArmed: true,
    /** Rocket: cans left (not counting the one loaded), what's left of the loaded one (0-1), burning now. */
    cans: stats.cans - 1,
    fuel: 1,
    burning: false,
    /** Time spent nearly stopped, and whether the ride is over ('stop' or 'finish'). */
    still: 0,
    done: null,
    time: 0,
    best: 0,
    taken: { coins: new Set(), boosts: new Set(), walls: new Set(), diamonds: new Set() },
    /** Where each kind of feature was last looked at from: the lists are walked forwards. */
    cursor: { coins: 0, boosts: 0, walls: 0, diamonds: 0 },
    events: [],
    smashes: 0,
    boosts: 0,
  }
}

/** Steps along `list` (sorted by s) from `ride.cursor[key]`, calling `hit(item)` for each within [a, b]. */
function sweep(ride, key, list, a, b, hit) {
  let i = ride.cursor[key]
  while (i < list.length && list[i].s < a - 8) i += 1
  ride.cursor[key] = i
  for (let j = i; j < list.length && list[j].s <= b; j += 1) hit(list[j])
}

/**
 * Advances `ride` by `seconds` of real time (its world's ridePace times as much ride time).
 * `input` is `{ steer: -1..1, jump: bool, rocket: bool }`.
 */
export function stepRide(ride, input, seconds) {
  if (ride.done) return ride
  const { course, stats } = ride
  const end = course.length
  const dt = seconds * ridePace(course.world)
  ride.time += seconds
  const s0 = ride.s

  // --- Along the slide ---------------------------------------------------------------
  let a = 0
  if (!ride.airborne) {
    a += GRAVITY * course.gradeAt(ride.s)
    // Snow drag (heavier in later worlds) doesn't pull you backwards: it only ever slows you to a stop.
    a -= (SNOW_DRAG * (course.world.snow ?? 1)) / stats.glide
  }
  a -= AIR_DRAG * ride.v * ride.v

  // The rocket: SHIFT lights the loaded can, and it burns while held until it's empty;
  // then the next is loaded.
  const wantRocket = Boolean(input.rocket) && (ride.fuel > 0 || ride.cans > 0)
  if (wantRocket && ride.fuel <= 0) {
    ride.cans -= 1
    ride.fuel = 1
  }
  if (wantRocket) {
    if (!ride.burning) ride.events.push(['rocket', 1])
    ride.burning = true
    ride.fuel = Math.max(0, ride.fuel - dt / stats.burn)
    a += stats.thrust
    if (ride.fuel <= 0 && ride.cans > 0) {
      ride.cans -= 1
      ride.fuel = 1
    }
  } else if (ride.burning) {
    ride.burning = false
    ride.events.push(['rocket', 0])
  }

  ride.v = Math.max(0, ride.v + a * dt)
  // Past the finish, the run-out brakes you to a halt in front of the flag.
  if (ride.s > end) ride.v = Math.max(0, ride.v - 9 * dt)
  ride.s += ride.v * dt

  // --- Across: steering, and the walls pushing you back down to the floor --------------
  const steer = Math.max(-1, Math.min(1, input.steer || 0))
  const steerSpeed = STEER_SPEED + STEER_PER_SPEED * Math.min(ride.v, 40)
  const target = steer * steerSpeed
  ride.vx += (target - ride.vx) * (1 - Math.exp(-(ride.airborne ? 2 : 7) * dt))
  if (!ride.airborne) ride.vx -= GRAVITY * 0.55 * wallSlope(ride.x) * dt
  ride.x += ride.vx * dt
  if (Math.abs(ride.x) > RIDE_HALF) {
    ride.x = Math.sign(ride.x) * RIDE_HALF
    ride.vx = 0
  }

  // --- Up and down: the floor, kickers, jumps ------------------------------------------
  const ground = course.groundAt(ride.s, ride.x)
  if (!input.jump) ride.jumpArmed = true
  if (!ride.airborne && input.jump && ride.jumpArmed) {
    ride.jumpArmed = false
    ride.airborne = true
    ride.airTime = 0
    ride.vy = JUMP_SPEED
    ride.events.push(['jump', 0])
  }
  if (ride.airborne) {
    ride.airTime += dt
    ride.vy -= GRAVITY * dt
    ride.y += ride.vy * dt
    if (ride.y <= ground) {
      ride.y = ground
      ride.airborne = false
      ride.events.push(['land', Math.min(1, -ride.vy / 14)])
      // Down the slope with it, as the floor falls away. (Set to 0, the very next step
      // found the floor gone from under you and threw you off again: a hop every few
      // metres all the way down, and the camera shaking with it.)
      ride.vy = -course.gradeAt(ride.s) * ride.v
    }
  } else {
    // Following the floor; if it drops away faster than gravity can pull you down
    // (the lip of a kicker), you fly.
    const falling = ride.y + ride.vy * dt - 0.5 * GRAVITY * dt * dt
    if (falling > ground + 0.05 && ride.vy > -1) {
      ride.airborne = true
      ride.airTime = 0
      ride.y = falling
      ride.vy -= GRAVITY * dt
    } else {
      ride.vy = (ground - ride.y) / Math.max(dt, 1e-4)
      ride.y = ground
    }
  }

  // --- What's along the way ------------------------------------------------------------
  const s1 = ride.s
  const floor = course.groundAt(s1, ride.x)
  const h = ride.y - floor
  sweep(ride, 'coins', course.coins, s0, s1 + 0.9, (coin) => {
    if (ride.taken.coins.has(coin.index)) return
    if (Math.abs(coin.x - ride.x) > 1.5 || Math.abs(coin.h - (h + 0.7)) > 1.7) return
    ride.taken.coins.add(coin.index)
    ride.events.push(['coin', coin.index])
  })
  sweep(ride, 'diamonds', course.diamonds, s0, s1 + 1, (gem) => {
    if (ride.taken.diamonds.has(gem.index) || Math.abs(gem.x - ride.x) > 2.4 || h > 3.4) return
    ride.taken.diamonds.add(gem.index)
    ride.events.push(['diamond', gem.index])
  })
  if (!ride.airborne || h < 0.4) {
    sweep(ride, 'boosts', course.boosts, s0 - 4.5, s1, (pad) => {
      if (ride.taken.boosts.has(pad.index) || s1 < pad.s - pad.length / 2 || s0 > pad.s + pad.length / 2) return
      if (Math.abs(ride.x - pad.x) > pad.half + 0.6) return
      ride.taken.boosts.add(pad.index)
      ride.v += BOOST_SPEED
      ride.boosts += 1
      ride.events.push(['boost', pad.index])
    })
  }
  sweep(ride, 'walls', course.walls, s0 - 0.5, s1 + 0.6, (wall) => {
    if (ride.taken.walls.has(wall.index) || s0 > wall.s + 0.5 || s1 < wall.s - 0.6) return
    if (Math.abs(ride.x - wall.x) > wall.half + 0.7 || h > wall.height - 0.2) return
    ride.taken.walls.add(wall.index)
    ride.v *= SMASH_KEEP
    ride.smashes += 1
    ride.events.push(['smash', wall.index])
  })

  ride.best = Math.max(ride.best, Math.min(ride.s, end))

  // --- The end ---------------------------------------------------------------------------
  if (ride.s >= end && !ride.finished) {
    ride.finished = true
    ride.events.push(['finish', 0])
  }
  if (ride.s >= end + RUN_OUT - 20) ride.v = 0
  ride.still = !ride.airborne && ride.v < STOP_SPEED ? ride.still + dt : 0
  if (ride.still >= STOP_SECONDS) ride.done = ride.finished ? 'finish' : 'stop'
  return ride
}

/** Whether metre s, `x` across, is on the flat floor (not up a wall). */
export const onFloor = (x) => Math.abs(x) <= FLOOR_HALF
