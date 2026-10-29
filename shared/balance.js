/**
 * Every tunable number in Sled Surfers. Rules live in logic.js; this file is only data,
 * so balancing never means touching code.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 *
 * Two currencies, both earned in the game and nothing else: Coins (gold, from every ride)
 * and Diamonds (blue, from daily tasks, gifts, the login streak and the diamonds along the
 * slide). Nothing is sold for Bloxity Gems: the coin packs, the premium sleds and the
 * Gold Rush shortcut are all bought with Diamonds (DIAMOND_SHOP).
 */

// --- The ride ---------------------------------------------------------------------------

/** m/s per mph, for the speedometer. */
export const MPH = 2.23694
/**
 * How fast a ride plays out: the slide's physics runs this many times real time. The
 * same course, the same coins and the same distances - just less sitting and watching.
 * Every speed and time below is in that sped-up "ride time"; the speedometer shows
 * the real speed (x RIDE_PACE).
 */
export const RIDE_PACE = 2.8
/**
 * What the speedometer counts in: ride speed times this (and the world's pace), not the
 * full RIDE_PACE - the slide flies past, and the numbers stay believable (about 100 mph
 * well into World 1).
 */
export const SPEEDO_PACE = 2.5
/** Ride speed (m/s) as the speedometer shows it, in `world`. */
export const speedoSpeed = (v, world) => v * SPEEDO_PACE * (world?.pace ?? 1)
/** A world's pace: later worlds' longer slides play faster still (WORLDS pace), so rides there stay short. */
export const ridePace = (world) => RIDE_PACE * (world?.pace ?? 1)
/** Gravity (m/s^2) - a little stronger than real life, so jumps feel snappy. */
export const GRAVITY = 22
/**
 * Snow and air slow you down: a flat drag (m/s^2) divided by your sled's glide, and an
 * air drag on top of that which grows with the square of your speed.
 */
export const SNOW_DRAG = 3.9
export const AIR_DRAG = 0.0009
/**
 * Below this speed (m/s, ride time - about 15 mph on the speedometer) for STOP_SECONDS
 * on the ground, the ride's over: the last slow crawl to a halt is cut short, and the
 * few metres it would have added are hardly any.
 */
export const STOP_SPEED = 3
export const STOP_SECONDS = 1.2
/** A boost pad adds this much speed (m/s); a brick wall smashed keeps this share of your speed (it stings, but a run of them never stops you dead). */
export const BOOST_SPEED = 6
export const SMASH_KEEP = 0.85
/** SPACE: a hop off the snow (vertical m/s). Once per landing. */
export const JUMP_SPEED = 7.5
/** Sideways steering speed (m/s) at a standstill, and how much more it gets with speed. */
export const STEER_SPEED = 7
export const STEER_PER_SPEED = 0.12
/** A ride with no report for this long is ended by the server. */
export const RIDE_TIMEOUT_MS = 30000
/** How long the slingshot may be held before you must let go. */
export const PULL_SECONDS = 1.1

// --- Upgrades (the four cards under PLAY) -----------------------------------------------

/**
 * SLINGSHOT: how hard the band throws you. Level L launches at `launchSpeed(L)` m/s with
 * a full pull. Costs Coins.
 */
export const SLINGSHOT = { base: 18, perLevel: 2, cost: 660, growth: 1.1, max: 200 }
/** The first few levels throw much harder, so the first upgrades are really felt; then perLevel. */
const SLINGSHOT_EARLY = { perLevel: 4, levels: 4 }
export const launchSpeed = (level) => {
  const up = Math.max(1, level) - 1
  return SLINGSHOT.base + SLINGSHOT_EARLY.perLevel * Math.min(up, SLINGSHOT_EARLY.levels) + SLINGSHOT.perLevel * Math.max(0, up - SLINGSHOT_EARLY.levels)
}

