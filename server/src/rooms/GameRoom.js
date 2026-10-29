import { Room } from '@colyseus/core'

import { AD_REWARDS } from '../../../shared/balance.js'
import { PlayerSession } from '../../../shared/session.js'
import { RaceHost } from '../../../shared/race.js'
import { clampToWalkable, isTeleportSpot, MAX_MOVE_SPEED, SPAWN } from '../../../shared/world.js'
import { isGuestId, noteScores, verifyAdReward, verifyPlayerToken } from '../boxity.js'
import { adoptGuestProgress, loadProfile, saveProfile } from '../db.js'
import { getLeaderboards } from '../leaderboards.js'
import { activePlayers, liveRooms } from '../registry.js'
import { GameState, NOT_RIDING, PlayerState } from './schema.js'

const MAX_CLIENTS = 8
const RECONNECT_SECONDS = 20
const AUTOSAVE_MS = 30_000
/** State patches to clients, and the training simulation, per second. */
const PATCH_HZ = 15
const SIM_HZ = 10
/** Allowance on top of max speed for a position update to be accepted. */
const MOVE_SLACK = 2.5
/** Close code used when the same player joins somewhere else (4000-4010 are Colyseus's own). */
const DUPLICATE_LOGIN = 4100
/** Names this server process in save ownership; Legion sets POD_NAME per pod. */
const POD = process.env.POD_NAME || `local-${process.pid}`

/** What other players may be told someone is doing. */
const ANIMS = ['idle', 'walk', 'jump', 'pull', 'ride', 'dance']

/** Unambiguous characters for lobby codes people read out to each other. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = (length = 5) =>
  Array.from({ length }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')

const cleanName = (name) =>
  String(name || 'Player')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 20) || 'Player'

/**
 * One lobby: up to 8 players sharing a world. All game rules run in each player's
 * PlayerSession; the room handles networking, position validation, persistence and
 * the small shared state other players render from.
 */
export class GameRoom extends Room {
  maxClients = MAX_CLIENTS
  autoDispose = true

  /**
   * sessionId -> { session, playerId, owner, lastPos, lastPosAt, kicked?, reconnection? }
   * `owner` claims the player's save for this session (see db.js).
   */
  members = new Map()
  /** The races, every few minutes, for everyone in the room (shared/race.js). */
  races = new RaceHost()

  onCreate(options = {}) {
    this.setState(new GameState())
    if (options.private) {
      // A short code friends can type instead of the long generated room id.
      this.roomId = makeCode()
      this.state.code = this.roomId
      this.state.isPrivate = true
      this.setPrivate(true)
    }
    this.setPatchRate(1000 / PATCH_HZ)
    this.setSimulationInterval((dt) => this.tick(dt / 1000), 1000 / SIM_HZ)
    this.updateListing()
    liveRooms.add(this)

    // Everything the client can ask for goes through the player's session.
    this.onMessage('*', (client, type, payload) => {
      if (type === 'pos') return this.handlePosition(client, payload)
      if (type === 'look') return this.handleLook(client, payload)
      if (type === 'emote') return this.handleEmote(client, payload)
      if (type === 'respawn') return this.handleRespawn(client)
      if (type === 'adReward') return this.handleAdReward(client, payload)
      const member = this.members.get(client.sessionId)
      if (!member) return
      member.session.handle(String(type), payload || {}, Date.now())
      this.syncPlayer(client.sessionId)
    })

    this.autosave = setInterval(() => this.saveAll(), AUTOSAVE_MS)
  }

  /**
   * Who's joining. A Boxity token, checked with Boxity, names the account whose save is
   * loaded - and carries a guest's progress into it if the account has none yet. With
   * no token (or Boxity unreachable), the id the client brought: our own guests' random
   * per-browser ids, which only ever reach their own guest save. Only verified players
   * count towards Boxity's leaderboards.
   */
  async onAuth(_client, options) {
    const verified = await verifyPlayerToken(options?.token)
    if (verified) {
      const playerId = String(verified.user._id)
      if (verified.carriedFrom.length) {
        const from = await adoptGuestProgress(playerId, verified.carriedFrom)
        if (from) console.log(`[room] carried guest ${from}'s progress into ${playerId}`)
      }
      return { playerId, name: cleanName(options?.name || verified.user.displayName || verified.user.username), verified: true }
    }
    const playerId = String(options?.playerId || '').slice(0, 80)
    if (!playerId) throw new Error('Missing player id')
    return { playerId, name: cleanName(options?.name), verified: false }
  }

