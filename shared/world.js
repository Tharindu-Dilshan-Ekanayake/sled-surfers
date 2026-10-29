/**
 * Lobby layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where the slingshot is.
 *
 * Units are roughly metres - the avatar is 1.8 tall. +X is east, -Z is north, which is
 * "forward" from spawn and the way down the slide.
 *
 * Seen from spawn, as in the reference: a wooden boardwalk straight ahead to the
 * slingshot (two Y-shaped posts and their band) at the top of the slide, the premium
 * sleds on their pedestals either side of it, the WORLDS portal on the left and the
 * NEXT WORLD sign on the right; behind you the leaderboards, the free-coins statue, the
 * cabins and the ice castle.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

export const SPAWN = { x: 0, z: 8 }

/**
 * The flat, snowy plaza: snug, as in the reference, with the snowy cliffs and their pines
 * rising close all round it but where the slide drops away.
 */
export const PLAZA = { minX: -32, maxX: 32, minZ: -24, maxZ: 34 }

// --- The slingshot and the top of the slide ----------------------------------------------

/** The band between the posts: the slide's metre 0 (it runs north from here). */
export const LAUNCH_Z = -40
/** The two Y-shaped posts, either side of the band. */
export const POST_X = 8.6
/** The glowing pad you stand on to ride, just short of the band. */
export const LAUNCH_PAD = { x: 0, z: LAUNCH_Z + 5, radius: 2.4 }
/** How far back the band stretches at a full pull. */
export const PULL_BACK = 3.4
/** The deck between the plaza and the band, inside the slide's walls. */
export const LAUNCH_DECK = { minX: -9.4, maxX: 9.4, minZ: LAUNCH_Z + 1.2, maxZ: PLAZA.minZ + 0.5 }
/** The boardwalk from the plaza to the slingshot (painted planks: walked on like the ground). */
export const BOARDWALK = { minX: -3, maxX: 3, minZ: LAUNCH_Z + 7.5, maxZ: -4 }
/** Where you're put back after a ride: on the boardwalk, facing the slingshot. */
export const RIDE_RETURN = { x: 0, z: LAUNCH_Z + 11 }

/** The two premium sleds on their pedestals, either side of the boardwalk. */
export const PEDESTALS = [
  { id: 'unicorn', product: 'sled_unicorn', x: -12, z: -19, color: '#ff6fd0' },
  { id: 'orca', product: 'sled_orca', x: 12, z: -19, color: '#3d8bff' },
]
export const PEDESTAL_RADIUS = 3.2

// --- Around the plaza ------------------------------------------------------------------

/** The golden WORLDS portal: walk in to open the Worlds panel. Faces south, at spawn. */
export const WORLDS_PORTAL = { x: -18, z: -9, radius: 2.6 }
/** The three leaderboards, behind spawn, facing it (north). */
export const LEADERBOARDS = [
  { id: 'playtime', x: -12, z: 28 },
  { id: 'distance', x: 0, z: 28 },
  { id: 'coins', x: 12, z: 28 },
]
/** "FREE 5,000 COINS!": the golden money bag. Walk up to it to claim. */
export const FREE_COINS_STATUE = { x: -23, z: 19, radius: 4 }

/** Cabins (red roofs, lit windows), the shop with its awning, the Christmas tree, snowmen. */
export const CABINS = [
  { x: -27, z: 4, w: 9, d: 7, rotY: Math.PI / 2 },
  { x: 27, z: 4, w: 9, d: 7, rotY: -Math.PI / 2 },
]
export const SHOP_CABIN = { x: 23, z: 22, w: 11, d: 7 }
export const XMAS_TREE = { x: -26, z: -17 }
export const SNOWMEN = [
  { x: -28, z: 30, rotY: 0.6 },
  { x: 28, z: -20, rotY: -0.7 },
  { x: 25, z: 31, rotY: Math.PI },
  { x: -7, z: -18, rotY: 0.3 },
]
/** Lamp posts along the boardwalk and round the plaza. */
export const LAMPS = [
  ...[-30, -22, -14].flatMap((z) => [
    { x: -4.4, z },
    { x: 4.4, z },
  ]),
  { x: -10, z: -4 },
  { x: 10, z: -4 },
  { x: -15, z: 12 },
  { x: 15, z: 12 },
]
/** The banner over the plaza's south entrance, and the ice castle beyond it. */
export const BANNER = { x: 0, z: 33.5, width: 18 }
export const CASTLE = { x: 0, z: 76 }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ })

