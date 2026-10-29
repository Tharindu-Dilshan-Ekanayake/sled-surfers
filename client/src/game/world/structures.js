import { ConeGeometry, CylinderGeometry, Euler, Quaternion, SphereGeometry, TorusGeometry } from 'three'

import {
  BANNER,
  BOARDWALK,
  CABINS,
  CASTLE,
  FREE_COINS_STATUE,
  LAMPS,
  LAUNCH_PAD,
  LAUNCH_Z,
  PEDESTALS,
  PLAZA,
  POST_X,
  SHOP_CABIN,
  SNOWMEN,
  WORLDS_PORTAL,
  XMAS_TREE,
} from '@shared/world'
import { mulberry32 } from '@shared/rng'

import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'
import { addTree } from './terrain'

/**
 * Everything built in the lobby, as boxes (into a BlockSet) and, for the round things,
 * merged props (into a PropBuilder): the whole lot is two draw calls.
 */

const CYL = new CylinderGeometry(1, 1, 1, 24)
const SPHERE = new SphereGeometry(1, 16, 10)
const CONE = new ConeGeometry(1, 1, 12)

/** A box turned `rotY` about (cx, cz), offset (dx, dz) from it in its own frame. */
function turned(blocks, cx, base, cz, rotY, dx, dz, sx, sy, sz, color, style) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  blocks.addOn(cx + dx * c + dz * s, base, cz - dx * s + dz * c, sx, sy, sz, color, style, rotY)
}

/** The slingshot: two tall Y-shaped wooden posts on stone bases, and the glowing pad. */
export function buildSlingshot(blocks, props) {
  for (const side of [-1, 1]) {
    const x = side * POST_X
    const z = LAUNCH_Z
    blocks.addOn(x, 0, z, 3.2, 0.7, 3.2, '#3d4f80', STYLE.STUDS)
    blocks.addOn(x, 0.7, z, 2.6, 0.25, 2.6, PALETTE.snow, STYLE.SMOOTH)
    blocks.addOn(x, 0.95, z, 1.9, 4.6, 1.9, '#8a5226', STYLE.STUDS)
    for (const y of [1.6, 3.9]) blocks.addOn(x, 0.95 + y, z, 2.05, 0.35, 2.05, '#4a2a14', STYLE.SMOOTH)
    // The fork: two arms leaning out, snow on their tips.
    for (const arm of [-1, 1]) {
      blocks.add(x + arm * 0.75, 7.0, z, 1.2, 3.4, 1.2, '#9a5e2e', STYLE.STUDS, 0, 0, -arm * 0.45)
      blocks.add(x + arm * 1.55, 8.75, z, 1.5, 0.45, 1.5, PALETTE.snow, STYLE.SMOOTH, 0, 0, -arm * 0.45)
    }
  }
  // The pad you stand on to ride: a glowing cyan disc.
  // A pale glowing disc ringed in brighter cyan, flush with the deck.
  props.add(CYL, { position: [LAUNCH_PAD.x, 0.03, LAUNCH_PAD.z], scale: [LAUNCH_PAD.radius * 0.94, 0.06, LAUNCH_PAD.radius * 0.94], color: '#bdf6ff', style: STYLE.GLOW })
  props.add(new TorusGeometry(LAUNCH_PAD.radius, 0.14, 8, 40), { position: [LAUNCH_PAD.x, 0.08, LAUNCH_PAD.z], rotation: [Math.PI / 2, 0, 0], color: '#2fd8ff', style: STYLE.GLOW })
}

/** The boardwalk from the plaza to the slingshot: planks across, rails along. */
export function buildBoardwalk(blocks) {
  const { minX, maxX, minZ, maxZ } = BOARDWALK
  let k = 0
  for (let z = minZ + 0.55; z < maxZ; z += 1.15) {
    blocks.addOn(0, 0, z, maxX - minX, 0.25, 1.05, PALETTE.plank[k % PALETTE.plank.length], STYLE.STUDS)
    k += 1
  }
  for (const x of [minX - 0.2, maxX + 0.2]) blocks.addOn(x, 0, (minZ + maxZ) / 2, 0.4, 0.45, maxZ - minZ, '#5a3418', STYLE.SMOOTH)
}