  async onJoin(client, _options, auth) {
    const { playerId, name, verified } = client.auth || auth

    // Same account joining again (a refresh, a new tab, a reconnect the old session
    // hasn't noticed yet): the newest connection wins. The old one is saved and removed
    // at once, even when it's only a seat held open for a reconnect - otherwise a
    // frozen copy of the player would stand in the lobby until that ran out.
    const existing = activePlayers.get(playerId)
    if (existing) await existing.room.evict(existing.client, 'You joined from another window.')

    const now = Date.now()
    const owner = `${POD}:${client.sessionId}`
    const profile = await loadProfile(playerId, name, owner)

    const player = new PlayerState()
    const spawnX = SPAWN.x + (Math.random() - 0.5) * 6
    const spawnZ = SPAWN.z + (Math.random() - 0.5) * 4
    Object.assign(player, { name, uid: verified && !isGuestId(playerId) ? playerId : '', x: spawnX, y: 0, z: spawnZ, rotY: Math.PI, anim: 'idle', rideMeter: NOT_RIDING })
    this.state.players.set(client.sessionId, player)

    const session = new PlayerSession(profile, {
      now,
      emit: (type, payload) => client.send(type, payload),
      getPosition: () => player,
      verified: Boolean(verified) && !isGuestId(playerId),
      // Everyone else sees you down the slide from the synced state.
      onRide: (ride) => {
        player.rideMeter = ride ? ride.s : NOT_RIDING
        player.rideX = ride ? ride.x : 0
        player.rideY = ride ? ride.y || 0 : 0
      },
    })

    this.members.set(client.sessionId, { session, playerId, verified: Boolean(verified), owner, lastPos: { x: spawnX, z: spawnZ }, lastPosAt: now })
    session.onJoinRace = (at) => this.races.join(client.sessionId, this.raceMember(client.sessionId), at, this.raceMembers())
    session.onRaceStart = (raceId) => this.races.started(client.sessionId, raceId)
    session.onRaceEnd = (raceId, s) => this.races.finished(client.sessionId, raceId, s)
    activePlayers.set(playerId, { room: this, client })

    session.sendProfile()
    session.greet()
    client.send('spawn', { x: spawnX, z: spawnZ })
    client.send('leaderboards', getLeaderboards())
    this.races.hello(client.sessionId, this.raceMember(client.sessionId), now)
    this.syncPlayer(client.sessionId)
    this.updateListing()
  }

  /** Dropped without saying goodbye (mobile network blip): hold the seat. */
  async onDrop(client) {
    const member = this.members.get(client.sessionId)
    if (!member || member.kicked) return
    member.reconnection = this.allowReconnection(client, RECONNECT_SECONDS)
    try {
      await member.reconnection
    } catch {
      // Window expired, or the player came back as a new session (evict); onLeave
      // cleans up.
    } finally {
      member.reconnection = null
    }
  }

  onReconnect(client) {
    const member = this.members.get(client.sessionId)
    if (!member) return
    activePlayers.set(member.playerId, { room: this, client })
    member.session.emit = (type, payload) => client.send(type, payload)
    member.session.sendProfile()
  }

  async onLeave(client) {
    const member = this.members.get(client.sessionId)
    this.state.players.delete(client.sessionId)
    if (member) {
      if (activePlayers.get(member.playerId)?.client === client) activePlayers.delete(member.playerId)
      this.members.delete(client.sessionId)
      // A ride still going (the tab closed mid-ride, the connection lost for good): banked.
      if (!member.kicked && member.session.ride) member.session.finish(Date.now(), 'left')
      this.races.leave(client.sessionId)
      this.noteScores(member)
      if (!member.kicked) await saveProfile(member.session.profile, member.owner)
    }
    this.updateListing()
  }

