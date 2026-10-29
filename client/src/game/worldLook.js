import { GRASS_COLOR } from './materials'
import { CLOUDS, FOG, LIGHTS, PALETTE, SKY } from './sceneStyle'
import { skyUniforms } from './skyState'

/**
 * Each world's look in the lobby: its ground, cliffs and what caps them, its trees and
 * figures, its castle, its sky and light, and its weather. World 1 is a snowy winter
 * valley; World 2 a golden desert canyon under a warm hazy sky; World 3 a volcano at
 * dusk, ash on the rocks and embers drifting up.
 *
 * The scene's palette objects (sceneStyle.js) are the current world's: applyWorldLook
 * copies a world's look into them, and GameScene rebuilds the lobby, sky and light
 * after it. Nothing here runs per frame; a world change costs one rebuild.
 */

/** World 1: what sceneStyle starts with, snapshotted before any other world is applied. */
const snowy = {
  palette: { ...PALETTE },
  sky: { ...SKY },
  clouds: { ...CLOUDS },
  lights: { hemiSky: LIGHTS.hemiSky, hemiGround: LIGHTS.hemiGround, sunColor: LIGHTS.sunColor },
  /** What tops every step of the cliffs (STYLE.TERRAIN's cap). */
  cap: `#${GRASS_COLOR.getHexString()}`,
  /** What falls through the air: its colour, how fast (negative rises), size and drift. */
  weather: { color: '#ffffff', fall: 1, size: 1, drift: 0.35 },
}

const LOOKS = {
  snowy,
  gold: {
    palette: {
      plaza: '#f2d9a0',
      path: '#e8c88a',
      ice: '#5fd0e0',
      rock: ['#c9733a', '#b8652f', '#d48444'],
      cliff: '#c9733a',
      trunk: '#7a5230',
      leaves: ['#3faa4a', '#48b856', '#2f9a40'],
      roof: '#2f9a8a',
      snow: '#f6e2b0',
      cabin: '#d9a066',
      trim: '#a8672e',
      tree: 'cactus',
      figure: 'cactus',
      landmark: 'palm',
      castleBase: '#e8d0a0',
      castleWall: '#e2c48a',
      castleDark: '#cfae6e',
      castleRoof: '#2f9a8a',
    },
    sky: { top: '#3f8ff0', horizon: '#ffdcaa', exponent: 0.45 },
    clouds: { top: '#fff6e6', bottom: '#f2d2a8' },
    lights: { hemiSky: '#fff4e0', hemiGround: '#e6c590', sunColor: '#ffe2b0' },
    cap: '#f6dfa6',
    // Glints of sand blowing across the canyon.
    weather: { color: '#ffe2a0', fall: 0.12, size: 0.7, drift: 1.4 },
  },
  lava: {
    palette: {
      plaza: '#544a52',
      path: '#62565f',
      ice: '#ff7a2a',
      rock: ['#3a3036', '#2e262c', '#463a40'],
      cliff: '#3a3036',
      trunk: '#2a2024',
      leaves: ['#ff7a1a', '#ff5a1a', '#ffa23a'],
      roof: '#2a2024',
      snow: '#8a7a80',
      cabin: '#5a4a50',
      trim: '#2a2024',
      tree: 'pine',
      figure: 'lavaRock',
      landmark: 'obelisk',
      castleBase: '#3a3036',
      castleWall: '#4a4048',
      castleDark: '#2e262c',
      castleRoof: '#ff5a1a',
    },
    sky: { top: '#2a1640', horizon: '#ff9a6a', exponent: 0.5 },
    clouds: { top: '#ffb08a', bottom: '#5a3040' },
    lights: { hemiSky: '#ffd8c8', hemiGround: '#8a4a3a', sunColor: '#ffb080' },
    cap: '#8a7a80',
    // Embers drifting up from the lava.
    weather: { color: '#ff9a3a', fall: -0.45, size: 0.8, drift: 0.25 },
  },
}

/** Makes world `id`'s look the scene's (see the file comment) and returns it. */
export function applyWorldLook(id) {
  const look = LOOKS[id] ?? snowy
  Object.assign(PALETTE, look.palette)
  Object.assign(SKY, look.sky)
  FOG.color = SKY.horizon
  Object.assign(CLOUDS, look.clouds)
  Object.assign(LIGHTS, look.lights)
  GRASS_COLOR.set(look.cap)
  skyUniforms.topColor.value.set(SKY.top)
  skyUniforms.horizonColor.value.set(SKY.horizon)
  skyUniforms.exponent.value = SKY.exponent
  return look
}
