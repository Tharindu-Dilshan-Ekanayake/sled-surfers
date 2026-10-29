import {
  Box3,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
// ~2 KB: rounded boxes, so the sleds read as moulded toys rather than bricks.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { FIRST_SLED, SLEDS } from '@shared/balance'

import { PropBuilder } from '../blocks'
import { star } from '../geometry'
import { STYLE } from '../materials'

/**
 * Every sled's 3D model, modelled from rounded boxes, lathes, tubes and extruded shapes
 * and merged into one vertex-coloured geometry (one draw call), cached by id. Drawn
 * with the glossy toy material (materials.js), so they shine like moulded plastic -
 * or polished metal, for the Gold and Ruby finishes. The same geometry is used under
 * you on the slide, under other players, on the pedestals and in the SLEDS portraits.
 *
 * Model space: the sled faces +Z, sits on y = 0, and its seat is SEAT_HEIGHT[shape] up.
 * Each shape comes in five finishes (balance TIERS): its own colours, then Gold,
 * Diamond (pastel rainbow), Ruby and Galaxy; the four premium finishes also wear a
 * glowing gem on the nose.
 *
 * Built once per sled, on first use: no geometry is made per frame. Every sled stays
 * under ~2.5k triangles.
 */

const SPHERE = new SphereGeometry(1, 16, 12)
const BEAD = new SphereGeometry(1, 6, 4)
const CONE = new ConeGeometry(1, 1, 16)
const CYL = new CylinderGeometry(1, 1, 1, 20)
const GEM = new OctahedronGeometry(1)

/** Every sled is modelled at this scale (they read bigger under the rider, as in the reference). */
export const SLED_SCALE = 1.3

/** How high you sit on each shape, before SLED_SCALE. */
export const SEAT_HEIGHT = {
  tube: 0.36,
  bobsled: 0.6,
  sled: 0.47,
  saucer: 0.3,
  board: 0.2,
  rocket: 0.74,
  cart: 0.5,
  toboggan: 0.2,
  carpet: 0.36,
  camel: 0.78,
  magma: 0.24,
  meteor: 0.98,
  hover: 0.46,
  dragon: 0.86,
  unicorn: 0.4,
  orca: 0.84,
}

/** The colours of a finish: `main`, `alt` (stripes, trim), `dark`, their styles, and a gem. */
function finish(tier, own) {
  switch (tier) {
    case 'gold':
      return { main: '#ffc22e', alt: '#ffe36b', dark: '#c98a00', style: STYLE.METAL, altStyle: STYLE.METAL, gem: '#fff3a3' }
    case 'diamond':
      return { main: '#bfe9ff', alt: '#ffc6ec', dark: '#9fd7ff', style: STYLE.RAINBOW, altStyle: STYLE.RAINBOW, gem: '#9ef0ff' }
    case 'ruby':
      return { main: '#a3122f', alt: '#e0294a', dark: '#4a0612', style: STYLE.METAL, altStyle: STYLE.METAL, gem: '#ff7a92' }
    case 'galaxy':
      return { main: '#25145e', alt: '#4a2bb8', dark: '#160b3a', style: STYLE.GALAXY, altStyle: STYLE.GALAXY, gem: '#c9a2ff' }
    default:
      return { ...own, style: STYLE.SMOOTH, altStyle: STYLE.SMOOTH, gem: null }
  }
}

// --- Shape helpers -----------------------------------------------------------------------
// Each returns a fresh geometry registered in `made`, disposed once the sled is merged.

let made = []
const keep = (g) => {
  made.push(g)
  return g
}

/** A box with rounded edges, `r` the radius. */
const rbox = (w, h, d, r = 0.04) => keep(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.98))

/** A polygon (`[x, z]` points) with every corner rounded off by `r`, as a Shape seen from above. */
function rounded(points, r) {
  const shape = new Shape()
  const n = points.length
  const toward = (a, b, d) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const k = Math.min(d, len / 2) / len
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
  }
  for (let i = 0; i < n; i += 1) {
    const p = points[i]
    const a = toward(p, points[(i - 1 + n) % n], r)
    const c = toward(p, points[(i + 1) % n], r)
    if (i === 0) shape.moveTo(a[0], -a[1])
    else shape.lineTo(a[0], -a[1])
    shape.quadraticCurveTo(p[0], -p[1], c[0], -c[1])
  }
  shape.closePath()
  return shape
}

/** `shape` extruded `depth` upwards from y = 0, its edges bevelled by `bevel` (which adds to its size). */
function slab(shape, depth, bevel = 0.02) {
  const g = keep(new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 }))
  g.rotateX(-Math.PI / 2)
  g.translate(0, bevel, 0)
  return g
}

/** A round solid of revolution about +Y from `[radius, y]` points. */
const lathe = (points, segments = 28, phiStart = 0, phiLength = Math.PI * 2) =>
  keep(new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments, phiStart, phiLength))

/** A rope or rail of radius `r` through `[x, y, z]` points. */
const pipe = (points, r, radial = 8, segments = 28) =>
  keep(new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), segments, r, radial, false))

/** A small glowing gem on the nose of the premium finishes. */
function noseGem(b, c, position, size = 0.09) {
  if (!c.gem) return
  b.add(GEM, { position, scale: [size, size * 1.3, size], color: c.gem, style: STYLE.GLOW })
}

// --- The models --------------------------------------------------------------------------