/** The premium sleds' pedestals: a round stand with a glowing ring (the sleds spin on top, see Pedestals). */
export function buildPedestals(props) {
  for (const p of PEDESTALS) {
    props.add(CYL, { position: [p.x, 0.35, p.z], scale: [2.6, 0.7, 2.6], color: '#f4f8fc' })
    props.add(CYL, { position: [p.x, 0.78, p.z], scale: [2.2, 0.16, 2.2], color: p.color, style: STYLE.GLOW })
    props.add(new TorusGeometry(2.4, 0.12, 6, 28), { position: [p.x, 0.75, p.z], rotation: [Math.PI / 2, 0, 0], color: p.color, style: STYLE.GLOW })
  }
}

/** The WORLDS portal: a dark stone arch round a glowing golden door. */
export function buildWorldsPortal(blocks) {
  const { x, z, radius } = WORLDS_PORTAL
  const h = 6.2
  for (const side of [-1, 1]) blocks.addOn(x + side * (radius + 0.6), 0, z, 1.4, h, 2, '#2c3550', STYLE.BLOCK)
  blocks.addOn(x, h, z, radius * 2 + 2.6, 1.4, 2, '#2c3550', STYLE.BLOCK)
  blocks.addOn(x, h + 1.4, z, radius * 2 - 0.6, 0.8, 2, '#2c3550', STYLE.BLOCK)
  blocks.addOn(x, 0, z, radius * 2 - 0.2, h - 0.1, 0.4, '#ffd23a', STYLE.GLOW)
  blocks.addOn(x, 0, z + 1.6, radius * 2 + 2, 0.15, 2.4, '#3d4f80', STYLE.STUDS)
}

/** "FREE 5,000 COINS!": a giant golden money bag on a pile of coins. */
export function buildMoneyBag(props) {
  const { x, z } = FREE_COINS_STATUE
  props.add(CYL, { position: [x, 0.15, z], scale: [3.2, 0.3, 3.2], color: '#ffd23a', style: STYLE.GLOW })
  props.add(SPHERE, { position: [x, 2.1, z], scale: [1.9, 1.9, 1.9], color: '#ffc22e', style: STYLE.SMOOTH })
  props.add(CONE, { position: [x, 4.3, z], rotation: [Math.PI, 0, 0], scale: [0.9, 1, 0.9], color: '#ffc22e', style: STYLE.SMOOTH })
  props.add(CYL, { position: [x, 3.7, z], scale: [0.75, 0.3, 0.75], color: '#c98a00', style: STYLE.SMOOTH })
  props.add(CYL, { position: [x, 2.3, z + 1.85], rotation: [Math.PI / 2, 0, 0], scale: [0.85, 0.1, 0.85], color: '#fff3a3', style: STYLE.GLOW })
  for (let i = 0; i < 9; i += 1) {
    const a = i * 2.1
    const r = 2.2 + (i % 3) * 0.3
    props.add(CYL, { position: [x + Math.cos(a) * r, 0.36 + (i % 2) * 0.1, z + Math.sin(a) * r], rotation: [0.2 * (i % 3), a, 0.3], scale: [0.45, 0.1, 0.45], color: '#ffd23a', style: STYLE.GLOW })
  }
}

const _tilt = new Quaternion()
const _euler = new Euler()

/**
 * A box tipped `tilt` about its own length (local x) and then turned `rotY`, centred at
 * (dx, y, dz) in a building's frame at (cx, cz): a roof slope. BlockSet takes X-then-Y
 * Euler angles, so the turn-then-tip is worked out as a rotation first.
 */
