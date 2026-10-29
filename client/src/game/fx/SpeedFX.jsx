import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three'

import { COURSE } from '../ride/course'
import { sAtZ } from '../ride/path'
import { ride } from '../ride/rideControl'

/** Wind streaks rushing past, and snow puffs thrown up behind the sled. */
const LINES = 40
const PUFFS = 56
const PUFF_LIFE = 0.55

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _zero = new Matrix4().makeScale(0, 0, 0)

/** Pools: fixed, mutated in place every frame. Module-level: one rider of your own. */
const lines = Array.from({ length: LINES }, () => ({ x: 0, y: 0, z: 0, live: false }))
/** Puffs are placed relative to the sled. */
const puffs = Array.from({ length: PUFFS }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }))
/** The next puff to reuse, and puffs owed (spawned at a rate, not once a frame). */
const spray = { next: 0, debt: 0 }

/**
 * The feel of speed down the slide: thin white streaks that the wind seems to whip past
 * (the faster you go the longer and brighter), and snow spraying off the sled while it's
 * on the snow. Two draw calls, fixed pools, nothing allocated per frame. Only mounted on
 * presets with particles (GameScene).
 */
export default function SpeedFX() {
  const { lineMesh, puffMesh } = useMemo(() => {
    const lineMaterial = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false })
    const lineMesh = new InstancedMesh(new BoxGeometry(0.035, 0.035, 1), lineMaterial, LINES)
    const puffMesh = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshBasicMaterial({ color: '#f4f9ff' }), PUFFS)
    for (const mesh of [lineMesh, puffMesh]) {
      mesh.frustumCulled = false
      for (let i = 0; i < mesh.count; i += 1) mesh.setMatrixAt(i, _zero)
    }
    return { lineMesh, puffMesh }
  }, [])

  useEffect(
    () => () => {
      for (const mesh of [lineMesh, puffMesh]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
        mesh.dispose()
      }
    },
    [lineMesh, puffMesh],
  )

  const lineRef = useRef(null)
  const puffRef = useRef(null)

  useFrame((_state, rawDelta) => {
    const lineMesh = lineRef.current
    const puffMesh = puffRef.current
    if (!lineMesh || !puffMesh) return
    const dt = Math.min(rawDelta, 0.05)
    const sim = ride.phase === 'ride' ? ride.sim : null
    const speed = sim ? ride.speed : 0
    const at = ride.position

    // Wind streaks: still in the world, so you rush past them; respawned ahead once behind you.
    const fade = Math.min(1, Math.max(0, (speed - 16) / 30))
    lineMesh.material.opacity = fade * 0.45
    lineMesh.visible = fade > 0.01
    if (lineMesh.visible) {
      const length = 0.8 + speed * 0.05
      for (let i = 0; i < LINES; i += 1) {
        const l = lines[i]
        if (!l.live || l.z > at.z + 6 || l.z < at.z - 90) {
          const dx = (Math.random() - 0.5) * 26
          l.x = at.x + (Math.abs(dx) < 2.5 ? Math.sign(dx || 1) * 2.5 : dx)
          l.z = at.z - 25 - Math.random() * 50
          l.y = COURSE.baseHeight(sAtZ(l.z)) + 0.5 + Math.random() * 5
          l.live = true
        }
        _m.makeScale(1, 1, length)
        _m.setPosition(l.x, l.y, l.z)
        lineMesh.setMatrixAt(i, _m)
      }
      lineMesh.instanceMatrix.needsUpdate = true
    } else {
      for (const l of lines) l.live = false
    }

    // Snow spray: off both sides of the sled's tail while it's on the snow and moving.
    if (sim && !sim.airborne && speed > 8) {
      spray.debt += dt * Math.min(70, speed * 1.1)
      while (spray.debt >= 1) {
        spray.debt -= 1
        const p = puffs[spray.next]
        spray.next = (spray.next + 1) % PUFFS
        // Kept relative to the sled (it'd leave them behind in a blink): they fly out
        // from its tail, drift back a little and settle.
        const side = Math.random() < 0.5 ? -1 : 1
        p.life = PUFF_LIFE * (0.7 + Math.random() * 0.6)
        p.x = side * 0.55
        p.y = 0.15
        p.z = 0.6
        p.vx = side * (1.2 + Math.random() * 2.2)
        p.vy = 1.2 + Math.random() * 2
        p.vz = 1 + Math.random() * 2.5
      }
    } else {
      spray.debt = 0
    }
    let alive = false
    for (let i = 0; i < PUFFS; i += 1) {
      const p = puffs[i]
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) {
        puffMesh.setMatrixAt(i, _zero)
        alive = true
        continue
      }
      alive = true
      p.vy -= 7 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const size = 0.05 + 0.15 * (p.life / PUFF_LIFE)
      _m.compose(_p.set(at.x + p.x, at.y + p.y, at.z + p.z), _q, _s.setScalar(size))
      puffMesh.setMatrixAt(i, _m)
    }
    puffMesh.visible = alive
    if (alive) puffMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive ref={lineRef} object={lineMesh} />
      <primitive ref={puffRef} object={puffMesh} />
    </>
  )
}