/** The inner tube: a fat ring of alternating segments, rope handles, a valve. */
function tube(b, c, own) {
  const R = 0.62
  const segments = 8
  const arc = (Math.PI * 2) / segments
  for (let i = 0; i < segments; i += 1) {
    // The segments overlap a touch (no gaps); every other one is a hair fatter, so
    // where they overlap their surfaces never coincide.
    b.add(keep(new TorusGeometry(R, i % 2 ? 0.306 : 0.3, 14, 8, arc + 0.02)), {
      position: [0, 0.3, 0],
      rotation: [Math.PI / 2, 0, i * arc],
      color: i % 2 ? c.alt : c.main,
      style: i % 2 ? c.altStyle : c.style,
    })
  }
  // The rubber floor of the hole you sit in.
  b.add(CYL, { position: [0, 0.1, 0], scale: [0.42, 0.06, 0.42], color: own ? '#2b3046' : c.dark, style: c.style })
  // Rope handles either side and at the front, looping round the tube.
  const loop = keep(new TorusGeometry(0.12, 0.03, 6, 16))
  for (const phi of [0, Math.PI, Math.PI / 2]) {
    b.add(loop, { position: [(R + 0.27) * Math.cos(phi), 0.4, (R + 0.27) * Math.sin(phi)], rotation: [0, -phi, 0], color: own ? '#ffd24a' : c.dark, style: c.style })
  }
  // The valve, at the back.
  b.add(CYL, { position: [0, 0.62, -R], scale: [0.05, 0.1, 0.05], color: own ? '#2b3046' : c.dark, style: c.style })
  b.add(CYL, { position: [0, 0.68, -R], scale: [0.065, 0.04, 0.065], color: own ? '#ffd24a' : c.alt, style: c.altStyle })
  noseGem(b, c, [0, 0.66, R])
}

/** A classic wooden sled: curled runners, slatted deck, a rope on the front bar, a cushion. */
function woodSled(b, c, own) {
  const runner = own ? '#e22a2a' : c.alt
  for (const s of [-1, 1]) {
    const x = s * 0.42
    const path = [
      [x, 0.06, -0.85],
      [x, 0.05, 0.35],
      [x, 0.1, 0.82],
      [x, 0.3, 1.02],
      [x, 0.5, 0.92],
      [x, 0.47, 0.74],
    ]
    b.add(pipe(path, 0.045, 8, 36), { color: runner, style: c.altStyle })
    for (const end of [path[0], path[path.length - 1]]) b.add(BEAD, { position: end, scale: 0.045, color: runner, style: c.altStyle })
    for (const z of [-0.6, -0.05, 0.45]) b.add(rbox(0.06, 0.3, 0.06, 0.02), { position: [x, 0.2, z], color: runner, style: c.altStyle })
  }
  for (const z of [-0.6, -0.05, 0.45]) b.add(rbox(0.98, 0.05, 0.08, 0.02), { position: [0, 0.33, z], color: own ? '#7a4a24' : c.dark, style: c.style })
  for (let i = 0; i < 5; i += 1) {
    b.add(rbox(0.15, 0.055, 1.45, 0.025), { position: [-0.36 + i * 0.18, 0.385, -0.12], color: own ? (i % 2 ? '#b8743a' : '#c8843f') : c.main, style: c.style })
  }
  b.add(CYL, { position: [0, 0.47, 0.74], rotation: [0, 0, Math.PI / 2], scale: [0.035, 0.9, 0.035], color: own ? '#7a4a24' : c.dark, style: c.style })
  b.add(
    pipe(
      [
        [-0.4, 0.47, 0.76],
        [-0.22, 0.42, 0.98],
        [0, 0.4, 1.07],
        [0.22, 0.42, 0.98],
        [0.4, 0.47, 0.76],
      ],
      0.018,
      6,
      24,
    ),
    { color: own ? '#f3e3b3' : c.alt, style: c.altStyle },
  )
  b.add(rbox(0.62, 0.07, 0.62, 0.03), { position: [0, 0.445, -0.3], color: own ? '#e22a2a' : c.alt, style: c.altStyle })
  noseGem(b, c, [0, 0.6, 0.98])
}

/** A flying saucer of a sled: a deep dish with a rolled rim, racing lights and handles. */
function saucer(b, c, own) {
  b.add(
    lathe(
      [
        [0, 0.03],
        [0.45, 0],
        [0.75, 0.05],
        [0.9, 0.17],
        [0.94, 0.26],
        [0.88, 0.3],
        [0.78, 0.24],
        [0.55, 0.17],
        [0, 0.15],
      ],
      36,
    ),
    { color: own ? '#2f9bff' : c.main, style: c.style },
  )
  b.add(CYL, { position: [0, 0.17, 0], scale: [0.56, 0.03, 0.56], color: own ? '#1d6fd6' : c.dark, style: c.style })
  const emblem = keep(star(5, 0.22, 0.1, 0.03))
  emblem.rotateX(-Math.PI / 2)
  b.add(emblem, { position: [0, 0.2, 0], color: own ? '#ffffff' : c.alt, style: c.altStyle })
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2
    b.add(BEAD, { position: [Math.cos(a) * 0.92, 0.25, Math.sin(a) * 0.92], scale: 0.04, color: c.gem ?? '#ffe36b', style: STYLE.GLOW })
  }
  for (const s of [-1, 1]) {
    const handle = keep(new TorusGeometry(0.13, 0.03, 6, 12, Math.PI))
    handle.rotateX(-Math.PI / 2)
    handle.rotateY(-s * (Math.PI / 2))
    b.add(handle, { position: [s * 0.9, 0.24, 0], color: own ? '#1b1b1f' : c.dark, style: c.style })
  }
  noseGem(b, c, [0, 0.36, 0.86])
}

