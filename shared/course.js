import { COURSE, WORLDS } from './balance.js'
import { hash2, mulberry32 } from './rng.js'

/**
 * Each world's slide: the shape of the run down the mountain and everything along it.
 *
 * The slide runs straight north (-Z) from the slingshot. Track metre `s` is horizontal
 * distance from the launch line - the metres the HUD counts. The floor drops away as
 * the mountain does: a steep first drop off the slingshot, then a long run that slowly
 * flattens out, so every ride ends somewhere and getting further takes better gear.
 *
 * Across the slide is a half-pipe: a flat floor FLOOR_HALF either side of the middle,
 * then walls that curve up to the rim (wallHeight). Along it: lines of Coins, boost pads,
 * brick walls to smash, snow kickers to fly off, and a big Diamond at each milestone.
 *
 * Seeded by the world, so every client and the server build the very same course and
 * agree on every coin. Pure data and maths: no three.js, no DOM.
 */

/** Half the flat floor's width, the wall's reach past it, and the rim's height. */
export const FLOOR_HALF = 10
export const WALL_REACH = 6.4
export const RIM_HEIGHT = 6.4
/** How far out a sled can ride up the walls. */
export const RIDE_HALF = FLOOR_HALF + WALL_REACH - 0.6
/** The flat start by the slingshot, and the big first drop after it. */
export const START_FLAT = 14
const FIRST_DROP = { length: 34, grade: 0.34 }
/** The grade the slide eases from and towards, and how fast (in metres) it gets there. */
const GRADE_START = 0.13
const GRADE_END = 0.035
const GRADE_DECAY = 1500
/** Past the finish the slide runs on flat and level into the finish area. */
export const RUN_OUT = 160
/** Height samples per metre. */
const RES = 1

/** Height of a wall above the floor at `u` metres out from the middle (0 on the floor). */
export function wallHeight(u) {
  const a = Math.abs(u)
  if (a <= FLOOR_HALF) return 0
  const t = Math.min(1, (a - FLOOR_HALF) / WALL_REACH)
  return RIM_HEIGHT * t * t
}

/** Steepness of the wall at `u` (rise per metre out), signed with `u`. */
export function wallSlope(u) {
  const a = Math.abs(u)
  if (a <= FLOOR_HALF) return 0
  const t = Math.min(1, (a - FLOOR_HALF) / WALL_REACH)
  return Math.sign(u) * ((2 * RIM_HEIGHT * t) / WALL_REACH)
}

const smooth = (t) => t * t * (3 - 2 * t)

/** Where stage `i` (0, 1, ...) starts: COURSE.stageStarts, then one every COURSE.stageLength. */
export function stageStart(i) {
  const starts = COURSE.stageStarts
  if (i < starts.length) return starts[Math.max(0, i)]
  return starts[starts.length - 1] + (i - starts.length + 1) * COURSE.stageLength
}

/** Which stage (0, 1, ...) metre s is in. */
export function stageAt(s) {
  const starts = COURSE.stageStarts
  const last = starts.length - 1
  if (s >= starts[last]) return last + Math.floor((s - starts[last]) / COURSE.stageLength)
  let i = 0
  while (i < last && s >= starts[i + 1]) i += 1
  return i
}

/**
 * Each stage's brick walls, by turns: one across the MIDDLE (round it either side), a
 * pair at the SIDES (through the gap in the middle), or left and right by turns (ZIGZAG).
 */
export const WALL_PATTERNS = ['zigzag', 'middle', 'sides']

/**
 * Snow kickers: over `length` metres the floor rises `height` above the slope, then
 * drops straight back at the lip - fast, and you fly.
 */
const KICKER = { length: 7, height: 1.5 }

function makeHeights(world, rand, length) {
  const n = Math.ceil((length + RUN_OUT) * RES) + 2
  const heights = new Float32Array(n)
  // Sections of a little steeper or flatter than the trend, eased into each other.
  const sections = []
  for (let s = START_FLAT + FIRST_DROP.length; s < length + RUN_OUT; ) {
    const len = 70 + rand() * 130
    sections.push({ from: s, to: s + len, k: 0.7 + rand() * 0.6 })
    s += len
  }
  let si = 0
  let y = 0
  let k = 1
  for (let i = 1; i < n; i += 1) {
    const s = i / RES
    let grade
    if (s <= START_FLAT) grade = 0
    else if (s <= START_FLAT + FIRST_DROP.length) grade = FIRST_DROP.grade * smooth(Math.min(1, (s - START_FLAT) / 8))
    else if (s >= length) grade = s >= length + 30 ? 0 : GRADE_END * (1 - (s - length) / 30)
    else {
      while (si < sections.length - 1 && s > sections[si].to) si += 1
      k += (sections[si].k - k) * 0.03
      const trend = GRADE_END + (GRADE_START - GRADE_END) * Math.exp(-(s - START_FLAT - FIRST_DROP.length) / GRADE_DECAY)
      grade = trend * k
    }
    y -= grade / RES
    heights[i] = y
  }
  return heights
}

/** Every world's course, built once on first use. */
const cache = new Map()

