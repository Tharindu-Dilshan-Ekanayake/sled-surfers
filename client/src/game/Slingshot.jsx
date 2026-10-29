import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, CylinderGeometry, Object3D, SphereGeometry, Vector3 } from 'three'

import { LAUNCH_Z, POST_X } from '@shared/world'

import { createToyInstances, PropBuilder } from './blocks'
import { sharedMaterials, STYLE } from './materials'
import { ride } from './ride/rideControl'

/** Segments per half of the band, alternating red and white like a candy cane. */
const SEGMENTS = 14
/** Where each half is tied on: the inside of a post's fork, just under its arms. */
const ANCHOR_Y = 1.3
const ANCHOR_X = POST_X - 0.95
/** How thick the band is (an oval rubber cord: this wide, two thirds as tall), and how far it sags in the middle at rest. */
const RADIUS = 0.12
const SAG = 0.35
const RED = new Color('#e3242b')
const WHITE = new Color('#f6f7fb')
const POUCH = new Color('#6a3a1a')

const _a = new Vector3()
const _p = new Vector3()
const _q = new Vector3()
const _o = new Object3D()

/** A unit band segment along +Z (a smooth round tube with domed ends, so the joints look continuous). */
function segmentGeometry() {
  const b = new PropBuilder()
  b.add(new CylinderGeometry(1, 1, 1, 14, 1, true), { rotation: [Math.PI / 2, 0, 0], color: '#ffffff', style: STYLE.SMOOTH })
  for (const z of [-0.5, 0.5]) b.add(new SphereGeometry(1, 14, 8), { position: [0, 0, z], scale: [1, 1, 0.12], color: '#ffffff', style: STYLE.SMOOTH })
  return b.build()
}

/** The leather pouch the band holds your sled with: a rounded pad. */
function pouchGeometry() {
  const b = new PropBuilder()
  b.add(new SphereGeometry(1, 16, 10), { scale: [1, 0.45, 0.35], color: '#ffffff', style: STYLE.SMOOTH })
  return b.build()
}

/** Where along a half of the band (t 0 at the post, 1 at the middle), sagging under its weight at rest. */
function bandPoint(side, t, pulled, middle, out) {
  _a.set(side * ANCHOR_X, ANCHOR_Y, LAUNCH_Z)
  out.lerpVectors(_a, middle, t)
  // At rest the band droops in a gentle curve; pulled tight, it's straight.
  out.y -= Math.sin(t * Math.PI * 0.5) * SAG * (1 - pulled)
  return out
}

/**
 * The slingshot's red-and-white rubber band between its two posts (the posts are lobby
 * blocks): an oval rubber cord in candy-cane stripes, with a small leather pouch, drooping a little at rest. While
 * you pull, both halves stretch back taut to the leather pouch behind your sled - and
 * snap straight again as you fly. Two instanced meshes, rewritten only while it moves.
 */
export default function Slingshot() {
  const meshes = useMemo(() => {
    const material = sharedMaterials().toy
    const band = createToyInstances(segmentGeometry(), material, SEGMENTS * 2)
    band.count = SEGMENTS * 2
    for (let i = 0; i < SEGMENTS * 2; i += 1) band.setColorAt(i, (i % SEGMENTS) % 2 ? WHITE : RED)
    band.instanceColor.needsUpdate = true
    const pouch = createToyInstances(pouchGeometry(), material, 1)
    pouch.count = 1
    pouch.setColorAt(0, POUCH)
    pouch.instanceColor.needsUpdate = true
    return { band, pouch }
  }, [])
  useEffect(
    () => () => {
      meshes.band.geometry.dispose()
      meshes.band.dispose()
      meshes.pouch.geometry.dispose()
      meshes.pouch.dispose()
    },
    [meshes],
  )
  const bandRef = useRef(null)
  const pouchRef = useRef(null)
  /** Where the band's middle was last drawn, so a still band isn't rewritten. */
  const last = useRef({ z: NaN, power: NaN })
  const middle = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const band = bandRef.current
    const pouch = pouchRef.current
    if (!band || !pouch) return
    const pulling = ride.active && ride.phase === 'pull'
    const power = pulling ? ride.power : 0
    // The back of the sled while pulled; the middle of the gap at rest.
    if (pulling) middle.set(ride.position.x, 0.62, ride.position.z + 1.05)
    else middle.set(0, ANCHOR_Y, LAUNCH_Z)
    if (Math.abs(middle.z - last.current.z) < 1e-3 && power === last.current.power) return
    last.current.z = middle.z
    last.current.power = power
    const taut = pulling ? 1 : 0
    // Stretched, the rubber thins.
    const radius = RADIUS * (1 - 0.3 * power)
    let n = 0
    for (const side of [-1, 1]) {
      for (let k = 0; k < SEGMENTS; k += 1) {
        bandPoint(side, k / SEGMENTS, taut, middle, _p)
        bandPoint(side, (k + 1) / SEGMENTS, taut, middle, _q)
        _o.position.lerpVectors(_p, _q, 0.5)
        _o.lookAt(_q)
        _o.scale.set(radius, radius * 0.66, _p.distanceTo(_q) * 1.04)
        _o.updateMatrix()
        band.setMatrixAt(n, _o.matrix)
        n += 1
      }
    }
    band.instanceMatrix.needsUpdate = true
    // The pouch: a small knot of band behind the sled while pulled (any bigger and it
    // fills the camera, right behind it), hanging in the middle at rest.
    _o.position.copy(middle)
    _o.position.y -= pulling ? 0 : SAG
    _o.rotation.set(0, 0, 0)
    _o.scale.setScalar(pulling ? 0.22 : 0.3)
    _o.updateMatrix()
    pouch.setMatrixAt(0, _o.matrix)
    pouch.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <primitive ref={bandRef} object={meshes.band} />
      <primitive ref={pouchRef} object={meshes.pouch} />
    </>
  )
}