/** INCOME: a multiplier on every Coin a ride pays: x1, x1.1, x1.2 ... Costs Coins. */
export const INCOME = { perLevel: 0.1, cost: 1000, growth: 1.18, max: 200 }
export const incomeMultiplier = (level) => 1 + INCOME.perLevel * (Math.max(1, level) - 1)

/**
 * ROCKET: SHIFT burns a fuel can for `burn` seconds of `thrust` m/s^2. Level L gives
 * you `rocketCans(L)` cans a ride, each a little stronger. Costs Diamonds.
 */
export const ROCKET = { burn: 1.5, thrust: 8, thrustPerLevel: 0.6, cost: 2, costPerLevel: 1, max: 30 }
export const rocketCans = (level) => Math.min(8, 1 + Math.floor((Math.max(1, level) - 1) / 3))
export const rocketThrust = (level) => ROCKET.thrust + ROCKET.thrustPerLevel * (Math.max(1, level) - 1)

// --- Worlds -----------------------------------------------------------------------------

/**
 * The worlds, each its own slide. Reach the end of a world's slide (its `length` in
 * metres) to beat it, which unlocks the next. `coinPerMeter` and `coin` (a Coin's
 * worth on that slide) set how much a ride pays; `scale` multiplies gifts, chests and
 * coin packs while you're in it. `pace` speeds the ride up on its longer slide; `snow` is
 * how heavy its snow is (times SNOW_DRAG): deeper and slower in each world, so each one
 * takes the next world's sleds to beat.
 */
export const WORLDS = [
  { id: 'snowy', name: 'Snowy Peaks', length: 5000, coinPerMeter: 0.14, coin: 1, scale: 1, seed: 7, pace: 1 },
  { id: 'gold', name: 'Gold Rush', length: 7000, coinPerMeter: 0.7, coin: 5, scale: 6, seed: 31, pace: 1.5, snow: 1.45 },
  { id: 'lava', name: 'Lava Volcano', length: 9000, coinPerMeter: 3.5, coin: 25, scale: 36, seed: 53, pace: 1.8, snow: 1.65 },
]
/** The world after the last: a countdown and a NOTIFY ME on the sign. */
export const NEXT_WORLD = { name: 'World 4', opensAt: Date.UTC(2026, 10, 8, 18, 0, 0) }

// --- Sleds ------------------------------------------------------------------------------

/** The five finishes every sled comes in, in order: plain, then Gold, Diamond, Ruby, Galaxy. */
export const TIERS = [
  { id: 'base', name: '' },
  { id: 'gold', name: 'Gold' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'galaxy', name: 'Galaxy' },
]

/**
 * Each world's sleds, row by row (a shape, then its four finishes). Bought in order
 * with the SLED card or from the SLEDS panel; `glide` is how much further a sled slides
 * (snow drag is divided by it), shown as +% SPEED.
 */
const SLED_ROWS = {
  snowy: [
    { shape: 'tube', name: 'Basic Tube' },
    { shape: 'bobsled', name: 'Bobsled' },
    { shape: 'sled', name: 'Wooden Sled' },
    { shape: 'saucer', name: 'Saucer' },
    { shape: 'board', name: 'Snowboard' },
    { shape: 'rocket', name: 'Rocket Sled' },
  ],
  gold: [
    { shape: 'cart', name: 'Mine Cart' },
    { shape: 'toboggan', name: 'Golden Toboggan' },
    { shape: 'carpet', name: 'Magic Carpet' },
    { shape: 'camel', name: 'Camel Float' },
  ],
  lava: [
    { shape: 'magma', name: 'Magma Board' },
    { shape: 'meteor', name: 'Meteor' },
    { shape: 'hover', name: 'Hover Board' },
    { shape: 'dragon', name: 'Dragon' },
  ],
}

