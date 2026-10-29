import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, LatheGeometry, MeshLambertMaterial, Object3D, OctahedronGeometry, Vector2 } from 'three'

import { featuresBetween } from '@shared/course'
import { hash2 } from '@shared/rng'

import { getQuality } from '../../store/quality'
import { createBoxInstances, createToyInstances, disposeBlocks, PropBuilder } from '../blocks'
import { star } from '../geometry'
import { sharedMaterials, STYLE } from '../materials'
import { COURSE } from './course'
import { slidePitch, slidePoint, zAt } from './path'
import { ride } from './rideControl'

/** The most of each drawn at once: what's in view down the slide. */
const MAX_COINS = 140
const MAX_GEMS = 4
const MAX_WALLS = 14
/** Boost pads in view at once, and the boxes each is made of (the pad and six chevron arms). */
const MAX_PADS = 6
const PAD_BOXES = 7
/** Each brick wall is this many bricks across and up. */
const BRICK_COLS = 4
const BRICK_ROWS = 3
const MAX_BRICKS = MAX_WALLS * BRICK_COLS * BRICK_ROWS
/** How far behind and ahead of you things are drawn. */
const BEHIND = 12
const AHEAD = 170
/** Smashed bricks fly for this long. */
const FLY_MS = 1800

const PAD_YELLOW = new Color('#ffe53b')
const PAD_ORANGE = new Color('#ff7a00')
const RED = new Color('#e3242b')
const WHITE = new Color('#f4f6fa')

/**
 * A gold Coin, facing +Z: a raised rim round a recessed face, a fat star standing out of
 * both sides, all polished metal (the glossy material's METAL). Fewer segments on LOW.
 */
function coinGeometry(segments) {
  const b = new PropBuilder()
  const rim = [
    [0, -0.06],
    [0.44, -0.06],
    [0.47, -0.1],
    [0.57, -0.1],
    [0.6, -0.06],
    [0.6, 0.06],
    [0.57, 0.1],
    [0.47, 0.1],
    [0.44, 0.06],
    [0, 0.06],
  ]
  const body = new LatheGeometry(rim.map(([r, y]) => new Vector2(r, y)), segments)
  body.rotateX(Math.PI / 2)
  b.add(body, { color: '#ffbf1f', style: STYLE.METAL })
  body.dispose()
  const emblem = star(5, 0.3, 0.13, 0.05)
  b.add(emblem, { color: '#fff1a0', style: STYLE.METAL })
  emblem.dispose()
  return b.build()
}

const _o = new Object3D()
const _list = []

/**
 * Everything on the slide that changes while you ride, pooled: the gold Coins spinning
 * over the floor (gone once you've picked them up), the big Diamonds at the milestones,
 * and the red-and-white brick walls - which burst into flying bricks when you smash
 * through. Three instanced meshes, rebuilt each frame from the course and the ride
 * (no allocation: a scratch Object3D and reused index lists).
 */
