import { useSyncExternalStore } from 'react'
import { BackSide, Box3, Color, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Sphere, Vector3, WebGLRenderTarget } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { asToyInstance } from '../blocks'
import { sharedMaterials } from '../materials'
import { sledGeometry } from './sledModels'

/**
 * Sled portraits for the UI, rendered from the same models the world uses, so a sled
 * looks the same in the SLEDS panel, on the cards and under you on the slide.
 *
 * Rendered on demand into a small offscreen target with the game's own renderer (a
 * couple per frame at most), read back once, and kept as PNG data URLs. No image
 * assets to download, and nothing is rendered twice.
 */

const SIZE = 160
/** The dark outline round each portrait, as on the HUD icons (model units). */
const OUTLINE = 0.035
const urls = new Map()
const queue = []
const listeners = new Set()
let renderer = null
let rig = null
let notifyScheduled = false
const _previousClear = new Color()
const _box = new Box3()
const _sphere = new Sphere()
/** Where the portrait camera looks from: front-right and above. */
const VIEW = new Vector3(2.3, 2.1, 2.6).normalize()

/** linear -> sRGB byte lookup: render targets come back in linear light. */
const TO_SRGB = new Uint8Array(256)
for (let i = 0; i < 256; i += 1) {
  const c = i / 255
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  TO_SRGB[i] = Math.round(Math.min(1, Math.max(0, s)) * 255)
}

function buildRig() {
  const scene = new Scene()
  scene.add(new HemisphereLight('#ffffff', '#b9cba6', 2.4))
  const sun = new DirectionalLight('#fff6e8', 1.7)
  sun.position.set(2, 4, 3)
  scene.add(sun)
  const camera = new PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(2.3, 2.1, 2.6)
  camera.lookAt(0, 0.35, 0)
  const target = new WebGLRenderTarget(SIZE, SIZE, { samples: 4 })
  const mesh = asToyInstance(sledGeometry(null), sharedMaterials().sled)
  scene.add(mesh)
  const outlineMaterial = new MeshBasicMaterial({ color: '#14162a', side: BackSide })
  outlineMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${OUTLINE.toFixed(3)};`)
  }
  const outline = new Mesh(undefined, outlineMaterial)
  scene.add(outline)
  return { scene, camera, target, mesh, outline, pixels: new Uint8Array(SIZE * SIZE * 4) }
}

/**
 * Renders `scene` through `camera` into `target` (a square, `size` across) on a clear
 * background with the game's own renderer, and returns it as a PNG data URL. Also what
 * the HUD's 3D icons (icons3d.js) are made with.
 */
export function renderPortrait(gl, scene, camera, target, size, pixels) {
  const previousTarget = gl.getRenderTarget()
  const previousClear = gl.getClearColor(_previousClear)
  const previousAlpha = gl.getClearAlpha()
  gl.setRenderTarget(target)
  gl.setClearColor(0x000000, 0)
  gl.clear()
  gl.render(scene, camera)
  gl.readRenderTargetPixels(target, 0, 0, size, size, pixels)
  gl.setRenderTarget(previousTarget)
  gl.setClearColor(previousClear, previousAlpha)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  // GL rows run bottom-up; MSAA edges come back premultiplied.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const from = ((size - 1 - y) * size + x) * 4
      const to = (y * size + x) * 4
      const a = pixels[from + 3]
      const k = a > 0 ? 255 / a : 0
      image.data[to] = TO_SRGB[Math.min(255, Math.round(pixels[from] * k))]
      image.data[to + 1] = TO_SRGB[Math.min(255, Math.round(pixels[from + 1] * k))]
      image.data[to + 2] = TO_SRGB[Math.min(255, Math.round(pixels[from + 2] * k))]
      image.data[to + 3] = a
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

/** An outline hull for `geometry`: the same shape, its vertices welded so it pushes out in one piece. */
function hullOf(geometry) {
  const plain = geometry.clone()
  for (const name of Object.keys(plain.attributes)) if (name !== 'position') plain.deleteAttribute(name)
  const hull = mergeVertices(plain, 1e-3)
  hull.computeVertexNormals()
  plain.dispose()
  return hull
}

/** Frames the sled in the portrait: big sleds and small ones fill it alike. */
function frameSled(geometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  _box.copy(geometry.boundingBox).getBoundingSphere(_sphere)
  const { camera } = rig
  const distance = (_sphere.radius * 0.86) / Math.sin((camera.fov * Math.PI) / 360)
  camera.position.copy(_sphere.center).addScaledVector(VIEW, distance)
  camera.lookAt(_sphere.center)
}

function render(id) {
  rig.mesh.geometry = sledGeometry(id)
  frameSled(rig.mesh.geometry)
  rig.outline.geometry = hullOf(rig.mesh.geometry)
  urls.set(id, renderPortrait(renderer, rig.scene, rig.camera, rig.target, SIZE, rig.pixels))
  rig.outline.geometry.dispose()
}

/** Called once the renderer exists (from inside the Canvas). */
export function attachIconRenderer(gl) {
  renderer = gl
  // Built here, at set-up, so the frame loop that renders portraits never allocates.
  rig ||= buildRig()
}

/** Renders up to `max` queued portraits. Runs in the frame loop; no React state. */
export function processIconQueue(max = 2) {
  if (!renderer || !rig || queue.length === 0) return
  for (let i = 0; i < max && queue.length; i += 1) render(queue.shift())
  // Re-render the portraits' React components after the frame, not inside it.
  if (notifyScheduled) return
  notifyScheduled = true
  setTimeout(() => {
    notifyScheduled = false
    for (const fn of listeners) fn()
  }, 0)
}

function request(id) {
  if (!id || urls.has(id) || queue.includes(id)) return
  queue.push(id)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Portrait URL for a sled; null until it has been rendered. */
export function useSledIcon(id) {
  request(id)
  return useSyncExternalStore(subscribe, () => urls.get(id) ?? null)
}

/** Portrait URL for a sled outside React (debug views): asks for it, null until rendered. */
export function sledPortrait(id) {
  request(id)
  return urls.get(id) ?? null
}
