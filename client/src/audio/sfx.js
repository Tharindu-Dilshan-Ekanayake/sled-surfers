import { createMusic } from './music'

/**
 * Sound effects and the background music, synthesised with WebAudio: no audio files
 * to download.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is created on
 * the first tap/click/key (which also starts the music) and every sound before that is
 * silently skipped.
 */

const MUTE_KEY = 'sled.muted'

let ctx = null
let master = null
/** Input of the echo the chimes ring out into (see createEcho). */
let echo = null
let noiseBuffer = null
let music = null
let muted = readMuted()
/** Boxity's volume settings, 0-1: everything, and the music on its own. */
let allVolume = 1
let musicVolume = 1
/** True while Boxity shows an ad break: silent until it's over. */
let adBreak = false
/** Where the master gain sits now. */
const masterLevel = () => (muted || adBreak ? 0 : 0.5 * allVolume)
const lastPlayed = new Map()
const muteListeners = new Set()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return
  }
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = masterLevel()
  master.connect(ctx.destination)
  echo = createEcho()
  // One second of white noise, reused by every whoosh and crack.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  music = createMusic(ctx, master, noiseBuffer)
  music.setVolume(musicVolume)
  music.start()
  // The slide's rumble, made now (just after the tap) rather than at the launch, where
  // it would cost a frame.
  setTimeout(slideBuffers, 0)
}

/**
 * A short, darkening echo for the chimes to ring out into, so they sparkle instead of
 * clicking off. Built once; every sound sent to it shares it.
 */
function createEcho() {
  const input = ctx.createGain()
  input.gain.value = 0.25
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.13
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 3200
  const feedback = ctx.createGain()
  feedback.gain.value = 0.32
  input.connect(delay)
  delay.connect(damp).connect(feedback).connect(delay)
  damp.connect(master)
  return input
}

/** Installs the first-gesture unlock. Call once at startup. */
export function installAudioUnlock() {
  const events = ['pointerdown', 'keydown', 'touchend']
  const handler = () => {
    unlock()
    for (const e of events) window.removeEventListener(e, handler, true)
  }
  for (const e of events) window.addEventListener(e, handler, true)
  // Mobile browsers suspend audio in the background; resume on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx?.state === 'suspended') ctx.resume()
  })
}

export function isMuted() {
  return muted
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not persisted; fine.
  }
  if (master) master.gain.value = masterLevel()
  for (const listener of muteListeners) listener(muted)
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1))

/** Boxity's volume settings (0-1): `all` for everything, `music` for the music alone. */
export function setVolumes({ all = allVolume, music: musicLevel = musicVolume } = {}) {
  allVolume = clamp01(all)
  musicVolume = clamp01(musicLevel)
  if (master) master.gain.value = masterLevel()
  music?.setVolume(musicVolume)
}

/** Boxity's ad breaks: every sound off for the break, back as it was after. */
export function setAdBreak(on) {
  adBreak = Boolean(on)
  if (master) master.gain.value = masterLevel()
}

/** Calls `listener(muted)` on every change; returns the unsubscribe. */
export function onMutedChange(listener) {
  muteListeners.add(listener)
  return () => muteListeners.delete(listener)
}

// --- The slide: snow hissing under the sled, wind, and the rocket ----------------------

let slide = null
let slideSetAt = 0
/** Brown noise (a low rumble), made once sound is unlocked (or the first time a sled slides). */
let brownBuffer = null

function slideBuffers() {
  if (brownBuffer) return
  const n = ctx.sampleRate * 2
  brownBuffer = ctx.createBuffer(1, n, ctx.sampleRate)
  const brown = brownBuffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    brown[i] = last * 3.5
  }
  // Tilted so it ends where it starts: no click each time round the loop.
  const drift = brown[n - 1] - brown[0]
  for (let i = 0; i < n; i += 1) brown[i] -= (drift * i) / (n - 1)
}

