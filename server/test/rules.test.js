import assert from 'node:assert/strict'
import { test } from 'node:test'

import { COURSE, FIRST_SLED, GIFTS, nextRaceAt, RACE, ridePace, SLEDS, TRAILS, WORLD_SLEDS, WORLDS } from '../../shared/balance.js'
import { courseOf, FLOOR_HALF, rideLayout, stageAt, stageStart, WALL_PATTERNS, WALL_REACH, wallHeight } from '../../shared/course.js'
import {
  buyDiamondItem,
  buySled,
  buyTrail,
  buyUpgrade,
  claimFreeCoins,
  claimLogin,
  claimTask,
  claimTaskChest,
  collectAwayCoins,
  createProfile,
  dailyTasks,
  finishRide,
  grantAdReward,
  normalizeProfile,
  recordLogin,
  rideReward,
  upgradeCost,
  worldUnlocked,
} from '../../shared/logic.js'
import { RaceHost } from '../../shared/race.js'
import { createRide, maxRideSpeed, rideStats, stepRide } from '../../shared/ride.js'
import { PlayerSession } from '../../shared/session.js'
import { LAUNCH_PAD } from '../../shared/world.js'

const NOW = Date.UTC(2026, 9, 29, 12)

/** Rides a course hands-off until it stops; returns the ride. */
function rideOut(profile, world = 0) {
  const ride = createRide(rideStats(profile), courseOf(world), 1)
  for (let i = 0; i < 60 * 600 && !ride.done; i += 1) {
    stepRide(ride, { steer: 0, jump: false, rocket: false }, 1 / 60)
    ride.events.length = 0
  }
  return ride
}

function session(profile, at = LAUNCH_PAD) {
  const events = []
  const s = new PlayerSession(profile, { now: NOW, emit: (type, payload) => events.push([type, payload]), getPosition: () => ({ x: at.x, y: 0, z: at.z }) })
  return { s, events }
}

test('the course is the same every time, sorted, and inside the slide', () => {
  const a = courseOf(0)
  assert.equal(a, courseOf(0))
  assert.ok(a.coins.length > 100)
  for (let i = 1; i < a.coins.length; i += 1) assert.ok(a.coins[i].s >= a.coins[i - 1].s, 'coins sorted by s')
  for (const coin of a.coins) assert.ok(Math.abs(coin.x) < FLOOR_HALF && coin.s < a.length)
  assert.equal(wallHeight(0), 0)
  assert.ok(wallHeight(FLOOR_HALF + WALL_REACH) > 5)
  // Downhill all the way to the finish.
  assert.ok(a.baseHeight(a.length) < a.baseHeight(100))
})

test('a brand-new sled stops a hundred-odd metres down; better gear goes further', () => {
  const fresh = createProfile('a', 'A')
  const first = rideOut(fresh)
  assert.equal(first.done, 'stop')
  assert.ok(first.s > 60 && first.s < 400, `fresh ride ${first.s}`)
  const strong = createProfile('b', 'B')
  strong.upgrades.slingshot = 30
  strong.sled = WORLD_SLEDS.snowy[20]
  const far = rideOut(strong)
  assert.ok(far.s > first.s * 2, `upgraded ride ${far.s}`)
})

test('upgrades cost Coins (Diamonds for the rocket) and go up a level', () => {
  const p = createProfile('a', 'A')
  // The first levels are cheap (the first in a few rides); from level 4 the usual curve.
  assert.deepEqual(upgradeCost(p, 'slingshot'), { amount: 130, currency: 'coins' })
  assert.equal(buyUpgrade(p, 'slingshot').ok, false)
  p.coins = 1000
  assert.equal(buyUpgrade(p, 'slingshot').ok, true)
  assert.equal(p.upgrades.slingshot, 2)
  assert.equal(p.coins, 870)
  assert.deepEqual(upgradeCost({ upgrades: { slingshot: 4 } }, 'slingshot'), { amount: 880, currency: 'coins' })
  assert.equal(upgradeCost(p, 'rocket').currency, 'diamonds')
  p.diamonds = 2
  assert.equal(buyUpgrade(p, 'rocket').ok, true)
  assert.equal(p.diamonds, 0)
})