function tipped(blocks, cx, cz, rotY, dx, y, dz, sx, sy, sz, tilt, color, style) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  _tilt.setFromEuler(_euler.set(tilt, rotY, 0, 'YXZ'))
  _euler.setFromQuaternion(_tilt, 'XYZ')
  blocks.add(cx + dx * c + dz * s, y, cz - dx * s + dz * c, sx, sy, sz, color, style, _euler.y, _euler.x, _euler.z)
}

/**
 * A log cabin, as in the reference: plank walls with lit windows and a door, and a red
 * gable roof - two slopes meeting on the ridge, overhanging the walls, a thick layer of
 * snow on each and a ridge cap - over stepped gable ends.
 */
function cabin(blocks, { x, z, w, d, rotY = 0 }, { awning = false } = {}) {
  const wall = 3.8
  const pitch = 0.62
  const half = d / 2 + 0.8
  const rise = half * Math.tan(pitch)
  const slope = half / Math.cos(pitch)
  turned(blocks, x, 0, z, rotY, 0, 0, w, wall, d, PALETTE.cabin, STYLE.WINDOWS)
  turned(blocks, x, wall - 0.2, z, rotY, 0, 0, w + 0.3, 0.4, d + 0.3, PALETTE.trim, STYLE.SMOOTH)
  // The gable ends: stepped triangles of planks under the slopes.
  for (let k = 0; k < 4; k += 1) {
    const depth = d * (1 - (k + 0.5) / 4)
    turned(blocks, x, wall + (k * rise) / 4.4, z, rotY, 0, 0, w - 0.1, rise / 4.4 + 0.02, depth, PALETTE.cabin, STYLE.STUDS)
  }
  for (const side of [-1, 1]) {
    // A slope: its middle halfway down from the ridge, tipped down towards its eave.
    const dz = (side * half) / 2
    const y = wall + rise / 2 + 0.15
    tipped(blocks, x, z, rotY, 0, y, dz, w + 1.2, 0.36, slope + 0.2, side * pitch, PALETTE.roof, STYLE.STUDS)
    tipped(blocks, x, z, rotY, 0, y + 0.3, dz - side * 0.04, w + 1.3, 0.24, slope + 0.1, side * pitch, PALETTE.snow, STYLE.SMOOTH)
  }
  turned(blocks, x, wall + rise + 0.25, z, rotY, 0, 0, w + 1.35, 0.35, 0.7, PALETTE.snow, STYLE.SMOOTH)
  turned(blocks, x, wall + rise * 0.3, z, rotY, w * 0.3, -d * 0.15, 0.9, rise + 1.4, 0.9, '#7a4e34', STYLE.STUDS)
  turned(blocks, x, wall + rise + 1.4, z, rotY, w * 0.3, -d * 0.15, 1.1, 0.3, 1.1, PALETTE.snow, STYLE.SMOOTH)
  turned(blocks, x, 0, z, rotY, 0, d / 2 + 0.05, 1.6, 2.6, 0.12, '#4a2a14', STYLE.SMOOTH)
  turned(blocks, x, 2.9, z, rotY, 0, d / 2 + 0.1, 1.2, 0.4, 0.1, '#fff2a8', STYLE.GLOW)
  if (awning) {
    // Red-and-white striped awning over a wide lit window: the shop. The stripes
    // overlap a little; the red ones are a touch bigger all round, so where they
    // overlap no two faces share a plane.
    for (let k = 0; k < 8; k += 1) {
      const red = k % 2 === 0
      const grow = red ? 0.04 : 0
      turned(blocks, x, wall - 0.4 - grow, z, rotY, -w / 2 + 0.75 + k * ((w - 1.5) / 7), d / 2 + 0.9 + grow / 2, (w - 1.5) / 7 + 0.05, 0.3 + grow * 2, 1.8 + grow, red ? '#e3242b' : '#ffffff', STYLE.SMOOTH)
    }
    // Beside the door, not overlapping it (their fronts are level).
    turned(blocks, x, 1.1, z, rotY, -2.75, d / 2 + 0.06, 3.5, 1.8, 0.1, '#fff2a8', STYLE.GLOW)
  }
}

