/**
 * The game's icon set, hand-drawn as SVG: glossy cartoon style with thick dark outlines,
 * matching the reference HUD. Strings rather than components so the same art feeds
 * both the DOM HUD (<img src>) and the canvas-drawn 3D world labels.
 *
 * Every icon uses a 100x100 viewBox. Gradient ids are prefixed per icon so icons can
 * be inlined side by side without clashing.
 */

const OUT = '#1b1b1f'

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`

const vgrad = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

const GOLD = [
  [0, '#fff6a3'],
  [0.45, '#ffcf2e'],
  [1, '#f08c00'],
]

const trophy = svg(
  `<g stroke="${OUT}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30" fill="none" stroke-width="13"/>
    <path d="M73 24h16c0 19-9 28-22 30" fill="none" stroke-width="13"/>
  </g>
  <g fill="none" stroke="url(#tr-g)" stroke-width="5" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30"/><path d="M73 24h16c0 19-9 28-22 30"/>
  </g>
  <g stroke="${OUT}" stroke-width="5" stroke-linejoin="round" fill="url(#tr-g)">
    <path d="M42 62h16l3 15H39z"/>
    <rect x="27" y="76" width="46" height="15" rx="5"/>
    <path d="M22 12h56v22c0 19-12 30-28 30S22 53 22 34z"/>
  </g>
  <path d="M50 21l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L50 44.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#fffbd1" stroke="#d98900" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M30 18v16c0 8 3 14 8 18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('tr-g', GOLD),
)

const star = svg(
  `<path d="M50 8l12 25 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

/** A chunky steel dumbbell, tilted: a bar with two big plates and two small ones. */
const gift = svg(
  `<path d="M50 30c-6-14-26-18-26-6 0 8 14 8 26 6zM50 30c6-14 26-18 26-6 0 8-14 8-26 6z" fill="#ffd23a" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="14" y="44" width="72" height="44" rx="6" fill="url(#gf-r)" stroke="${OUT}" stroke-width="6"/>
  <rect x="9" y="30" width="82" height="18" rx="5" fill="url(#gf-r)" stroke="${OUT}" stroke-width="6"/>
  <rect x="43" y="30" width="14" height="58" fill="#ffd23a" stroke="${OUT}" stroke-width="5"/>
  <path d="M20 40h20M20 54v24" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>`,
  vgrad('gf-r', [
    [0, '#ff6b62'],
    [1, '#d6182b'],
  ]),
)

/** A settings gear. */
const gear = svg(
  `<path d="M43 8h14l3 12 8 4 11-6 10 10-6 11 4 8 12 3v14l-12 3-4 8 6 11-10 10-11-6-8 4-3 12H43l-3-12-8-4-11 6-10-10 6-11-4-8-12-3V43l12-3 4-8-6-11 10-10 11 6 8-4z" fill="url(#ge-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="50" cy="50" r="13" fill="#2c344d" stroke="${OUT}" stroke-width="5"/>`,
  vgrad('ge-g', [
    [0, '#e3ecf6'],
    [1, '#8fa1b8'],
  ]),
)

/** A little house: back to the lobby. */
const close = svg(
  `<path d="M24 24l52 52M76 24L24 76" stroke="${OUT}" stroke-width="22" stroke-linecap="round"/>
  <path d="M24 24l52 52M76 24L24 76" stroke="#fff" stroke-width="11" stroke-linecap="round"/>`,
)

const arrowDown = svg(
  `<path d="M36 8h28v40h20L50 90 16 48h20z" fill="#ffffff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`,
)

const check = svg(
  `<path d="M16 52l22 22 46-48" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 52l22 22 46-48" fill="none" stroke="#5cf064" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
)

const starGold = svg(
  `<path d="M50 6l13 27 29 4-21 20 5 29-26-14-26 14 5-29L8 37l29-4z" fill="url(#sg-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M38 30l7-13" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('sg-g', GOLD),
)

const SPEAKER = `<path d="M14 38h16l22-18v60L30 62H14z" fill="url(#sp-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M20 44h8" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
const SPEAKER_GRADIENT = vgrad('sp-g', [
  [0, '#ffffff'],
  [1, '#c7d3e3'],
])

const sound = svg(
  `${SPEAKER}
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="${OUT}" stroke-width="12" stroke-linecap="round"/>
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="#7fe2ff" stroke-width="5" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