/** A snowboard: rounded deck with an upturned nose and tail, a graphic, two bindings. */
function board(b, c, own) {
  const deck = own ? '#34d1a0' : c.main
  b.add(
    slab(
      rounded(
        [
          [-0.3, 0.66],
          [0.3, 0.66],
          [0.3, -0.66],
          [-0.3, -0.66],
        ],
        0.06,
      ),
      0.03,
      0.02,
    ),
    { position: [0, 0.02, 0], color: deck, style: c.style },
  )
  const end = [
    [-0.3, 0],
    [0.3, 0],
    [0.3, 0.16],
    [0.18, 0.32],
    [-0.18, 0.32],
    [-0.3, 0.16],
  ]
  for (const s of [-1, 1]) {
    const g = slab(
      rounded(
        end.map(([x, z]) => [x, s * z]),
        0.1,
      ),
      0.03,
      0.02,
    )
    g.rotateX(-s * 0.45)
    b.add(g, { position: [0, 0.02, s * 0.6], color: deck, style: c.style })
  }
  b.add(
    slab(
      rounded(
        [
          [-0.07, 0.55],
          [0.08, 0.55],
          [0.17, 0],
          [0.07, -0.55],
          [-0.08, -0.55],
          [0.02, 0],
        ],
        0.03,
      ),
      0.008,
      0.006,
    ),
    { position: [0, 0.088, 0], color: own ? '#ffe02a' : c.alt, style: c.altStyle },
  )
  for (const z of [-0.32, 0.32]) {
    b.add(rbox(0.34, 0.04, 0.24, 0.015), { position: [0, 0.12, z], color: own ? '#1b1b1f' : c.dark, style: c.style })
    b.add(rbox(0.32, 0.2, 0.04, 0.015), { position: [0, 0.22, z - 0.12], rotation: [-0.25, 0, 0], color: own ? '#1b1b1f' : c.dark, style: c.style })
    for (const dz of [-0.03, 0.08]) b.add(rbox(0.36, 0.05, 0.07, 0.02), { position: [0, 0.18, z + dz], color: own ? '#ff5fa2' : c.alt, style: c.altStyle })
  }
  noseGem(b, c, [0, 0.22, 0.86], 0.07)
}

/** A rocket you ride on top of: streamlined body, nose cone, fins, a glowing nozzle, a canopy. */
function rocketSled(b, c, own) {
  const body = lathe(
    [
      [0, -0.85],
      [0.27, -0.85],
      [0.34, -0.7],
      [0.37, -0.3],
      [0.37, 0.35],
      [0.33, 0.62],
      [0.24, 0.86],
      [0.12, 1.02],
      [0, 1.08],
    ],
    28,
  )
  body.rotateX(Math.PI / 2)
  b.add(body, { position: [0, 0.4, 0], color: own ? '#e8eef6' : c.main, style: c.style })
  const nose = lathe(
    [
      [0, 0.6],
      [0.345, 0.6],
      [0.26, 0.86],
      [0.13, 1.03],
      [0, 1.1],
    ],
    28,
  )
  nose.rotateX(Math.PI / 2)
  b.add(nose, { position: [0, 0.4, 0], color: own ? '#ff3b3b' : c.alt, style: c.altStyle })
  const ring = keep(new TorusGeometry(0.372, 0.028, 6, 32))
  for (const z of [-0.45, 0.12]) b.add(ring, { position: [0, 0.4, z], color: own ? '#ff3b3b' : c.alt, style: c.altStyle })
  for (const a of [Math.PI / 2, -Math.PI / 6, (Math.PI * 7) / 6]) {
    const fin = slab(
      rounded(
        [
          [0.3, -0.3],
          [0.64, -0.82],
          [0.64, -1.0],
          [0.3, -0.86],
        ],
        0.05,
      ),
      0.04,
      0.015,
    )
    fin.translate(0, -0.035, 0)
    fin.rotateZ(a)
    b.add(fin, { position: [0, 0.4, 0], color: own ? '#ff3b3b' : c.alt, style: c.altStyle })
  }
  b.add(CYL, { position: [0, 0.4, -0.95], rotation: [Math.PI / 2, 0, 0], scale: [0.24, 0.22, 0.24], color: own ? '#2a2f3a' : c.dark, style: c.style })
  b.add(CYL, { position: [0, 0.4, -1.065], rotation: [Math.PI / 2, 0, 0], scale: [0.17, 0.02, 0.17], color: '#ffb02e', style: STYLE.GLOW })
  b.add(SPHERE, { position: [0, 0.72, 0.42], scale: [0.2, 0.14, 0.3], color: '#7fdcff', style: STYLE.SMOOTH })
  noseGem(b, c, [0, 0.4, 1.16], 0.08)
}