/** Glide and price of sled `i` of a world (counting from its first). */
/** Each world's sleds start this much glide above World 1's, and at this price. */
const WORLD_GLIDE = { snowy: 0, gold: 1.2, lava: 1.25 }
const WORLD_FIRST_PRICE = { snowy: 80, gold: 25000, lava: 900000 }
// World 1's first five sleds each glide a good deal further than the one before (+8%),
// so a new player feels every one; after them, +3% a sled.
const sledGlide = (world, i) => 1 + 0.03 * i + (world === 'snowy' ? 0.05 * Math.min(i, 5) : 0) + (WORLD_GLIDE[world] ?? 0)
const sledCost = (world, i) => {
  if (world === 'snowy' && i === 0) return 0
  const row = Math.floor(i / TIERS.length)
  const first = WORLD_FIRST_PRICE[world] ?? 80
  return roundPrice(first * 1.068 ** Math.max(0, i - 1) * 1.75 ** row)
}

/** Prices read like the reference's: 80, 85, 91, 97, 180, 1.5K, 23K... */
export function roundPrice(n) {
  if (n < 100) return Math.max(1, Math.round(n))
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / step) * step
}

export const SLEDS = {}
/** Each world's sled ids, in buying order. */
export const WORLD_SLEDS = {}
// Bought in order: every shape in its own colours first, then each again in Gold, then
// Diamond... so the first purchases are always a new sled, not a recolour. Price and
// speed go by position in that order.
for (const world of WORLDS) {
  const ids = []
  const rows = SLED_ROWS[world.id]
  TIERS.forEach((tier, t) => {
    rows.forEach((row) => {
      const i = t * rows.length + rows.indexOf(row)
      const id = `${world.id}-${row.shape}-${tier.id}`
      SLEDS[id] = {
        id,
        world: world.id,
        index: i,
        shape: row.shape,
        tier: tier.id,
        name: tier.name ? `${tier.name} ${row.name}` : row.name,
        glide: sledGlide(world.id, i),
        cost: sledCost(world.id, i),
      }
      ids.push(id)
    })
  })
  WORLD_SLEDS[world.id] = ids
}
export const FIRST_SLED = WORLD_SLEDS.snowy[0]

/**
 * The premium sleds on the pedestals by the slingshot, bought with Diamonds (their
 * DIAMOND_SHOP item): each as good as a sled far down World 1's list ("SKIP TO 24"), with
 * a look of its own.
 */
SLEDS.unicorn = { id: 'unicorn', world: 'snowy', index: 23, shape: 'unicorn', tier: 'base', name: 'Diamond Unicorn', glide: sledGlide('snowy', 23), cost: 0, premium: 'sled_unicorn' }
SLEDS.orca = { id: 'orca', world: 'snowy', index: 29, shape: 'orca', tier: 'base', name: 'Galaxy Orca', glide: sledGlide('snowy', 29) + 0.15, cost: 0, premium: 'sled_orca' }

/** +% SPEED, as the panels show it. */
export const sledSpeedPercent = (sled) => Math.round((sled.glide - 1) * 100)

// --- Trails -------------------------------------------------------------------------

/** The ribbon behind your sled. `bonus` is extra Coins on every ride; bought with Coins. */
export const TRAILS = {
  red: { name: 'Red', color: '#ff2a2a', bonus: 0, cost: 0 },
  orange: { name: 'Orange', color: '#ff8a1c', bonus: 0.1, cost: 1500 },
  yellow: { name: 'Yellow', color: '#ffe02a', bonus: 0.15, cost: 3100 },
  green: { name: 'Green', color: '#39e25a', bonus: 0.25, cost: 10000 },
  blue: { name: 'Blue', color: '#2f7bff', bonus: 0.3, cost: 17000 },
  purple: { name: 'Purple', color: '#a64dff', bonus: 0.35, cost: 20000 },
  pink: { name: 'Pink', color: '#ff5fc8', bonus: 0.5, cost: 45000 },
  black: { name: 'Black', color: '#25262c', bonus: 0.6, cost: 90000 },
  white: { name: 'White', color: '#f2f6ff', bonus: 0.7, cost: 160000 },
  rainbow: { name: 'Rainbow', color: '#ff5fc8', bonus: 1, cost: 600000, rainbow: true },
  /** Never sold: day 7 of the login streak's prize. */
  aurora: { name: 'Aurora', color: '#5affc8', bonus: 0.4, cost: 0, exclusive: true },
}
export const FIRST_TRAIL = 'red'

