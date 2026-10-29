import { useEffect, useRef } from 'react'

/**
 * Takes `objects()` out of the scene when the component really unmounts: a keyed swap
 * (another world's lobby or slide) has been seen to leave the old tree's objects
 * attached. The removal waits a tick and checks the component didn't come straight
 * back, so React StrictMode's dev-only unmount-and-remount - which keeps the very same
 * objects - doesn't take them out of the scene for good.
 *
 * @param {() => (import('three').Object3D | null)[]} objects stable (useCallback)
 */
export function useDetachOnUnmount(objects) {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    const list = objects()
    return () => {
      mounted.current = false
      setTimeout(() => {
        if (mounted.current) return
        for (const object of list) object?.removeFromParent()
      }, 0)
    }
  }, [objects])
}
