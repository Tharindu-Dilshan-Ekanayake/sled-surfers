import {
  AD_REWARDS,
  AWAY_COINS,
  BADGES,
  CHESTS,
  FIRST_SLED,
  FIRST_TRAIL,
  FREE_COINS,
  DIAMOND_SHOP,
  GIFTS,
  incomeMultiplier,
  INCOME,
  LOGIN_STREAK,
  ROCKET,
  roundPrice,
  SLEDS,
  SLINGSHOT,
  TASK_CHEST,
  TASK_COUNT,
  TASKS,
  TRAILS,
  WORLD_SLEDS,
  WORLDS,
} from './balance.js'
import { mulberry32 } from './rng.js'

/**
 * Game rules as pure functions over a plain profile object.
 *
 * The server runs these authoritatively; the client runs the very same functions for
 * offline play and for display (costs, what a button would do). Mutating functions
 * change the profile in place and return a small result describing what happened.
 *
 * `session` is the per-connection state that is never saved: when this session started.
 */

export const PROFILE_VERSION = 2

export function createProfile(id, name) {
  return {
    v: PROFILE_VERSION,
    id,
    name,
    coins: 0,
    diamonds: 0,
    upgrades: { slingshot: 1, income: 1, rocket: 1 },
    sled: FIRST_SLED,
    sleds: [FIRST_SLED],
    trail: FIRST_TRAIL,
    trails: [FIRST_TRAIL],
    /** The world you're in (WORLDS index), each world's best ride, and those beaten or bought. */
    world: 0,
    best: WORLDS.map(() => 0),
    beaten: [],
    bought: [],
    tasks: { day: '', list: [], chest: false },
    freeCoins: false,
    notify: false,
    /**
     * Today's gifts (UTC day): how long you've played today (ms) - the gifts open with it -
     * and which you've claimed. Saved, so a refresh or a new lobby never starts them over.
     */
    gifts: { day: '', played: 0, claimed: [] },
    /** The login streak: the UTC day of the last visit, how many days in a row, and whether today's prize is claimed. */
    login: { day: '', streak: 0, claimed: true },
    badges: [],
    /** The last ride's Coins, for CLAIM 3x: `{ total, at, tripled }`. */
    lastRide: null,
    stats: { rides: 0, bestDistance: 0, coinsEarned: 0, playtime: 0, smashes: 0, boosts: 0, coinsPicked: 0 },
    lastSeen: 0,
  }
}

const int = (value, fallback = 0) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback)

