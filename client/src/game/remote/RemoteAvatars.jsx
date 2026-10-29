import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Euler, Vector3 } from 'three'

import { WALK_SPEED } from '@shared/world'

import { remotePlayers } from '../../net/remotePlayers'
import { asToyInstance } from '../blocks'
import { emoteMotion } from '../emotes'
import { sharedMaterials } from '../materials'
import { BloxityAvatar } from '../PlayerAvatar'
import { BODY_BULK } from '../playerPose'
import { seatHeight, sledGeometry } from '../sleds/sledModels'
import { stepRemoteRiders } from './remoteRide'

/** How often the set of players is checked for comings, goings and outfit changes. */
const PICK_MS = 500
/** The most other players drawn (a room holds 8). */
const MAX_SHOWN = 12
/** Past these distances a player is posed every 2nd, then every 4th frame. */
const POSE_HALF = 30
const POSE_QUARTER = 60

const _up = new Vector3(0, 1, 0)
const _euler = new Euler(0, 0, 0, 'YXZ')

/**
 * One other player as their real Bloxity avatar, dressed as they are, with their sled -
 * slung on their back in the lobby, under them on the slingshot and down the slide - and
 * posed by the same playerPose as yours, from what the network says they're doing.
 */
function RemoteAvatar({ sessionId, look }) {
  const groupRef = useRef(null)
  const seatRef = useRef(null)
  const sledRef = useRef(null)
  const handRef = useRef(null)
  const lastY = useRef(null)
  const sledId = useRef(null)
  const sledMesh = useMemo(() => {
    const mesh = asToyInstance(sledGeometry(null), sharedMaterials().sled)
    mesh.frustumCulled = false
    return mesh
  }, [])
  useEffect(() => () => sledMesh.dispose(), [sledMesh])
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: WALK_SPEED, vy: 0, stride: 0, riding: false, lean: 0, pull: 0, air: 0, bulk: BODY_BULK })

  useFrame((state, rawDelta) => {
    const group = groupRef.current
    const seat = seatRef.current
    const sled = sledRef.current
    const r = remotePlayers.get(sessionId)
    if (!group || !seat || !sled || !r) return
    const delta = Math.min(rawDelta, 0.05)
    stepRemoteRiders(remotePlayers, state.clock.elapsedTime, delta)
    const m = motionRef.current
    const far = state.camera.position.distanceTo(group.position)
    m.poseEvery = far > POSE_QUARTER ? 4 : far > POSE_HALF ? 2 : 1
    m.time += delta
    if (r.sled !== sledId.current) {
      sledId.current = r.sled
      sled.geometry = sledGeometry(r.sled)
    }

    // Down the slide (or about to be, on the slingshot): sat on the sled.
    if (r.riding || r.anim === 'pull') {
      group.visible = true
      if (r.riding) {
        group.position.copy(r.shownAt)
        _euler.set(r.ridePitch || 0, Math.PI, r.rideRoll || 0)
        group.quaternion.setFromEuler(_euler)
      } else {
        group.position.copy(r.position)
        group.quaternion.setFromAxisAngle(_up, Math.PI)
      }
      sled.position.set(0, 0, 0)
      sled.rotation.set(0, 0, 0)
      sled.scale.setScalar(1)
      seat.position.y = seatHeight(r.sled) - 0.06
      m.riding = true
      m.lean = 0
      m.air = r.shownY > 0.4 ? 1 : 0
      m.pull = r.anim === 'pull' ? 0.6 : 0
      m.emoteClip = null
      lastY.current = null
      return
    }
    m.riding = false
    seat.position.y = 0
    sled.position.set(0, 1.0, -0.62)
    sled.rotation.set(Math.PI / 2 - 0.12, 0, 0)
    sled.scale.setScalar(0.62)

    // Mid-ride but we never saw it start (we joined late): not drawn on the pad.
    group.visible = r.anim !== 'ride'
    group.position.copy(r.position)
    group.quaternion.setFromAxisAngle(_up, r.yaw)
    m.speed = r.speed
    m.maxSpeed = WALK_SPEED
    m.grounded = r.anim !== 'jump'
    m.dance = r.anim === 'dance' ? 1 : 0
    // Vertical speed from the interpolated height, smoothed: rising vs falling.
    const y = r.position.y
    if (lastY.current !== null) m.vy += ((y - lastY.current) / Math.max(delta, 1e-3) - m.vy) * 0.3
    lastY.current = y
    m.stride += delta * (5 + 6 * Math.min(1, r.speed / WALK_SPEED))
    // Their Boxity emote, while they stand still.
    if (!r.emote || r.speed > 0.6 || !m.grounded || !emoteMotion(m, r.emote, r.emoteStart)) m.emoteClip = null
  })

  return (
    <group ref={groupRef}>
      <primitive ref={sledRef} object={sledMesh} />
      <group ref={seatRef}>
        <BloxityAvatar equipped={look?.equipped} proportions={look?.proportions} motionRef={motionRef} handRef={handRef} targetHeight={1.8} />
        <group ref={handRef} />
      </group>
    </group>
  )
}

/**
 * Every other player as their real Bloxity avatar, dressed as they are - standing,
 * walking or riding, however far away (the far ones just posed less often). Each shows
 * once it's dressed; until then, nothing - never a stand-in. Checked twice a second,
 * never per frame, so React only re-renders when the set of players (or an outfit)
 * actually changes.
 */
export function RemoteAvatars() {
  const [shown, setShown] = useState([])

  useEffect(() => {
    const pick = () => {
      const next = [...remotePlayers.values()].sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1)).slice(0, MAX_SHOWN)
      setShown((prev) => {
        const same = prev.length === next.length && prev.every((p, i) => p.sessionId === next[i].sessionId && p.lookKey === next[i].lookKey)
        return same ? prev : next.map((r) => ({ sessionId: r.sessionId, look: r.look, lookKey: r.lookKey }))
      })
    }
    pick()
    const id = setInterval(pick, PICK_MS)
    return () => clearInterval(id)
  }, [])

  return shown.map((s) => (
    <Suspense key={`${s.sessionId}:${s.lookKey}`} fallback={null}>
      <RemoteAvatar sessionId={s.sessionId} look={s.look} />
    </Suspense>
  ))
}

export default RemoteAvatars
