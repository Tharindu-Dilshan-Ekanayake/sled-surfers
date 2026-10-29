import {
  BackSide,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { setRenderedIcon } from '../ui/icons'
import { renderPortrait } from './sleds/sledIcons'

/**
 * The HUD's icons as glossy 3D renders, like the reference's: a coin with a raised star,
 * a cut diamond, a gift with its bow, a money bag, a rocket... each modelled from a few
 * primitives, lit by a studio environment (for the shine) and outlined in dark navy,
 * then rendered once at start-up into a PNG with the game's own renderer. The SVG
 * icons (ui/icons.js) show until they're in, and stay for the small glyphs.
 *
 * Nothing here runs after start-up: the scene, its materials and the environment map
 * are all disposed once the last icon is done.
 */

const SIZE = 192
/** Outline thickness, in model units (every model is about 2 across). */
const OUTLINE = 0.07
const OUTLINE_COLOR = '#14162a'

// --- Building blocks -------------------------------------------------------------------

const materials = new Map()
function mat(color, { metal = 0, rough = 0.32, glow = 0, flat = false } = {}) {
  const key = `${color}:${metal}:${rough}:${glow}:${flat}`
  let m = materials.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, metalness: metal, roughness: rough, flatShading: flat })
    if (glow) {
      m.emissive = new Color(color)
      m.emissiveIntensity = glow
    }
    materials.set(key, m)
  }
  return m
}

