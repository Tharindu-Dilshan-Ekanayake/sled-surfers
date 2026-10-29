import { RACE, RIDE_TIMEOUT_MS, TRAILS, WORLDS } from './balance.js'
import { courseOf } from './course.js'
import {
  buyDiamondItem,
  buySled,
  buyTrail,
  buyUpgrade,
  claimFreeCoins,
  claimGift,
  claimLogin,
  claimTask,
  claimTaskChest,
  collectAwayCoins,
  createSession,
  dailyTasks,
  equipSled,
  equipTrail,
  finishRide,
  giftStatus,
  giftsToday,
  grantAdReward,
  playGifts,
  recordLogin,
  setWorld,
} from './logic.js'
import { maxRideSpeed, rideStats } from './ride.js'
import { onLaunchPad } from './world.js'

/** The pad's reach, allowing for a little lag in the position reports. */
const PAD_SLACK = 2
/** How far past what it could really have got a ride's report may run (lag, frame steps). */
const RIDE_SLACK = 12

/**
 * One player's authoritative session: validates intents and reports what happened
 * through `emit`.
 *
 * Transport-agnostic on purpose. The Colyseus room wraps one of these per client; the
 * offline mode wraps one for the local player. Either way the rules that run are
 * byte-for-byte the same.
 *
 * A ride is simulated by the client (it's a physics toy, and it must feel instant);
 * the session holds it to what's possible: never further than its gear could have
 * slid it in the time it's had, each Coin and Diamond only once and only when the ride
 * has got to it. What a ride pays is worked out here, from what was accepted.
 *
 * Events emitted (type, payload):
 * - 'profile'    { profile, session }  full state, after anything that changed it
 * - 'ride'       { world }             a ride has begun (or 'rideEnd' { reason: 'refused' })
 * - 'diamond'    { index }             a milestone Diamond paid
 * - 'rideResult' { distance, best, newBest, gained, finished, picked, far, bonus, total, world }
 * - 'rideEnd'    { reason }            the server ended a ride ('timeout', 'refused', 'left')
 * - 'reward'     { coins?, diamonds?, chest?, source }  a gift, task, chest, free coins, an ad or the Diamond shop
 * - 'badge'      { id, name }
 */
export class PlayerSession {
  /**
   * @param {object} profile normalized profile (see logic.normalizeProfile)
   * @param {{ now: number, emit: (type: string, payload?: object) => void,
   *           getPosition: () => {x: number, y: number, z: number},
   *           verified?: boolean, onRide?: (ride: object | null) => void }} options
   *   `verified`: signed in with Boxity (the free coins need it). `onRide` lets the host
   *   show other players where someone is on the slide.
   */
  constructor(profile, { now, emit, getPosition, verified = false, onRide }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.getPosition = getPosition
    this.verified = verified
    this.onRide = onRide
    /** The race (RaceHost) this player has just been started in, until they set off. */
    this.raceId = 0
    /** The ride in progress: { world, startedAt, s, x, lastAt, cap, coins: Set, diamonds: Set, walls: Set, boosts: Set }. */
    this.ride = null
    /** Coins earned on rides not yet counted towards a leaderboard. */
    this.coinsEarned = 0
    this.dirty = false
    dailyTasks(profile, now)
    // Back after a while: what INCOME made meanwhile (handed over by greet), and today's visit.
    this.away = collectAwayCoins(profile, now)
    recordLogin(profile, now)
  }

  /**
   * The welcome, once the client has its profile: the Coins earned while away, if any
   * ('away' { coins, minutes }). Today's login prize, if it's waiting, shows from the profile.
   */
  greet() {
    if (this.away) this.emit('away', this.away)
    this.away = null
  }

  // --- Plumbing --------------------------------------------------------------------

  sendProfile() {
    this.dirty = false
    this.emit('profile', { profile: this.profile, session: this.session })
  }


  /** Dispatches one client message. Unknown types are ignored. */
  handle(type, payload = {}, now) {
    const handler = this.handlers[type]
    if (!handler) return
    dailyTasks(this.profile, now)
    // Playing on past midnight: the next day's prize opens without rejoining.
    if (recordLogin(this.profile, now)) this.dirty = true
    handler.call(this, payload || {}, now)
    if (this.dirty) this.sendProfile()
  }

  reward(result, source) {
    if (!result?.ok) return
    this.dirty = true
    this.emit('reward', { coins: result.coins || 0, diamonds: result.diamonds || 0, chest: result.chest || null, source })
  }

