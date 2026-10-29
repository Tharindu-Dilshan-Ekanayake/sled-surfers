import { wallSlope } from '@shared/course'
import { LAUNCH_Z } from '@shared/world'

import { COURSE } from './course'

/**
 * Where the slide is in the world. It runs straight north (-Z) from the slingshot's
 * band: track metre `s` is at z = LAUNCH_Z - s, `x` across is world x, and the floor's
 * height is the course's. Pure maths, allocation-free: the frame loop calls it freely.
 */

export const zAt = (s) => LAUNCH_Z - s
export const sAtZ = (z) => LAUNCH_Z - z

/** World point `h` above the slide's floor at metre s, `x` across. */
export const slidePoint = (s, x, h, out) => out.set(x, COURSE.groundAt(s, x) + h, LAUNCH_Z - s)

/** How the floor tips at metre s: its pitch down the slide (radians, + nose down). */
export const slidePitch = (s) => Math.atan((COURSE.groundAt(s - 0.6, 0) - COURSE.groundAt(s + 0.6, 0)) / 1.2)

/** How a wall tips something riding up it at `x` (radians, + leaning left). */
export const wallRoll = (x) => -Math.atan(wallSlope(x))