/** A looping buffer through a filter and a gain (starting silent) into the mix. */
function loopLayer(buffer, type, frequency, q) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  src.connect(filter).connect(gain).connect(master)
  src.start(0, Math.random())
  return { src, filter, gain }
}

/**
 * The ride, in layers: snow hissing under the runners, the bright scrape of ice on top
 * of it (both brighter and louder the faster you go), a low rumble, and the wind -
 * rushing harder with speed, and taking over in the air. And the rocket's roar while it
 * burns. The music ducks under it until `slideStop`.
 */
function slideStart() {
  if (!ctx || slide || ctx.state !== 'running') return
  slideBuffers()
  slide = {
    hiss: loopLayer(noiseBuffer, 'bandpass', 3200, 0.6),
    ice: loopLayer(noiseBuffer, 'highpass', 6500, 0.7),
    rumble: loopLayer(brownBuffer, 'lowpass', 140, 0.8),
    wind: loopLayer(noiseBuffer, 'bandpass', 700, 1.4),
    rocket: loopLayer(brownBuffer, 'lowpass', 420, 1.2),
    burning: false,
  }
  music?.duck(true)
}

/**
 * `level` 0..1 from how fast you're going, whether you're in the air, and whether the
 * rocket's burning. Positional, not an object: it's called every frame.
 */
function slideSet(level, airborne = false, burning = false) {
  if (!slide) return
  // Ten updates a second is plenty for a smooth swell.
  const now = performance.now()
  if (now - slideSetAt < 100) return
  slideSetAt = now
  const t = ctx.currentTime
  const l = Math.min(1, Math.max(0, level))
  const ground = airborne ? 0 : 1
  // A touch of flutter on the hiss: runners scraping over ice, not a steady noise.
  const flutter = 0.85 + Math.random() * 0.3
  slide.hiss.gain.gain.setTargetAtTime(0.0001 + l * 0.13 * ground * flutter, t, 0.08)
  slide.hiss.filter.frequency.setTargetAtTime(2400 + l * 3800, t, 0.2)
  slide.ice.gain.gain.setTargetAtTime(0.0001 + l * l * 0.07 * ground * flutter, t, 0.06)
  slide.ice.filter.frequency.setTargetAtTime(6000 + l * 3500, t, 0.2)
  slide.rumble.gain.gain.setTargetAtTime(0.0001 + l * 0.16 * ground, t, 0.1)
  slide.wind.gain.gain.setTargetAtTime(0.0001 + (airborne ? 0.04 + l * 0.12 : 0.02 + l * 0.07), t, 0.15)
  slide.wind.filter.frequency.setTargetAtTime(400 + l * 900, t, 0.3)
  slide.rocket.gain.gain.setTargetAtTime(burning ? 0.35 : 0.0001, t, 0.06)
}

function slideStop() {
  if (!slide) return
  const layers = slide
  slide = null
  const t = ctx.currentTime
  for (const layer of [layers.hiss, layers.ice, layers.rumble, layers.wind, layers.rocket]) {
    layer.gain.gain.setTargetAtTime(0.0001, t, 0.15)
    layer.src.stop(t + 1)
  }
  music?.duck(false)
}

/** The band creaking as you pull it back: a strained, rising tone (0 lets go). */
let stretchVoice = null
function stretch(level) {
  if (!ctx || ctx.state !== 'running') return
  if (level <= 0) {
    if (!stretchVoice) return
    const voice = stretchVoice
    stretchVoice = null
    voice.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04)
    voice.osc.stop(ctx.currentTime + 0.3)
    return
  }
  if (!stretchVoice) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    osc.connect(filter).connect(gain).connect(master)
    osc.start()
    stretchVoice = { osc, gain }
  }
  const t = ctx.currentTime
  stretchVoice.osc.frequency.setTargetAtTime(90 + level * 160 + Math.random() * 8, t, 0.05)
  stretchVoice.gain.gain.setTargetAtTime(0.015 + level * 0.04, t, 0.05)
}