/** A mine cart: riveted steel tub with brass rims, iron wheels, a lantern on the front. */
function cart(b, c, own) {
  const steel = own ? '#8a6a4a' : c.main
  const brass = own ? '#e0a83a' : c.alt
  const iron = own ? '#3a3f4a' : c.dark
  b.add(rbox(0.92, 0.08, 1.3, 0.03), { position: [0, 0.3, 0], color: steel, style: c.style })
  for (const s of [-1, 1]) {
    b.add(rbox(0.07, 0.5, 1.38, 0.025), { position: [s * 0.48, 0.58, 0], color: steel, style: c.style })
    b.add(rbox(0.9, 0.48, 0.07, 0.025), { position: [0, 0.57, s * 0.66], color: steel, style: c.style })
    b.add(rbox(0.11, 0.06, 1.46, 0.025), { position: [s * 0.48, 0.85, 0], color: brass, style: c.altStyle })
    b.add(rbox(1.07, 0.055, 0.11, 0.025), { position: [0, 0.8475, s * 0.68], color: brass, style: c.altStyle })
    for (const z of [-1, 1]) b.add(rbox(0.12, 0.62, 0.12, 0.03), { position: [s * 0.48, 0.56, z * 0.66], color: iron, style: c.style })
    for (const y of [0.42, 0.72]) {
      for (const z of [-0.42, -0.14, 0.14, 0.42]) b.add(BEAD, { position: [s * 0.525, y, z], scale: 0.028, color: iron, style: c.style })
    }
  }
  for (const z of [-0.42, 0.42]) {
    b.add(CYL, { position: [0, 0.17, z], rotation: [0, 0, Math.PI / 2], scale: [0.03, 1.1, 0.03], color: iron, style: c.style })
    for (const s of [-1, 1]) {
      b.add(CYL, { position: [s * 0.52, 0.17, z], rotation: [0, 0, Math.PI / 2], scale: [0.17, 0.08, 0.17], color: iron, style: c.style })
      b.add(CYL, { position: [s * 0.52, 0.17, z], rotation: [0, 0, Math.PI / 2], scale: [0.07, 0.12, 0.07], color: brass, style: c.altStyle })
    }
  }
  b.add(rbox(0.16, 0.18, 0.06, 0.02), { position: [0, 0.62, 0.71], color: iron, style: c.style })
  b.add(rbox(0.11, 0.12, 0.05, 0.02), { position: [0, 0.62, 0.735], color: '#fff2a8', style: STYLE.GLOW })
  noseGem(b, c, [0, 0.98, 0.68], 0.08)
}

/** Diamond Unicorn: a rainbow saucer with a unicorn's head and mane, wings and a tail. */
function unicorn(b) {
  const white = '#fbf6ff'
  b.add(
    lathe(
      [
        [0, 0.03],
        [0.5, 0],
        [0.78, 0.08],
        [0.84, 0.2],
        [0.8, 0.27],
        [0.7, 0.22],
        [0, 0.18],
      ],
      36,
    ),
    { color: '#ffd1f0', style: STYLE.RAINBOW },
  )
  b.add(keep(new TorusGeometry(0.8, 0.045, 8, 40)), { position: [0, 0.25, 0], rotation: [Math.PI / 2, 0, 0], color: white })
  b.add(rbox(0.36, 0.62, 0.34, 0.12), { position: [0, 0.55, 0.6], rotation: [0.25, 0, 0], color: white })
  b.add(rbox(0.36, 0.34, 0.58, 0.12), { position: [0, 0.95, 0.82], rotation: [0.15, 0, 0], color: white })
  b.add(rbox(0.3, 0.22, 0.14, 0.07), { position: [0, 0.88, 1.13], color: '#ffb3e6' })
  for (const s of [-1, 1]) {
    b.add(BEAD, { position: [s * 0.06, 0.9, 1.2], scale: 0.022, color: '#c06090' })
    b.add(SPHERE, { position: [s * 0.18, 1.0, 0.92], scale: [0.04, 0.065, 0.05], color: '#1b1b2f' })
    b.add(BEAD, { position: [s * 0.2, 1.03, 0.95], scale: 0.016, color: '#ffffff', style: STYLE.GLOW })
    b.add(CONE, { position: [s * 0.12, 1.17, 0.66], scale: [0.06, 0.17, 0.05], color: white })
    b.add(CONE, { position: [s * 0.12, 1.16, 0.675], scale: [0.03, 0.11, 0.025], color: '#ffb3e6' })
  }
  // The horn, with spiral rings.
  b.add(CONE, { position: [0, 1.3, 0.92], rotation: [0.45, 0, 0], scale: [0.07, 0.42, 0.07], color: '#ffe36b', style: STYLE.GLOW })
  for (const [t, r] of [
    [-0.08, 0.05],
    [0.06, 0.028],
  ]) {
    b.add(keep(new TorusGeometry(r, 0.012, 4, 14)), { position: [0, 1.3 + Math.cos(0.45) * t, 0.92 + Math.sin(0.45) * t], rotation: [0.45 - Math.PI / 2, 0, 0], color: '#ffffff', style: STYLE.GLOW })
  }
  // A rainbow mane down the back of the neck.
  const mane = ['#ff5fc8', '#ffa53b', '#ffe36b', '#6fe36b', '#7fe2ff']
  mane.forEach((color, i) => {
    const t = i / (mane.length - 1)
    b.add(SPHERE, { position: [0, 1.14 - t * 0.66, 0.66 - t * 0.24], scale: 0.1 - t * 0.012, color, style: STYLE.GLOW })
  })
  // Little wings at the rim.
  for (const s of [-1, 1]) {
    const wing = slab(
      rounded(
        [
          [0, 0.05],
          [0.48, 0.18],
          [0.74, 0.02],
          [0.62, -0.1],
          [0.7, -0.24],
          [0.5, -0.28],
          [0.54, -0.4],
          [0.28, -0.38],
          [0, -0.28],
        ].map(([x, z]) => [s * x, z]),
        0.05,
      ),
      0.03,
      0.015,
    )
    wing.rotateZ(s * 0.5)
    b.add(wing, { position: [s * 0.6, 0.3, -0.05], color: white })
  }
  b.add(
    pipe(
      [
        [0, 0.3, -0.72],
        [0, 0.46, -0.95],
        [0, 0.32, -1.1],
        [0, 0.14, -1.04],
      ],
      0.06,
      8,
      24,
    ),
    { color: '#ffd1f0', style: STYLE.RAINBOW },
  )
  b.add(SPHERE, { position: [0, 0.14, -1.04], scale: 0.06, color: '#ffd1f0', style: STYLE.RAINBOW })
}

