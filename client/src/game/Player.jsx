import { useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Euler, Quaternion, Vector3 } from 'three'

import { clampToWalkable, groundHeightAt, STATIC_COLLIDERS, WALK_SPEED } from '@shared/world'

import { sfx } from '../audio/sfx'
import { prefetchLook } from '../bloxity/avatarLoader'
import { useBloxity } from '../bloxity/BloxityContext'
import { getGame } from '../store/game'
import ErrorBoundary from '../ui/ErrorBoundary'
import { asToyInstance } from './blocks'
import { emoteMotion, stopEmote } from './emotes'
import FallbackAvatar from './FallbackAvatar'
import { sharedMaterials } from './materials'
import PlayerAvatar, { AvatarShaderWarmup } from './PlayerAvatar'
import { BODY_BULK } from './playerPose'
import { advanceRide, ride } from './ride/rideControl'
import { runtime } from './runtime'
import { seatHeight, sledGeometry } from './sleds/sledModels'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
const RADIUS = 0.45

const ACCELERATION = 16
const GRAVITY = 32
const JUMP_SPEED = 10.5
/** Ledges up to this high are walked straight onto (the boardwalk). */
const STEP_UP = 1.05
/** The win dance lasts this long, unless you move off sooner. */
const DANCE_MS = 4500

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _euler = new Euler(0, 0, 0, 'YXZ')
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }
/** Ride input, handed to the ride each frame. */
const rideInput = { steer: 0, jump: false, rocket: false, hold: false }

/** Pushes a circle out of an axis-aligned rect. Returns true on contact. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return false

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const shove = (RADIUS - d) / d
    pos.x += dx * shove
    pos.z += dz * shove
    return true
  }

  // Centre inside the rect (spawned in, or a wall appeared on top of us): leave by the
  // nearest side.
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
  return true
}

/**
 * The local player: a kinematic character controller.
 *
 * No physics engine: the plaza is flat snow, a boardwalk and a list of rectangular
 * walls, which a circle-vs-rect push-out handles exactly. That saves the ~2 MB Rapier
 * WASM download and keeps the active rigid body count at zero.
 *
 * In the lobby you walk about with your sled slung on your back. On the slingshot and
 * down the slide you sit on it: the ride (ride/rideControl.js) says where, and this
 * draws you there, tipped with the slope and leaning into the turns. Your logical
 * position stays on the slingshot's pad all the while (it's what the server checks).
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 *
 * @param {{ onAvatarReady?: () => void }} props
 */