test('sleds are bought in order, and equip themselves', () => {
  const p = createProfile('a', 'A')
  const [, gold, diamond] = WORLD_SLEDS.snowy
  p.coins = 1000
  assert.equal(buySled(p, diamond).ok, false)
  assert.equal(buySled(p, gold).ok, true)
  assert.equal(p.sled, gold)
  assert.equal(p.coins, 1000 - SLEDS[gold].cost)
  assert.equal(SLEDS[gold].cost, 80)
  // Gold Rush's sleds need Gold Rush.
  assert.equal(buySled(p, WORLD_SLEDS.gold[0]).ok, false)
  // The premium ones only come from the Diamond shop.
  assert.equal(buySled(p, 'unicorn').ok, false)
})

test('trails cost Coins and add to every ride', () => {
  const p = createProfile('a', 'A')
  const plain = rideReward(p, { world: 0, distance: 200, pickups: 10 })
  p.coins = TRAILS.orange.cost
  assert.equal(buyTrail(p, 'orange').ok, true)
  assert.equal(p.trail, 'orange')
  const better = rideReward(p, { world: 0, distance: 200, pickups: 10 })
  assert.ok(better.total > plain.total)
})

test('a ride pays its Coins, records a best, and beating the slide opens the next world', () => {
  const p = createProfile('a', 'A')
  assert.equal(worldUnlocked(p, 1), false)
  const result = finishRide(p, { world: 0, distance: 150, pickups: 12 }, NOW)
  assert.equal(result.newBest, true)
  assert.equal(p.coins, result.total)
  assert.equal(p.best[0], 150)
  const done = finishRide(p, { world: 0, distance: WORLDS[0].length + 50, pickups: 0 }, NOW)
  assert.equal(done.finished, true)
  assert.equal(worldUnlocked(p, 1), true)
})

test('the session holds a ride to what its gear could do, and each coin to once', () => {
  const p = createProfile('a', 'A')
  const { s, events } = session(p)
  s.handle('startRide', {}, NOW)
  assert.equal(events.at(-1)[0], 'ride')
  // A tenth of a second in, nobody's 5 km down.
  s.handle('rideAt', { s: 5000, x: 0 }, NOW + 100)
  assert.ok(s.ride.s < 100)
  s.handle('rideAt', { s: 120, x: 0 }, NOW + 20000)
  const coin = courseOf(0).coins[0]
  s.handle('collectCoin', { index: coin.index }, NOW + 20000)
  s.handle('collectCoin', { index: coin.index }, NOW + 20000)
  // A coin far beyond where the ride has got isn't taken.
  s.handle('collectCoin', { index: courseOf(0).coins.at(-1).index }, NOW + 20000)
  s.handle('endRide', { s: 120 }, NOW + 21000)
  const result = events.find(([type]) => type === 'rideResult')[1]
  assert.equal(result.picked, 1)
  assert.equal(result.distance, 120)
  assert.equal(s.ride, null)
})

test('no riding from the other end of the plaza', () => {
  const { s, events } = session(createProfile('a', 'A'), { x: 30, z: 30 })
  s.handle('startRide', {}, NOW)
  assert.equal(s.ride, null)
  assert.deepEqual(events.at(-1), ['rideEnd', { reason: 'refused', id: 0 }])
})

test('CLAIM 3x pays the last ride twice more, once, soon after', () => {
  const p = createProfile('a', 'A')
  const ride = finishRide(p, { world: 0, distance: 200, pickups: 10 }, NOW)
  assert.equal(grantAdReward(p, 'triple-coins', NOW + 1000).coins, ride.total * 2)
  assert.equal(p.coins, ride.total * 3)
  assert.equal(grantAdReward(p, 'triple-coins', NOW + 2000).ok, false)
  finishRide(p, { world: 0, distance: 200, pickups: 10 }, NOW)
  assert.equal(grantAdReward(p, 'triple-coins', NOW + 60 * 60 * 1000).ok, false)
})

test('daily tasks: three a day, Diamonds when done, and the chest after all three', () => {
  const p = createProfile('a', 'A')
  const list = dailyTasks(p, NOW)
  assert.equal(list.length, 3)
  assert.equal(new Set(list.map((t) => t.kind)).size, 3)
  assert.equal(claimTask(p, 0, NOW).ok, false)
  for (const task of list) task.progress = task.goal
  for (let i = 0; i < 3; i += 1) assert.equal(claimTask(p, i, NOW).ok, true)
  assert.ok(p.diamonds > 0)
  assert.equal(claimTaskChest(p, NOW).ok, true)
  assert.equal(claimTaskChest(p, NOW).ok, false)
  // A new day, new tasks.
  dailyTasks(p, NOW + 24 * 60 * 60 * 1000)
  assert.ok(p.tasks.list.every((t) => !t.claimed))
})

