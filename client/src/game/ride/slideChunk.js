import { BufferAttribute, BufferGeometry } from 'three'

import { FLOOR_HALF, RIM_HEIGHT, stageAt, stageStart, START_FLAT, WALL_REACH, wallHeight } from '@shared/course'
import { hash2, mulberry32 } from '@shared/rng'
import { LAUNCH_Z } from '@shared/world'

import { BlockSet, PropBuilder } from '../blocks'
import { STYLE } from '../materials'
import { COURSE } from './course'
import { zAt } from './path'
import { stageTheme } from './stages'

/**
 * The slide down the mountain, generated in CHUNK-metre pieces on demand. Each piece is
 * two meshes: its surfaces (the snowy floor, the blue half-pipe walls, the rims and the
 * snowy banks beyond, following the slope) merged into one, and every box on it (cliffs,
 * pines, lamps, arches, boost pads, kickers, the finish) in one BlockSet. Seeded by the
 * piece's index, so every client builds an identical slide and a piece can be thrown
 * away and rebuilt at will.
 */

export const CHUNK = 40
/** Where the first piece starts: the slide's walls reach back to the plaza's edge. */
export const FIRST_S = -16
/** Surface rows every this many metres: enough to follow the slope's bends. */
const ROW = 2
/** Out past the rim: the wooden rail, then the banks, then the cliffs. */
const RIM_IN = FLOOR_HALF + WALL_REACH
const RIM_OUT = RIM_IN + 1.3
const BANK_OUT = 38
/** Half the light-blue lane down the middle of the floor. */
const LANE_HALF = 2.2
/** No scenery on the deck by the slingshot, where the lobby's own stands. */
const DECOR_FROM = 6

/** Each world's colours. */
const THEMES = {
  snowy: {
    floor: '#f4f8fc',
    lane: '#a6d4fa',
    wall: '#68b2f6',
    rim: '#7a4a2a',
    bank: '#eef4fa',
    cliff: ['#8a5a3c', '#7a4e34', '#94603f'],
    far: ['#7d8db0', '#8d9cbc', '#6f80a6'],
    leaves: ['#1f8f4a', '#23a052', '#1b7f42'],
    tree: 'pine',
    snowmen: true,
  },
  gold: {
    floor: '#f6dc94',
    lane: '#ffb84a',
    wall: '#e8913a',
    rim: '#6a3a1a',
    bank: '#efcf86',
    cliff: ['#c9733a', '#b8652f', '#d48444'],
    far: ['#d9a066', '#c98f5a', '#e2ab72'],
    leaves: ['#3faa4a', '#48b856', '#2f9a40'],
    tree: 'cactus',
  },
  lava: {
    floor: '#4a4048',
    lane: '#ff8a3a',
    wall: '#7a3a3a',
    rim: '#2a1a1a',
    bank: '#3a3036',
    cliff: ['#3a3036', '#2e262c', '#463a40'],
    far: ['#6a3a3a', '#7a4a3a', '#5a2f3a'],
    // Burning pines: flame-coloured tiers under the ash.
    leaves: ['#ff7a1a', '#ff5a1a', '#ffa23a'],
    tree: 'pine',
  },
}
export const themeOf = () => THEMES[COURSE.world.id] ?? THEMES.snowy

export const chunkCount = () => Math.ceil((COURSE.length + 160 - FIRST_S) / CHUNK)
export const chunkStart = (i) => FIRST_S + i * CHUNK

// --- Surfaces ----------------------------------------------------------------------------

/**
 * A strip of surface following the slope from metre s0 to s1, its cross-section the
 * polyline `points` ([x, height above the floor], increasing x): one flat-shaded
 * geometry added to `b` in `color`.
 */