const soundOff = svg(
  `${SPEAKER}
  <path d="M62 38l22 24M84 38L62 62" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M62 38l22 24M84 38L62 62" stroke="#ff5a5a" stroke-width="6" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)


// --- Sled Surfers ------------------------------------------------------------------------

/** The gold Coin with its star, as on the reference's counter. */
const coin = svg(
  `<circle cx="50" cy="50" r="42" fill="url(#co-g)" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="50" r="31" fill="none" stroke="#e08a00" stroke-width="4"/>
  <path d="M50 26l7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z" fill="#ffd84a" stroke="#c87400" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M26 36a28 28 0 0 1 16-14" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  vgrad('co-g', GOLD),
)

/** The blue Diamond. */
const diamond = svg(
  `<path d="M24 22h52l18 22-44 48L6 44z" fill="url(#di-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M6 44h88M24 22l12 22 14 48 14-48 12-22M36 44l14-22 14 22" fill="none" stroke="#1a6fd6" stroke-width="3" stroke-linejoin="round" opacity=".7"/>
  <path d="M28 30l6 8" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  vgrad('di-g', [
    [0, '#d9f7ff'],
    [0.5, '#5fd2ff'],
    [1, '#1f86ff'],
  ]),
)

/** The red sled for the SLEDS button. */
const sled = svg(
  `<path d="M10 70h70c8 0 12-6 12-12" fill="none" stroke="${OUT}" stroke-width="12" stroke-linecap="round"/>
  <path d="M10 70h70c8 0 12-6 12-12" fill="none" stroke="#ffd24a" stroke-width="5" stroke-linecap="round"/>
  <path d="M14 34l66-4c6 0 10 4 10 10v8c0 4-4 8-8 8H18c-6 0-10-4-10-10v-4c0-4 2-8 6-8z" fill="url(#sl-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M26 58v12M70 56v14" stroke="${OUT}" stroke-width="6"/>
  <path d="M18 40h56" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".65"/>`,
  vgrad('sl-g', [
    [0, '#ff8a8a'],
    [1, '#d4142a'],
  ]),
)

/** A swoosh of trail for the TRAILS button. */
const trail = svg(
  `<path d="M8 74C30 70 46 52 56 34c6-10 14-20 30-24-4 12-10 22-18 30-14 16-34 30-60 34z" fill="url(#tl-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M20 66c18-6 32-20 40-34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>`,
  vgrad('tl-g', [
    [0, '#b98bff'],
    [1, '#5b2bff'],
  ]),
)

/** The planet with its ring, for WORLDS. */
const worlds = svg(
  `<circle cx="50" cy="52" r="30" fill="url(#wo-g)" stroke="${OUT}" stroke-width="6"/>
  <path d="M30 40c8 4 12 0 18 4s4 12 12 12 10-6 14-4" fill="none" stroke="#2fae4a" stroke-width="8" stroke-linecap="round"/>
  <ellipse cx="50" cy="56" rx="46" ry="12" fill="none" stroke="${OUT}" stroke-width="12" transform="rotate(-14 50 56)"/>
  <ellipse cx="50" cy="56" rx="46" ry="12" fill="none" stroke="#ffd24a" stroke-width="5" transform="rotate(-14 50 56)"/>`,
  vgrad('wo-g', [
    [0, '#8fe6ff'],
    [1, '#1f7bff'],
  ]),
)

/** The clipboard with its ticks, for TASKS. */
const tasks = svg(
  `<rect x="18" y="14" width="64" height="80" rx="10" fill="url(#ta-g)" stroke="${OUT}" stroke-width="6"/>
  <rect x="24" y="22" width="52" height="66" rx="5" fill="#fff"/>
  <rect x="36" y="6" width="28" height="16" rx="5" fill="#9aa6b8" stroke="${OUT}" stroke-width="5"/>
  <path d="M30 40l5 5 9-10M30 58l5 5 9-10M30 76l5 5 9-10" fill="none" stroke="#2fc53a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 42h20M50 60h20M50 78h20" stroke="#9aa6b8" stroke-width="5" stroke-linecap="round"/>`,
  vgrad('ta-g', [
    [0, '#ffd27a'],
    [1, '#d68a2a'],
  ]),
)