  handlers = {
    /**
     * Let go of the slingshot standing on the pad: a ride begins. `id` is the client's
     * number for it, echoed in everything about it, so a late answer about one ride is
     * never taken for the next. A ride still open (its end lost on a bad connection) is
     * banked first.
     */
    startRide({ id, race }, now) {
      if (this.ride) this.finish(now)
      const rideId = Number.isFinite(Number(id)) ? Number(id) : 0
      // The race this player was started in (RaceHost), once: on the race sled, from
      // wherever the start found them.
      const racing = Boolean(this.raceId) && Number(race) === this.raceId
      const p = this.getPosition()
      if (!racing && !onLaunchPad(p.x, p.z, PAD_SLACK)) {
        this.emit('rideEnd', { reason: 'refused', id: rideId })
        return
      }
      const stats = racing ? RACE.stats : rideStats(this.profile)
      const raceId = racing ? this.raceId : 0
      this.raceId = 0
      this.ride = {
        id: rideId,
        race: raceId,
        world: this.profile.world,
        startedAt: now,
        lastAt: now,
        s: 0,
        x: 0,
        cap: maxRideSpeed(stats, WORLDS[this.profile.world]),
        coins: new Set(),
        diamonds: new Set(),
        walls: new Set(),
        boosts: new Set(),
      }
      this.onRide?.(this.ride)
      this.emit('ride', { world: this.ride.world })
      if (raceId) this.onRaceStart?.(raceId)
    },

    /** Join the race whose window is open (the room's RaceHost decides). */
    joinRace(_payload, now) {
      this.onJoinRace?.(now)
    },

    /** Where the ride has got to: trusted only as far as its gear could have taken it. */
    rideAt({ s, x, y }, now) {
      const ride = this.ride
      if (!ride || !this.advance(s, now)) return
      ride.x = Math.max(-20, Math.min(20, Number(x) || 0))
      ride.y = Number.isFinite(Number(y)) ? Number(y) : 0
      this.onRide?.(ride)
    },

    /**
     * Picked up Coin `index` at metre `s` (sent with it, so a fast sled's pickups aren't
     * ahead of the last position report): only one the ride has really reached.
     */
    collectCoin({ index, s }, now) {
      const ride = this.ride
      if (!ride) return
      this.advance(s, now)
      const coin = courseOf(ride.world).coins[Number(index)]
      if (!coin || ride.coins.has(coin.index) || coin.s > ride.s + 6) return
      ride.coins.add(coin.index)
    },

    /** A milestone Diamond: paid at once. */
    collectDiamond({ index, s }, now) {
      const ride = this.ride
      if (!ride) return
      this.advance(s, now)
      const gem = courseOf(ride.world).diamonds[Number(index)]
      if (!gem || ride.diamonds.has(gem.index) || gem.s > ride.s + 6) return
      ride.diamonds.add(gem.index)
      this.profile.diamonds += 1
      this.dirty = true
      this.emit('diamond', { index: gem.index })
    },

    /** A wall smashed or a boost pad hit, for the daily tasks. */
    rideHit({ kind, index, s }, now) {
      const ride = this.ride
      if (!ride || (kind !== 'wall' && kind !== 'boost')) return
      this.advance(s, now)
      const list = kind === 'wall' ? courseOf(ride.world).walls : courseOf(ride.world).boosts
      const item = list[Number(index)]
      if (!item || item.s > ride.s + 6) return
      ;(kind === 'wall' ? ride.walls : ride.boosts).add(item.index)
    },

    /** The sled's stopped (or crossed the finish, or END was pressed): bank the ride. */
    endRide({ s, id }, now) {
      if (!this.ride) return
      // The end of an earlier ride, arriving late: this one carries on.
      if (id !== undefined && Number(id) !== this.ride.id) return
      this.advance(s, now)
      this.finish(now)
    },

    upgrade({ kind }) {
      if (buyUpgrade(this.profile, String(kind)).ok) this.dirty = true
    },

    buySled({ id }) {
      if (buySled(this.profile, String(id)).ok) this.dirty = true
    },

    equipSled({ id }) {
      if (equipSled(this.profile, String(id)).ok) this.dirty = true
    },

    buyTrail({ id }) {
      if (!TRAILS[id]) return
      if (buyTrail(this.profile, id).ok) this.dirty = true
    },

    equipTrail({ id }) {
      if (equipTrail(this.profile, String(id)).ok) this.dirty = true
    },

    setWorld({ world }) {
      if (this.ride) return
      const result = setWorld(this.profile, world)
      if (!result.ok) return
      this.dirty = true
      this.emit('world', { world: result.world })
    },

    claimGift({ index }, now) {
      this.reward(claimGift(this.profile, Number(index), now), 'gift')
    },

    claimAllGifts(_payload, now) {
      let coins = 0
      let diamonds = 0
      for (const gift of giftStatus(giftsToday(this.profile, now))) {
        if (gift.state !== 'ready') continue
        const got = claimGift(this.profile, gift.index, now)
        coins += got.coins || 0
        diamonds += got.diamonds || 0
      }
      if (coins || diamonds) this.reward({ ok: true, coins, diamonds }, 'gift')
    },

    claimTask({ index }, now) {
      this.reward(claimTask(this.profile, Number(index), now), 'task')
    },

    claimTaskChest(_payload, now) {
      this.reward({ ...claimTaskChest(this.profile, now), chest: 'blue' }, 'chest')
    },

    /** Something from the Diamond shop: a coin pack, a premium sled, Gold Rush early. */
    buyDiamondItem({ id }) {
      const result = buyDiamondItem(this.profile, String(id))
      if (!result.ok) return
      this.dirty = true
      if (result.spent) this.emit('reward', { coins: result.coins || 0, diamonds: 0, sled: result.sled || null, world: result.world ?? null, source: 'shop' })
    },

    /** Today's login-streak prize. */
    claimLogin(_payload, now) {
      const result = claimLogin(this.profile, now)
      if (!result.ok) return
      this.dirty = true
      this.emit('reward', { coins: result.coins, diamonds: result.diamonds, chest: result.chest, trail: result.trail, source: 'login' })
    },

    claimFreeCoins() {
      this.reward(claimFreeCoins(this.profile, this.verified), 'free')
    },

    notifyMe() {
      this.profile.notify = true
      this.dirty = true
    },
  }