export function Player({ onAvatarReady }) {
  const { avatar } = useBloxity()
  // Your clothes start downloading now, not once the body has.
  useEffect(() => prefetchLook(avatar), [avatar])
  const [avatarIn, setAvatarIn] = useState(false)
  const handleAvatarReady = useCallback(() => {
    setAvatarIn(true)
    onAvatarReady?.()
  }, [onAvatarReady])
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  const seatRef = useRef(null)
  const sledRef = useRef(null)
  const handRef = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(new Vector3())
  const vy = useRef(0)
  const wasRiding = useRef(false)
  const sledId = useRef(null)
  const sledMesh = useMemo(() => {
    const mesh = asToyInstance(sledGeometry(null), sharedMaterials().sled)
    mesh.frustumCulled = false
    return mesh
  }, [])
  useEffect(() => () => sledMesh.dispose(), [sledMesh])

  /** Handed to the avatar so it can pose itself. A ref: written every frame. */
  const motionRef = useRef({
    time: 0,
    speed: 0,
    grounded: true,
    maxSpeed: WALK_SPEED,
    vy: 0,
    stride: 0,
    riding: false,
    lean: 0,
    pull: 0,
    air: 0,
    cheer: 0,
    dance: 0,
    bulk: BODY_BULK,
  })

  // The blob shadow follows what's drawn, which is down the slide while you ride.
  const shownAt = useMemo(() => new Vector3().copy(runtime.player.position), [])
  useEffect(() => {
    const caster = { position: shownAt, size: 1.2 }
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [shownAt])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const player = runtime.player
    const pos = player.position
    const k = keys.current
    const joy = runtime.input
    const motion = motionRef.current
    motion.time += delta
    motion.bulk = BODY_BULK

    const group = groupRef.current
    const visual = visualRef.current
    const seat = seatRef.current
    const sled = sledRef.current
    if (!group || !visual || !seat || !sled) return

    // Your sled, whichever you've equipped.
    const id = getGame().profile.sled
    if (id !== sledId.current) {
      sledId.current = id
      sled.geometry = sledGeometry(id)
    }

    // --- On the slingshot, down the slide -----------------------------------------
    if (ride.active) {
      rideInput.steer = Math.max(-1, Math.min(1, (k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX + joy.steer))
      rideInput.jump = k.jump || joy.jump
      rideInput.rocket = k.rocket || joy.rocket
      rideInput.hold = k.jump || joy.jump
      advanceRide(delta, rideInput)
      if (!ride.active) return
      if (!wasRiding.current) {
        wasRiding.current = true
        velocity.current.set(0, 0, 0)
        vy.current = 0
        if (player.emote) stopEmote()
      }
      group.position.copy(ride.position)
      _euler.set(ride.pitch, Math.PI, ride.roll)
      visual.quaternion.setFromEuler(_euler)
      // On the sled: sat on its seat, the sled under you.
      sled.position.set(0, 0, 0)
      sled.rotation.set(0, 0, 0)
      sled.scale.setScalar(1)
      seat.position.y = seatHeight(id) - 0.06
      shownAt.copy(ride.position)
      player.anim = ride.phase === 'pull' ? 'pull' : 'ride'
      player.speed = 0
      const airborne = ride.sim?.airborne ? 1 : 0
      motion.riding = true
      motion.lean += (rideInput.steer - motion.lean) * (1 - Math.exp(-8 * delta))
      motion.pull = ride.phase === 'pull' ? ride.power : 0
      motion.air += (airborne - motion.air) * (1 - Math.exp(-10 * delta))
      motion.cheer = ride.phase === 'result' ? Math.min(1, motion.cheer + delta * 2) : 0
      motion.emoteClip = null
      return
    }
    if (wasRiding.current) {
      // Off the sled: back in the lobby.
      wasRiding.current = false
      velocity.current.set(0, 0, 0)
      vy.current = 0
      group.position.copy(pos)
      visual.quaternion.setFromAxisAngle(_up, player.yaw)
      motion.riding = false
      motion.cheer = 0
      motion.air = 0
    }
    // In the lobby your sled rides on your back, standing up, its bottom outwards.
    seat.position.y = 0
    sled.position.set(0, 1.0, -0.62)
    sled.rotation.set(Math.PI / 2 - 0.12, 0, 0)
    sled.scale.setScalar(0.62)

    const locked = player.frozen
    const moving = (k.forward || k.backward || k.left || k.right || Math.hypot(joy.joyX, joy.joyY) > 0.02) && !locked

    // --- Input, relative to the camera ----------------------------------------
    _input.set(0, 0, 0)
    if (!locked) {
      _input.set((k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX, 0, (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY)
    }
    const inputLength = Math.min(1, _input.length())
    if (inputLength > 0.02) {
      _input.normalize()
      // Flatten the camera's forward onto the ground plane so "up" always means
      // "away from the camera".
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()
        .multiplyScalar(WALK_SPEED * inputLength)
    } else {
      _move.set(0, 0, 0)
    }

    // Ease towards the target velocity: crisp, but no instant 0->max snaps.
    velocity.current.lerp(_move, 1 - Math.exp(-ACCELERATION * delta))

    // --- Horizontal move + collision --------------------------------------------
    const prevX = pos.x
    const prevZ = pos.z
    pos.x += velocity.current.x * delta
    pos.z += velocity.current.z * delta
    for (const rect of STATIC_COLLIDERS) pushOut(pos, rect)
    for (const rect of runtime.dynamicColliders) pushOut(pos, rect)
    clampToWalkable(pos.x, pos.z, _clamped)
    pos.x = _clamped.x
    pos.z = _clamped.z
    // A ledge too tall to step onto acts as a wall.
    let floor = groundHeightAt(pos.x, pos.z)
    if (floor - pos.y > STEP_UP) {
      pos.x = prevX
      pos.z = prevZ
      floor = groundHeightAt(pos.x, pos.z)
    }

    // --- Vertical ---------------------------------------------------------------
    if (!locked && (k.jump || joy.jump) && player.grounded) {
      vy.current = JUMP_SPEED
      player.grounded = false
      sfx.jump()
    }
    vy.current -= GRAVITY * delta
    pos.y += vy.current * delta
    if (pos.y <= floor) {
      // Coming down from a jump (not just stepping off the boardwalk) lands with a thump.
      if (!player.grounded && vy.current < -5) sfx.jumpLand()
      pos.y = floor
      vy.current = 0
      player.grounded = true
    } else if (pos.y - floor > 0.05) {
      player.grounded = false
    }

    // --- Facing -----------------------------------------------------------------
    const speed = Math.hypot(velocity.current.x, velocity.current.z)
    if (speed > 0.3) player.yaw = Math.atan2(velocity.current.x, velocity.current.z)
    _targetQuat.setFromAxisAngle(_up, player.yaw)
    visual.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0005, delta))
    // Step-ups ease in over a few frames on the visual only; the logical position
    // snaps so collision and triggers stay exact.
    const steppingUp = player.grounded && pos.y > group.position.y
    group.position.set(pos.x, steppingUp ? group.position.y + (pos.y - group.position.y) * Math.min(1, delta * 18) : pos.y, pos.z)
    shownAt.copy(pos)

    // Back from a ride: dancing on the spot until it's over or you move off.
    if (player.danceAt && (moving || !player.grounded || performance.now() - player.danceAt > DANCE_MS)) player.danceAt = 0
    const dancing = player.danceAt > 0

    // --- Publish motion ---------------------------------------------------------
    player.speed = speed
    player.anim = !player.grounded ? 'jump' : dancing ? 'dance' : speed > 0.5 ? 'walk' : 'idle'
    motion.speed = speed
    motion.maxSpeed = WALK_SPEED
    motion.grounded = player.grounded
    motion.vy = vy.current
    motion.dance = dancing ? 1 : 0
    // Steps quicken with speed: the stride phase runs faster rather than jumping.
    motion.stride += delta * (5 + 6 * Math.min(1, speed / WALK_SPEED))

    // A Boxity emote plays while you stand; moving, jumping or dancing stops it.
    const emote = player.emote
    if (emote && (moving || !player.grounded || dancing || !emoteMotion(motion, emote.id, emote.at))) stopEmote()
    if (!player.emote) motion.emoteClip = null
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <primitive ref={sledRef} object={sledMesh} />
        <group ref={seatRef}>
          {/* The loading screen waits for your Bloxity avatar; only if it can't be had in
              time (or at all) does the blocky stand-in show in its place. */}
          {!avatarIn && <FallbackAvatar motionRef={motionRef} handRef={handRef} />}
          <AvatarShaderWarmup />
          <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} handRef={handRef} onReady={handleAvatarReady} />}>
            <Suspense fallback={null}>
              <PlayerAvatar onReady={handleAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} handRef={handRef} />
            </Suspense>
          </ErrorBoundary>
          <group ref={handRef} />
        </group>
      </group>
    </group>
  )
}

export default Player
