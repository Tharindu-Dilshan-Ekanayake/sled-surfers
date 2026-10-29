/**
 * The scene's whole look in one place: a bright toy-brick winter world with a
 * saturated blue sky, a snowy studded plaza, brown voxel cliffs with snow on every step
 * all round, snow-capped pines and the slide's blue half-pipe walls.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The hemisphere fill plus the
 * sun add up to just over that on the ground, which is what keeps the colours vivid;
 * shadowed ground only gets the fill, so shadows read as a softer, darker shade.
 */

export const SKY = {
  /** Straight up. */
  top: '#2f8ff2',
  /** At eye level. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#a6d6fb',
  /** Lower = the deep blue reaches further down towards the horizon. */
  exponent: 0.35,
}

export const FOG = {
  color: SKY.horizon,
}

export const CLOUDS = {
  /** Sunlit tops. */
  top: '#ffffff',
  /** Undersides, a cool blue-grey. */
  bottom: '#d6e5f5',
}

/**
 * Every surface colour in the lobby - World 1's. The current world's look is copied in
 * over these when you change worlds (worldLook.js), before the lobby is rebuilt.
 */
export const PALETTE = {
  /** The plaza: white snow studs, as in the reference. */
  plaza: '#eef3f9',
  /** Paths trodden into the snow, a shade bluer. */
  path: '#dde8f3',
  /** The ice rink's blue. */
  ice: '#bfe3fb',
  /** Brown voxel cliffs (snow on every step), in a few shades. */
  rock: ['#8a5a3c', '#7a4e34', '#94603f'],
  cliff: '#8a5a3c',
  trunk: '#6a3f22',
  wood: '#a8672e',
  plank: ['#b8773c', '#a8672e', '#c4834a'],
  leaves: ['#1f8f4a', '#23a052', '#1b7f42'],
  white: '#f4f7fb',
  roof: '#d6262e',
  slideWall: '#4f9ff0',
  /** Snow on roofs, lamps and posts, and the drifts (sand or ash in other worlds). */
  snow: '#f7faff',
  /** Cabin walls and their dark trim. */
  cabin: '#8a5226',
  trim: '#5a3418',
  /** The trees on the cliffs ('pine' or 'cactus'), the figures round the plaza ('snowman', 'cactus' or 'lavaRock') and the big centrepiece ('xmas', 'palm' or 'obelisk'). */
  tree: 'pine',
  figure: 'snowman',
  landmark: 'xmas',
  /** The castle on the plateau behind the plaza. */
  castleBase: '#e8f2fb',
  castleWall: '#cfe9fb',
  castleDark: '#9fd0f2',
  castleRoof: '#d6262e',
}

export const LIGHTS = {
  /** Fill from above (sky) and below (bounce off the snow). */
  hemiSky: '#ffffff',
  hemiGround: '#c8d6e6',
  hemiIntensity: 1.95,

  sunColor: '#fff6e8',
  sunIntensity: 1.65,
  /**
   * Direction *towards* the sun: high and a little to the left, behind the default
   * camera, so the side of the character you look at is lit and its shadow falls
   * beside it where you can see it, not hidden behind its back.
   */
  sunDirection: [-0.35, 0.9, 0.25],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.7,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}
