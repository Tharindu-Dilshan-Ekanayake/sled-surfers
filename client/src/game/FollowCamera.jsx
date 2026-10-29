import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { slidePoint } from './ride/path'
import { ride } from './ride/rideControl'
import { runtime } from './runtime'

/** How high above the player's feet the camera aims. */
const LOOK_HEIGHT = 1.6

const MIN_DISTANCE = 4
const MAX_DISTANCE = 26

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the ground.
const MIN_PITCH = -0.05
const MAX_PITCH = 1.2

const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.007
const ZOOM_SENSITIVITY = 0.012

// Higher = snappier. Framerate-independent via the exp() smoothing below.
const POSITION_SMOOTHING = 10
const LOOK_SMOOTHING = 14

const _desired = new Vector3()
const _target = new Vector3()
/** Where the camera is looking, eased towards its target (one camera, so module-level). */
const _lookAt = new Vector3()
/** Where the sled was last frame, and how far it has moved since. */
const _sledWas = new Vector3()
const _sledMove = new Vector3()
/** Whether the chase camera was already following the sled last frame. */
const chase = { following: false }
const _shake = new Vector3()

/** Down the slide: how far behind and above the sled the chase camera rides. */
const CHASE_BEHIND = 7.2
const CHASE_HEIGHT = 3.6
/** It looks this far ahead of the sled, down the slide. */
const CHASE_AHEAD = 10
const CHASE_LOOK_HEIGHT = 0.9
const CHASE_SMOOTHING = 7

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Where the chase camera wants to be on the slingshot and down the slide, and what it
 * looks at: behind and above you looking down the slide (further back the faster you
 * go); swung round to your side, onto you, once you've stopped.
 */
/** Eases the field of view towards `target`: a wider view the faster you go. */
function easeFov(camera, target, delta) {
  const fov = camera.fov + (target - camera.fov) * (1 - Math.exp(-3 * delta))
  if (Math.abs(fov - camera.fov) < 0.005) return
  camera.fov = fov
  camera.updateProjectionMatrix()
}

function chaseTarget(out, look) {
  const p = ride.position
  if (ride.phase === 'pull' || !ride.sim) {
    out.set(p.x, p.y + 3.3, p.z + 6.2 + ride.power * 0.8)
    look.set(p.x, p.y + 1.1, p.z - 12)
    return
  }
  const sim = ride.sim
  if (ride.phase === 'result') {
    const k = smoothstep(0, 1.2, (performance.now() - ride.stoppedAt) / 1000)
    slidePoint(sim.s - CHASE_BEHIND * (1 - k) + 3.2 * k, sim.x * 0.6 + 5.2 * k * (sim.x > 0 ? -1 : 1), CHASE_HEIGHT - 1.4 * k, out)
    slidePoint(sim.s + CHASE_AHEAD * (1 - k), sim.x, CHASE_LOOK_HEIGHT + 0.3 * k, look)
    return
  }
  const back = CHASE_BEHIND + Math.min(4, sim.v * 0.08)
  slidePoint(sim.s - back, sim.x * 0.6, 0, out)
  out.y = Math.max(out.y, sim.y) + CHASE_HEIGHT
  slidePoint(sim.s + CHASE_AHEAD, sim.x * 0.75, CHASE_LOOK_HEIGHT, look)
}

/**
 * Third-person orbit camera around the player.
 *
 * Mouse: drag (either button) orbits, wheel zooms. Touch: one-finger drag orbits (the
 * joystick owns the left side of the screen as a separate element), pinch zooms.
 *
 * Orbit state lives in `runtime.camera`, so after a ride the camera can be handed back
 * exactly where it was taken from. On the slingshot and down the slide it's a chase
 * camera instead.
 */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const initialised = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return undefined

    /** pointerId -> last { x, y } */
    const pointers = new Map()
    let pinchDistance = 0

    const orbit = runtime.camera

    const onPointerDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onPointerMove = (e) => {
      const last = pointers.get(e.pointerId)
      if (!last) return

      if (pointers.size >= 2) {
        last.x = e.clientX
        last.y = e.clientY
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance - (d - pinchDistance) * 0.04))
        pinchDistance = d
        return
      }

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last.x = e.clientX
      last.y = e.clientY
      const sensitivity = e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY
      orbit.yaw -= dx * sensitivity
      orbit.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbit.pitch + dy * sensitivity))
    }

    const endDrag = (e) => {
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    if (runtime.camera.mode === 'ride') {
      // Carried along with the sled, then eased towards its place behind it: the swoop
      // from the orbit camera stays smooth, but the camera never lags further behind the
      // faster you go.
      if (chase.following) {
        _sledMove.subVectors(ride.position, _sledWas)
        camera.position.add(_sledMove)
        _lookAt.add(_sledMove)
      }
      _sledWas.copy(ride.position)
      chase.following = true
      // Eased towards, so taking over from the orbit camera is a swoop, not a cut.
      chaseTarget(_desired, _target)
      const k = 1 - Math.exp(-CHASE_SMOOTHING * delta)
      camera.position.lerp(_desired, k)
      _lookAt.lerp(_target, k)
      // A jolt when you smash through a wall.
      const smashed = performance.now() - ride.smashAt
      if (smashed < 280) {
        const shake = (1 - smashed / 280) * 0.22
        camera.position.add(_shake.set(Math.sin(smashed * 0.09) * shake, Math.cos(smashed * 0.12) * shake, 0))
      }
      camera.lookAt(_lookAt)
      easeFov(camera, runtime.camera.baseFov + (ride.phase === 'ride' ? Math.min(16, Math.max(0, ride.speed - 12) * 0.16) : 0), delta)
      return
    }
    easeFov(camera, runtime.camera.baseFov, delta)
    chase.following = false
    // You, in the lobby.
    const p = runtime.player.position
    _target.set(p.x, p.y + LOOK_HEIGHT, p.z)

    // Spherical -> cartesian. yaw 0 puts the camera south of the player, looking north.
    const { yaw, pitch, distance } = runtime.camera
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      Math.max(_target.y + Math.sin(pitch) * distance, 0.6),
      _target.z + Math.cos(yaw) * horizontal,
    )

    // After a ride the camera is far down the slide; jump back rather than swoop.
    if (runtime.camera.snap) {
      runtime.camera.snap = false
      initialised.current = false
    }

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the default camera started.
      camera.position.copy(_desired)
      _lookAt.copy(_target)
      initialised.current = true
    }

    camera.position.lerp(_desired, 1 - Math.exp(-POSITION_SMOOTHING * delta))
    _lookAt.lerp(_target, 1 - Math.exp(-LOOK_SMOOTHING * delta))
    camera.lookAt(_lookAt)
  })

  return null
}

export default FollowCamera
