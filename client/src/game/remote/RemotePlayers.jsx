import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Vector3 } from 'three'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { hideNameplatesFrom, NAMEPLATE_POOL_SIZE, placeNameplate } from './nameplates'
import { stepRemoteRiders } from './remoteRide'

/** Remote players are drawn this far in the past, so 10 Hz updates interpolate. */
const INTERP_DELAY_MS = 110
/** Riders are drawn this much further away than people in the lobby. */
const RIDER_DISTANCE_SCALE = 2

const _v = new Vector3()
const _prev = new Vector3()

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Interpolates a remote player to `renderTime`. */
function interpolate(r, renderTime) {
  const snaps = r.snaps
  if (snaps.length === 0) return
  let i = snaps.length - 1
  while (i > 0 && snaps[i - 1].t > renderTime) i -= 1
  const b = snaps[i]
  const a = snaps[Math.max(0, i - 1)]
  const span = b.t - a.t
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.t) / span)) : 1
  _prev.copy(r.position)
  r.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
  r.yaw = lerpAngle(a.r, b.r, t)
  // Drop snapshots we've moved past, keeping one to interpolate from.
  while (snaps.length > 2 && snaps[1].t < renderTime) snaps.shift()
}

/** Puts a name tag over `at`, if it's on screen; returns the next free tag. */
function writeNameplate(plate, name, at, distance, maxDistance, camera, size) {
  if (plate >= NAMEPLATE_POOL_SIZE) return plate
  if (distance < maxDistance) {
    _v.copy(at).project(camera)
    if (_v.z < 1) {
      const fade = Math.min(1, (maxDistance - distance) / 6)
      placeNameplate(plate, name, (_v.x * 0.5 + 0.5) * size.width, (-_v.y * 0.5 + 0.5) * size.height, fade)
      return plate + 1
    }
  }
  placeNameplate(plate, '', null)
  return plate + 1
}

/**
 * Everyone else: where they are (interpolated from the server's 10 Hz updates), their
 * name tags and shadows. Down the slide they're where the server says, on their sleds.
 * Their bodies are their real avatars (RemoteAvatars).
 */
export function RemotePlayers() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => () => hideNameplatesFrom(0), [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const settings = getQuality()
    const now = performance.now()
    const renderTime = now - INTERP_DELAY_MS
    stepRemoteRiders(remotePlayers, state.clock.elapsedTime, delta)

    let plate = 0

    for (const r of remotePlayers.values()) {
      interpolate(r, renderTime)
      const moved = _prev.distanceTo(r.position)
      r.speed = r.speed * 0.8 + (moved / Math.max(delta, 1e-3)) * 0.2

      // --- Down the slide (stepRemoteRiders placed them) ------------------------------
      if (r.riding) {
        const distance = camera.position.distanceTo(r.shownAt)
        r.shadow.visible = distance < settings.remoteDrawDistance * RIDER_DISTANCE_SCALE
        if (!r.shadow.visible) continue
        _v.copy(r.shownAt).y += 2.2
        plate = writeNameplate(plate, r.name, _v, distance, settings.remoteNameDistance, camera, size)
        continue
      }

      // --- In the lobby -----------------------------------------------------------
      r.shownAt.copy(r.position)
      const distance = camera.position.distanceTo(r.position)
      // Someone mid-ride we never saw start (we joined late) isn't drawn on the pad.
      const visible = distance < settings.remoteDrawDistance && r.anim !== 'ride'
      r.shadow.visible = visible

      // Name tag, just above the head (players are 1.8 tall).
      if (visible) {
        _v.set(r.position.x, r.position.y + 2.05, r.position.z)
        plate = writeNameplate(plate, r.name, _v, distance, settings.remoteNameDistance, camera, size)
      }
    }
    hideNameplatesFrom(plate)
  })

  return null
}

export default RemotePlayers