/** Galaxy Orca: a sleek starry whale you ride on the back of. */
function orca(b) {
  const body = lathe(
    [
      [0, -1.2],
      [0.12, -1.1],
      [0.3, -0.8],
      [0.5, -0.35],
      [0.58, 0.1],
      [0.52, 0.6],
      [0.36, 1.0],
      [0.15, 1.22],
      [0, 1.28],
    ],
    28,
  )
  body.rotateX(Math.PI / 2)
  body.scale(1, 0.72, 1)
  b.add(body, { position: [0, 0.45, 0], color: '#1e1450', style: STYLE.GALAXY })
  b.add(SPHERE, { position: [0, 0.3, 0.15], scale: [0.47, 0.26, 0.98], color: '#eef3fb' })
  for (const s of [-1, 1]) {
    b.add(SPHERE, { position: [s * 0.4, 0.6, 0.72], scale: [0.13, 0.08, 0.2], color: '#eef3fb' })
    b.add(BEAD, { position: [s * 0.47, 0.62, 0.8], scale: 0.035, color: '#3cf0ff', style: STYLE.GLOW })
    const flipper = slab(
      rounded(
        [
          [0, 0.15],
          [0.45, -0.05],
          [0.5, -0.2],
          [0, -0.1],
        ].map(([x, z]) => [s * x, z]),
        0.06,
      ),
      0.03,
      0.015,
    )
    flipper.rotateZ(-s * 0.4)
    b.add(flipper, { position: [s * 0.4, 0.22, 0.35], color: '#3a2399', style: STYLE.GALAXY })
  }
  const fin = slab(
    rounded(
      [
        [0, 0.25],
        [0.55, -0.12],
        [0.62, -0.3],
        [0.4, -0.2],
        [0, -0.35],
      ],
      0.06,
    ),
    0.06,
    0.02,
  )
  fin.rotateZ(Math.PI / 2)
  b.add(fin, { position: [0.05, 0.8, -0.55], color: '#3a2399', style: STYLE.GALAXY })
  b.add(
    slab(
      rounded(
        [
          [0, 0.1],
          [0.55, -0.1],
          [0.64, -0.32],
          [0.3, -0.2],
          [0, -0.1],
          [-0.3, -0.2],
          [-0.64, -0.32],
          [-0.55, -0.1],
        ],
        0.06,
      ),
      0.04,
      0.015,
    ),
    { position: [0, 0.42, -1.18], color: '#3a2399', style: STYLE.GALAXY },
  )
  b.add(rbox(0.36, 0.04, 0.04, 0.015), { position: [0, 0.5, 1.2], color: '#3cf0ff', style: STYLE.GLOW })
}

/** A racing bobsled: a sleek streamlined hull with an open cockpit, stripes, runners and push bars. */
function bobsled(b, c, own) {
  const hull = own ? '#e3242b' : c.main
  const trim = own ? '#ffffff' : c.alt
  const shell = lathe(
    [
      [0, -1.0],
      [0.3, -1.0],
      [0.42, -0.82],
      [0.46, -0.25],
      [0.45, 0.35],
      [0.38, 0.78],
      [0.22, 1.04],
      [0, 1.12],
    ],
    28,
  )
  shell.rotateX(Math.PI / 2)
  shell.scale(1.15, 0.62, 1)
  b.add(shell, { position: [0, 0.4, 0], color: hull, style: c.style })
  // The cockpit you sit in.
  b.add(SPHERE, { position: [0, 0.66, -0.18], scale: [0.38, 0.1, 0.62], color: own ? '#1b1b1f' : c.dark, style: c.style })
  // Stripes round the hull, and a racing number disc either side of the nose.
  const ring = keep(new TorusGeometry(0.455, 0.03, 6, 32))
  ring.scale(1.15, 0.62, 1)
  for (const z of [0.5, 0.66]) b.add(ring, { position: [0, 0.4, z], color: trim, style: c.altStyle })
  for (const s of [-1, 1]) {
    b.add(CYL, { position: [s * 0.5, 0.42, 0.15], rotation: [0, 0, Math.PI / 2], scale: [0.16, 0.03, 0.16], color: '#ffffff' })
    b.add(CYL, { position: [s * 0.515, 0.42, 0.15], rotation: [0, 0, Math.PI / 2], scale: [0.09, 0.02, 0.09], color: own ? '#1d6fd6' : c.alt, style: c.altStyle })
    const x = s * 0.33
    b.add(pipe([[x, 0.06, -0.95], [x, 0.05, 0.6], [x, 0.12, 0.98], [x, 0.24, 1.1]], 0.035, 8, 28), { color: own ? '#3a3f4a' : c.dark, style: c.style })
    for (const z of [-0.6, 0.45]) b.add(rbox(0.05, 0.22, 0.06, 0.02), { position: [x, 0.16, z], color: own ? '#3a3f4a' : c.dark, style: c.style })
    // Push bars at the back.
    b.add(pipe([[s * 0.3, 0.55, -0.85], [s * 0.32, 0.72, -1.05], [s * 0.32, 0.74, -1.2]], 0.03, 6, 12), { color: own ? '#c9d3e0' : c.alt, style: STYLE.METAL })
  }
  noseGem(b, c, [0, 0.66, 0.92], 0.08)
}