export function buildCabins(blocks) {
  for (const c of CABINS) cabin(blocks, c)
  cabin(blocks, { ...SHOP_CABIN, rotY: Math.PI }, { awning: true })
}

/** The plaza's centrepiece: the world's own (PALETTE.landmark). */
export function buildXmasTree(blocks, props) {
  if (PALETTE.landmark === 'palm') return buildPalm(blocks)
  if (PALETTE.landmark === 'obelisk') return buildObelisk(blocks)
  return buildChristmasTree(blocks, props)
}

/** Gold Rush's centrepiece: a tall leaning palm over a pool, coconuts in its crown. */
function buildPalm(blocks) {
  const { x, z } = XMAS_TREE
  blocks.addOn(x, 0, z, 5.2, 0.4, 5.2, '#d9b876', STYLE.BLOCK)
  blocks.addOn(x, 0.05, z, 4.2, 0.4, 4.2, '#5fd0e0', STYLE.WATER)
  let y = 0
  let px = x
  for (let k = 0; k < 6; k += 1) {
    blocks.addOn(px, y, z, 0.9, 1.6, 0.9, k % 2 ? '#9a6a3a' : '#8a5a2e', STYLE.SMOOTH)
    y += 1.5
    px += 0.22
  }
  const L = 4.4
  const tilt = 0.4
  for (let k = 0; k < 7; k += 1) {
    const th = (k / 7) * Math.PI * 2
    blocks.add(px + Math.cos(th) * (L / 2) * Math.cos(tilt), y - (L / 2) * Math.sin(tilt), z - Math.sin(th) * (L / 2) * Math.cos(tilt), L, 0.18, 1.2, k % 2 ? '#3faa4a' : '#2f9a40', STYLE.SMOOTH, th, 0, -tilt)
  }
  for (const [dx, dz] of [
    [0.35, 0.2],
    [-0.3, 0.25],
    [0, -0.35],
  ]) {
    blocks.add(px + dx, y - 0.35, z + dz, 0.5, 0.5, 0.5, '#6a4a2a', STYLE.SMOOTH)
  }
}

/** Lava Volcano's centrepiece: an obsidian obelisk over a ring of lava, a burning gem on top. */
function buildObelisk(blocks) {
  const { x, z } = XMAS_TREE
  blocks.addOn(x, 0, z, 5.6, 0.5, 5.6, '#2e262c', STYLE.BLOCK)
  blocks.addOn(x, 0.1, z, 4.6, 0.5, 4.6, '#ff6a1a', STYLE.LAVA)
  blocks.addOn(x, 0.6, z, 2.6, 1.0, 2.6, '#3a3036', STYLE.BLOCK)
  blocks.addOn(x, 1.6, z, 1.8, 7.5, 1.8, '#2a2228', STYLE.LAVA)
  blocks.addOn(x, 9.1, z, 1.3, 1.2, 1.3, '#2a2228', STYLE.LAVA)
  blocks.add(x, 11.2, z, 1.3, 1.3, 1.3, '#ff9a2a', STYLE.GLOW, Math.PI / 4, Math.PI / 4, 0)
}