/** Fills in anything missing from an older or partial save. Never throws. */
export function normalizeProfile(raw, id, name) {
  const base = createProfile(id, name)
  if (!raw || typeof raw !== 'object' || raw.v !== PROFILE_VERSION) return base
  const p = { ...base, ...raw, id, name: name || raw.name || base.name }
  p.coins = int(raw.coins)
  p.diamonds = int(raw.diamonds)
  p.upgrades = {
    slingshot: Math.min(SLINGSHOT.max, Math.max(1, int(raw.upgrades?.slingshot, 1))),
    income: Math.min(INCOME.max, Math.max(1, int(raw.upgrades?.income, 1))),
    rocket: Math.min(ROCKET.max, Math.max(1, int(raw.upgrades?.rocket, 1))),
  }
  p.sleds = Array.isArray(raw.sleds) ? [...new Set(raw.sleds.filter((s) => SLEDS[s]))] : []
  if (!p.sleds.includes(FIRST_SLED)) p.sleds.unshift(FIRST_SLED)
  if (!p.sleds.includes(p.sled)) p.sled = FIRST_SLED
  p.trails = Array.isArray(raw.trails) ? [...new Set(raw.trails.filter((t) => TRAILS[t]))] : []
  if (!p.trails.includes(FIRST_TRAIL)) p.trails.unshift(FIRST_TRAIL)
  if (!p.trails.includes(p.trail)) p.trail = FIRST_TRAIL
  p.best = WORLDS.map((_, i) => Math.max(0, Number(raw.best?.[i]) || 0))
  p.beaten = Array.isArray(raw.beaten) ? raw.beaten.filter((w) => WORLDS[w]) : []
  p.bought = Array.isArray(raw.bought) ? raw.bought.filter((w) => WORLDS[w]) : []
  p.stats = { ...base.stats, ...(raw.stats || {}) }
  p.badges = Array.isArray(raw.badges) ? raw.badges.filter((b) => BADGES[b]) : []
  p.tasks = raw.tasks && Array.isArray(raw.tasks.list) ? { day: String(raw.tasks.day || ''), list: raw.tasks.list.filter((t) => TASKS[t?.kind]), chest: Boolean(raw.tasks.chest) } : base.tasks
  p.gifts =
    raw.gifts && typeof raw.gifts === 'object'
      ? { day: String(raw.gifts.day || ''), played: Math.max(0, Number(raw.gifts.played) || 0), claimed: Array.isArray(raw.gifts.claimed) ? raw.gifts.claimed.filter((i) => Number.isInteger(i) && GIFTS[i]) : [] }
      : base.gifts
  p.login = raw.login && typeof raw.login === 'object' ? { day: String(raw.login.day || ''), streak: int(raw.login.streak), claimed: Boolean(raw.login.claimed) } : base.login
  if (!Number.isInteger(p.world) || !worldUnlocked(p, p.world)) p.world = 0
  p.v = PROFILE_VERSION
  return p
}

export function createSession(now) {
  return { start: now }
}

// --- Upgrades -------------------------------------------------------------------------

export const UPGRADES = ['slingshot', 'income', 'rocket']

/** What the next level of upgrade `kind` costs: `{ amount, currency }`, or null at the max. */
/**
 * The first few Coin upgrades cost less - the first SLINGSHOT within a few rides - and
 * the discount is gone by level 4, where the usual curve takes over.
 */
const earlyDiscount = (level) => Math.min(1, 0.19 + 0.27 * (level - 1))

export function upgradeCost(profile, kind) {
  const level = profile.upgrades[kind] ?? 1
  if (kind === 'slingshot') return level >= SLINGSHOT.max ? null : { amount: roundPrice(SLINGSHOT.cost * SLINGSHOT.growth ** (level - 1) * earlyDiscount(level)), currency: 'coins' }
  if (kind === 'income') return level >= INCOME.max ? null : { amount: roundPrice(INCOME.cost * INCOME.growth ** (level - 1) * earlyDiscount(level)), currency: 'coins' }
  if (kind === 'rocket') return level >= ROCKET.max ? null : { amount: ROCKET.cost + ROCKET.costPerLevel * (level - 1), currency: 'diamonds' }
  return null
}

export function buyUpgrade(profile, kind) {
  if (!UPGRADES.includes(kind)) return { ok: false, error: 'Unknown upgrade' }
  const cost = upgradeCost(profile, kind)
  if (!cost) return { ok: false, error: 'Maxed out!' }
  if (profile[cost.currency] < cost.amount) return { ok: false, error: cost.currency === 'coins' ? 'Not enough Coins!' : 'Not enough Diamonds!' }
  profile[cost.currency] -= cost.amount
  profile.upgrades[kind] += 1
  taskProgress(profile, 'upgrades', 1)
  return { ok: true, kind, level: profile.upgrades[kind] }
}

// --- Worlds ---------------------------------------------------------------------------

/** Whether world `i` is open to you: the first always; the others once the one before is beaten (or bought). */
export const worldUnlocked = (profile, i) => i === 0 || (WORLDS[i] !== undefined && (profile.beaten.includes(i - 1) || profile.bought.includes(i)))

export function setWorld(profile, world) {
  const i = Number(world)
  if (!Number.isInteger(i) || !worldUnlocked(profile, i)) return { ok: false, error: 'Locked!' }
  profile.world = i
  return { ok: true, world: i }
}