/** A golden toboggan: a long flat deck curling up and back over the front, rails and a cushion. */
function toboggan(b, c, own) {
  const wood = own ? '#e0a83a' : c.main
  const gold = own ? '#ffd23a' : c.alt
  for (let i = 0; i < 4; i += 1) b.add(rbox(0.16, 0.06, 1.7, 0.025), { position: [-0.27 + i * 0.18, 0.06, -0.15], color: own ? (i % 2 ? '#d89a34' : '#e8ad48') : wood, style: c.style })
  // The curl: short slats round an arc at the front.
  const R = 0.34
  for (let k = 0; k <= 7; k += 1) {
    const a = (k / 7) * Math.PI * 1.05
    b.add(rbox(0.68, 0.06, 0.17, 0.025), { position: [0, 0.4 - R * Math.cos(a), 0.72 + R * Math.sin(a)], rotation: [-a, 0, 0], color: wood, style: c.style })
  }
  for (const s of [-1, 1]) {
    b.add(pipe([[s * 0.36, 0.13, -0.95], [s * 0.36, 0.13, 0.6], [s * 0.36, 0.3, 0.95], [s * 0.36, 0.62, 0.95]], 0.03, 6, 20), { color: gold, style: STYLE.METAL })
  }
  b.add(pipe([[-0.34, 0.74, 0.72], [-0.15, 0.62, 0.62], [0.15, 0.62, 0.62], [0.34, 0.74, 0.72]], 0.02, 6, 16), { color: own ? '#f3e3b3' : c.dark, style: c.style })
  b.add(rbox(0.56, 0.08, 1.0, 0.04), { position: [0, 0.13, -0.35], color: own ? '#c41c24' : c.dark, style: c.style })
  noseGem(b, c, [0, 0.78, 0.86], 0.08)
}

/** A magic carpet: a rippling red rug with a gold border, a medallion and tassels, floating. */
function carpet(b, c, own) {
  const ripple = (x, z) => 0.06 * Math.sin(z * 3.2 + x * 0.6)
  const rug = (w, d, lift, color, style) => {
    const plane = keep(new PlaneGeometry(w, d, 6, 14))
    plane.rotateX(-Math.PI / 2)
    const p = plane.getAttribute('position')
    for (let i = 0; i < p.count; i += 1) p.setY(i, ripple(p.getX(i), p.getZ(i)) + lift)
    plane.computeVertexNormals()
    b.add(plane, { position: [0, 0.3, 0], color, style })
  }
  rug(1.3, 2.1, 0, own ? '#ffc22e' : c.alt, own ? STYLE.METAL : c.altStyle)
  rug(1.06, 1.86, 0.02, own ? '#b8182a' : c.main, c.style)
  rug(0.5, 0.9, 0.04, own ? '#2a3fa8' : c.dark, c.style)
  b.add(GEM, { position: [0, 0.37 + ripple(0, 0), 0], scale: [0.14, 0.05, 0.14], color: c.gem ?? '#ffd23a', style: STYLE.GLOW })
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
    for (const z of [-1.05, 1.05]) b.add(CONE, { position: [x, 0.24 + ripple(x, z), z * 1.02], rotation: [Math.PI, 0, 0], scale: [0.05, 0.14, 0.05], color: own ? '#ffd23a' : c.alt, style: STYLE.GLOW })
  }
}

/** A camel float: an inflatable camel with two humps (you sit between), a saddle and a friendly face. */
function camel(b, c, own) {
  const tan = own ? '#e8b86a' : c.main
  const dark = own ? '#c98f4a' : c.dark
  b.add(SPHERE, { position: [0, 0.38, 0], scale: [0.6, 0.38, 1.05], color: tan, style: c.style })
  b.add(keep(new TorusGeometry(0.6, 0.04, 6, 32)), { position: [0, 0.38, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 1.75, 1], color: own ? '#ffffff' : c.alt, style: c.altStyle })
  for (const z of [0.45, -0.5]) b.add(SPHERE, { position: [0, 0.72, z], scale: [0.32, 0.3, 0.3], color: tan, style: c.style })
  b.add(rbox(0.62, 0.08, 0.4, 0.04), { position: [0, 0.74, -0.02], color: own ? '#c41c24' : c.alt, style: c.altStyle })
  b.add(rbox(0.28, 0.62, 0.26, 0.12), { position: [0, 0.82, 0.92], rotation: [0.45, 0, 0], color: tan, style: c.style })
  b.add(rbox(0.34, 0.3, 0.52, 0.13), { position: [0, 1.16, 1.12], color: tan, style: c.style })
  b.add(rbox(0.26, 0.2, 0.18, 0.08), { position: [0, 1.08, 1.4], color: dark, style: c.style })
  for (const s of [-1, 1]) {
    b.add(SPHERE, { position: [s * 0.16, 1.24, 1.26], scale: [0.04, 0.06, 0.04], color: '#1b1b2f' })
    b.add(BEAD, { position: [s * 0.18, 1.27, 1.29], scale: 0.015, color: '#ffffff', style: STYLE.GLOW })
    b.add(SPHERE, { position: [s * 0.15, 1.34, 0.95], scale: [0.05, 0.09, 0.04], color: dark, style: c.style })
    for (const z of [0.55, -0.55]) b.add(SPHERE, { position: [s * 0.32, 0.12, z], scale: [0.12, 0.1, 0.12], color: dark, style: c.style })
  }
  b.add(pipe([[0, 0.45, -1.0], [0, 0.4, -1.2], [0, 0.25, -1.3]], 0.04, 6, 10), { color: dark, style: c.style })
  noseGem(b, c, [0, 1.36, 1.2], 0.07)
}

// --- World 3: Lava Volcano ------------------------------------------------------------------

