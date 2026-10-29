import { Vector3 } from 'three'

import { FIRST_SLED, FIRST_TRAIL } from '@shared/balance'

import { WORLD } from '../game/ride/course'
import { runtime } from '../game/runtime'

/**
 * Other players, as the network last described them. Network callbacks write here;
 * the renderer reads it each frame and interpolates between snapshots, drawing
 * everyone ~110 ms in the past so 10 Hz updates still move smoothly.
 */

/** sessionId -> remote player */
export const remotePlayers = new Map()

const MAX_SNAPSHOTS = 24
/** The synced `rideMeter` of someone who isn't riding (see the server's schema). */
const NOT_RIDING = -999

export function upsertRemotePlayer(sessionId, state) {
  let r = remotePlayers.get(sessionId)
  if (!r) {
    r = {
      sessionId,
      name: '',
      snaps: [],
      position: new Vector3(state.x, state.y, state.z),
      yaw: state.rotY,
      speed: 0,
      anim: 'idle',
      sled: FIRST_SLED,
      trail: FIRST_TRAIL,
      /** Their avatar's outfit, parsed from `look`; `lookKey` is the raw string. */
      look: null,
      lookKey: '',
      /**
       * Down the slide: whether they're riding (in our world), where they've reported,
       * and where they're drawn (eased towards it).
       */
      riding: false,
      rideMeter: 0,
      rideX: 0,
      rideY: 0,
      shownMeter: 0,
      shownX: 0,
      shownY: 0,
      rideSpeed: 0,
      best: 0,
      /** Where they're drawn: down the slide while riding, else in the lobby. */
      shownAt: new Vector3(state.x, state.y, state.z),
    }
    r.shadow = { position: r.shownAt, size: 1.1, visible: true }
    runtime.shadowCasters.add(r.shadow)
    remotePlayers.set(sessionId, r)
  }
  r.name = state.name
  /** Their Boxity account id ('' for a guest of ours): what chat bubbles find them by. */
  r.uid = state.uid || ''
  r.anim = state.anim
  // A Boxity emote: played from when we heard of it.
  if ((state.emote || '') !== (r.emote || '')) {
    r.emote = state.emote || ''
    r.emoteStart = performance.now()
  }
  r.sled = state.sled || FIRST_SLED
  r.trail = state.trail || FIRST_TRAIL
  r.world = state.world || 0
  r.best = state.best || 0
  // Riding in another world: not on this slide (and not in the lobby either).
  const riding = state.rideMeter > NOT_RIDING && r.world === WORLD
  if (riding && !r.riding) {
    // Just started: drawn from where they are, no easing in from elsewhere.
    r.shownMeter = state.rideMeter
    r.shownX = state.rideX
    r.shownY = state.rideY
  }
  r.riding = riding
  r.rideMeter = state.rideMeter
  r.rideX = state.rideX
  r.rideY = state.rideY
  if (state.look !== r.lookKey) {
    r.lookKey = state.look
    try {
      r.look = state.look ? JSON.parse(state.look) : null
    } catch {
      r.look = null
    }
  }
  const last = r.snaps[r.snaps.length - 1]
  if (!last || last.x !== state.x || last.y !== state.y || last.z !== state.z || last.r !== state.rotY) {
    r.snaps.push({ t: performance.now(), x: state.x, y: state.y, z: state.z, r: state.rotY })
    if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift()
  }
}

export function removeRemotePlayer(sessionId) {
  const r = remotePlayers.get(sessionId)
  if (!r) return
  runtime.shadowCasters.delete(r.shadow)
  remotePlayers.delete(sessionId)
}

export function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
}