function ready(name, minGapMs = 0) {
  if (!ctx || muted || ctx.state !== 'running') return false
  const now = performance.now()
  if (minGapMs && now - (lastPlayed.get(name) || 0) < minGapMs) return false
  lastPlayed.set(name, now)
  return true
}

/** A short enveloped oscillator note; `echo` also sends it into the echo. */
function tone(freq, { type = 'sine', at = 0, duration = 0.12, volume = 0.3, slideTo = null, attack = 0.01, echo: wet = false } = {}) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(master)
  if (wet) gain.connect(echo)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** A struck bell: the note, a quieter octave and a glassy strike, ringing into the echo. */
function bell(freq, { at = 0, volume = 0.1, decay = 0.4 } = {}) {
  tone(freq, { at, duration: decay, volume, echo: true })
  tone(freq * 2, { at, duration: decay * 0.6, volume: volume * 0.35, echo: true })
  tone(freq * 3.01, { type: 'triangle', at, duration: 0.05, volume: volume * 0.3 })
}

/** Trophy chimes climb and fall this scale while they keep coming (C major pentatonic). */
const TROPHY_SCALE = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637]
/** A trophy within this long of the last carries the run on; otherwise it starts again. */
const TROPHY_RUN_MS = 700
let trophyRun = 0
let trophyAt = 0

/** Filtered noise: whooshes and cracks. */
function noise({ at = 0, duration = 0.3, volume = 0.25, from = 400, to = 2400, q = 1.2 } = {}) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.3)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(gain).connect(master)
  // Looped, so a long one from a random spot never runs off the end of the second.
  src.loop = true
  src.start(t, Math.random() * 0.5)
  src.stop(t + duration + 0.02)
}