const outlineMaterial = new MeshBasicMaterial({ color: OUTLINE_COLOR, side: BackSide })
outlineMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${OUTLINE.toFixed(3)};`)
}

/** Adds `geometry` in `material` to `group` at `position`/`rotation`/`scale`. */
function part(group, geometry, material, { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = {}) {
  const mesh = new Mesh(geometry, material)
  mesh.position.fromArray(position)
  mesh.rotation.set(rotation[0], rotation[1], rotation[2])
  if (Array.isArray(scale)) mesh.scale.fromArray(scale)
  else mesh.scale.setScalar(scale)
  group.add(mesh)
  return mesh
}

/** A five-pointed star shape, `outer` and `inner` radii. */
function starShape(outer, inner, points = 5) {
  const shape = new Shape()
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 ? inner : outer
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

/** A tube along `curve` that swells from a thin tail to `radius` at its end, like a comet's streak. */
function taperedTube(curve, radius, tubular = 48, radial = 12) {
  const tube = new TubeGeometry(curve, tubular, radius, radial, false)
  const position = tube.getAttribute('position')
  const centre = new Vector3()
  const v = new Vector3()
  for (let i = 0; i <= tubular; i += 1) {
    const t = i / tubular
    curve.getPointAt(t, centre)
    const k = 0.18 + 0.82 * Math.sqrt(t)
    for (let j = 0; j <= radial; j += 1) {
      const index = i * (radial + 1) + j
      v.fromBufferAttribute(position, index).sub(centre).multiplyScalar(k).add(centre)
      position.setXYZ(index, v.x, v.y, v.z)
    }
  }
  tube.computeVertexNormals()
  return tube
}

const bevel = (depth, size) => ({ depth, bevelEnabled: true, bevelThickness: size, bevelSize: size, bevelSegments: 3, curveSegments: 12 })

// --- The models ------------------------------------------------------------------------

const GOLD = { metal: 0.55, rough: 0.28 }

function coinModel(g, { x = 0, y = 0, z = 0, tilt = 0, star = true } = {}) {
  const coin = new Group()
  part(coin, new CylinderGeometry(1, 1, 0.26, 40), mat('#ffbf1f', GOLD), { rotation: [Math.PI / 2, 0, 0] })
  part(coin, new TorusGeometry(0.86, 0.07, 10, 40), mat('#f59a00', GOLD), { position: [0, 0, 0.13] })
  if (star) part(coin, new ExtrudeGeometry(starShape(0.62, 0.27), bevel(0.06, 0.05)), mat('#ffd84a', { ...GOLD, glow: 0.08 }), { position: [0, -0.02, 0.1] })
  coin.position.set(x, y, z)
  coin.rotation.set(0, tilt, 0)
  g.add(coin)
  return coin
}

const MODELS = {
  coin(g) {
    coinModel(g, { tilt: -0.35 })
  },

  coins(g) {
    for (const [x, y, z, n] of [
      [-0.55, -0.55, 0, 3],
      [0.55, -0.45, -0.2, 4],
      [0, -0.3, 0.5, 2],
    ]) {
      for (let k = 0; k < n; k += 1) {
        const c = new Group()
        part(c, new CylinderGeometry(0.62, 0.62, 0.2, 32), mat(k === n - 1 ? '#ffd23a' : '#f2a900', GOLD))
        part(c, new TorusGeometry(0.52, 0.04, 8, 32), mat('#e08a00', GOLD), { position: [0, 0.1, 0], rotation: [Math.PI / 2, 0, 0] })
        c.position.set(x, y + k * 0.22, z)
        g.add(c)
      }
    }
    coinModel(g, { x: 0.15, y: 0.75, z: 0.3, tilt: -0.2 }).scale.setScalar(0.62)
  },

  diamond(g) {
    // A brilliant cut: a flat table, the crown sloping out to the girdle, the pavilion to a point.
    const profile = [new Vector2(0, -1.05), new Vector2(1.0, 0.12), new Vector2(0.98, 0.3), new Vector2(0.58, 0.62), new Vector2(0, 0.62)]
    part(g, new LatheGeometry(profile, 8), mat('#38a8ff', { rough: 0.06, flat: true, glow: 0.18 }), { rotation: [0.12, 0.4, 0] })
  },

  gift(g) {
    const red = mat('#e8283a')
    const gold = mat('#ffd23a', { rough: 0.25 })
    part(g, new BoxGeometry(1.6, 1.25, 1.6), red, { position: [0, -0.35, 0] })
    part(g, new BoxGeometry(1.8, 0.36, 1.8), red, { position: [0, 0.42, 0] })
    part(g, new BoxGeometry(0.34, 1.7, 1.84), gold, { position: [0, -0.06, 0] })
    part(g, new BoxGeometry(1.84, 1.7, 0.34), gold, { position: [0, -0.06, 0] })
    for (const a of [-1, 1]) part(g, new TorusGeometry(0.34, 0.11, 10, 20), gold, { position: [a * 0.32, 0.86, 0], rotation: [0, 0, a * 0.7], scale: [1.1, 0.85, 1] })
    g.rotation.set(0.35, -0.6, 0)
  },

  chest(g, colors) {
    const [wood, band] = colors
    part(g, new BoxGeometry(2, 1.1, 1.3), mat(wood), { position: [0, -0.45, 0] })
    part(g, new CylinderGeometry(0.65, 0.65, 2, 24, 1, false, 0, Math.PI), mat(wood), { position: [0, 0.1, 0], rotation: [0, 0, Math.PI / 2] })
    for (const x of [-0.7, 0.7]) {
      part(g, new BoxGeometry(0.22, 1.16, 1.36), mat(band, GOLD), { position: [x, -0.45, 0] })
      part(g, new TorusGeometry(0.66, 0.11, 8, 20, Math.PI), mat(band, GOLD), { position: [x, 0.1, 0], rotation: [0, Math.PI / 2, 0] })
    }
    part(g, new BoxGeometry(0.42, 0.5, 0.14), mat('#e8eef6', GOLD), { position: [0, -0.05, 0.68] })
    g.rotation.set(0.3, -0.55, 0)
  },

  income(g) {
    const green = mat('#3fcf4a')
    const profile = [new Vector2(0, -1.05), new Vector2(0.75, -0.95), new Vector2(1.0, -0.45), new Vector2(0.92, 0.15), new Vector2(0.5, 0.55), new Vector2(0.32, 0.7), new Vector2(0.55, 1.05), new Vector2(0, 1.0)]
    part(g, new LatheGeometry(profile, 28), green)
    part(g, new TorusGeometry(0.36, 0.08, 8, 20), mat('#2a8f33'), { position: [0, 0.68, 0], rotation: [Math.PI / 2, 0, 0] })
    // A gold $ on its front.
    const gold = mat('#ffd23a', GOLD)
    part(g, new TorusGeometry(0.2, 0.07, 8, 16, Math.PI * 1.25), gold, { position: [0, 0.0, 0.92], rotation: [0, 0, Math.PI * 0.25] })
    part(g, new TorusGeometry(0.2, 0.07, 8, 16, Math.PI * 1.25), gold, { position: [0, -0.38, 0.92], rotation: [0, 0, -Math.PI * 0.75] })
    part(g, new CylinderGeometry(0.06, 0.06, 1.0, 8), gold, { position: [0, -0.19, 0.95] })
    g.rotation.set(0.15, -0.2, 0)
  },

  rocket(g) {
    const body = [new Vector2(0, -0.9), new Vector2(0.45, -0.85), new Vector2(0.52, -0.2), new Vector2(0.45, 0.5), new Vector2(0.22, 1.0), new Vector2(0, 1.15)]
    part(g, new LatheGeometry(body, 28), mat('#f4f6fa'))
    part(g, new ConeGeometry(0.33, 0.5, 24), mat('#e8283a'), { position: [0, 1.0, 0] })
    part(g, new TorusGeometry(0.22, 0.07, 8, 24), mat('#9aa6b8', GOLD), { position: [0, 0.25, 0.42] })
    part(g, new SphereGeometry(0.2, 16, 12), mat('#4fc3ff', { rough: 0.1, glow: 0.2 }), { position: [0, 0.25, 0.4] })
    const fin = new Shape()
    fin.moveTo(0, 0)
    fin.lineTo(0.55, -0.5)
    fin.lineTo(0.55, -0.85)
    fin.lineTo(0, -0.55)
    fin.closePath()
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2
      part(g, new ExtrudeGeometry(fin, bevel(0.06, 0.03)), mat('#e8283a'), { position: [Math.sin(a) * 0.42, -0.2, Math.cos(a) * 0.42], rotation: [0, a - Math.PI / 2, 0] })
    }
    part(g, new ConeGeometry(0.32, 0.75, 20), mat('#ffb21e', { glow: 0.7 }), { position: [0, -1.25, 0], rotation: [Math.PI, 0, 0] })
    g.rotation.set(0, 0.3, -0.55)
  },

  slingshot(g) {
    const wood = mat('#f08a1e')
    part(g, new CylinderGeometry(0.17, 0.2, 1.2, 14), wood, { position: [0, -0.55, 0] })
    for (const a of [-1, 1]) {
      part(g, new CylinderGeometry(0.15, 0.17, 1.15, 14), wood, { position: [a * 0.38, 0.45, 0], rotation: [0, 0, -a * 0.6] })
      part(g, new SphereGeometry(0.17, 12, 10), wood, { position: [a * 0.72, 0.95, 0] })
    }
    part(g, new CylinderGeometry(0.23, 0.23, 0.55, 16), mat('#2f7bff'), { position: [0, -0.85, 0] })
    part(g, new BoxGeometry(1.4, 0.09, 0.09), mat('#e8283a'), { position: [0, 0.95, 0.05] })
    part(g, new SphereGeometry(0.27, 16, 12), mat('#eef2f7', { rough: 0.5 }), { position: [0, 0.82, 0.15] })
    g.rotation.set(0.1, -0.4, 0.18)
  },

  sled(g) {
    const red = mat('#e8283a')
    const gold = mat('#ffc61e', GOLD)
    part(g, new BoxGeometry(1.0, 0.18, 2.0), red, { position: [0, 0.25, 0] })
    part(g, new BoxGeometry(1.0, 0.18, 0.7), red, { position: [0, 0.55, 1.15], rotation: [-0.9, 0, 0] })
    for (const x of [-0.5, 0.5]) {
      part(g, new BoxGeometry(0.12, 0.12, 2.2), gold, { position: [x, -0.25, 0] })
      part(g, new TorusGeometry(0.32, 0.06, 8, 16, Math.PI * 0.8), gold, { position: [x, 0.06, 1.1], rotation: [0, Math.PI / 2, -0.3] })
      for (const z of [-0.6, 0.6]) part(g, new BoxGeometry(0.1, 0.45, 0.1), gold, { position: [x, 0.0, z] })
    }
    g.rotation.set(0.45, -0.9, 0)
  },

  worlds(g) {
    part(g, new SphereGeometry(0.9, 32, 24), mat('#3d9bff', { rough: 0.25 }))
    const land = mat('#3fcf4a', { rough: 0.5 })
    for (const [x, y, z, s] of [
      [0.45, 0.35, 0.65, 0.45],
      [-0.5, -0.1, 0.65, 0.38],
      [0.1, -0.55, 0.65, 0.3],
      [-0.2, 0.7, 0.45, 0.25],
    ]) {
      part(g, new SphereGeometry(1, 14, 10), land, { position: [x, y, z], scale: [s, s * 0.75, s * 0.4] })
    }
    part(g, new TorusGeometry(1.35, 0.12, 10, 48), mat('#ffc61e', GOLD), { rotation: [1.25, 0.25, 0], scale: [1, 1, 0.6] })
    g.rotation.set(0.15, 0, 0.2)
  },

  tasks(g) {
    part(g, new BoxGeometry(1.5, 1.95, 0.16), mat('#d68a3a', { rough: 0.6 }), { position: [0, -0.05, 0] })
    part(g, new BoxGeometry(1.25, 1.65, 0.05), mat('#ffffff', { rough: 0.7 }), { position: [0, -0.12, 0.1] })
    part(g, new BoxGeometry(0.75, 0.28, 0.22), mat('#9aa6b8', GOLD), { position: [0, 0.9, 0.1] })
    const tick = mat('#2fc53a')
    const line = mat('#9aa6b8', { rough: 0.6 })
    for (let i = 0; i < 3; i += 1) {
      const y = 0.4 - i * 0.48
      part(g, new BoxGeometry(0.08, 0.2, 0.06), tick, { position: [-0.42, y - 0.03, 0.15], rotation: [0, 0, 0.7] })
      part(g, new BoxGeometry(0.08, 0.36, 0.06), tick, { position: [-0.3, y + 0.03, 0.15], rotation: [0, 0, -0.6] })
      part(g, new BoxGeometry(0.6, 0.08, 0.04), line, { position: [0.22, y, 0.14] })
    }
    g.rotation.set(0.05, -0.35, 0.08)
  },

  /** A comet: three swooshes fanning back from a glowing head, as in the reference. */
  trail(g) {
    const streak = (points, radius, color, glow) =>
      part(g, taperedTube(new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z))), radius), mat(color, { rough: 0.22, glow }))
    streak([[-1.3, -0.75, 0], [-0.65, -0.72, 0.05], [0, -0.38, 0.08], [0.5, 0.15, 0.06], [0.95, 0.72, 0]], 0.24, '#3f6fff', 0.2)
    streak([[-1.25, -0.12, 0.14], [-0.6, -0.2, 0.18], [0, 0, 0.2], [0.48, 0.42, 0.16], [0.95, 0.72, 0.1]], 0.2, '#4fc8ff', 0.25)
    streak([[-1.05, 0.5, 0.26], [-0.5, 0.32, 0.3], [0.02, 0.42, 0.3], [0.5, 0.64, 0.24], [0.95, 0.72, 0.18]], 0.15, '#b98cff', 0.3)
    part(g, new SphereGeometry(0.44, 24, 16), mat('#f4ecff', { glow: 0.5 }), { position: [1.0, 0.74, 0.12] })
    g.rotation.set(0.12, -0.25, 0)
  },

  /** A stopwatch: blue case, white face, ticks and hands, the crown on top. */
  timer(g) {
    const steel = mat('#c9d3e0', GOLD)
    const ink = mat('#14162a')
    part(g, new CylinderGeometry(1, 1, 0.42, 40), mat('#2fa8ff', { rough: 0.25 }), { rotation: [Math.PI / 2, 0, 0] })
    part(g, new TorusGeometry(0.92, 0.1, 10, 40), mat('#8fdcff', { rough: 0.2 }), { position: [0, 0, 0.2] })
    part(g, new CylinderGeometry(0.82, 0.82, 0.1, 40), mat('#ffffff', { rough: 0.5 }), { position: [0, 0, 0.2], rotation: [Math.PI / 2, 0, 0] })
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      part(g, new BoxGeometry(0.07, i % 3 === 0 ? 0.2 : 0.11, 0.04), ink, { position: [Math.sin(a) * 0.66, Math.cos(a) * 0.66, 0.27], rotation: [0, 0, -a] })
    }
    part(g, new BoxGeometry(0.09, 0.55, 0.05), ink, { position: [0, 0.25, 0.29] })
    part(g, new BoxGeometry(0.08, 0.44, 0.05), mat('#ff3b3b'), { position: [0.19, -0.11, 0.3], rotation: [0, 0, -2.09] })
    part(g, new SphereGeometry(0.09, 12, 8), ink, { position: [0, 0, 0.31] })
    part(g, new CylinderGeometry(0.15, 0.15, 0.26, 16), steel, { position: [0, 1.1, 0] })
    part(g, new BoxGeometry(0.44, 0.16, 0.3), steel, { position: [0, 1.28, 0] })
    part(g, new CylinderGeometry(0.11, 0.11, 0.24, 12), steel, { position: [0.73, 0.82, 0], rotation: [0, 0, -0.78] })
    g.rotation.set(0.1, -0.35, 0.06)
  },

  fuel(g) {
    const red = mat('#e8283a')
    part(g, new BoxGeometry(1.3, 1.6, 0.7), red, { position: [0, -0.1, 0] })
    part(g, new BoxGeometry(0.9, 0.24, 0.28), red, { position: [-0.1, 0.82, 0] })
    part(g, new CylinderGeometry(0.17, 0.17, 0.35, 14), mat('#ffd23a', GOLD), { position: [0.45, 0.85, 0], rotation: [0, 0, -0.5] })
    part(g, new BoxGeometry(0.9, 0.12, 0.05), mat('#ffffff'), { position: [0, 0, 0.37], rotation: [0, 0, 0.8] })
    part(g, new BoxGeometry(0.9, 0.12, 0.05), mat('#ffffff'), { position: [0, 0, 0.37], rotation: [0, 0, -0.8] })
    g.rotation.set(0.15, -0.45, 0)
  },

  lock(g) {
    part(g, new TorusGeometry(0.48, 0.13, 12, 24, Math.PI), mat('#c9d3e0', GOLD), { position: [0, 0.35, 0] })
    for (const x of [-0.48, 0.48]) part(g, new CylinderGeometry(0.13, 0.13, 0.4, 12), mat('#c9d3e0', GOLD), { position: [x, 0.17, 0] })
    part(g, new BoxGeometry(1.5, 1.2, 0.6), mat('#ffbf1f', GOLD), { position: [0, -0.45, 0] })
    part(g, new CylinderGeometry(0.13, 0.13, 0.1, 12), mat('#14162a'), { position: [0, -0.35, 0.31], rotation: [Math.PI / 2, 0, 0] })
    part(g, new BoxGeometry(0.1, 0.32, 0.06), mat('#14162a'), { position: [0, -0.55, 0.31] })
    g.rotation.set(0.1, -0.35, 0)
  },

  starGold(g) {
    part(g, new ExtrudeGeometry(starShape(1.05, 0.46), bevel(0.22, 0.1)), mat('#ffc61e', { ...GOLD, glow: 0.1 }), { position: [0, -0.05, -0.15] })
    g.rotation.set(0.1, -0.3, -0.12)
  },

  mountain(g) {
    const rock = mat('#4f8ff0', { flat: true })
    const snow = mat('#ffffff', { flat: true, rough: 0.5 })
    part(g, new ConeGeometry(0.85, 1.6, 5), rock, { position: [-0.4, -0.2, 0] })
    part(g, new ConeGeometry(0.35, 0.65, 5), snow, { position: [-0.4, 0.29, 0] })
    part(g, new ConeGeometry(0.7, 1.2, 5), mat('#3a6fd0', { flat: true }), { position: [0.55, -0.4, 0.2] })
    part(g, new ConeGeometry(0.28, 0.48, 5), snow, { position: [0.55, -0.02, 0.2] })
    g.rotation.set(0.15, 0.4, 0)
  },
}

/** Icon name -> how to build it (chests come in three colours). */
const ICONS = {
  coin: MODELS.coin,
  coins: MODELS.coins,
  diamond: MODELS.diamond,
  gift: MODELS.gift,
  'chest:orange': (g) => MODELS.chest(g, ['#e8862a', '#5a6a8a']),
  'chest:blue': (g) => MODELS.chest(g, ['#3d8bff', '#ffc61e']),
  'chest:rainbow': (g) => MODELS.chest(g, ['#ff5fc8', '#ffc61e']),
  income: MODELS.income,
  rocket: MODELS.rocket,
  slingshot: MODELS.slingshot,
  sled: MODELS.sled,
  worlds: MODELS.worlds,
  tasks: MODELS.tasks,
  trail: MODELS.trail,
  timer: MODELS.timer,
  fuel: MODELS.fuel,
  lock: MODELS.lock,
  starGold: MODELS.starGold,
  mountain: MODELS.mountain,
}

// --- Rendering ------------------------------------------------------------------------

/** An outline hull for every mesh: the same shape, pushed out along smooth normals, drawn back faces only. */
function addOutlines(group) {
  const meshes = []
  group.traverse((o) => {
    if (o.isMesh) meshes.push(o)
  })
  for (const mesh of meshes) {
    const plain = mesh.geometry.clone()
    for (const name of Object.keys(plain.attributes)) if (name !== 'position') plain.deleteAttribute(name)
    const hull = mergeVertices(plain)
    hull.computeVertexNormals()
    plain.dispose()
    const outline = new Mesh(hull, outlineMaterial)
    mesh.add(outline)
  }
}

/** Frames `group` in `camera`: centred, filling the square but for a margin for the outline. */
function frame(group, camera) {
  const box = new Box3().setFromObject(group)
  const centre = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  group.position.sub(centre)
  const half = Math.max(size.x, size.y) / 2 + OUTLINE * 2
  const distance = half / Math.tan((camera.fov * Math.PI) / 360) + size.z / 2
  camera.position.set(0, 0, distance)
  camera.near = Math.max(0.05, distance - size.z * 2)
  camera.far = distance + size.z * 2
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.isMesh) o.geometry.dispose()
  })
}

let started = false

/**
 * Renders every 3D icon with `gl`, a few a frame (`schedule` runs a callback on the next
 * frame), and hands each to the icon set as it's done. Safe to call more than once.
 */
export function renderIcons3d(gl, schedule) {
  if (started) return
  started = true
  const scene = new Scene()
  const pmrem = new PMREMGenerator(gl)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = env.texture
  // The studio for the shine, and a key light from the upper left for the shape.
  scene.environmentIntensity = 0.55
  scene.add(new HemisphereLight('#ffffff', '#6a7aa0', 0.7))
  const key = new DirectionalLight('#fff6e8', 2.2)
  key.position.set(-2, 3, 4)
  scene.add(key)
  const rim = new DirectionalLight('#bfe0ff', 1.2)
  rim.position.set(3, 2, -3)
  scene.add(rim)
  const camera = new PerspectiveCamera(28, 1, 0.1, 50)
  const target = new WebGLRenderTarget(SIZE, SIZE, { samples: 4 })
  const pixels = new Uint8Array(SIZE * SIZE * 4)
  const queue = Object.keys(ICONS)

  const step = () => {
    for (let k = 0; k < 3 && queue.length; k += 1) {
      const name = queue.shift()
      const holder = new Group()
      const model = new Group()
      ICONS[name](model)
      holder.add(model)
      addOutlines(holder)
      scene.add(holder)
      frame(holder, camera)
      try {
        setRenderedIcon(name, renderPortrait(gl, scene, camera, target, SIZE, pixels))
      } catch (err) {
        console.warn('[icons] could not render', name, err)
      }
      scene.remove(holder)
      disposeGroup(holder)
    }
    if (queue.length) {
      schedule(step)
      return
    }
    // All done: nothing of this stays on the GPU.
    target.dispose()
    env.dispose()
    pmrem.dispose()
    for (const m of materials.values()) m.dispose()
    materials.clear()
    outlineMaterial.dispose()
  }
  schedule(step)
}