/** How far through world `i` your best ride got, 0-1. */
export const worldProgress = (profile, i) => Math.min(1, (profile.best[i] ?? 0) / WORLDS[i].length)

/** Coins scale with the world you're in: gifts, chests and packs pay more in later ones. */
export const worldScale = (profile) => WORLDS[profile.world]?.scale ?? 1

// --- Sleds and trails ----------------------------------------------------------------

/** The next sled of world `world` (default: yours) you don't own yet, or null. */
export function nextSled(profile, world = profile.world) {
  const ids = WORLD_SLEDS[WORLDS[world]?.id] ?? []
  return SLEDS[ids.find((id) => !profile.sleds.includes(id))] ?? null
}

/** Buys sled `id` with Coins: only the next one of its world, in a world you've unlocked. */
export function buySled(profile, id) {
  const sled = SLEDS[id]
  if (!sled || sled.premium) return { ok: false, error: 'Unknown sled' }
  if (profile.sleds.includes(id)) return equipSled(profile, id)
  const world = WORLDS.findIndex((w) => w.id === sled.world)
  if (!worldUnlocked(profile, world)) return { ok: false, error: 'Unlock that world first!' }
  if (nextSled(profile, world)?.id !== id) return { ok: false, error: 'Buy the one before first!' }
  if (profile.coins < sled.cost) return { ok: false, error: 'Not enough Coins!' }
  profile.coins -= sled.cost
  profile.sleds.push(id)
  profile.sled = id
  taskProgress(profile, 'upgrades', 1)
  return { ok: true, bought: true, id }
}

export function equipSled(profile, id) {
  if (!profile.sleds.includes(id)) return { ok: false, error: 'You don’t own that sled' }
  profile.sled = id
  return { ok: true, id }
}

export function buyTrail(profile, id) {
  const trail = TRAILS[id]
  if (!trail) return { ok: false, error: 'Unknown trail' }
  if (profile.trails.includes(id)) return equipTrail(profile, id)
  if (trail.exclusive) return { ok: false, error: 'Only from the 7-day login streak!' }
  if (profile.coins < trail.cost) return { ok: false, error: 'Not enough Coins!' }
  profile.coins -= trail.cost
  profile.trails.push(id)
  profile.trail = id
  return { ok: true, bought: true, id }
}

export function equipTrail(profile, id) {
  if (!profile.trails.includes(id)) return { ok: false, error: 'You don’t own that trail' }
  profile.trail = id
  return { ok: true, id }
}

// --- Rides ----------------------------------------------------------------------------

/** Everything that multiplies a ride's Coins: your INCOME and your trail. */
export const coinMultiplier = (profile) => incomeMultiplier(profile.upgrades.income) * (1 + (TRAILS[profile.trail]?.bonus ?? 0))

/** Coins for the distance itself in world `world`: a little more for every metre further you get. */
export function distanceCoins(world, distance) {
  const w = WORLDS[world] ?? WORLDS[0]
  const s = Math.max(0, distance)
  return Math.floor(w.coinPerMeter * s * (1 + s / 600))
}

/**
 * What a ride pays: the Coins picked up (`pickups` of them, at the world's worth), the
 * distance's, and the bonus your INCOME and trail add to both.
 */
export function rideReward(profile, { world, distance, pickups }) {
  const w = WORLDS[world] ?? WORLDS[0]
  const picked = Math.max(0, Math.floor(pickups)) * w.coin
  const far = distanceCoins(world, distance)
  const bonus = Math.round((picked + far) * (coinMultiplier(profile) - 1))
  return { picked, far, bonus, total: picked + far + bonus }
}

/**
 * Banks a finished ride: its Coins, the stats and tasks it counts towards, a new best,
 * and the world beaten if it reached the end. Returns what the results card shows.
 */
