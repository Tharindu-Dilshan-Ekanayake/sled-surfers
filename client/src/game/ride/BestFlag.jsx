import { useEffect, useRef } from 'react'

import { FLOOR_HALF, RIM_HEIGHT, WALL_REACH } from '@shared/course'

import { useGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { LabelBatch } from '../labels/LabelBatch'
import { sharedMaterials, STYLE } from '../materials'
import { COURSE } from './course'
import { slidePitch, zAt } from './path'

/**
 * YOUR BEST, down the slide: a glowing gold line right across the floor at your best
 * distance in this world, a gold flag on each rim, and the distance floating over it -
 * so every ride shows how far you've come, and passing it is a NEW BEST (rideControl).
 * Rebuilt only when your best changes (after a ride); a handful of boxes and one label.
 */
export default function BestFlag() {
  const best = useGame((s) => s.profile.best?.[s.profile.world] ?? 0)
  const groupRef = useRef(null)

  useEffect(() => {
    const group = groupRef.current
    if (!group || best < 30 || best >= COURSE.length) return undefined
    const base = COURSE.baseHeight(best)
    const z = zAt(best)
    const set = new BlockSet()
    set.add(0, base + 0.06, z, FLOOR_HALF * 2, 0.12, 0.5, '#ffd23a', STYLE.GLOW, 0, -slidePitch(best))
    for (const side of [-1, 1]) {
      const x = side * (FLOOR_HALF + WALL_REACH + 2)
      set.addOn(x, base + RIM_HEIGHT, z, 0.25, 6, 0.25, '#ffffff', STYLE.SMOOTH)
      set.addOn(x - side * 0.8, base + RIM_HEIGHT + 4.8, z, 1.5, 1, 0.1, '#ffc61e', STYLE.GLOW)
    }
    const blocks = set.build(sharedMaterials().blocks)
    group.add(blocks)

    const batch = new LabelBatch({ pageSize: Math.min(512, getQuality().maxTexture) })
    batch.add(
      'best',
      [0, base + 7.5, z],
      { lines: [{ text: 'YOUR BEST', size: 52, gradient: ['#fffaa8', '#ffd52a', '#ff9c00'] }, { text: `${Math.floor(best)}m`, size: 72, fill: '#ffffff' }], pxPerUnit: 30 },
      { fade: 160 },
    )
    let cancelled = false
    const labels = []
    batch.build().then((meshes) => {
      if (cancelled) return
      for (const mesh of meshes) {
        group.add(mesh)
        labels.push(mesh)
      }
    })
    return () => {
      cancelled = true
      group.remove(blocks, ...labels)
      disposeBlocks(blocks)
      batch.dispose()
    }
  }, [best])

  return <group ref={groupRef} />
}