test('gifts open with playtime, CLAIM ALL takes every ready one, and a rejoin never resets them', () => {
  const p = createProfile('a', 'A')
  const { s, events } = session(p)
  s.handle('claimGift', { index: 0 }, NOW)
  assert.equal(p.coins, 0)
  // Five minutes of play.
  for (let t = 1; t <= 50; t += 1) s.tick(6, NOW + t * 6000)
  s.handle('claimAllGifts', {}, NOW + 5 * 60 * 1000)
  const ready = GIFTS.filter((g) => g.minutes <= 5).length
  assert.equal(p.gifts.claimed.length, ready)
  assert.ok(p.coins > 0 && p.diamonds > 0)
  assert.equal(events.filter(([type]) => type === 'reward').length, 1)
  // Refresh: a new session, same save - the gifts carry on, none to claim twice.
  const again = session(p)
  again.s.handle('claimGift', { index: 0 }, NOW + 6 * 60 * 1000)
  assert.equal(p.gifts.claimed.length, ready)
  // A new day starts them over.
  again.s.tick(1, NOW + 86400000)
  assert.deepEqual(p.gifts.claimed, [])
})

test('a fast sled keeps the coins it picks up between position reports', () => {
  const p = createProfile('a', 'A')
  p.upgrades.slingshot = 80
  const { s, events } = session(p)
  s.handle('startRide', { id: 1 }, NOW)
  // The last report was at 0 m, but the sled is 200 m down: the pickups say so.
  const coin = courseOf(0).coins.find((c) => c.s > 150 && c.s < 250)
  s.handle('collectCoin', { index: coin.index, s: coin.s }, NOW + 4000)
  s.handle('endRide', { s: coin.s + 5, id: 1 }, NOW + 4500)
  const result = events.find(([type]) => type === 'rideResult')[1]
  assert.equal(result.picked, 1)
  assert.equal(result.id, 1)
})

test('a lost end is banked when the next ride starts; a late end for an old ride is ignored', () => {
  const p = createProfile('a', 'A')
  const { s, events } = session(p)
  s.handle('startRide', { id: 1 }, NOW)
  s.handle('rideAt', { s: 120, x: 0 }, NOW + 15000)
  // Its endRide never arrived: the next ride banks it first.
  s.handle('startRide', { id: 2 }, NOW + 20000)
  const first = events.filter(([type]) => type === 'rideResult')
  assert.equal(first.length, 1)
  assert.equal(first[0][1].id, 1)
  assert.equal(p.stats.rides, 1)
  // A stray end for ride 1 doesn't end ride 2.
  s.handle('endRide', { s: 130, id: 1 }, NOW + 21000)
  assert.equal(s.ride.id, 2)
})

test('free coins need a Boxity account; the Diamond shop sells for Diamonds only', () => {
  const p = createProfile('a', 'A')
  assert.equal(claimFreeCoins(p, false).ok, false)
  assert.equal(claimFreeCoins(p, true).coins, 5000)
  assert.equal(claimFreeCoins(p, true).ok, false)
  // Not enough Diamonds: nothing happens.
  assert.equal(buyDiamondItem(p, 'sled_orca').ok, false)
  assert.equal(p.sled, FIRST_SLED)
  p.diamonds = 2000
  assert.equal(buyDiamondItem(p, 'coins_small').coins, 1500)
  assert.equal(buyDiamondItem(p, 'sled_orca').sled, 'orca')
  assert.equal(p.sled, 'orca')
  assert.equal(p.diamonds, 2000 - 15 - 450)
  // A sled you have is just worn again, never bought twice.
  assert.equal(buyDiamondItem(p, 'sled_orca').ok, true)
  assert.equal(p.diamonds, 2000 - 15 - 450)
  assert.equal(buyDiamondItem(p, 'world_gold').world, 1)
  assert.equal(worldUnlocked(p, 1), true)
  assert.equal(buyDiamondItem(p, 'world_gold').ok, false)
  assert.equal(buyDiamondItem(p, 'nope').ok, false)
})