  /**
   * The pod is going away (a deploy, or scaling in): save everyone, then close with
   * SERVER_SHUTDOWN, which sends each client back through the matchmaker to a pod
   * that's staying.
   */
  async onBeforeShutdown() {
    await this.saveAll()
    super.onBeforeShutdown()
  }

  async onDispose() {
    clearInterval(this.autosave)
    liveRooms.delete(this)
    await this.saveAll()
  }

  // --- Helpers -----------------------------------------------------------------------

  /** Hands a verified player's scores to the Boxity leaderboard reporter. */
  noteScores(member) {
    if (!member.verified) return
    noteScores(member.playerId, member.session.profile, member.session.coinsEarned)
    member.session.coinsEarned = 0
  }

  /** Everyone's scores here, for the reporter's next report. */
  collectScores() {
    for (const member of this.members.values()) this.noteScores(member)
  }

  /**
   * Saves and removes a player who has joined again elsewhere: gone from everyone's
   * view at once, and a seat held for their reconnect let go rather than left to run
   * out.
   */
  async evict(client, reason) {
    const member = this.members.get(client.sessionId)
    this.state.players.delete(client.sessionId)
    if (member && !member.kicked) {
      if (member.session.ride) member.session.finish(Date.now(), 'left')
      member.kicked = true
      await saveProfile(member.session.profile, member.owner)
      member.reconnection?.reject(new Error('replaced by a new session'))
    }
    try {
      client.send('kicked', { reason })
      client.leave(DUPLICATE_LOGIN)
    } catch {
      // Already disconnected (the held-seat case).
    }
  }

  /**
   * Saves everyone here. A save refused because the player's save now belongs to a newer
   * session (they joined again, on another pod) means this one is stale: it's let go, so
   * it can't go on playing on progress that will never be kept.
   */
  saveAll() {
    return Promise.all(
      [...this.members.entries()].map(async ([sessionId, m]) => {
        if (m.kicked) return
        if (await saveProfile(m.session.profile, m.owner)) return
        const client = this.clients.find((c) => c.sessionId === sessionId)
        if (client && !m.kicked) await this.evict(client, 'You joined from another window.')
      }),
    )
  }

  updateListing() {
    this.setMetadata({
      players: this.clients.length,
      isPrivate: Boolean(this.state.isPrivate),
      region: process.env.REGION || 'default',
    })
  }

  /** Copies the public bits of a profile into the synced state (only what changed). */
  syncPlayer(sessionId) {
    const member = this.members.get(sessionId)
    const player = this.state.players.get(sessionId)
    if (!member || !player) return
    const p = member.session.profile
    if (player.world !== p.world) player.world = p.world
    if (player.sled !== p.sled) player.sled = p.sled
    if (player.trail !== p.trail) player.trail = p.trail
    const best = p.best[p.world] ?? 0
    if (player.best !== best) player.best = best
  }

  /**
   * Position reports, ~10 Hz from each client. Accepted if the move is physically
   * possible since the last accepted one (or lands on one of the fixed spots PLAY and
   * the trip back after a ride take you to);
   * otherwise the client is snapped back.
   */
  handlePosition(client, msg) {
    const member = this.members.get(client.sessionId)
    const player = this.state.players.get(client.sessionId)
    if (!member || !player || !msg) return
    const x = Number(msg.x)
    const y = Number(msg.y)
    const z = Number(msg.z)
    if (![x, y, z].every(Number.isFinite)) return

    const now = Date.now()
    const dt = Math.max(0.05, (now - member.lastPosAt) / 1000)
    const dist = Math.hypot(x - member.lastPos.x, z - member.lastPos.z)
    if (dist > MAX_MOVE_SPEED * dt + MOVE_SLACK && !isTeleportSpot({ x, z })) {
      client.send('correct', { x: member.lastPos.x, y: player.y, z: member.lastPos.z })
      return
    }
    const clamped = clampToWalkable(x, z)
    member.lastPos = clamped
    member.lastPosAt = now
    player.x = clamped.x
    player.y = Math.max(0, Math.min(y, 6))
    player.z = clamped.z
    player.rotY = Number(msg.r) || 0
    player.anim = ANIMS.includes(msg.a) ? msg.a : 'idle'
  }

