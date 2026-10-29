import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import { WebGLRenderTarget } from 'three'

import { RIM_HEIGHT, stageAt } from '@shared/course'

import { getQuality } from '../../store/quality'
import { asToyInstance, disposeBlocks } from '../blocks'
import { useDetachOnUnmount } from '../detach'
import { LabelBatch } from '../labels/LabelBatch'
import { sharedMaterials } from '../materials'
import { COURSE } from './course'
import { zAt } from './path'
import { ride } from './rideControl'
import { buildChunk, CHUNK, chunkCount, FIRST_S } from './slideChunk'
import { stageTheme } from './stages'
import BestFlag from './BestFlag'
import SlideItems from './SlideItems'

/** Metres of slide kept behind you, and how long one builder pass may spend building (ms). */
const BEHIND = 40
const BUILD_BUDGET_MS = 4
/** How often the piece builder runs (between frames, not inside them). */
const BUILD_INTERVAL_MS = 40
/** Pieces never thrown away: the stretch seen from the lobby. */
const PINNED = 4
const CACHE_LIMIT = 16
/** Extra pieces built ahead (hidden) while you're in the lobby, ready for the launch. */
const LOBBY_AHEAD = 6

/** Built pieces by index: `{ surface, blocks }` meshes. Module-level: one slide exists at a time. */
const cache = new Map()
/** The window of pieces the frame loop wants; the builder makes it so. */
const want = { first: 0, last: 0, near: 0, density: 1, shadows: false }

/** A 1x1 target for drawing a new piece once, unseen, to upload it to the GPU. */
const upload = { target: null }

/**
 * Uploads a just-built piece's buffers to the GPU now, between frames, with one draw into
 * a 1x1 target - rather than in the frame it first comes into view, which (with several
 * at once as the camera swoops onto the slide at launch) was a visible hitch.
 */
function uploadPiece(gl, camera, piece) {
  upload.target ||= new WebGLRenderTarget(1, 1)
  const previous = gl.getRenderTarget()
  gl.setRenderTarget(upload.target)
  for (const mesh of [piece.blocks, piece.surface]) {
    const { visible, frustumCulled } = mesh
    mesh.visible = true
    mesh.frustumCulled = false
    gl.render(mesh, camera)
    mesh.visible = visible
    mesh.frustumCulled = frustumCulled
  }
  gl.setRenderTarget(previous)
}

function disposePiece(piece) {
  disposeBlocks(piece.blocks)
  piece.surface.geometry.dispose()
  piece.surface.dispose()
}

/**
 * Lazily loaded: the slide down the mountain of the world you're in, its signs and
 * everything on it. While nobody's riding it still streams the first stretch, which is
 * the slide you see dropping away beyond the slingshot. Mounted afresh for each world
 * (see GameScene).
 */