/** The SLINGSHOT card: a Y with its band and stone. */
const slingshot = svg(
  `<path d="M50 92V56M50 56L26 18M50 56L74 18" fill="none" stroke="${OUT}" stroke-width="18" stroke-linecap="round"/>
  <path d="M50 92V56M50 56L26 18M50 56L74 18" fill="none" stroke="url(#ss-g)" stroke-width="9" stroke-linecap="round"/>
  <path d="M26 22l24 26 24-26" fill="none" stroke="#ff4a4a" stroke-width="5"/>
  <circle cx="50" cy="44" r="10" fill="#e8eef6" stroke="${OUT}" stroke-width="5"/>
  <rect x="38" y="68" width="24" height="12" rx="4" fill="#3d8bff" stroke="${OUT}" stroke-width="4"/>`,
  vgrad('ss-g', [
    [0, '#ffb24a'],
    [1, '#b8661a'],
  ]),
)

/** The INCOME card: a green money bag. */
const income = svg(
  `<path d="M36 22h28l-6 12c18 6 30 22 30 38 0 14-14 22-38 22S12 86 12 72c0-16 12-32 30-38z" fill="url(#in-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M34 34h32" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>
  <path d="M60 52c-4-4-20-4-20 4s20 4 20 12-16 8-20 4M50 46v40" fill="none" stroke="#ffd24a" stroke-width="7" stroke-linecap="round"/>`,
  vgrad('in-g', [
    [0, '#8dff6a'],
    [1, '#16a034'],
  ]),
)

/** The ROCKET card. */
const rocket = svg(
  `<path d="M50 6c18 12 24 32 22 54H28C26 38 32 18 50 6z" fill="url(#rk-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="50" cy="34" r="9" fill="#5fd2ff" stroke="${OUT}" stroke-width="5"/>
  <path d="M28 46L14 64l14 4M72 46l14 18-14 4" fill="#ff4a4a" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M38 62c0 14 6 24 12 30 6-6 12-16 12-30z" fill="#ffb21e" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>`,
  vgrad('rk-g', [
    [0, '#ffffff'],
    [1, '#c9d3e0'],
  ]),
)

/** A red fuel can, over the rocket's fuel bar. */
const fuel = svg(
  `<path d="M22 24h44l14 14v52H22z" fill="url(#fu-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="34" y="10" width="20" height="14" rx="3" fill="#ffd24a" stroke="${OUT}" stroke-width="5"/>
  <path d="M34 46l24 28M58 46L34 74" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>`,
  vgrad('fu-g', [
    [0, '#ff7a7a'],
    [1, '#c4101f'],
  ]),
)

/** The green PLAY triangle (tasks, the play button). */
const play = svg(
  `<path d="M24 12l62 38-62 38z" fill="url(#pl-g)" stroke="${OUT}" stroke-width="7" stroke-linejoin="round"/>`,
  vgrad('pl-g', [
    [0, '#ffffff'],
    [1, '#dfe7f0'],
  ]),
)

/** A speedometer: the distance task, the speed chip. */
const speed = svg(
  `<circle cx="50" cy="54" r="40" fill="#2b3c78" stroke="${OUT}" stroke-width="6"/>
  <path d="M20 66a32 32 0 0 1 60 0" fill="none" stroke="url(#sp2-g)" stroke-width="10" stroke-linecap="round"/>
  <path d="M50 58L72 32" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
  <circle cx="50" cy="58" r="7" fill="#ff4a4a" stroke="${OUT}" stroke-width="4"/>`,
  `<linearGradient id="sp2-g" x1="0" x2="1"><stop offset="0" stop-color="#4ef05a"/><stop offset=".5" stop-color="#ffe53b"/><stop offset="1" stop-color="#ff3b3b"/></linearGradient>`,
)