test('an old Muscle-and-Wins save starts over as a fresh sledder', () => {
  const p = normalizeProfile({ v: 1, muscle: 500, wins: 9000, rebirths: 3 }, 'a', 'A')
  assert.equal(p.coins, 0)
  assert.equal(p.sled, FIRST_SLED)
  assert.equal(p.rebirths, undefined)
  assert.equal(p.wins, undefined)
})

test('the login streak: a prize a day in a row, day 7 the Aurora trail, back to day 1 after a missed day', () => {
  const day = 86400000
  const p = createProfile('a', 'A')
  assert.equal(recordLogin(p, NOW), true)
  assert.equal(p.login.streak, 1)
  assert.equal(recordLogin(p, NOW + 1000), false)
  assert.equal(claimLogin(p, NOW).coins, 250)
  assert.equal(claimLogin(p, NOW).ok, false)
  for (let d = 1; d < 6; d += 1) {
    recordLogin(p, NOW + d * day)
    assert.equal(claimLogin(p, NOW + d * day).ok, true)
  }
  recordLogin(p, NOW + 6 * day)
  assert.equal(p.login.streak, 7)
  const seventh = claimLogin(p, NOW + 6 * day)
  assert.equal(seventh.trail, 'aurora')
  assert.equal(p.trail, 'aurora')
  // Can't be bought, only won.
  assert.equal(buyTrail(createProfile('b', 'B'), 'aurora').ok, false)
  // Missing a day starts it over.
  recordLogin(p, NOW + 9 * day)
  assert.equal(p.login.streak, 1)
})

test('INCOME keeps paying while you are away - not for a short break, and at most 8 hours', () => {
  const p = createProfile('a', 'A')
  p.lastSeen = NOW - 5 * 60000
  assert.equal(collectAwayCoins(p, NOW), null)
  p.lastSeen = NOW - 60 * 60000
  assert.equal(collectAwayCoins(p, NOW).coins, 120)
  p.lastSeen = NOW - 3 * 86400000
  p.upgrades.income = 11
  assert.equal(collectAwayCoins(p, NOW).coins, Math.floor(480 * 2 * 2))
  // A session greets with it once.
  const q = createProfile('c', 'C')
  q.lastSeen = NOW - 30 * 60000
  const events = []
  const s = new PlayerSession(q, { now: NOW, emit: (type, payload) => events.push([type, payload]), getPosition: () => ({ x: 0, y: 0, z: 0 }) })
  s.greet()
  s.greet()
  assert.deepEqual(events, [['away', { coins: 60, minutes: 30 }]])
  assert.equal(q.login.claimed, false)
})

test('each stage has a gate and its own wall pattern: middle, both sides, or left and right by turns', () => {
  for (let w = 0; w < WORLDS.length; w += 1) {
    const course = courseOf(w)
    assert.deepEqual(course.arches.slice(0, 2), [stageStart(1), stageStart(2)])
    assert.ok(stageStart(1) < 150, 'Stage 2 within a first ride')
    for (const wall of course.walls) {
      const pattern = WALL_PATTERNS[stageAt(wall.s) % WALL_PATTERNS.length]
      const row = course.walls.filter((other) => other.s === wall.s)
      if (pattern === 'middle') assert.ok(row.length === 1 && wall.x === 0)
      else if (pattern === 'sides') assert.ok(row.length === 2 && Math.abs(wall.x) > 3)
      else assert.ok(row.length === 1 && Math.abs(wall.x) === FLOOR_HALF - 4.6)
      // Every wall leaves a way through on the floor.
      const blocked = (x) => row.some((other) => Math.abs(x - other.x) < other.half)
      let open = false
      for (let x = -FLOOR_HALF + 1; x <= FLOOR_HALF - 1; x += 0.5) open ||= !blocked(x)
      assert.ok(open, `wall at ${wall.s}m blocks the whole floor`)
    }
  }
})