export default function Slide() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const rootRef = useRef(null)
  const groupRef = useRef(null)
  const labelsRef = useRef(null)

  // Swapped for another world's slide, this one leaves the scene for certain.
  useDetachOnUnmount(useCallback(() => [rootRef.current], []))

  // This module loads after the lobby is on screen; compile its shaders in the
  // background before showing it, so the first ride doesn't stall on them.
  useEffect(() => {
    const root = rootRef.current
    // Skipped in dev, where StrictMode's remount disposes materials mid-compile.
    if (!root || import.meta.env.DEV) return undefined
    let cancelled = false
    root.visible = false
    gl.compileAsync(root, camera, scene)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) root.visible = true
      })
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene])

  // The distance signs ("100m" ...) and the finish: their own small label batch.
  useEffect(() => {
    const labels = labelsRef.current
    const batch = new LabelBatch({ pageSize: Math.min(512, getQuality().maxTexture) })
    const y = (s) => COURSE.baseHeight(s) + RIM_HEIGHT
    for (const s of COURSE.signs) {
      batch.add(`sign-${s}`, [15.1, y(s) + 3.15, zAt(s) + 0.3], { lines: [{ text: `${s}m`, size: 64, fill: '#3a2410' }], pxPerUnit: 70 }, { fade: 140, near: 4 })
    }
    // Each stage's name, hanging in its gate (the first is named by the HUD as you set off).
    for (const s of COURSE.arches) {
      batch.add(
        `stage-${s}`,
        [0, COURSE.baseHeight(s) + 13, zAt(s)],
        { lines: [{ text: `STAGE ${stageAt(s) + 1}`, size: 84, gradient: ['#ffffff', '#dff3ff', '#9fd2ff'] }, { text: stageTheme(s).name, size: 46, fill: '#ffe36b' }], pxPerUnit: 38 },
        // Shown only as you near the gate, not while the HUD still names the stage you just entered.
        { fade: 130 },
      )
    }
    batch.add('finish',[0, y(COURSE.length) + 12.5, zAt(COURSE.length)], { lines: [{ text: 'FINISH!', size: 90, gradient: ['#fffaa8', '#ffd52a', '#ff9c00'] }, { text: `Beat ${COURSE.world.name}!`, size: 44, rainbow: true }], pxPerUnit: 26 }, { fade: 300 })
    let cancelled = false
    batch.build().then((meshes) => {
      if (cancelled || !labels) return
      for (const mesh of meshes) labels.add(mesh)
    })
    return () => {
      cancelled = true
      labels?.clear()
      batch.dispose()
    }
  }, [])

  // Streams pieces in and out between frames: the one nearest you first, and only as
  // many as fit in a few milliseconds, so building never shows up as a stutter.
  useEffect(() => {
    const group = groupRef.current
    const id = setInterval(() => {
      if (!group) return
      const materials = sharedMaterials()
      const started = performance.now()
      const build = (i) => {
        if (cache.has(i)) return
        const parts = buildChunk(i, { density: want.density })
        const piece = { blocks: parts.blocks.build(materials.blocks), surface: asToyInstance(parts.surface.build(), materials.toy) }
        piece.blocks.receiveShadow = want.shadows
        piece.surface.receiveShadow = want.shadows
        piece.blocks.castShadow = want.shadows
        cache.set(i, piece)
        group.add(piece.blocks, piece.surface)
        uploadPiece(gl, camera, piece)
      }
      // From where you are on down the slide, then whatever's left behind you.
      for (let i = Math.max(want.first, want.near); i <= want.last && performance.now() - started < BUILD_BUDGET_MS; i += 1) build(i)
      for (let i = want.near - 1; i >= want.first && performance.now() - started < BUILD_BUDGET_MS; i -= 1) build(i)
      if (cache.size <= CACHE_LIMIT) return
      for (const [i, piece] of cache) {
        if ((i < want.first || i > want.last) && i >= PINNED) {
          group.remove(piece.blocks, piece.surface)
          disposePiece(piece)
          cache.delete(i)
        }
      }
    }, BUILD_INTERVAL_MS)
    return () => {
      clearInterval(id)
      for (const piece of cache.values()) disposePiece(piece)
      cache.clear()
      upload.target?.dispose()
      upload.target = null
    }
  }, [gl, camera])

  useFrame(() => {
    const settings = getQuality()
    const focus = ride.active && ride.sim ? ride.sim.s : 0
    // Only decide what should exist; the builder above does the allocating, outside
    // the frame loop.
    want.first = Math.max(0, Math.floor((focus - BEHIND - FIRST_S) / CHUNK))
    want.near = Math.max(0, Math.floor((focus - FIRST_S) / CHUNK))
    // A piece past the fog too, built before it's needed - and, while you're idle in the
    // lobby, a few hundred metres more (hidden), so the launch itself never waits on the
    // builder however fast you go.
    const seen = Math.min(chunkCount() - 1, Math.floor((focus + settings.viewDistance - FIRST_S) / CHUNK) + 1)
    want.last = Math.min(chunkCount() - 1, seen + (ride.active ? 0 : LOBBY_AHEAD))
    want.density = settings.decorDensity
    want.shadows = settings.shadows === 'realtime'
    for (const [i, piece] of cache) {
      const visible = i >= want.first && i <= seen
      piece.blocks.visible = visible
      piece.surface.visible = visible
    }
  })

  return (
    <group ref={rootRef}>
      <group ref={groupRef} />
      <group ref={labelsRef} />
      <SlideItems />
      <BestFlag />
    </group>
  )
}
