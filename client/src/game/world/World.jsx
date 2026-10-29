import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useQuality } from '../../store/quality'
import { asToyInstance, BlockSet, disposeBlocks, PropBuilder } from '../blocks'
import { useDetachOnUnmount } from '../detach'
import { glowTime } from '../glow'
import { createToyMaterial, sharedMaterials, toyTime } from '../materials'
import { ride } from '../ride/rideControl'
import { createGroundGeometry, createGroundMap } from './ground'
import {
  buildBanner,
  buildBoardwalk,
  buildCabins,
  buildCastle,
  buildLamps,
  buildMoneyBag,
  buildPedestals,
  buildSlingshot,
  buildSnowDrifts,
  buildSnowmen,
  buildWorldsPortal,
  buildXmasTree,
} from './structures'
import { buildTerrain, CASTLE_BASE } from './terrain'

/**
 * The static lobby: ground plane, every box (cliffs, pines, cabins, the slingshot's
 * posts, the boardwalk, the castle...) in one InstancedMesh, and every round prop (the
 * pad, the pedestals, the money bag, the castle's roofs) merged into one mesh. Three
 * draw calls for the whole environment. (The slide beyond the slingshot is ride/Slide.)
 *
 * Built once. Quality only decides tree density at build time and whether the result
 * casts/receives realtime shadows.
 */
/** How far down the slide (m) the lobby is wholly behind you. */
const LOBBY_OUT_OF_SIGHT = 70

export function World() {
  const shadows = useQuality((s) => s.settings.shadows === 'realtime')

  // Drives every animated toy-material style (glow pulses...).
  // Once you're well down the slide the whole lobby is behind you and out of sight:
  // not drawn at all until you're back (the slide brings its own scenery). On a slow
  // machine that's most of the work of the first seconds of every ride.
  const groupRef = useRef(null)
  useFrame((state) => {
    toyTime.value = state.clock.elapsedTime
    glowTime.value = state.clock.elapsedTime
    const group = groupRef.current
    if (group) group.visible = !(ride.active && ride.sim && ride.sim.s > LOBBY_OUT_OF_SIGHT)
  })

  const { blocks, ground, props } = useMemo(() => {
    performance.mark('pp:world-start')
    const { decorDensity, maxTexture } = useQuality.getState().settings
    const set = new BlockSet()
    const propBuilder = new PropBuilder()
    buildTerrain(set, { treeDensity: decorDensity })
    buildSlingshot(set, propBuilder)
    buildBoardwalk(set)
    buildPedestals(propBuilder)
    buildWorldsPortal(set)
    buildMoneyBag(propBuilder)
    buildCabins(set)
    buildXmasTree(set, propBuilder)
    buildSnowmen(set)
    buildSnowDrifts(set)
    buildLamps(set)
    buildBanner(set)
    buildCastle(set, propBuilder, CASTLE_BASE)

    const map = createGroundMap(maxTexture)
    const groundMaterial = createToyMaterial({ instanced: false, vertexColors: false, map, studScale: 2 })

    performance.mark('pp:world-end')
    return {
      blocks: set.build(sharedMaterials().blocks),
      props: asToyInstance(propBuilder.build(), sharedMaterials().toy),
      ground: { geometry: createGroundGeometry(), material: groundMaterial, map },
    }
  }, [])

  // Out of the scene for certain when another world's lobby replaces this one.
  useDetachOnUnmount(useCallback(() => [blocks, props], [blocks, props]))

  useEffect(
    () => () => {
      disposeBlocks(blocks)
      props.geometry.dispose()
      props.dispose()
      ground.geometry.dispose()
      ground.material.dispose()
      ground.map.dispose()
    },
    [blocks, ground, props],
  )

  return (
    <group ref={groupRef}>
      <mesh geometry={ground.geometry} material={ground.material} receiveShadow={shadows} />
      <primitive object={blocks} castShadow={shadows} receiveShadow={shadows} />
      <primitive object={props} castShadow={shadows} receiveShadow={shadows} />
    </group>
  )
}

export default World