export function finishRide(profile, { world, distance, pickups, smashes = 0, boosts = 0, race = false }, now) {
  const w = WORLDS[world] ?? WORLDS[0]
  const d = Math.max(0, Math.min(w.length, Math.floor(distance)))
  const reward = rideReward(profile, { world, distance: d, pickups })
  const before = profile.best[world] ?? 0
  profile.coins += reward.total
  // A race ride (on the race sled, not yours) pays, but sets no best.
  if (!race) profile.best[world] = Math.max(before, d)
  const stats = profile.stats
  stats.rides += 1
  if (!race) stats.bestDistance = Math.max(stats.bestDistance, d)
  stats.coinsEarned += reward.total
  stats.coinsPicked += pickups
  stats.smashes += smashes
  stats.boosts += boosts
  profile.lastRide = { total: reward.total, at: now, tripled: false }
  taskProgress(profile, 'rides', 1)
  if (!race) taskProgress(profile, 'distance', d, true)
  taskProgress(profile, 'coins', pickups)
  taskProgress(profile, 'smash', smashes)
  taskProgress(profile, 'boosts', boosts)
  const finished = !race && d >= w.length
  const badges = race ? [] : [awardBadge(profile, 'firstRide'), d >= 100 ? awardBadge(profile, 'hundred') : null, d >= 1000 ? awardBadge(profile, 'kilometre') : null]
  if (finished && !profile.beaten.includes(world)) {
    profile.beaten.push(world)
    badges.push(awardBadge(profile, w.id))
  }
  return {
    ok: true,
    world,
    distance: d,
    best: before,
    newBest: !race && d > before,
    gained: race ? 0 : Math.max(0, d - before),
    finished,
    race,
    ...reward,
    badges: badges.filter(Boolean),
  }
}

/** A rewarded ad watched to the end (Boxity confirmed it): CLAIM 3x on the last ride. */
export function grantAdReward(profile, placement, now) {
  const ad = AD_REWARDS[placement]
  if (!ad) return { ok: false, error: 'Unknown placement' }
  const last = profile.lastRide
  if (!last || last.tripled || now - last.at > ad.withinMs) return { ok: false, error: 'Nothing to triple' }
  const coins = last.total * ad.extra
  last.tripled = true
  profile.coins += coins
  profile.stats.coinsEarned += coins
  return { ok: true, placement, coins }
}

// --- Daily tasks ----------------------------------------------------------------------

/** The UTC day `now` falls in, as 2026-10-29. */
export const dayKey = (now) => new Date(now).toISOString().slice(0, 10)