/** A stopwatch: the time to the next gift. */
const timer = svg(
  `<rect x="42" y="4" width="16" height="12" rx="3" fill="#c9d3e0" stroke="${OUT}" stroke-width="5"/>
  <path d="M76 22l8 8" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>
  <circle cx="50" cy="56" r="38" fill="#2fa8ff" stroke="${OUT}" stroke-width="6"/>
  <circle cx="50" cy="56" r="28" fill="#fff"/>
  <path d="M50 56V34" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>
  <path d="M50 56l14 9" stroke="#ff3b3b" stroke-width="6" stroke-linecap="round"/>
  <circle cx="50" cy="56" r="5" fill="${OUT}"/>`,
)

/** Chasing arrows: upgrades (the task), the INCOME bonus chip. */
const upgrade = svg(
  `<path d="M78 46a30 30 0 0 0-54-14l-6-8-4 30 28-6-8-6a18 18 0 0 1 32 4z" fill="#ffb21e" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M22 54a30 30 0 0 0 54 14l6 8 4-30-28 6 8 6a18 18 0 0 1-32-4z" fill="#ff7a1e" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>`,
)

/** Wind streaks: distance coins. */
const wind = svg(
  `<path d="M10 36h50a12 12 0 1 0-12-12M10 54h66a12 12 0 1 1-12 12M10 72h34" fill="none" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M10 36h50a12 12 0 1 0-12-12M10 54h66a12 12 0 1 1-12 12M10 72h34" fill="none" stroke="#dff4ff" stroke-width="6" stroke-linecap="round"/>`,
)

/** Bricks flying: the smash task. */
const smash = svg(
  `<rect x="10" y="50" width="34" height="20" fill="#e22a2a" stroke="${OUT}" stroke-width="5" transform="rotate(-18 27 60)"/>
  <rect x="52" y="22" width="34" height="20" fill="#fff" stroke="${OUT}" stroke-width="5" transform="rotate(22 69 32)"/>
  <rect x="48" y="62" width="34" height="20" fill="#e22a2a" stroke="${OUT}" stroke-width="5" transform="rotate(10 65 72)"/>
  <path d="M30 18l6 14M18 34l12 6M44 12v14" stroke="#ffb21e" stroke-width="5" stroke-linecap="round"/>`,
)

/** Yellow chevrons: the boost-pad task. */
const boost = svg(
  `<rect x="8" y="14" width="84" height="72" rx="10" fill="#ffe53b" stroke="${OUT}" stroke-width="6"/>
  <path d="M22 62l28-20 28 20M22 42l28-20 28 20" fill="none" stroke="#e05a00" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
)

/** A lock, for whatever isn't open yet. */
const lock = svg(
  `<path d="M30 44V32a20 20 0 0 1 40 0v12" fill="none" stroke="${OUT}" stroke-width="14"/>
  <path d="M30 44V32a20 20 0 0 1 40 0v12" fill="none" stroke="#c9d3e0" stroke-width="6"/>
  <rect x="18" y="42" width="64" height="48" rx="10" fill="url(#lk-g)" stroke="${OUT}" stroke-width="6"/>
  <path d="M50 58v14" stroke="${OUT}" stroke-width="8" stroke-linecap="round"/>`,
  vgrad('lk-g', GOLD),
)

/** A checkered finish flag. */
const flag = svg(
  `<path d="M20 8v88" stroke="${OUT}" stroke-width="8" stroke-linecap="round"/>
  <path d="M22 12h62v40H22z" fill="#fff" stroke="${OUT}" stroke-width="5"/>
  <path d="M22 12h15v10H22zM52 12h16v10H52zM37 22h15v10H37zM68 22h16v10H68zM22 32h15v10H22zM52 32h16v10H52zM37 42h15v10H37zM68 42h16v10H68z" fill="#222"/>`,
)

/** A bell, for NOTIFY ME. */
const bell = svg(
  `<path d="M50 10c18 0 28 14 28 32v18l10 12H12l10-12V42c0-18 10-32 28-32z" fill="url(#be-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <circle cx="50" cy="82" r="9" fill="#ffd24a" stroke="${OUT}" stroke-width="5"/>`,
  vgrad('be-g', [
    [0, '#ffffff'],
    [1, '#c9d3e0'],
  ]),
)