test('World 3, Lava Volcano: opened by beating Gold Rush or with Diamonds, its own sleds, a faster pace', () => {
  const p = createProfile('lava', 'Lava')
  assert.equal(worldUnlocked(p, 2), false)
  p.beaten.push(1)
  assert.equal(worldUnlocked(p, 2), true)
  const q = createProfile('lava2', 'Lava2')
  q.diamonds = 2000
  assert.equal(buyDiamondItem(q, 'world_lava').world, 2)
  assert.equal(worldUnlocked(q, 2), true)
  assert.equal(WORLD_SLEDS.lava.length, 20)
  assert.ok(SLEDS[WORLD_SLEDS.lava[0]].glide > SLEDS[WORLD_SLEDS.gold[WORLD_SLEDS.gold.length - 1]].glide - 1)
  // The server's speed cap keeps up with each world's pace.
  const stats = rideStats(p)
  assert.ok(maxRideSpeed(stats, WORLDS[2]) > maxRideSpeed(stats, WORLDS[0]))
  assert.equal(maxRideSpeed(stats, WORLDS[2]) / maxRideSpeed(stats, WORLDS[0]), ridePace(WORLDS[2]) / ridePace(WORLDS[0]))
})

test('every ride lays its coins and boost pads out a little differently, at the same metres', () => {
  const course = courseOf(0)
  assert.equal(rideLayout(course, 0), course)
  const a = rideLayout(course, 101)
  const b = rideLayout(course, 202)
  assert.equal(a.coins.length, course.coins.length)
  let moved = 0
  a.coins.forEach((coin, i) => {
    assert.equal(coin.s, course.coins[i].s)
    assert.equal(coin.index, course.coins[i].index)
    assert.ok(Math.abs(coin.x) <= FLOOR_HALF - 1 || coin.h > 1.5)
    if (coin.x !== b.coins[i].x) moved += 1
  })
  assert.ok(moved > course.coins.length / 4, 'two rides should look different')
  a.boosts.forEach((pad, i) => assert.equal(pad.s, course.boosts[i].s))
  // The same variant (a race's) lays everyone's out the same.
  assert.deepEqual(rideLayout(course, 101).coins, a.coins)
})

test('a race: join in the window, all start together on the race sled, the top three win Diamonds', () => {
  const host = new RaceHost()
  const start = nextRaceAt(NOW) // on the clock
  const members = new Map()
  const make = (id, name) => {
    const events = []
    const profile = createProfile(id, name)
    const s = new PlayerSession(profile, { now: NOW, emit: (type, payload) => events.push([type, payload]), getPosition: () => ({ x: 0, y: 0, z: 0 }) })
    s.onRaceStart = (raceId) => host.started(id, raceId)
    s.onRaceEnd = (raceId, dist) => host.finished(id, raceId, dist)
    const member = { name, session: s, send: (type, payload) => events.push([type, payload]) }
    members.set(id, member)
    return { s, events, profile, member }
  }
  const a = make('a', 'Ann')
  const b = make('b', 'Bob')
  const c = make('c', 'Cat')
  // Too early: no window yet.
  host.join('a', a.member, start - RACE.joinMs - 1000, members)
  assert.equal(a.events.at(-1)[0], 'raceRefused')
  host.tick(start - RACE.joinMs + 10, members)
  for (const [id, m] of [['a', a], ['b', b]]) host.join(id, m.member, start - 5000, members)
  host.tick(start + 1, members)
  // The two who joined were started; the third wasn't.
  assert.ok(a.events.some(([t]) => t === 'raceGo'))
  assert.ok(!c.events.some(([t]) => t === 'raceGo'))
  // A race ride needs no launch pad, and goes at the race sled's pace.
  a.s.handle('startRide', { id: 1, race: start }, start + 100)
  b.s.handle('startRide', { id: 1, race: start }, start + 100)
  assert.ok(a.s.ride?.race === start && b.s.ride?.race === start)
  a.s.handle('rideAt', { s: 400, x: 0 }, start + 30000)
  b.s.handle('rideAt', { s: 300, x: 0 }, start + 30000)
  const diamondsBefore = a.profile.diamonds
  a.s.handle('endRide', { s: 400, id: 1 }, start + 31000)
  b.s.handle('endRide', { s: 300, id: 1 }, start + 31000)
  host.tick(start + 31100, members)
  const result = a.events.find(([t]) => t === 'raceResult')?.[1]
  assert.equal(result.place, 1)
  assert.equal(result.prize, RACE.prizes[0])
  assert.equal(a.profile.diamonds, diamondsBefore + RACE.prizes[0])
  assert.equal(b.events.find(([t]) => t === 'raceResult')[1].place, 2)
  // A race ride sets no best.
  assert.equal(a.profile.best[0] ?? 0, 0)
})