function strip(b, points, s0, s1, color, style) {
  const rows = Math.max(1, Math.round((s1 - s0) / ROW))
  const quads = rows * (points.length - 1)
  const pos = new Float32Array(quads * 18)
  let o = 0
  const put = (s, x, h) => {
    pos[o++] = x
    pos[o++] = COURSE.baseHeight(s) + h
    pos[o++] = LAUNCH_Z - s
  }
  for (let r = 0; r < rows; r += 1) {
    const a = s0 + ((s1 - s0) * r) / rows
    const c = s0 + ((s1 - s0) * (r + 1)) / rows
    for (let j = 0; j < points.length - 1; j += 1) {
      const [x0, h0] = points[j]
      const [x1, h1] = points[j + 1]
      put(a, x0, h0)
      put(a, x1, h1)
      put(c, x1, h1)
      put(a, x0, h0)
      put(c, x1, h1)
      put(c, x0, h0)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(pos, 3))
  geometry.computeVertexNormals()
  b.add(geometry, { color, style })
  geometry.dispose()
}

/** The half-pipe's wall, one side (`side` -1 or 1), as cross-section points. */
function wallPoints(side) {
  const pts = []
  // Twelve facets: a smooth curve up to the rim, not a few flat panels.
  for (let k = 0; k <= 12; k += 1) {
    const u = FLOOR_HALF + (WALL_REACH * k) / 12
    pts.push([side * u, wallHeight(u)])
  }
  return side < 0 ? pts.reverse() : pts
}
const WALL_R = wallPoints(1)
const WALL_L = wallPoints(-1)
const RIM_R = [
  [RIM_IN, RIM_HEIGHT],
  [RIM_IN, RIM_HEIGHT + 0.45],
  [RIM_OUT, RIM_HEIGHT + 0.45],
  [RIM_OUT, RIM_HEIGHT],
]
const RIM_L = RIM_R.map(([x, h]) => [-x, h]).reverse()

/**
 * The surfaces from s0 to s1, in runs that end at stage boundaries: every strip of a run
 * shares its rows, so their edges meet exactly, and each stage gets its own lane colour.
 */
function surfaces(b, s0, s1, t) {
  for (let a = s0; a < s1; ) {
    const end = Math.min(s1, stageStart(stageAt(a) + 1))
    surfaceRun(b, a, end, t, stageTheme(a))
    a = end
  }
}

function surfaceRun(b, s0, s1, t, stage) {
  strip(b, [[-FLOOR_HALF, 0], [-LANE_HALF, 0]], s0, s1, t.floor, STYLE.STUDS)
  strip(b, [[LANE_HALF, 0], [FLOOR_HALF, 0]], s0, s1, t.floor, STYLE.STUDS)
  // The lane down the middle, as in the reference, in the stage's colour.
  strip(b, [[-LANE_HALF, 0], [LANE_HALF, 0]], s0, s1, stage.lane, STYLE.STUDS)
  // Studded like the reference's, the same small studs as the floor.
  strip(b, WALL_L, s0, s1, stage.wall, STYLE.STUDS)
  strip(b, WALL_R, s0, s1, stage.wall, STYLE.STUDS)
  strip(b, RIM_L, s0, s1, t.rim, STYLE.SMOOTH)
  strip(b, RIM_R, s0, s1, t.rim, STYLE.SMOOTH)
  strip(b, [[-BANK_OUT, RIM_HEIGHT], [-RIM_OUT, RIM_HEIGHT]], s0, s1, t.bank, STYLE.STUDS)
  strip(b, [[RIM_OUT, RIM_HEIGHT], [BANK_OUT, RIM_HEIGHT]], s0, s1, t.bank, STYLE.STUDS)
}

// --- Boxes -------------------------------------------------------------------------------

const pick = (rand, list) => list[Math.floor(rand() * list.length)]
/** Height of the banks (the rim's level) at metre s. */
const bankY = (s) => COURSE.baseHeight(s) + RIM_HEIGHT

/** A blocky snow-capped pine (its tiers' tops are snow), or a cactus in Gold Rush. */
function tree(blocks, x, base, z, scale, rand, t) {
  const s = scale
  if (t.tree === 'cactus') {
    const green = pick(rand, t.leaves)
    blocks.addOn(x, base, z, 0.9 * s, 4.2 * s, 0.9 * s, green, STYLE.STUDS)
    blocks.addOn(x - 0.9 * s, base + 1.6 * s, z, 0.9 * s, 0.6 * s, 0.6 * s, green, STYLE.STUDS)
    blocks.addOn(x - 1.2 * s, base + 1.6 * s, z, 0.6 * s, 1.6 * s, 0.6 * s, green, STYLE.STUDS)
    blocks.addOn(x + 0.9 * s, base + 2.4 * s, z, 0.9 * s, 0.6 * s, 0.6 * s, green, STYLE.STUDS)
    blocks.addOn(x + 1.2 * s, base + 2.4 * s, z, 0.6 * s, 1.3 * s, 0.6 * s, green, STYLE.STUDS)
    return
  }
  blocks.addOn(x, base, z, 0.8 * s, 2.2 * s, 0.8 * s, '#6a3f22')
  const green = pick(rand, t.leaves)
  let y = base + 1.8 * s
  for (const width of [4.6, 3.6, 2.6, 1.6]) {
    blocks.addOn(x, y, z, width * s, 1.5 * s, width * s, green, STYLE.TERRAIN)
    y += 1.3 * s
  }
  blocks.addOn(x, y, z, 0.7 * s, 0.9 * s, 0.7 * s, green, STYLE.TERRAIN)
}

/** A snowman: three balls of snow (boxes), a carrot and a top hat. */
function snowman(blocks, x, base, z) {
  blocks.addOn(x, base, z, 2, 1.8, 2, '#ffffff', STYLE.SMOOTH)
  blocks.addOn(x, base + 1.8, z, 1.5, 1.4, 1.5, '#ffffff', STYLE.SMOOTH)
  blocks.addOn(x, base + 3.2, z, 1.1, 1.1, 1.1, '#ffffff', STYLE.SMOOTH)
  blocks.addOn(x, base + 4.3, z, 0.9, 0.9, 0.9, '#1b1b1f', STYLE.SMOOTH)
  blocks.addOn(x, base + 4.2, z, 1.4, 0.15, 1.4, '#1b1b1f', STYLE.SMOOTH)
  blocks.add(x, base + 3.75, z + 0.7, 0.2, 0.2, 0.6, '#ff8a1c', STYLE.SMOOTH)
  blocks.add(x, base + 3.1, z + 0.62, 0.9, 0.2, 0.3, '#e22a2a', STYLE.SMOOTH)
}

// --- Each stage's scenery on the banks ------------------------------------------------------

/** A cluster of ice crystals round a glowing core. */
function crystals(blocks, x, base, z, s, rand) {
  const colors = ['#bff3ff', '#8fe3ff', '#d9f8ff', '#a8c8ff']
  for (let k = 0; k < 4; k += 1) {
    const h = (2.2 + rand() * 3.8) * s
    const w = (0.6 + rand() * 0.5) * s
    blocks.add(x + (rand() - 0.5) * 2.2 * s, base + h * 0.42, z + (rand() - 0.5) * 2.2 * s, w, h, w, pick(rand, colors), STYLE.SMOOTH, rand() * Math.PI, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.5)
  }
  blocks.add(x, base + 0.5 * s, z, 1.1 * s, 1.1 * s, 1.1 * s, '#7fe8ff', STYLE.GLOW, Math.PI / 4, Math.PI / 4, 0)
}

/** A candy cane, a lollipop or a stack of gumdrops. */
function candy(blocks, x, base, z, s, rand) {
  const kind = rand()
  if (kind < 0.45) {
    blocks.addOn(x, base, z, 0.5 * s, 4.2 * s, 0.5 * s, '#e3242b', STYLE.STRIPES)
    blocks.add(x + 0.55 * s, base + 4.35 * s, z, 1.6 * s, 0.5 * s, 0.5 * s, '#e3242b', STYLE.STRIPES)
    blocks.addOn(x + 1.1 * s, base + 3.0 * s, z, 0.5 * s, 1.35 * s, 0.5 * s, '#e3242b', STYLE.STRIPES)
  } else if (kind < 0.75) {
    blocks.addOn(x, base, z, 0.22 * s, 3.2 * s, 0.22 * s, '#ffffff', STYLE.SMOOTH)
    blocks.add(x, base + 3.9 * s, z, 1.7 * s, 1.7 * s, 0.35 * s, pick(rand, ['#ff5fc8', '#7fe2ff', '#ffe36b']), STYLE.RAINBOW, rand() * Math.PI, 0, Math.PI / 4)
  } else {
    const color = pick(rand, ['#ff5fc8', '#6fe36b', '#ffe36b', '#7fe2ff', '#b98cff'])
    blocks.addOn(x, base, z, 2.2 * s, 0.9 * s, 2.2 * s, color, STYLE.SMOOTH)
    blocks.addOn(x, base + 0.9 * s, z, 1.5 * s, 0.7 * s, 1.5 * s, color, STYLE.SMOOTH)
    blocks.addOn(x, base + 1.6 * s, z, 0.8 * s, 0.5 * s, 0.8 * s, color, STYLE.SMOOTH)
  }
}

/** A little cottage: lit windows, a red gable roof with snow on the ridge, a chimney. */
function cottage(blocks, x, base, z, s, rand) {
  const rot = rand() * Math.PI
  blocks.addOn(x, base, z, 2.6 * s, 2 * s, 2.2 * s, '#8a5226', STYLE.WINDOWS, rot)
  // The roof: a square beam turned 45 degrees, its upper half the gable.
  blocks.add(x, base + 2 * s, z, 1.95 * s, 1.95 * s, 2.7 * s, '#d6262e', STYLE.STUDS, rot, 0, Math.PI / 4)
  blocks.add(x, base + 3.38 * s, z, 0.5 * s, 0.3 * s, 2.8 * s, '#f6f9fd', STYLE.SMOOTH, rot)
  const c = Math.cos(rot)
  const n = Math.sin(rot)
  blocks.addOn(x + 0.7 * s * c + 0.5 * s * n, base + 2 * s, z - 0.7 * s * n + 0.5 * s * c, 0.5 * s, 1.6 * s, 0.5 * s, '#7a4e34', STYLE.STUDS, rot)
}

/** A starry spire with a glowing gem on top. */
function spire(blocks, x, base, z, s, rand) {
  const h = (5 + rand() * 6) * s
  const rot = rand() * Math.PI
  blocks.addOn(x, base, z, 1.6 * s, h, 1.6 * s, '#2b2f6a', STYLE.GALAXY, rot)
  blocks.addOn(x, base + h, z, 1.0 * s, 1.4 * s, 1.0 * s, '#3a3f8a', STYLE.GALAXY, rot + 0.4)
  blocks.add(x, base + h + 1.9 * s, z, 0.7 * s, 0.7 * s, 0.7 * s, pick(rand, ['#5fffb0', '#7fe2ff', '#c9a2ff']), STYLE.GLOW, Math.PI / 4, Math.PI / 4, 0)
}

/** A broken sandstone column, its capital on top or its drum fallen beside it. */
function ruin(blocks, x, base, z, s, rand) {
  const h = (2.5 + rand() * 4) * s
  blocks.addOn(x, base, z, 1.6 * s, 0.5 * s, 1.6 * s, '#cfae6e', STYLE.BLOCK)
  blocks.addOn(x, base + 0.5 * s, z, 1.1 * s, h, 1.1 * s, '#e2c48a', STYLE.BLOCK)
  if (rand() < 0.6) blocks.addOn(x, base + 0.5 * s + h, z, 1.7 * s, 0.5 * s, 1.7 * s, '#cfae6e', STYLE.BLOCK)
  else blocks.add(x + 1.6 * s, base + 0.55 * s, z + 0.4 * s, 1.1 * s, 1.1 * s, 2.4 * s, '#e2c48a', STYLE.BLOCK, rand(), 0.3, 0)
}

/** A leaning palm: a ringed trunk and a crown of drooping fronds. */
function palm(blocks, x, base, z, s, rand) {
  let y = base
  let px = x
  for (let k = 0; k < 4; k += 1) {
    blocks.addOn(px, y, z, 0.55 * s, 1.5 * s, 0.55 * s, k % 2 ? '#9a6a3a' : '#8a5a2e', STYLE.SMOOTH)
    y += 1.45 * s
    px += 0.18 * s
  }
  const L = 2.8 * s
  const tilt = 0.45
  for (let k = 0; k < 6; k += 1) {
    const th = (k / 6) * Math.PI * 2 + rand() * 0.4
    blocks.add(px + Math.cos(th) * (L / 2) * Math.cos(tilt), y - (L / 2) * Math.sin(tilt), z - Math.sin(th) * (L / 2) * Math.cos(tilt), L, 0.12 * s, 0.8 * s, k % 2 ? '#3faa4a' : '#2f9a40', STYLE.SMOOTH, th, 0, -tilt)
  }
  blocks.add(px, y, z, 0.6 * s, 0.6 * s, 0.6 * s, '#6a4a2a', STYLE.SMOOTH)
}

/** A rock seamed with glowing gold. */
function goldRock(blocks, x, base, z, s, rand) {
  blocks.add(x, base + 0.8 * s, z, 2.4 * s, 1.8 * s, 2.0 * s, '#7a5a3a', STYLE.BLOCK, rand() * Math.PI)
  for (let k = 0; k < 3; k += 1) {
    blocks.add(x + (rand() - 0.5) * 2 * s, base + (0.9 + rand() * 0.9) * s, z + (rand() - 0.5) * 1.8 * s, 0.5 * s, 0.5 * s, 0.5 * s, '#ffd23a', STYLE.GLOW, rand() * Math.PI, rand(), rand())
  }
}

/** A small stepped pyramid, a gold cap on its top. */
function pyramid(blocks, x, base, z, s) {
  for (let k = 0; k < 4; k += 1) blocks.addOn(x, base + k * 1.2 * s, z, (4.4 - k * 1.1) * s, 1.2 * s, (4.4 - k * 1.1) * s, k % 2 ? '#e2c48a' : '#d9b876', STYLE.BLOCK)
  blocks.add(x, base + 5.1 * s, z, 0.5 * s, 0.5 * s, 0.5 * s, '#ffd23a', STYLE.GLOW, Math.PI / 4, Math.PI / 4, 0)
}

/** A pillar of cooling lava, glowing at its cracked top. */
function magmaPillar(blocks, x, base, z, s, rand) {
  const h = (3 + rand() * 5) * s
  const rot = rand() * Math.PI
  blocks.addOn(x, base, z, 1.9 * s, h, 1.9 * s, '#3a2a2a', STYLE.LAVA, rot)
  blocks.addOn(x, base + h, z, 1.3 * s, 0.6 * s, 1.3 * s, '#ff8a1a', STYLE.GLOW, rot + 0.5)
}

/** One piece of the stage's scenery on the bank. */
function decor(blocks, stage, x, base, z, s, rand, t) {
  switch (stage.decor) {
    case 'crystal':
      return crystals(blocks, x, base, z, s, rand)
    case 'candy':
      return candy(blocks, x, base, z, s, rand)
    case 'village':
      return rand() < 0.5 ? cottage(blocks, x, base, z, s, rand) : tree(blocks, x, base, z, s, rand, t)
    case 'aurora':
      return spire(blocks, x, base, z, s, rand)
    case 'magma':
      return magmaPillar(blocks, x, base, z, s, rand)
    case 'ruins':
      return ruin(blocks, x, base, z, s, rand)
    case 'palm':
      return palm(blocks, x, base, z, s, rand)
    case 'mine':
      return goldRock(blocks, x, base, z, s, rand)
    case 'pyramid':
      return rand() < 0.5 ? pyramid(blocks, x, base, z, s) : tree(blocks, x, base, z, s, rand, t)
    default:
      if (t.snowmen && rand() < 0.06) return snowman(blocks, x, base, z)
      return tree(blocks, x, base, z, s, rand, t)
  }
}

/** Ribbons of the northern lights, high over the Aurora Peaks. */
function aurora(blocks, s0, s1, rand) {
  for (let k = 0; k < 2; k += 1) {
    const s = s0 + rand() * (s1 - s0)
    blocks.add((rand() - 0.5) * 70, COURSE.baseHeight(s) + 30 + rand() * 10, zAt(s), 60, 1.4, 0.4, pick(rand, ['#5fffb0', '#7fe2ff', '#c9a2ff']), STYLE.GLOW, (rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.3)
  }
}

/** A lamp post on the rim, glowing in the stage's colour. */
function lamp(blocks, x, base, z, glow = '#fff2a8') {
  blocks.addOn(x, base, z, 0.35, 3.6, 0.35, '#7a4a2a', STYLE.SMOOTH)
  blocks.addOn(x, base + 3.6, z, 0.8, 0.8, 0.8, glow, STYLE.GLOW)
  blocks.addOn(x, base + 4.4, z, 1, 0.25, 1, '#2a2f3a', STYLE.SMOOTH)
}

/** A stage's gate: a big arch right over the slide at metre s, in the stage's colours. */
function arch(blocks, s) {
  const stage = stageTheme(s)
  const base = COURSE.baseHeight(s)
  const z = zAt(s)
  const R = RIM_OUT + 1
  const n = 15
  for (let k = 0; k <= n; k += 1) {
    const a = (Math.PI * k) / n
    const x = -Math.cos(a) * R
    const y = base + RIM_HEIGHT - 1 + Math.sin(a) * (R * 0.85)
    // Neighbours overlap at their inner corners: every other one a little deeper, so
    // their faces never share a plane (they'd flicker between the two blues).
    blocks.add(x, y, z, 3.2, 3.2, k % 2 ? 3.3 : 3, stage.gate[k % 2], STYLE.BLOCK, 0, 0, a - Math.PI / 2)
  }
  // A glowing crystal hanging from the keystone.
  blocks.add(0, base + RIM_HEIGHT + R * 0.85 - 4, z, 1.2, 1.2, 1.2, stage.lamp, STYLE.GLOW, Math.PI / 4, 0, Math.PI / 4)
}

/** A snow kicker right across the floor, its lip striped yellow. */
function kicker(blocks, k, t) {
  const s0 = k.s - k.length
  const base = (COURSE.baseHeight(s0) + COURSE.baseHeight(k.s)) / 2
  const tilt = Math.atan2(k.height, k.length)
  const hyp = Math.hypot(k.height, k.length)
  const midZ = (zAt(s0) + zAt(k.s)) / 2
  const slope = Math.atan2(COURSE.baseHeight(s0) - COURSE.baseHeight(k.s), k.length)
  blocks.add(0, base + k.height / 2 - 0.12, midZ, FLOOR_HALF * 2 + 0.6, 0.3, hyp, t.floor, STYLE.STUDS, 0, tilt - slope)
  blocks.add(0, COURSE.baseHeight(k.s) + k.height / 2 - 0.1, zAt(k.s) + 0.15, FLOOR_HALF * 2 + 0.6, k.height + 0.2, 0.3, t.floor, STYLE.STUDS)
  blocks.add(0, COURSE.baseHeight(k.s) + k.height + 0.02, zAt(k.s) + 0.4, FLOOR_HALF * 2 + 0.6, 0.08, 0.6, '#ffd21f', STYLE.GLOW)
}

/** The finish: a chequered arch over the slide and flags either side. */
function finish(blocks, s) {
  const base = COURSE.baseHeight(s)
  const z = zAt(s)
  const span = RIM_OUT + 2
  for (let i = -span; i < span; i += 1.5) {
    for (let row = 0; row < 2; row += 1) {
      const black = (Math.round(i / 1.5) + row) % 2 === 0
      blocks.add(i + 0.75, base + RIM_HEIGHT + 7 + row * 1.5, z, 1.5, 1.5, 1, black ? '#1b1b1f' : '#ffffff', STYLE.SMOOTH)
    }
  }
  for (const side of [-1, 1]) {
    blocks.addOn(side * span, base + RIM_HEIGHT, z, 1.4, 8.6, 1.4, '#ffd21f', STYLE.STRIPES)
  }
  blocks.add(0, base + 0.05, z, FLOOR_HALF * 2, 0.1, 1.2, '#ffffff', STYLE.GLOW)
}

/** Cliffs and far mountains beyond the banks, either side. */
function cliffs(blocks, s0, s1, rand, t, density) {
  for (const side of [-1, 1]) {
    for (let s = s0; s < s1; s += 8) {
      const cliff = stageTheme(s).cliff ?? t.cliff
      const base = bankY(s + 4)
      const z = zAt(s + 4)
      // The near cliff steps, rising away from the slide. Each 8 m piece overlaps the
      // next a little (no seams): every other one stands a touch further out, so their
      // faces towards the slide never share a plane.
      let x = BANK_OUT + (Math.floor(s) % 16 < 8 ? 0 : 0.3)
      let h = 2 + rand() * 4
      for (let step = 0; step < 3; step += 1) {
        const w = 8 + rand() * 8
        blocks.addOn(side * (x + w / 2), base - 2, z, w, h + 2, 8.2, pick(rand, cliff), STYLE.TERRAIN)
        if (rand() < 0.35 * density) tree(blocks, side * (x + w / 2 + (rand() - 0.5) * w * 0.5), base + h, z + (rand() - 0.5) * 4, 0.8 + rand() * 0.5, rand, t)
        x += w
        h += 4 + rand() * 9
      }
      // Far mountains, big and pale with the distance.
      if (rand() < 0.5 * density + 0.2) {
        const w = 20 + rand() * 30
        blocks.addOn(side * (x + 10 + w / 2), base - 30, z + (rand() - 0.5) * 6, w, h + 40 + rand() * 40, 14 + rand() * 10, pick(rand, t.far), STYLE.TERRAIN)
      }
    }
  }
}

/** A ski-lift tower on the right bank, its cable running on down the slope. */
function liftTower(blocks, s) {
  const base = bankY(s)
  const z = zAt(s)
  const x = 25
  blocks.addOn(x, base, z, 0.8, 11, 0.8, '#3a4a6a', STYLE.SMOOTH)
  blocks.addOn(x, base + 11, z, 5, 0.5, 0.8, '#3a4a6a', STYLE.SMOOTH)
  const s2 = s + 60
  const dy = bankY(s2) - base
  const len = Math.hypot(60, dy)
  const tilt = Math.atan2(dy, 60)
  for (const dx of [-2.2, 2.2]) blocks.add(x + dx, base + 10.6 + dy / 2, z - 30, 0.12, 0.12, len, '#1b1b1f', STYLE.SMOOTH, 0, -tilt)
  // A chair or two hanging off the cable.
  for (const f of [0.3, 0.75]) {
    const cz = z - 60 * f
    const cy = base + 10.6 + dy * f
    blocks.add(x + 2.2, cy - 1.2, cz, 0.1, 2.2, 0.1, '#1b1b1f', STYLE.SMOOTH)
    blocks.add(x + 2.2, cy - 2.4, cz, 1.6, 0.3, 0.9, '#e22a2a', STYLE.SMOOTH)
    blocks.add(x + 2.2, cy - 1.9, cz - 0.4, 1.6, 0.8, 0.15, '#e22a2a', STYLE.SMOOTH)
  }
}

/**
 * Builds piece `i`: `{ surface: PropBuilder, blocks: BlockSet }` for the caller to turn
 * into meshes. `density` (0-1) thins the scenery on low presets.
 */
export function buildChunk(i, { density = 1 } = {}) {
  const s0 = chunkStart(i)
  const s1 = s0 + CHUNK
  const t = themeOf()
  const surface = new PropBuilder()
  const blocks = new BlockSet()
  const rand = mulberry32(i * 7919 + COURSE.index * 104729 + 17)
  surfaces(surface, s0, s1, t)

  if (i === 0) {
    // The slide's walls end in a face where they meet the plaza (behind the pedestals).
    for (const side of [-1, 1]) {
      blocks.addOn(side * ((RIM_IN + BANK_OUT) / 2 - 3), -0.5, zAt(s0) + 0.6, BANK_OUT - RIM_IN + 6, RIM_HEIGHT + 0.5, 1.2, t.wall, STYLE.STUDS)
      blocks.addOn(side * (FLOOR_HALF + 2.4), -0.5, zAt(s0) + 0.6, 4.8, RIM_HEIGHT * 0.55, 1.2, t.wall, STYLE.STUDS)
    }
  }

  const from = Math.max(s0, DECOR_FROM)
  if (s1 > DECOR_FROM) {
    cliffs(blocks, from, s1, rand, t, density)
    // The stage's scenery on the banks: pines (or cacti), crystals, candy...
    for (let s = from; s < s1; s += 6) {
      for (const side of [-1, 1]) {
        if (hash2(Math.floor(s), side, COURSE.index * 13 + 5) > 0.42 * density + 0.05) continue
        const x = side * (RIM_OUT + 4 + rand() * (BANK_OUT - RIM_OUT - 7))
        const ss = s + rand() * 4
        decor(blocks, stageTheme(ss), x, bankY(ss), zAt(ss), 0.8 + rand() * 0.6, rand, t)
      }
    }
    if (stageTheme(from).decor === 'aurora') aurora(blocks, from, s1, rand)
    // Lamps along both rims, glowing in the stage's colour.
    for (let s = Math.ceil(from / 24) * 24; s < s1; s += 24) {
      for (const side of [-1, 1]) lamp(blocks, side * (RIM_OUT + 0.9), bankY(s), zAt(s), stageTheme(s).lamp)
    }
    for (let s = Math.ceil(from / 120) * 120; s < s1; s += 120) if (s > START_FLAT + 40) liftTower(blocks, s)
  }

  for (const s of COURSE.arches) if (s >= s0 && s < s1) arch(blocks, s)
  for (const k of COURSE.kickers) if (k.s >= s0 && k.s < s1) kicker(blocks, k, t)
  if (COURSE.length >= s0 && COURSE.length < s1) finish(blocks, COURSE.length)
  // Distance signs: a board on a post on the right rim (the label floats over it).
  for (const s of COURSE.signs) {
    if (s < s0 || s >= s1) continue
    blocks.addOn(RIM_OUT + 1.6, bankY(s), zAt(s), 0.35, 2.6, 0.35, '#6a3f22', STYLE.SMOOTH)
    blocks.addOn(RIM_OUT + 1.6, bankY(s) + 2.4, zAt(s), 3.8, 1.5, 0.3, '#f4e3c4', STYLE.SMOOTH)
  }
  return { surface, blocks }
}
