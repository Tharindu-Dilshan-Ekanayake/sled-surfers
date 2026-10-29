import { courseOf } from '@shared/course'

/**
 * The slide of the world you're in. You ride one world at a time, so everything down
 * the slide reads its course from these live bindings, and setWorld swaps them when you
 * change worlds (the scene then rebuilds the slide: see GameScene). The authority keeps
 * a course per ride instead (shared/course courseOf).
 */
export let WORLD = 0
export let COURSE = courseOf(0)

/** Rides world `world`'s slide from now on. Returns whether that's a change. */
export function setWorld(world) {
  const course = courseOf(world)
  if (course === COURSE) return false
  WORLD = course.index
  COURSE = course
  return true
}