/** The big Christmas tree, its lights and its star. */
function buildChristmasTree(blocks, props) {
  const { x, z } = XMAS_TREE
  blocks.addOn(x, 0, z, 1.2, 1.4, 1.2, '#6a3f22', STYLE.SMOOTH)
  const lights = ['#ff3b3b', '#ffe02a', '#3fd2ff', '#ff5fc8', '#39e25a']
  let y = 1.2
  let k = 0
  for (const w of [7, 5.8, 4.6, 3.4, 2.2]) {
    blocks.addOn(x, y, z, w, 2, w, '#1f8f4a', STYLE.TERRAIN)
    for (const [dx, dz] of [
      [w / 2, 0],
      [-w / 2, 0],
      [0, w / 2],
      [0, -w / 2],
    ]) {
      blocks.add(x + dx * 1.02, y + 0.8, z + dz * 1.02, 0.45, 0.45, 0.45, lights[k % lights.length], STYLE.GLOW)
      k += 1
    }
    y += 1.8
  }
  props.add(new ConeGeometry(0.8, 0.5, 5), { position: [x, y + 0.6, z], rotation: [Math.PI / 2, 0, 0], color: '#ffe02a', style: STYLE.GLOW })
  // Presents round its foot.
  for (const [dx, dz, color] of [
    [2.6, 2.2, '#e3242b'],
    [-2.4, 2.6, '#3d8bff'],
    [2.8, -1.8, '#39e25a'],
  ]) {
    blocks.addOn(x + dx, 0, z + dz, 1.1, 1, 1.1, color, STYLE.SMOOTH)
    blocks.addOn(x + dx, 0, z + dz, 1.15, 1.05, 0.25, '#ffe02a', STYLE.SMOOTH)
  }
}

/** The figures round the plaza: snowmen, cacti or glowing lava rocks, by world (PALETTE.figure). */
export function buildSnowmen(blocks) {
  for (const { x, z, rotY } of SNOWMEN) {
    if (PALETTE.figure === 'cactus') {
      addTree(blocks, x, 0, z, 0.9)
      continue
    }
    if (PALETTE.figure === 'lavaRock') {
      blocks.add(x, 0.9, z, 2.2, 1.9, 2.0, '#3a2a2a', STYLE.LAVA, rotY, 0.2, 0.1)
      blocks.add(x + 0.5, 2.0, z - 0.2, 1.2, 1.1, 1.2, '#2e2428', STYLE.LAVA, rotY + 0.7, 0.3, 0)
      blocks.add(x - 0.4, 1.9, z + 0.3, 0.5, 0.5, 0.5, '#ff8a1a', STYLE.GLOW, rotY, 0.6, 0.4)
      continue
    }
    blocks.addOn(x, 0, z, 2, 1.8, 2, '#ffffff', STYLE.SMOOTH)
    blocks.addOn(x, 1.8, z, 1.5, 1.4, 1.5, '#ffffff', STYLE.SMOOTH)
    blocks.addOn(x, 3.2, z, 1.1, 1.1, 1.1, '#ffffff', STYLE.SMOOTH)
    blocks.addOn(x, 4.3, z, 0.9, 0.9, 0.9, '#1b1b1f', STYLE.SMOOTH)
    blocks.addOn(x, 4.2, z, 1.4, 0.15, 1.4, '#1b1b1f', STYLE.SMOOTH)
    turned(blocks, x, 3.65, z, rotY, 0, 0.7, 0.2, 0.2, 0.6, '#ff8a1c', STYLE.SMOOTH)
    turned(blocks, x, 3.0, z, rotY, 0, 0.62, 1, 0.22, 0.3, '#e22a2a', STYLE.SMOOTH)
  }
}

/**
 * Drifts of snow heaped along the foot of the cliffs round the plaza, so the ground
 * meets them softly: a few overlapping white blocks each, stepped like a mound.
 */
