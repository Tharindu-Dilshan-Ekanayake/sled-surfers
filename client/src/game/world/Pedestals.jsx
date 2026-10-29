import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import { PEDESTALS } from '@shared/world'

import { asToyInstance } from '../blocks'
import { sharedMaterials } from '../materials'
import { sledGeometry } from '../sleds/sledModels'

/**
 * The premium sleds (Diamond Unicorn, Galaxy Orca) turning slowly on their pedestals by
 * the slingshot, bobbing a little: one toy-material instance each.
 */
export default function Pedestals() {
  const sleds = useMemo(
    () =>
      PEDESTALS.map((p) => {
        const mesh = asToyInstance(sledGeometry(p.id), sharedMaterials().sled)
        mesh.position.set(p.x, 1.3, p.z)
        mesh.scale.setScalar(1.7)
        return mesh
      }),
    [],
  )
  useEffect(() => () => sleds.forEach((mesh) => mesh.dispose()), [sleds])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    sleds.forEach((mesh, i) => {
      mesh.rotation.y = t * 0.6 + i * Math.PI
      mesh.position.y = 1.3 + Math.sin(t * 1.6 + i) * 0.18
    })
  })

  return sleds.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)
}