export default function SlideItems() {
  const assets = useMemo(() => {
    const coinShape = coinGeometry(getQuality().maxTexture > 512 ? 24 : 14)
    // Drawn with the sleds' glossy material: polished gold that catches the sun.
    const coins = createToyInstances(coinShape, sharedMaterials().sled, MAX_COINS)
    const gemGeometry = new OctahedronGeometry(0.9, 0)
    const gemMaterial = new MeshLambertMaterial({ color: '#5fd2ff', emissive: '#1f6fd6', emissiveIntensity: 0.8 })
    const gems = new InstancedMesh(gemGeometry, gemMaterial, MAX_GEMS)
    gems.count = 0
    gems.frustumCulled = false
    const bricks = createBoxInstances(MAX_BRICKS, sharedMaterials().blocks, STYLE.STUDS)
    // Boost pads move with each ride's layout, so they're drawn here, not built into the slide.
    const pads = createBoxInstances(MAX_PADS * PAD_BOXES, sharedMaterials().blocks, STYLE.BOOST)
    for (let i = 0; i < MAX_PADS * PAD_BOXES; i += 1) pads.setColorAt(i, i % PAD_BOXES ? PAD_ORANGE : PAD_YELLOW)
    return { coinShape, coins, gemGeometry, gemMaterial, gems, bricks, pads }
  }, [])

  useEffect(
    () => () => {
      assets.coinShape.dispose()
      assets.coins.dispose()
      assets.gemGeometry.dispose()
      assets.gemMaterial.dispose()
      assets.gems.dispose()
      disposeBlocks(assets.bricks)
      disposeBlocks(assets.pads)
    },
    [assets],
  )

  const coinsRef = useRef(null)
  const gemsRef = useRef(null)
  const bricksRef = useRef(null)
  const padsRef = useRef(null)

  useFrame((state) => {
    const coins = coinsRef.current
    const gems = gemsRef.current
    const bricks = bricksRef.current
    const pads = padsRef.current
    if (!coins || !gems || !bricks || !pads) return
    const t = state.clock.elapsedTime
    const now = performance.now()
    const sim = ride.active ? ride.sim : null
    const focus = sim ? sim.s : 0
    const ahead = Math.min(AHEAD, getQuality().viewDistance * 0.6)
    const a = focus - BEHIND
    const b = focus + ahead

    // This ride's coins and pads (rideLayout); the course's own in the lobby.
    const layout = sim ? sim.course : COURSE

    // --- Coins --------------------------------------------------------------------
    let n = 0
    for (const i of featuresBetween(layout.coins, a, b, _list)) {
      if (n >= MAX_COINS) break
      const coin = layout.coins[i]
      if (sim?.taken.coins.has(coin.index)) continue
      slidePoint(coin.s, coin.x, coin.h + Math.sin(t * 3 + coin.index) * 0.08, _o.position)
      _o.rotation.set(0, t * 2.6 + coin.index * 0.4, 0)
      _o.scale.setScalar(1)
      _o.updateMatrix()
      coins.setMatrixAt(n, _o.matrix)
      n += 1
    }
    coins.count = n
    coins.instanceMatrix.needsUpdate = true

    // --- Diamonds -----------------------------------------------------------------
    n = 0
    for (const i of featuresBetween(COURSE.diamonds, a, b, _list)) {
      if (n >= MAX_GEMS) break
      const gem = COURSE.diamonds[i]
      if (sim?.taken.diamonds.has(gem.index)) continue
      slidePoint(gem.s, gem.x, gem.h + 0.6 + Math.sin(t * 2) * 0.25, _o.position)
      _o.rotation.set(0, t * 1.8, 0)
      _o.scale.set(1, 1.3, 1)
      _o.updateMatrix()
      gems.setMatrixAt(n, _o.matrix)
      n += 1
    }
    gems.count = n
    gems.instanceMatrix.needsUpdate = true

    // --- Boost pads: glowing, tipped with the floor, three chevrons pointing downhill ---
    n = 0
    for (const i of featuresBetween(layout.boosts, a - 10, b, _list)) {
      if (n + PAD_BOXES > MAX_PADS * PAD_BOXES) break
      const pad = layout.boosts[i]
      const tip = -slidePitch(pad.s)
      _o.position.set(pad.x, COURSE.baseHeight(pad.s) + 0.06, zAt(pad.s))
      _o.rotation.set(tip, 0, 0)
      _o.scale.set(pad.half * 2, 0.12, pad.length)
      _o.updateMatrix()
      pads.setMatrixAt(n, _o.matrix)
      n += 1
      const arm = Math.min(pad.half, 2.2) * 1.1
      const angle = 0.75
      for (const dz of [-1.4, 0, 1.4]) {
        const s = pad.s + dz - (arm / 2) * Math.sin(angle)
        for (const side of [-1, 1]) {
          _o.position.set(pad.x + side * (arm / 2) * Math.cos(angle), COURSE.baseHeight(s) + 0.15, zAt(s))
          _o.rotation.set(tip, -side * angle, 0)
          _o.scale.set(arm, 0.08, 0.55)
          _o.updateMatrix()
          pads.setMatrixAt(n, _o.matrix)
          n += 1
        }
      }
    }
    pads.count = n
    pads.instanceMatrix.needsUpdate = true

    // --- Brick walls ----------------------------------------------------------------
    n = 0
    for (const i of featuresBetween(COURSE.walls, a - 30, b, _list)) {
      const wall = COURSE.walls[i]
      const smashedAt = sim ? ride.smashed.get(wall.index) : undefined
      const flying = smashedAt !== undefined ? (now - smashedAt) / 1000 : -1
      if (flying * 1000 > FLY_MS) continue
      if (flying < 0 && wall.s < a) continue
      const bw = (wall.half * 2) / BRICK_COLS
      const bh = wall.height / BRICK_ROWS
      for (let row = 0; row < BRICK_ROWS && n < MAX_BRICKS; row += 1) {
        for (let col = 0; col < BRICK_COLS && n < MAX_BRICKS; col += 1) {
          // Each row offset half a brick, red and white in turn, as in the reference.
          const x = wall.x - wall.half + bw * (col + 0.5) + (row % 2 ? bw * 0.25 : -bw * 0.25)
          slidePoint(wall.s, x, bh * (row + 0.5), _o.position)
          _o.rotation.set(0, 0, 0)
          if (flying >= 0) {
            // Flung forward and up, tumbling, then falling away.
            const r1 = hash2(wall.index, row * 7 + col, 3)
            const r2 = hash2(wall.index, row * 7 + col, 9)
            const speed = Math.max(8, sim ? sim.v * 0.9 : 8)
            _o.position.x += (r1 - 0.5) * 9 * flying
            _o.position.y += (4 + r2 * 6) * flying - 11 * flying * flying
            _o.position.z -= speed * (0.6 + r2 * 0.5) * flying
            _o.rotation.set(flying * (4 + r1 * 6), flying * 3 * r2, flying * 5 * (r1 - 0.5))
          }
          _o.scale.set(bw * 0.96, bh * 0.94, 0.9)
          _o.updateMatrix()
          bricks.setMatrixAt(n, _o.matrix)
          bricks.setColorAt(n, (row + col) % 2 ? WHITE : RED)
          n += 1
        }
      }
    }
    bricks.count = n
    bricks.instanceMatrix.needsUpdate = true
    if (bricks.instanceColor) bricks.instanceColor.needsUpdate = true
  })

  return (
    <>
      <primitive ref={coinsRef} object={assets.coins} />
      <primitive ref={gemsRef} object={assets.gems} />
      <primitive ref={bricksRef} object={assets.bricks} />
      <primitive ref={padsRef} object={assets.pads} />
    </>
  )
}
