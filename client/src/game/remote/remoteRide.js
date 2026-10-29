import { slidePitch, slidePoint, wallRoll } from '../ride/path'

let frameKey = -1

/**
 * Eases everyone down the slide towards where they last reported, and tips them with the
 * slope and the walls. Idempotent per frame (keyed on the renderer's clock), so the name
 * tags, the shadows and the avatars all see exactly the same state however many of them
 * ask. Each rider's `shownAt` is where to draw them, `ridePitch`/`rideRoll` their tilt.
 */
export function stepRemoteRiders(players, clockTime, delta) {
  if (frameKey === clockTime) return
  frameKey = clockTime
  const k = 1 - Math.exp(-6 * delta)
  for (const r of players.values()) {
    if (!r.riding) continue
    const before = r.shownMeter
    // Reports come 5 a second: run on at their speed between them rather than stall.
    r.shownMeter += (r.rideMeter - r.shownMeter) * k
    r.shownX += (r.rideX - r.shownX) * k
    r.shownY += (r.rideY - r.shownY) * k
    r.rideSpeed = (r.shownMeter - before) / Math.max(delta, 1e-3)
    slidePoint(r.shownMeter, r.shownX, Math.max(0, r.shownY), r.shownAt)
    r.ridePitch = slidePitch(r.shownMeter)
    r.rideRoll = wallRoll(r.shownX)
  }
}