/** An obsidian board seamed with lava, a glowing edge and fins. */
function magmaBoard(b, c, own) {
  const deck = own ? '#2a1f24' : c.main
  const glow = c.gem ?? '#ff8a1a'
  const outline = (grow) => [
    [-0.36 - grow, 0.7 + grow],
    [0.36 + grow, 0.7 + grow],
    [0.42 + grow, 0],
    [0.36 + grow, -0.7 - grow],
    [-0.36 - grow, -0.7 - grow],
    [-0.42 - grow, 0],
  ]
  b.add(slab(rounded(outline(0), 0.12), 0.06, 0.03), { position: [0, 0.04, 0], color: deck, style: own ? STYLE.LAVA : c.style })
  // A thin glowing sheet a little bigger than the deck, inside it but for its edge.
  b.add(slab(rounded(outline(0.04), 0.12), 0.015, 0.01), { position: [0, 0.06, 0], color: glow, style: STYLE.GLOW })
  b.add(CONE, { position: [0, 0.15, 0.8], rotation: [1.3, 0, 0], scale: [0.13, 0.3, 0.06], color: deck, style: own ? STYLE.LAVA : c.style })
  for (const s of [-1, 1]) b.add(rbox(0.04, 0.24, 0.32, 0.015), { position: [s * 0.27, 0.26, -0.55], rotation: [0, 0, -s * 0.3], color: glow, style: STYLE.GLOW })
  b.add(rbox(0.42, 0.06, 0.5, 0.025), { position: [0, 0.19, -0.05], color: own ? '#1b1b1f' : c.dark, style: c.style })
}

/** A meteor: a cracked, glowing rock with flames streaming off its back. */
function meteor(b, c, own) {
  const rock = keep(new SphereGeometry(0.62, 7, 5).toNonIndexed())
  rock.deleteAttribute('normal')
  rock.computeVertexNormals()
  b.add(rock, { position: [0, 0.5, 0], scale: [1, 0.75, 1.15], color: own ? '#4a2a22' : c.main, style: own ? STYLE.LAVA : c.style })
  for (const [x, z, size] of [
    [0.55, 0.45, 0.16],
    [-0.6, 0.25, 0.13],
    [0.2, -0.65, 0.12],
  ]) {
    b.add(GEM, { position: [x, 0.4, z], scale: size, color: own ? '#3a2420' : c.dark, style: c.style })
  }
  // Flames, pointing back.
  b.add(CONE, { position: [0, 0.52, -0.95], rotation: [-Math.PI / 2, 0, 0], scale: [0.42, 1.0, 0.42], color: '#ff6a1a', style: STYLE.GLOW })
  b.add(CONE, { position: [0, 0.52, -0.85], rotation: [-Math.PI / 2, 0, 0], scale: [0.26, 0.85, 0.26], color: '#ffd23a', style: STYLE.GLOW })
  for (const s of [-1, 1]) b.add(CONE, { position: [s * 0.35, 0.35, -0.75], rotation: [-Math.PI / 2, 0, 0], scale: [0.14, 0.5, 0.14], color: '#ff9a2a', style: STYLE.GLOW })
  b.add(rbox(0.56, 0.08, 0.56, 0.03), { position: [0, 0.94, 0.05], color: own ? '#2a1f24' : c.dark, style: c.style })
  noseGem(b, c, [0, 0.62, 0.78], 0.08)
}

/** A hover board: a sleek deck floating on four glowing thrusters. */
function hoverBoard(b, c, own) {
  const deck = own ? '#e8eef6' : c.main
  const glow = own ? '#3cf0ff' : (c.gem ?? c.alt)
  b.add(
    slab(
      rounded(
        [
          [-0.36, 0.8],
          [0.36, 0.8],
          [0.36, -0.8],
          [-0.36, -0.8],
        ],
        0.24,
      ),
      0.05,
      0.025,
    ),
    { position: [0, 0.33, 0], color: deck, style: c.style },
  )
  b.add(
    slab(
      rounded(
        [
          [-0.08, 0.66],
          [0.08, 0.66],
          [0.12, -0.66],
          [-0.12, -0.66],
        ],
        0.05,
      ),
      0.008,
      0.006,
    ),
    { position: [0, 0.4, 0], color: glow, style: STYLE.GLOW },
  )
  for (const x of [-0.27, 0.27]) {
    for (const z of [-0.52, 0.52]) {
      b.add(CYL, { position: [x, 0.27, z], scale: [0.13, 0.12, 0.13], color: own ? '#2a2f3a' : c.dark, style: c.style })
      b.add(CYL, { position: [x, 0.205, z], scale: [0.105, 0.02, 0.105], color: glow, style: STYLE.GLOW })
      b.add(CONE, { position: [x, 0.1, z], rotation: [Math.PI, 0, 0], scale: [0.09, 0.18, 0.09], color: glow, style: STYLE.GLOW })
    }
  }
  b.add(rbox(0.06, 0.18, 0.3, 0.02), { position: [0, 0.48, -0.62], color: glow, style: STYLE.GLOW })
  noseGem(b, c, [0, 0.46, 0.76], 0.07)
}