// --- Coins, diamonds, boosts and walls along the slide ------------------------------

/**
 * What the slide's course is made of (see course.js): every `every` metres from `from`,
 * a feature - a line of coins, a boost pad or a brick wall - and the big diamonds at the
 * milestones (each pays one Diamond, once a ride).
 */
export const COURSE = {
  from: 22,
  every: 14,
  coinLine: 5,
  coinSpacing: 2.2,
  diamonds: [300, 800, 1600, 2800, 4200, 5600, 6600, 7800, 8700],
  signEvery: 100,
  /**
   * The slide comes in stages, each with its own scenery, a gate at its start and its
   * own pattern of brick walls (course.js WALL_PATTERNS). The first few are short, so a
   * new player reaches Stage 2 on their very first ride; past the last of these starts,
   * one every `stageLength` metres.
   */
  stageStarts: [0, 110, 260, 450, 700],
  stageLength: 250,
}

// --- Races -----------------------------------------------------------------------------

/**
 * A race every few minutes (race.js): everyone who joins in the last `joinMs` launches
 * together on the same race sled - so gear doesn't decide it, steering, boost pads and
 * the rocket do - and the furthest in each world win Diamonds, with at least
 * `minRacers` racing. Race rides pay their Coins but count towards neither your best nor
 * the leaderboards (the sled isn't yours).
 */
export const RACE = {
  everyMs: 5 * 60 * 1000,
  joinMs: 25 * 1000,
  /** A racer whose ride hasn't started this long after the start is out. */
  startGraceMs: 10 * 1000,
  maxMs: 120 * 1000,
  minRacers: 2,
  prizes: [10, 6, 3],
  stats: { launch: 34, glide: 1.5, cans: 2, thrust: 10, burn: 1.5 },
}
/** When the next race starts, on the clock (every RACE.everyMs). */
export const nextRaceAt = (now) => Math.ceil((now + 1) / RACE.everyMs) * RACE.everyMs

// --- Daily tasks ----------------------------------------------------------------------

/**
 * Three a day (UTC), picked from this pool for each player. Each pays its Diamonds
 * once done and claimed; all three claimed opens the chest.
 */
export const TASKS = {
  rides: { label: 'Go for {n} rides', icon: 'play', goals: [3, 5], diamonds: 6 },
  distance: { label: 'Reach {n}m in one ride', icon: 'speed', goals: [150, 300, 600], diamonds: 8, scaleWithBest: true },
  coins: { label: 'Collect {n} coins', icon: 'coin', goals: [40, 100], diamonds: 7 },
  upgrades: { label: 'Upgrade {n} times', icon: 'upgrade', goals: [3, 5], diamonds: 8 },
  smash: { label: 'Smash {n} walls', icon: 'smash', goals: [5, 12], diamonds: 7 },
  boosts: { label: 'Hit {n} boost pads', icon: 'boost', goals: [5, 10], diamonds: 6 },
}
export const TASK_COUNT = 3
export const TASK_CHEST = { coins: 400, diamonds: 6 }

// --- Gifts ------------------------------------------------------------------------------

/** Chest contents, as the gifts and tasks give them. */
export const CHESTS = {
  orange: { coins: 130, diamonds: 3 },
  blue: { coins: 420, diamonds: 5 },
  rainbow: { coins: 1500, diamonds: 15 },
}

/**
 * The GIFTS panel: twelve presents a session, each claimable after this many minutes
 * played. Coins scale with your world.
 */