  /**
   * What a player's avatar wears, so everyone else can dress them the same. Purely
   * cosmetic, so trusted as sent, but kept to a small object of short strings and
   * plain numbers.
   */
  handleLook(client, msg) {
    const player = this.state.players.get(client.sessionId)
    if (!player || !msg || typeof msg !== 'object') return
    const clean = (obj, keep) => {
      const out = {}
      if (!obj || typeof obj !== 'object') return out
      for (const [key, value] of Object.entries(obj).slice(0, 24)) {
        if (key.length > 24) continue
        if (keep(value)) out[key] = value
      }
      return out
    }
    const look = JSON.stringify({
      equipped: clean(msg.equipped, (v) => (typeof v === 'string' && v.length <= 40) || (Number.isFinite(v) && Math.abs(v) < 1e12)),
      // Boxity's own ranges (legOffsetX runs -0.7 to 5).
      proportions: clean(msg.proportions, (v) => Number.isFinite(v) && v > -1 && v < 6),
    })
    if (look.length <= 2048 && look !== player.look) player.look = look
  }

  /**
   * Boxity's "Reset Character": back at the spawn point at once (out of any ride, banked),
   * the jump allowed since it's the server that puts you there.
   */
  handleRespawn(client) {
    const member = this.members.get(client.sessionId)
    const player = this.state.players.get(client.sessionId)
    if (!member || !player) return
    if (member.session.ride) member.session.finish(Date.now(), 'left')
    Object.assign(player, { x: SPAWN.x, y: 0, z: SPAWN.z })
    member.lastPos = { x: SPAWN.x, z: SPAWN.z }
    member.lastPosAt = Date.now()
    client.send('spawn', { x: SPAWN.x, z: SPAWN.z })
    this.syncPlayer(client.sessionId)
  }

  /**
   * 'adReward' `{ placement, rewardToken }`: the client watched a rewarded ad. Paid
   * only once Boxity confirms the token; one check at a time per player.
   */
  async handleAdReward(client, msg) {
    const member = this.members.get(client.sessionId)
    const placement = String(msg?.placement || '')
    const rewardToken = msg?.rewardToken
    if (!member || member.adPending || !Object.hasOwn(AD_REWARDS, placement)) return
    if (typeof rewardToken !== 'string' || !rewardToken || rewardToken.length > 4096) return
    member.adPending = true
    try {
      if (!(await verifyAdReward(rewardToken))) return
      // Still here after the wait?
      if (this.members.get(client.sessionId) !== member || member.kicked) return
      member.session.grantAdReward(placement, Date.now())
    } finally {
      member.adPending = false
    }
  }

  /**
   * A Boxity emote started (or, with no id, stopped), so everyone sees it. Cosmetic: the
   * id is only checked to be a catalogue-style id; Boxity sent it only if it's theirs.
   */
  handleEmote(client, msg) {
    const player = this.state.players.get(client.sessionId)
    const id = typeof msg?.id === 'string' ? msg.id : ''
    if (!player || !/^[a-z0-9]{0,32}$/i.test(id)) return
    player.emote = id
    player.emoteAt = id ? Date.now() : 0
  }

  tick(dt) {
    const now = Date.now()
    for (const [sessionId, member] of this.members) {
      member.session.tick(dt, now)
      this.syncPlayer(sessionId)
    }
    this.races.tick(now, this.raceMembers())
  }

  /** A player as the races see them: name, session, and how to reach them. */
  raceMember(sessionId) {
    const member = this.members.get(sessionId)
    if (!member) return null
    return { name: this.state.players.get(sessionId)?.name ?? 'Player', session: member.session, send: (type, payload) => member.session.emit(type, payload) }
  }

  raceMembers() {
    const all = new Map()
    for (const sessionId of this.members.keys()) all.set(sessionId, this.raceMember(sessionId))
    return all
  }
}