  /**
   * Moves the ride on to metre `s`, but no further than its gear could have slid it
   * since it began (nor past the end of the slide's run-out). Returns whether `s` was a
   * number.
   */
  advance(s, now) {
    const ride = this.ride
    const m = Number(s)
    if (!ride || !Number.isFinite(m)) return false
    const allowed = ((now - ride.startedAt) / 1000) * ride.cap + RIDE_SLACK
    ride.s = Math.max(ride.s, Math.min(m, allowed, courseOf(ride.world).length + 200))
    ride.lastAt = now
    return true
  }

  /** Ends the ride in progress, banking what it earned. */
  finish(now, reason = null) {
    const ride = this.ride
    if (!ride) return
    this.ride = null
    this.onRide?.(null)
    const result = finishRide(
      this.profile,
      { world: ride.world, distance: ride.s, pickups: ride.coins.size, smashes: ride.walls.size, boosts: ride.boosts.size, race: Boolean(ride.race) },
      now,
    )
    this.coinsEarned += result.total
    this.dirty = true
    this.emit('rideResult', { ...result, badges: undefined, id: ride.id })
    for (const badge of result.badges) this.emit('badge', badge)
    if (reason) this.emit('rideEnd', { reason, id: ride.id })
    if (ride.race) this.onRaceEnd?.(ride.race, ride.s)
  }

  /** A race prize: Diamonds (RaceHost settles who wins what). */
  awardRace(diamonds) {
    this.profile.diamonds += diamonds
    this.reward({ ok: true, diamonds }, 'race')
  }

  /** Boxity confirmed a rewarded ad: pays it, if there's something to pay. */
  grantAdReward(placement, now) {
    const result = grantAdReward(this.profile, placement, now)
    if (result.ok) this.coinsEarned += result.coins
    this.reward(result, 'ad')
    if (this.dirty) this.sendProfile()
    return result
  }


  /** Call at a steady rate (the room's simulation interval). */
  tick(dt, now) {
    if (this.ride && now - this.ride.lastAt > RIDE_TIMEOUT_MS) this.finish(now, 'timeout')
    this.profile.stats.playtime += dt
    // Today's gifts open with play; the client counts on between profile updates, so
    // they're only sent when one is just ready.
    const before = giftStatus(giftsToday(this.profile, now)).filter((g) => g.state === 'ready').length
    playGifts(this.profile, dt, now)
    if (giftStatus(this.profile.gifts).filter((g) => g.state === 'ready').length !== before) this.dirty = true
    if (this.dirty) this.sendProfile()
  }
}