export function buildSnowDrifts(blocks) {
  const rand = mulberry32(911)
  const drift = (x, z, size) => {
    blocks.addOn(x, -0.2, z, size * 2.2, 0.75 + size * 0.15, size * 1.8, PALETTE.snow, STYLE.SMOOTH, rand() * 0.6)
    blocks.addOn(x + (rand() - 0.5) * size, 0.3, z + (rand() - 0.5) * size * 0.5, size * 1.4, 0.6 + size * 0.15, size * 1.2, PALETTE.snow, STYLE.SMOOTH, rand() * 0.6)
    blocks.addOn(x + (rand() - 0.5) * size * 0.6, 0.8, z, size * 0.7, 0.45, size * 0.6, PALETTE.snow, STYLE.SMOOTH, rand())
  }
  for (let z = PLAZA.minZ + 6; z < PLAZA.maxZ - 2; z += 4.5 + rand() * 3) {
    drift(PLAZA.minX + 1.2, z, 1.2 + rand() * 0.9)
    drift(PLAZA.maxX - 1.2, z + 2, 1.2 + rand() * 0.9)
  }
  for (let x = PLAZA.minX + 4; x < PLAZA.maxX - 3; x += 4.5 + rand() * 3) {
    if (Math.abs(x - BANNER.x) < BANNER.width / 2 + 1) continue
    drift(x, PLAZA.maxZ - 1.2, 1.2 + rand() * 0.9)
  }
  // Round the lamp posts out in the plaza, and either side of the deck to the slingshot.
  for (const { x, z } of LAMPS) if (Math.abs(x) > 6) drift(x + 0.8, z + 0.6, 0.7)
  for (const side of [-1, 1]) drift(side * 9, PLAZA.minZ + 2, 1.1)
}

export function buildLamps(blocks) {
  for (const { x, z } of LAMPS) {
    blocks.addOn(x, 0, z, 0.4, 3.4, 0.4, '#8a5226', STYLE.SMOOTH)
    blocks.addOn(x, 3.4, z, 0.95, 0.95, 0.95, '#fff2a8', STYLE.GLOW)
    blocks.addOn(x, 4.35, z, 1.15, 0.3, 1.15, PALETTE.snow, STYLE.SMOOTH)
  }
}

/** The banner over the plaza's south entrance (its words are a world label). */
export function buildBanner(blocks) {
  const { x, z, width } = BANNER
  for (const side of [-1, 1]) blocks.addOn(x + (side * width) / 2, 0, z, 0.8, 6.4, 0.8, '#5a3418', STYLE.SMOOTH)
  blocks.addOn(x, 4.6, z, width, 1.6, 0.4, '#f4f8fc', STYLE.SMOOTH)
}

/** The ice castle on the plateau behind the plaza: pale blue walls, towers with red roofs. */
export function buildCastle(blocks, props, base) {
  const { x, z } = CASTLE
  const ice = PALETTE.castleWall
  const iceDark = PALETTE.castleDark
  blocks.addOn(x, base, z, 34, 1.2, 22, PALETTE.castleBase, STYLE.STUDS)
  blocks.addOn(x, base + 1.2, z, 26, 10, 14, ice, STYLE.WINDOWS)
  blocks.addOn(x, base + 11.2, z, 18, 8, 10, ice, STYLE.WINDOWS)
  blocks.addOn(x, base + 1.2, z - 7.2, 5, 6, 0.6, '#2c3550', STYLE.SMOOTH)
  for (const [dx, dz, h] of [
    [-13, -7, 18],
    [13, -7, 18],
    [-13, 7, 15],
    [13, 7, 15],
    [0, 0, 26],
  ]) {
    const w = dx === 0 ? 6 : 4.6
    blocks.addOn(x + dx, base + 1.2, z + dz, w, h, w, dx === 0 ? ice : iceDark, STYLE.WINDOWS)
    props.add(CONE, { position: [x + dx, base + 1.2 + h + 2.4, z + dz], scale: [w * 0.62, 4.8, w * 0.62], color: PALETTE.castleRoof })
    blocks.addOn(x + dx, base + 1.2 + h + 4.8, z + dz, 0.2, 2.2, 0.2, '#1b1b1f', STYLE.SMOOTH)
    blocks.addOn(x + dx + 0.6, base + 1.2 + h + 6.2, z + dz, 1.2, 0.7, 0.1, '#ffe02a', STYLE.SMOOTH)
  }
  // Battlements along the wall tops.
  for (let k = -12; k <= 12; k += 3) blocks.addOn(x + k, base + 11.2, z - 7, 1.4, 1.2, 1, iceDark, STYLE.STUDS)
}