/** The mountains of a world's badge (WORLD: 1). */
const mountain = svg(
  `<path d="M4 84l30-52 16 26 14-20 32 46z" fill="url(#mo-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M26 46l8-14 8 14-4 4-4-4-4 4zM58 50l6-12 8 12-4 3-4-3z" fill="#fff"/>`,
  vgrad('mo-g', [
    [0, '#8fd6ff'],
    [1, '#2f6fd6'],
  ]),
)

/** A pointing hand, for PULL. */
const hand = svg(
  `<path d="M40 10c6 0 8 4 8 8v26c2-4 14-4 14 4 2-4 12-2 12 6 4-2 12 0 12 8v14c0 14-10 22-24 22H48c-10 0-16-6-22-14L14 64c-4-6 4-12 10-6l8 8V18c0-4 2-8 8-8z" fill="#fff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="34" y="82" width="40" height="12" rx="4" fill="#5fd2ff" stroke="${OUT}" stroke-width="5"/>`,
)

/** Chests, by colour: orange (common), blue (good), rainbow (the best). */
export function chestSvg(id) {
  const fills = {
    orange: ['#ffc07a', '#e06a1a'],
    blue: ['#9fd8ff', '#2f6fd6'],
    rainbow: ['#ff9cf4', '#ff4a8a'],
  }[id] ?? ['#ffc07a', '#e06a1a']
  return svg(
    `<path d="M12 44c0-20 16-30 38-30s38 10 38 30z" fill="url(#ch-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="12" y="44" width="76" height="44" rx="6" fill="url(#ch-g)" stroke="${OUT}" stroke-width="6"/>
    <path d="M12 52h76M30 16v72M70 16v72" stroke="#3a4a6a" stroke-width="7"/>
    <rect x="42" y="40" width="16" height="20" rx="3" fill="#e8eef6" stroke="${OUT}" stroke-width="5"/>`,
    vgrad('ch-g', [
      [0, fills[0]],
      [1, fills[1]],
    ]),
  )
}

/** A stack of coins, for the coin packs. */
const coins = svg(
  `<ellipse cx="34" cy="74" rx="26" ry="11" fill="#e08a00" stroke="${OUT}" stroke-width="5"/>
  <ellipse cx="34" cy="64" rx="26" ry="11" fill="#ffcf2e" stroke="${OUT}" stroke-width="5"/>
  <ellipse cx="62" cy="58" rx="26" ry="11" fill="#e08a00" stroke="${OUT}" stroke-width="5"/>
  <ellipse cx="62" cy="48" rx="26" ry="11" fill="#ffcf2e" stroke="${OUT}" stroke-width="5"/>
  <ellipse cx="46" cy="34" rx="26" ry="11" fill="#e08a00" stroke="${OUT}" stroke-width="5"/>
  <ellipse cx="46" cy="24" rx="26" ry="11" fill="#fff07a" stroke="${OUT}" stroke-width="5"/>
  <path d="M46 18l3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#ffb21e"/>`,
)

export const ICON_SVGS = {
  sound,
  soundOff,
  starGold,
  trophy,
  star,
  gift,
  gear,
  close,
  arrowDown,
  check,
  coin,
  coins,
  diamond,
  sled,
  trail,
  worlds,
  tasks,
  slingshot,
  income,
  rocket,
  fuel,
  play,
  speed,
  timer,
  upgrade,
  wind,
  smash,
  boost,
  lock,
  flag,
  bell,
  mountain,
  hand,
}

const urlCache = new Map()
/** The glossy 3D renders of the main icons (game/icons3d.js), once they're made. */
const rendered = new Map()
const listeners = new Set()

/** A 3D render of icon `name` is ready: it's used from now on, everywhere. */
export function setRenderedIcon(name, url) {
  rendered.set(name, url)
  for (const fn of listeners) fn()
}

/** Calls `fn` whenever a 3D icon arrives; returns the unsubscribe. */
export function onIconsChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** URL for an icon name, or `chest:<id>` for a chest: its 3D render if it has one, else its SVG. */
export function iconUrl(name) {
  const render = rendered.get(name)
  if (render) return render
  let url = urlCache.get(name)
  if (url) return url
  let markup = ICON_SVGS[name]
  if (!markup && name.startsWith('chest:')) markup = chestSvg(name.slice(6))
  if (!markup) return null
  url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  urlCache.set(name, url)
  return url
}