/** Walkable ground; the controller clamps the player into it. */
export const WALKABLE = [PLAZA, LAUNCH_DECK]

/** Solid, never-changing obstacles. */
export const STATIC_COLLIDERS = [
  // The slingshot's posts and their bases.
  box(-POST_X, LAUNCH_Z, 1.4, 1.4),
  box(POST_X, LAUNCH_Z, 1.4, 1.4),
  // The band itself: no walking down the slide.
  { minX: -POST_X, maxX: POST_X, minZ: LAUNCH_Z - 2, maxZ: LAUNCH_Z + 0.4 },
  // The slide's walls either side of the deck (they rise past it).
  { minX: LAUNCH_DECK.maxX + 0.2, maxX: LAUNCH_DECK.maxX + 6, minZ: LAUNCH_Z - 2, maxZ: PLAZA.minZ + 0.2 },
  { minX: LAUNCH_DECK.minX - 6, maxX: LAUNCH_DECK.minX - 0.2, minZ: LAUNCH_Z - 2, maxZ: PLAZA.minZ + 0.2 },
  ...PEDESTALS.map((p) => box(p.x, p.z, 2.2, 2.2)),
  // The portal's two pillars; walk in between them.
  box(WORLDS_PORTAL.x - WORLDS_PORTAL.radius - 0.6, WORLDS_PORTAL.z, 0.8, 1),
  box(WORLDS_PORTAL.x + WORLDS_PORTAL.radius + 0.6, WORLDS_PORTAL.z, 0.8, 1),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_COINS_STATUE.x, FREE_COINS_STATUE.z, 1.8, 1.8),
  ...CABINS.map((c) => (Math.abs(Math.sin(c.rotY)) > 0.5 ? box(c.x, c.z, c.d / 2, c.w / 2) : box(c.x, c.z, c.w / 2, c.d / 2))),
  box(SHOP_CABIN.x, SHOP_CABIN.z, SHOP_CABIN.w / 2, SHOP_CABIN.d / 2),
  box(XMAS_TREE.x, XMAS_TREE.z, 2.4, 2.4),
  ...SNOWMEN.map((s) => box(s.x, s.z, 0.9, 0.9)),
  ...LAMPS.map((l) => box(l.x, l.z, 0.3, 0.3)),
]

/** Raised floors the player stands on, as rects with a height. */
export const PLATFORMS = [
  { minX: BOARDWALK.minX, maxX: BOARDWALK.maxX, minZ: BOARDWALK.minZ, maxZ: BOARDWALK.maxZ, height: 0.25 },
]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Whether (x, z) is on the launch pad, give or take `margin`. */
export const onLaunchPad = (x, z, margin = 0) => Math.hypot(x - LAUNCH_PAD.x, z - LAUNCH_PAD.z) <= LAUNCH_PAD.radius + margin

/** The premium pedestal (x, z) is by, or null. */
export function pedestalNear(x, z) {
  for (const p of PEDESTALS) if (Math.hypot(x - p.x, z - p.z) < PEDESTAL_RADIUS + 1.6) return p
  return null
}

/** Whether (x, z) is inside the WORLDS portal's arch. */
export const inWorldsPortal = (x, z, margin = 0) =>
  Math.abs(x - WORLDS_PORTAL.x) < WORLDS_PORTAL.radius + margin && Math.abs(z - WORLDS_PORTAL.z) < 1.2 + margin

export const nearFreeCoins = (x, z, margin = 0) =>
  Math.hypot(x - FREE_COINS_STATUE.x, z - FREE_COINS_STATUE.z) < FREE_COINS_STATUE.radius + margin

/** Height of the floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the walkable union, returning the nearest walkable point. */
export function clampToWalkable(x, z, out = { x: 0, z: 0 }) {
  let best = Infinity
  for (const r of WALKABLE) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/**
 * Whether a move to `to` is one the server should let through however fast: PLAY's
 * hop to the slingshot, or the trip back after a ride. Both land at fixed spots.
 */
export const isTeleportSpot = (to) =>
  onLaunchPad(to.x, to.z, 1.5) || Math.hypot(to.x - RIDE_RETURN.x, to.z - RIDE_RETURN.z) < 2.5 || Math.hypot(to.x - SPAWN.x, to.z - SPAWN.z) < 4

/** Fastest a player can legitimately walk, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
/** Walking speed (m/s). */
export const WALK_SPEED = 12