/** World `index`'s course (see the file comment). */
export function courseOf(index) {
  if (cache.has(index)) return cache.get(index)
  const world = WORLDS[index] ?? WORLDS[0]
  const rand = mulberry32(world.seed * 7919 + 13)
  const length = world.length
  const heights = makeHeights(world, rand, length)

  const coins = []
  const boosts = []
  const walls = []
  const kickers = []
  const diamonds = COURSE.diamonds.filter((s) => s < length).map((s, index) => ({ index, s, x: 0, h: 1.6 }))
  const busy = (s, reach) => diamonds.some((d) => Math.abs(d.s - s) < reach) || kickers.some((k) => s > k.s - KICKER.length - reach && s < k.s + 14 + reach)

  /** The four lanes coins and pads line up in, across the floor. */
  const LANES = [-6.6, -2.2, 2.2, 6.6]
  const lane = () => LANES[Math.floor(rand() * LANES.length)]
  let lastKicker = -1000
  for (let s = START_FLAT + COURSE.from; s < length - 20; s += COURSE.every * (0.75 + rand() * 0.6)) {
    if (busy(s, 6)) continue
    const r = rand()
    if (s > 160 && s - lastKicker > 130 && r < 0.12) {
      // A kicker right across the floor, and a reward line in the air past its lip.
      kickers.push({ index: kickers.length, s: s + KICKER.length, length: KICKER.length, height: KICKER.height })
      lastKicker = s
      const x = lane() * 0.6
      for (let k = 0; k < 4; k += 1) coins.push({ index: coins.length, s: s + KICKER.length + 6 + k * 2.6, x, h: 2.6 + Math.sin((k / 3) * Math.PI) * 1.2 })
      s += 18
    } else if (r < 0.62) {
      // A line of coins down a lane, now and then weaving across.
      const x0 = lane()
      const weave = rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) * 3 : 0
      for (let k = 0; k < COURSE.coinLine; k += 1) {
        const t = k / (COURSE.coinLine - 1)
        const x = Math.max(-FLOOR_HALF + 1, Math.min(FLOOR_HALF - 1, x0 + weave * t))
        coins.push({ index: coins.length, s: s + k * COURSE.coinSpacing, x, h: 1.0 })
      }
    } else if (r < 0.8) {
      const wide = rand() < 0.12
      boosts.push({ index: boosts.length, s, x: wide ? 0 : lane() * 0.85, half: wide ? FLOOR_HALF - 0.6 : 2.6, length: 4.5 })
    } else if (s > 60 && Math.abs(s - stageStart(stageAt(s))) > 14) {
      // Brick walls across the floor, in the stage's pattern: smash them (it slows you)
      // or steer through the gap.
      const pattern = WALL_PATTERNS[stageAt(s) % WALL_PATTERNS.length]
      if (pattern === 'middle') walls.push({ index: walls.length, s, x: 0, half: 4.4, height: 2.6 })
      else if (pattern === 'sides') for (const side of [-1, 1]) walls.push({ index: walls.length, s, x: side * 6.6, half: 3.4, height: 2.6 })
      else walls.push({ index: walls.length, s, x: (rand() < 0.5 ? 1 : -1) * (FLOOR_HALF - 4.6), half: 4.4, height: 2.6 })
    }
  }

  const signs = []
  for (let s = COURSE.signEvery; s < length; s += COURSE.signEvery) signs.push(s)
  /** A gate over the slide at the start of every stage after the first. */
  const arches = []
  for (let i = 1; stageStart(i) < length; i += 1) arches.push(stageStart(i))

  /** Height of the slope (no kickers) at metre s. */
  const baseHeight = (s) => {
    if (s <= 0) return 0
    const f = s * RES
    const i = Math.min(heights.length - 2, Math.floor(f))
    const t = Math.min(1, f - i)
    return heights[i] + (heights[i + 1] - heights[i]) * t
  }

  /** How far a kicker lifts the floor at metre s (0 off them). */
  const kickerLift = (s) => {
    for (const k of kickers) {
      if (s > k.s - k.length && s <= k.s) return k.height * ((s - (k.s - k.length)) / k.length) ** 1.4
      if (k.s > s + 40) break
    }
    return 0
  }

  const course = {
    index,
    world,
    length,
    /** Floor height at metre s, `x` across: the slope, its kickers, and up the walls. */
    groundAt: (s, x) => baseHeight(s) + wallHeight(x) + (Math.abs(x) < FLOOR_HALF + 0.3 ? kickerLift(s) : 0),
    baseHeight,
    kickerLift,
    /** Downhill grade at metre s (positive going down). */
    gradeAt: (s) => baseHeight(s) - baseHeight(s + 1),
    coins,
    boosts,
    walls,
    kickers,
    diamonds,
    signs,
    arches,
    /** Coins on the whole slide. */
    coinCount: coins.length,
  }
  cache.set(index, course)
  return course
}

/**
 * A ride's own Coins and boost pads: the course's, each 40 m stretch of them mirrored
 * and/or slid a lane across by `variant` (0 = as built), so no two rides look alike.
 * Only across: everything stays at its metre - all the server checks - and the walls,
 * kickers and Diamonds stay put. Coins in the air off a kicker and full-width pads keep
 * their places.
 */
export function rideLayout(course, variant) {
  if (!variant) return course
  const across = (x, s, reach) => {
    const h = hash2(Math.floor(s / 40), 17, variant)
    const flip = h < 0.5 ? -1 : 1
    const shift = ((Math.floor(h * 6) % 3) - 1) * 2.2
    const limit = FLOOR_HALF - 1 - reach
    return Math.max(-limit, Math.min(limit, flip * x + shift))
  }
  return {
    ...course,
    variant,
    coins: course.coins.map((c) => (c.h > 1.5 ? c : { ...c, x: across(c.x, c.s, 0) })),
    boosts: course.boosts.map((b) => (b.half > 5 ? b : { ...b, x: across(b.x, b.s, b.half - 1) })),
  }
}

/** Indices of the features in `list` (sorted by s) between metres a and b. */
export function featuresBetween(list, a, b, out = []) {
  out.length = 0
  let lo = 0
  let hi = list.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (list[mid].s < a) lo = mid + 1
    else hi = mid
  }
  for (let i = lo; i < list.length && list[i].s <= b; i += 1) out.push(i)
  return out
}