function hashString(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Today's three tasks, picked fresh each UTC day for each player. Returns the list. */
export function dailyTasks(profile, now) {
  const day = dayKey(now)
  if (profile.tasks.day === day && profile.tasks.list.length) return profile.tasks.list
  const rand = mulberry32(hashString(`${day}:${profile.id}`))
  const kinds = Object.keys(TASKS)
  const list = []
  while (list.length < TASK_COUNT) {
    const kind = kinds.splice(Math.floor(rand() * kinds.length), 1)[0]
    const task = TASKS[kind]
    let goal = task.goals[Math.floor(rand() * task.goals.length)]
    // Distance goals grow with you: a little past your best, in round hundreds.
    if (task.scaleWithBest) goal = Math.max(goal, Math.ceil((profile.stats.bestDistance * 0.9) / 100) * 100)
    list.push({ kind, goal, progress: 0, claimed: false })
  }
  profile.tasks = { day, list, chest: false }
  return list
}

/** Counts `amount` towards today's tasks of `kind` (`best`: the task wants the most in one go). */
export function taskProgress(profile, kind, amount, best = false) {
  if (!amount) return
  for (const task of profile.tasks.list) {
    if (task.kind !== kind || task.claimed) continue
    task.progress = Math.min(task.goal, best ? Math.max(task.progress, amount) : task.progress + amount)
  }
}

export function claimTask(profile, index, now) {
  dailyTasks(profile, now)
  const task = profile.tasks.list[index]
  if (!task || task.claimed || task.progress < task.goal) return { ok: false, error: 'Not done yet' }
  task.claimed = true
  profile.diamonds += TASKS[task.kind].diamonds
  return { ok: true, diamonds: TASKS[task.kind].diamonds }
}

/** The chest, once all of today's tasks are claimed. */
export function claimTaskChest(profile, now) {
  dailyTasks(profile, now)
  if (profile.tasks.chest || !profile.tasks.list.every((t) => t.claimed)) return { ok: false, error: 'Finish every task first' }
  profile.tasks.chest = true
  const coins = Math.round(TASK_CHEST.coins * worldScale(profile))
  profile.coins += coins
  profile.diamonds += TASK_CHEST.diamonds
  return { ok: true, coins, diamonds: TASK_CHEST.diamonds }
}

// --- Coming back: the login streak, Coins while away ------------------------------------

/** The UTC day before day `day` (2026-10-29 -> 2026-10-28). */
const dayBefore = (day) => dayKey(Date.parse(`${day}T12:00:00Z`) - 86400000)

/**
 * Counts today's visit towards the login streak: the next day of it if you came
 * yesterday, back to day 1 if you missed one. Only once a day. Returns whether this
 * started a new day (whose prize is now waiting).
 */
export function recordLogin(profile, now) {
  const today = dayKey(now)
  const login = profile.login
  if (login.day === today) return false
  login.streak = login.day && dayBefore(today) === login.day ? login.streak + 1 : 1
  login.day = today
  login.claimed = false
  return true
}

/** Which of LOGIN_STREAK's seven prizes streak day `streak` (1, 2 ...) gets. */
export const streakSlot = (streak) => (Math.max(1, streak) - 1) % LOGIN_STREAK.length

/** What today's login prize gives you now: `{ coins, diamonds, chest, trail }`. */
export function loginPrize(profile, streak = profile.login.streak) {
  const prize = LOGIN_STREAK[streakSlot(streak)]
  const scale = worldScale(profile)
  const chest = prize.chest ? CHESTS[prize.chest] : null
  const trail = prize.trail && !profile.trails.includes(prize.trail) ? prize.trail : null
  return {
    coins: Math.round(((prize.coins || 0) + (chest?.coins || 0)) * scale),
    diamonds: (prize.diamonds || 0) + (chest?.diamonds || 0) + (prize.trail && !trail ? prize.repeatDiamonds || 0 : 0),
    chest: prize.chest || null,
    trail,
  }
}

export function claimLogin(profile, now) {
  recordLogin(profile, now)
  if (profile.login.claimed) return { ok: false, error: 'Come back tomorrow!' }
  const got = loginPrize(profile)
  profile.login.claimed = true
  profile.coins += got.coins
  profile.diamonds += got.diamonds
  if (got.trail) {
    profile.trails.push(got.trail)
    profile.trail = got.trail
  }
  return { ok: true, streak: profile.login.streak, ...got }
}

/**
 * Coins your INCOME earned while you were away (since `profile.lastSeen`), banked now.
 * Nothing for a short break, and no more than AWAY_COINS.maxMinutes' worth. Returns
 * `{ coins, minutes }` or null.
 */
export function collectAwayCoins(profile, now) {
  if (!profile.lastSeen) return null
  const minutes = Math.floor((now - profile.lastSeen) / 60000)
  if (minutes < AWAY_COINS.minMinutes) return null
  const counted = Math.min(AWAY_COINS.maxMinutes, minutes)
  const coins = Math.floor(counted * AWAY_COINS.perMinute * incomeMultiplier(profile.upgrades.income) * worldScale(profile))
  if (coins <= 0) return null
  profile.coins += coins
  profile.lastSeen = now
  return { coins, minutes }
}

// --- Gifts ----------------------------------------------------------------------------

/** What gift `index` gives you now: `{ coins, diamonds, chest? }`. */
export function giftContents(profile, index) {
  const gift = GIFTS[index]
  const scale = worldScale(profile)
  const base = gift.chest ? CHESTS[gift.chest] : gift
  return { coins: Math.round((base.coins || 0) * scale), diamonds: base.diamonds || 0, chest: gift.chest || null }
}

/** Today's gifts, started afresh on a new UTC day. */
export function giftsToday(profile, now) {
  const day = dayKey(now)
  if (profile.gifts.day !== day) profile.gifts = { day, played: 0, claimed: [] }
  return profile.gifts
}

/** Counts `seconds` of play towards today's gifts. */
export function playGifts(profile, seconds, now) {
  giftsToday(profile, now).played += seconds * 1000
}

/**
 * Each gift's state: 'claimed' | 'ready' | 'locked' (with `unlocksIn` ms), from today's
 * gifts and `extraMs` more play (the client counting on between profile updates).
 */
export function giftStatus(gifts, extraMs = 0) {
  const minutes = (gifts.played + extraMs) / 60000
  return GIFTS.map((gift, index) => {
    if (gifts.claimed.includes(index)) return { index, state: 'claimed' }
    if (minutes >= gift.minutes) return { index, state: 'ready' }
    return { index, state: 'locked', unlocksIn: (gift.minutes - minutes) * 60000 }
  })
}

export function claimGift(profile, index, now) {
  const gifts = giftsToday(profile, now)
  const status = giftStatus(gifts)[index]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  gifts.claimed.push(index)
  const got = giftContents(profile, index)
  profile.coins += got.coins
  profile.diamonds += got.diamonds
  return { ok: true, index, ...got }
}

// --- Free coins, the Diamond shop -------------------------------------------------------

/** FREE 5,000 COINS: once per Bloxity account, signed in. */
export function claimFreeCoins(profile, verified) {
  if (!verified) return { ok: false, error: 'Sign in to claim!' }
  if (profile.freeCoins) return { ok: false, error: 'Already claimed!' }
  profile.freeCoins = true
  profile.coins += FREE_COINS
  return { ok: true, coins: FREE_COINS }
}

/**
 * Buys DIAMOND_SHOP item `id` with Diamonds: a coin pack (Coins scaled by your world), a
 * premium sled (worn at once), or Gold Rush opened early. Never twice for the one-offs.
 */
export function buyDiamondItem(profile, id) {
  const item = Object.hasOwn(DIAMOND_SHOP, id) ? DIAMOND_SHOP[id] : null
  if (!item) return { ok: false, error: 'Unknown item' }
  const grant = item.grant
  if (grant.sled && profile.sleds.includes(grant.sled)) return equipSled(profile, grant.sled)
  if (Number.isInteger(grant.world) && worldUnlocked(profile, grant.world)) return { ok: false, error: 'Already open!' }
  if (profile.diamonds < item.diamonds) return { ok: false, error: 'Not enough Diamonds!' }
  profile.diamonds -= item.diamonds
  const result = { ok: true, id, spent: item.diamonds }
  if (grant.coins) {
    result.coins = Math.round(grant.coins * worldScale(profile))
    profile.coins += result.coins
  }
  if (grant.sled && SLEDS[grant.sled]) {
    if (!profile.sleds.includes(grant.sled)) profile.sleds.push(grant.sled)
    profile.sled = grant.sled
    result.sled = grant.sled
  }
  if (Number.isInteger(grant.world) && WORLDS[grant.world]) {
    if (!profile.bought.includes(grant.world)) profile.bought.push(grant.world)
    result.world = grant.world
  }
  return result
}

/** Awards a badge once. Returns the badge if newly awarded. */
export function awardBadge(profile, id) {
  if (!BADGES[id] || profile.badges.includes(id)) return null
  profile.badges.push(id)
  return { id, ...BADGES[id] }
}