export const GIFTS = [
  { minutes: 1, coins: 120, diamonds: 2 },
  { minutes: 2, chest: 'orange' },
  { minutes: 4, coins: 160 },
  { minutes: 6, diamonds: 3 },
  { minutes: 8, coins: 210 },
  { minutes: 12, diamonds: 5 },
  { minutes: 17, chest: 'blue' },
  { minutes: 22, coins: 250 },
  { minutes: 27, coins: 290, diamonds: 6 },
  { minutes: 37, chest: 'blue' },
  { minutes: 47, coins: 330, diamonds: 10 },
  { minutes: 57, chest: 'rainbow' },
]

// --- Coming back --------------------------------------------------------------------

/**
 * The login streak: a prize for every day in a row you play (UTC days), opened the first
 * time you join each day. Miss a day and it starts again from day 1; after day 7 it goes
 * round again (the Aurora trail only the first time - Diamonds after that). Coins scale
 * with your world.
 */
export const LOGIN_STREAK = [
  { coins: 250 },
  { diamonds: 3 },
  { chest: 'orange' },
  { coins: 600 },
  { diamonds: 6 },
  { chest: 'blue' },
  { chest: 'rainbow', trail: 'aurora', repeatDiamonds: 10 },
]

/**
 * While you're away your INCOME keeps paying: this many Coins a minute (times your
 * INCOME and your world), for at least MIN and at most MAX minutes away.
 */
export const AWAY_COINS = { perMinute: 2, minMinutes: 10, maxMinutes: 8 * 60 }

/** "FREE 5,000 COINS!": once per Bloxity account, for signing in. */
export const FREE_COINS = 5000

// --- The Diamond shop -------------------------------------------------------------------

/**
 * What Diamonds buy besides ROCKET upgrades: the coin packs down the right of the lobby
 * (Coins scale with your world), the two premium sleds, and Gold Rush without beating
 * Snowy Peaks first. An active player earns about 80 Diamonds a day.
 */
export const DIAMOND_SHOP = {
  coins_small: { name: 'Pile of Coins', diamonds: 15, grant: { coins: 1500 } },
  coins_medium: { name: 'Bag of Coins', diamonds: 40, grant: { coins: 5000 } },
  coins_large: { name: 'Vault of Coins', diamonds: 120, grant: { coins: 18000 } },
  sled_unicorn: { name: 'Diamond Unicorn', diamonds: 150, grant: { sled: 'unicorn' } },
  sled_orca: { name: 'Galaxy Orca', diamonds: 450, grant: { sled: 'orca' } },
  world_gold: { name: 'Gold Rush', diamonds: 300, grant: { world: 1 } },
  world_lava: { name: 'Lava Volcano', diamonds: 1500, grant: { world: 2 } },
}

// --- Bloxity: rewarded ads, leaderboards ------------------------------------------------

/** Rewarded ads: CLAIM 3x after a ride pays the ride's Coins twice more. */
export const AD_REWARDS = {
  'triple-coins': { label: 'CLAIM 3x', extra: 2, withinMs: 3 * 60 * 1000 },
}

/**
 * The game's Boxity leaderboards, shown on its Boxity page and behind the trophy button
 * in the game, and on the boards in the plaza. Ids and settings are permanent once
 * Boxity has seen them. The client declares them; the server reports the scores.
 */
export const BOXITY_BOARDS = [
  { id: 'distance', label: 'Longest Ride', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
  { id: 'coins', label: 'Most Coins', order: 'desc', mode: 'sum', format: 'compact', reset: 'weekly' },
  { id: 'playtime', label: 'Minutes Played', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
]

export const BADGES = {
  firstRide: { name: 'First Ride' },
  hundred: { name: '100 Metres' },
  kilometre: { name: 'One Kilometre' },
  snowy: { name: 'Beat Snowy Peaks' },
  gold: { name: 'Beat Gold Rush' },
  lava: { name: 'Beat Lava Volcano' },
}