/** A red dragon you ride: horned head, glowing eyes, bat wings, spiked back and tail. */
function dragon(b, c, own) {
  const scale = own ? '#d6262e' : c.main
  const wing = own ? '#8a1020' : c.alt
  const belly = own ? '#ffcf6a' : c.dark
  const horn = '#fff3d6'
  b.add(SPHERE, { position: [0, 0.45, 0], scale: [0.55, 0.38, 1.0], color: scale, style: c.style })
  b.add(SPHERE, { position: [0, 0.36, 0.05], scale: [0.45, 0.3, 0.86], color: belly, style: c.style })
  b.add(rbox(0.3, 0.72, 0.3, 0.12), { position: [0, 0.85, 0.82], rotation: [0.5, 0, 0], color: scale, style: c.style })
  b.add(rbox(0.42, 0.32, 0.55, 0.12), { position: [0, 1.2, 1.12], color: scale, style: c.style })
  b.add(rbox(0.3, 0.2, 0.3, 0.08), { position: [0, 1.12, 1.44], color: scale, style: c.style })
  for (const s of [-1, 1]) {
    b.add(CONE, { position: [s * 0.13, 1.45, 0.98], rotation: [-0.6, 0, 0], scale: [0.05, 0.3, 0.05], color: horn })
    b.add(BEAD, { position: [s * 0.2, 1.27, 1.3], scale: 0.04, color: '#ffe36b', style: STYLE.GLOW })
    b.add(BEAD, { position: [s * 0.07, 1.16, 1.6], scale: 0.025, color: '#2a0a0a' })
    const sail = slab(
      rounded(
        [
          [0, 0.3],
          [0.55, 0.45],
          [0.85, 0.2],
          [0.7, 0.05],
          [0.8, -0.15],
          [0.55, -0.12],
          [0.55, -0.35],
          [0.3, -0.25],
          [0, -0.2],
        ].map(([x, z]) => [s * x, z]),
        0.05,
      ),
      0.03,
      0.015,
    )
    sail.rotateZ(s * 0.6)
    b.add(sail, { position: [s * 0.45, 0.62, 0.05], color: wing, style: c.altStyle })
  }
  // Spikes along the back, behind you.
  for (const z of [-0.35, -0.6, -0.85]) b.add(CONE, { position: [0, 0.45 + 0.38 * Math.sqrt(Math.max(0, 1 - z * z)) + 0.07, z], scale: [0.07, 0.2, 0.07], color: horn })
  const tail = [
    [0, 0.45, -0.9],
    [0, 0.55, -1.3],
    [0.25, 0.48, -1.6],
    [0.38, 0.35, -1.8],
  ]
  b.add(pipe(tail, 0.1, 8, 24), { color: scale, style: c.style })
  b.add(CONE, { position: [0.42, 0.33, -1.88], rotation: [-Math.PI / 2, 0, 0.6], scale: [0.12, 0.25, 0.04], color: horn })
  noseGem(b, c, [0, 1.42, 1.25], 0.07)
}

/** Three glowing four-pointed glints round a premium sled, from its own bounds. */
function sparkles(b, color) {
  const box = new Box3()
  for (const part of b.parts) {
    part.computeBoundingBox()
    box.union(part.boundingBox)
  }
  const at = (a, z, t) => a + (z - a) * t
  const glint = keep(star(4, 1, 0.25, 0.2))
  for (const [fx, fy, fz, size] of [
    [0.12, 1, 0.85, 1],
    [0.92, 0.75, 0.25, 0.7],
    [0.06, 0.6, 0.12, 0.55],
  ]) {
    b.add(glint, { position: [at(box.min.x, box.max.x, fx), at(box.min.y, box.max.y, fy) + 0.12, at(box.min.z, box.max.z, fz)], scale: 0.16 * size, color, style: STYLE.GLOW })
  }
}

const SHAPES = {
  tube: [tube, { main: '#e3242b', alt: '#ffffff', dark: '#ffd24a' }],
  bobsled: [bobsled, { main: '#e3242b', alt: '#ffffff', dark: '#1b1b1f' }],
  sled: [woodSled, { main: '#b8743a', alt: '#e22a2a', dark: '#8a5226' }],
  saucer: [saucer, { main: '#2f9bff', alt: '#ffffff', dark: '#1b1b1f' }],
  board: [board, { main: '#34d1a0', alt: '#ffe02a', dark: '#1b1b1f' }],
  rocket: [rocketSled, { main: '#e8eef6', alt: '#ff3b3b', dark: '#2a2f3a' }],
  cart: [cart, { main: '#8a6a4a', alt: '#c99a3a', dark: '#3a3f4a' }],
  toboggan: [toboggan, { main: '#e0a83a', alt: '#ffd23a', dark: '#8a5226' }],
  carpet: [carpet, { main: '#b8182a', alt: '#ffc22e', dark: '#2a3fa8' }],
  camel: [camel, { main: '#e8b86a', alt: '#c41c24', dark: '#c98f4a' }],
  magma: [magmaBoard, { main: '#2a1f24', alt: '#ff8a1a', dark: '#1b1b1f' }],
  meteor: [meteor, { main: '#4a2a22', alt: '#ff7a1a', dark: '#2a1a1a' }],
  hover: [hoverBoard, { main: '#e8eef6', alt: '#3cf0ff', dark: '#2a2f3a' }],
  dragon: [dragon, { main: '#d6262e', alt: '#8a1020', dark: '#ffcf6a' }],
  unicorn: [unicorn, {}],
  orca: [orca, {}],
}

const cache = new Map()

/** The merged geometry of sled `id` (cached; never dispose it). */
export function sledGeometry(id) {
  const key = SLEDS[id] ? id : FIRST_SLED
  let geometry = cache.get(key)
  if (geometry) return geometry
  const sled = SLEDS[key]
  const [build, own] = SHAPES[sled.shape] ?? SHAPES.tube
  const b = new PropBuilder()
  made = []
  const colours = finish(sled.tier, own)
  build(b, colours, sled.tier === 'base')
  if (sled.tier !== 'base' || sled.premium) sparkles(b, colours.gem ?? '#ffffff')
  geometry = b.build()
  geometry.scale(SLED_SCALE, SLED_SCALE, SLED_SCALE)
  geometry.computeBoundingSphere()
  for (const g of made) g.dispose()
  made = []
  cache.set(key, geometry)
  return geometry
}

/** How high you sit on sled `id`. */
export const seatHeight = (id) => (SEAT_HEIGHT[SLEDS[id]?.shape] ?? 0.36) * SLED_SCALE