export const sfx = {
  click() {
    if (ready('click', 40)) tone(660, { type: 'triangle', duration: 0.05, volume: 0.15 })
  },
  /** Let go of the band: a big elastic TWANG and a whoosh, louder the harder you pulled. */
  launch(power = 1) {
    if (!ready('launch')) return
    tone(140 + power * 60, { type: 'sawtooth', duration: 0.35, volume: 0.12, slideTo: 520 })
    tone(70, { duration: 0.3, volume: 0.18, slideTo: 40 })
    noise({ duration: 0.6, volume: 0.14 + power * 0.1, from: 300, to: 3200, q: 0.7 })
  },
  /** A boost pad: a whoosh sweeping up, a rising synth, and a sparkling chord at the top. */
  boost() {
    if (!ready('boost', 120)) return
    noise({ duration: 0.55, volume: 0.16, from: 500, to: 7000, q: 0.7 })
    tone(220, { type: 'sawtooth', duration: 0.32, volume: 0.06, slideTo: 1760 })
    tone(440, { type: 'square', duration: 0.28, volume: 0.04, slideTo: 2637 })
    for (const [f, at] of [
      [1568, 0.2],
      [2093, 0.25],
      [2637, 0.3],
    ]) {
      bell(f, { at, volume: 0.05, decay: 0.35 })
    }
  },
  /** Through a brick wall: a crunch, a clatter of bricks. */
  smash() {
    if (!ready('smash', 120)) return
    tone(90, { duration: 0.3, volume: 0.22, slideTo: 45 })
    noise({ duration: 0.4, volume: 0.28, from: 2200, to: 300, q: 0.6 })
    for (let i = 0; i < 4; i += 1) tone(500 + Math.random() * 600, { type: 'square', at: 0.08 + i * 0.06, duration: 0.05, volume: 0.03 })
  },
  rocketOn() {
    if (!ready('rocketOn', 150)) return
    noise({ duration: 0.4, volume: 0.18, from: 200, to: 1800, q: 0.5 })
  },
  rocketOff() {
    if (slide) slide.rocket.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06)
  },
  /**
   * A coin picked up: a bright "ka-ching" - a quick tick, a chime a fifth up and a
   * sparkle - that climbs the scale and back down while they keep coming, so a line of
   * them plays a little tune.
   */
  coin() {
    if (!ready('coin', 60)) return
    const now = performance.now()
    trophyRun = now - trophyAt < TROPHY_RUN_MS ? trophyRun + 1 : 0
    trophyAt = now
    const n = TROPHY_SCALE.length
    const k = trophyRun % (2 * n - 2)
    const f = TROPHY_SCALE[k < n ? k : 2 * n - 2 - k]
    tone(f, { type: 'square', duration: 0.05, volume: 0.035 })
    tone(f * 1.5, { type: 'triangle', at: 0.045, duration: 0.2, volume: 0.07, echo: true })
    bell(f * 2, { at: 0.05, volume: 0.03, decay: 0.25 })
  },
  /** The old name for a coin: other systems still ring it. */
  trophy() {
    sfx.coin()
  },
  /** A Diamond: a glassy arpeggio up through the octave, ringing out. */
  diamond() {
    if (!ready('diamond', 120)) return
    ;[2093, 2637, 3136, 4186].forEach((f, i) => bell(f, { at: i * 0.05, volume: 0.06, decay: 0.5 }))
    tone(1047, { type: 'triangle', duration: 0.5, volume: 0.05, attack: 0.02, echo: true })
  },
  /** NEW BEST! down the slide: a short bright fanfare. */
  newBest() {
    if (!ready('newBest', 500)) return
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.08, duration: 0.24, volume: 0.1, echo: true }))
    tone(1047 * 1.003, { at: 0.34, duration: 0.6, volume: 0.05, attack: 0.04, echo: true })
    tone(1319, { at: 0.34, duration: 0.6, volume: 0.04, attack: 0.04 })
  },
  /** Into a new stage: a little three-note chime. */
  stage() {
    if (!ready('stage', 800)) return
    ;[784, 1047, 1319].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.09, duration: 0.3, volume: 0.07, echo: true }))
  },
  /** A payout (results, gifts, a badge): a fanfare, a shimmering chord and a shower of coins. */
  wins() {
    if (!ready('wins')) return
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.07, duration: 0.2, volume: 0.1, echo: true }))
    // G major, held, each voice doubled a hair apart so it shimmers.
    for (const f of [784, 988, 1175]) {
      tone(f * 1.003, { at: 0.28, duration: 0.9, volume: 0.045, attack: 0.05, echo: true })
      tone(f * 0.997, { at: 0.28, duration: 0.9, volume: 0.045, attack: 0.05 })
    }
    for (let i = 0; i < 6; i += 1) bell(2093 + Math.random() * 1200, { at: 0.3 + i * 0.07 + Math.random() * 0.03, volume: 0.035, decay: 0.2 })
  },
  reveal() {
    if (!ready('reveal')) return
    ;[392, 523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, duration: 0.22, volume: 0.12 }))
  },
  buy() {
    if (!ready('buy')) return
    tone(1047, { type: 'square', duration: 0.07, volume: 0.08 })
    tone(1568, { type: 'square', at: 0.08, duration: 0.16, volume: 0.08 })
  },
  error() {
    if (ready('error', 200)) tone(160, { type: 'sawtooth', duration: 0.18, volume: 0.07, slideTo: 110 })
  },
  /** A jump: a springy little boing. */
  jump() {
    if (ready('jump', 120)) tone(260, { type: 'triangle', duration: 0.18, volume: 0.1, slideTo: 620 })
  },
  /** Landing: a soft thump in the snow. */
  jumpLand() {
    if (!ready('jumpLand', 150)) return
    tone(140, { type: 'sine', duration: 0.12, volume: 0.12, slideTo: 70 })
    noise({ duration: 0.12, volume: 0.08, from: 1400, to: 300, q: 0.7 })
  },
  stretch,
  slideStart,
  slideSet,
  slideStop,
}
