import { create } from 'zustand'

/**
 * Graphics quality presets. Every visual feature reads its settings from here rather
 * than deciding for itself, so dropping a preset reliably sheds load everywhere.
 *
 * LOW is the mobile / weak-PC baseline: no realtime shadows, no particles, no
 * post-processing, a slightly shorter view and textures capped at 512px. The map itself
 * is the same on every preset - every tree, cliff and prop - so a weak PC sees the same
 * world; what LOW saves is the cost nobody sees (resolution, antialiasing, shadow maps).
 */
export const QUALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH']

export const PRESETS = {
  LOW: {
    dpr: 1,
    antialias: false,
    /** 'blob' = fake contact shadows only; 'realtime' = shadow-mapped sun. */
    shadows: 'blob',
    shadowMapSize: 0,
    particles: false,
    /** Flakes of falling snow: always some, so it always feels like winter (one draw call). */
    snowCount: 600,
    speedLines: false,
    /** Motion blur down the sides at speed (post-processing): samples a pixel, 0 = off. */
    motionBlur: 0,
    viewDistance: 280,
    fogNear: 95,
    cloudCount: 14,
    /** Max side of any generated texture. */
    maxTexture: 512,
    /** Other players' shadows and pets show this far away (their avatars, however far). */
    remoteDrawDistance: 150,
    remoteNameDistance: 50,
    /** World labels fade out past this. */
    labelDistance: 110,
    /** How much of the scenery to build (0-1): all of it, everywhere - the map never changes. */
    decorDensity: 1,
    /** Dumbbell, egg and aura halo size multiplier. */
    glow: 0.8,
  },
  MEDIUM: {
    dpr: 1.25,
    antialias: true,
    shadows: 'realtime',
    shadowMapSize: 1024,
    particles: true,
    snowCount: 1400,
    speedLines: true,
    motionBlur: 8,
    viewDistance: 340,
    fogNear: 110,
    cloudCount: 16,
    maxTexture: 1024,
    remoteDrawDistance: 150,
    remoteNameDistance: 55,
    labelDistance: 130,
    decorDensity: 1,
    glow: 1,
  },
  HIGH: {
    dpr: 1.5,
    antialias: true,
    shadows: 'realtime',
    shadowMapSize: 1024,
    particles: true,
    snowCount: 2200,
    speedLines: true,
    motionBlur: 12,
    viewDistance: 460,
    fogNear: 140,
    cloudCount: 18,
    maxTexture: 1024,
    remoteDrawDistance: 150,
    remoteNameDistance: 70,
    labelDistance: 150,
    decorDensity: 1,
    glow: 1,
  },
}

const STORAGE_KEY = 'pp.quality'

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true
  // iPadOS reports itself as a Mac; touch points give it away.
  return navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)
}

/**
 * The starting preset: LOW for everyone, so the game runs smoothly on any device from
 * the first ride. Anyone can pick MEDIUM or HIGH in Settings (remembered). The map is
 * the same on all of them.
 */
export const DEFAULT_QUALITY = 'LOW'

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return QUALITY_LEVELS.includes(saved) ? saved : null
  } catch {
    return null
  }
}

const initialLevel = readSaved() || DEFAULT_QUALITY

export const useQuality = create((set, get) => ({
  level: initialLevel,
  /** True when the player picked the level by hand; auto-drop then stays out of it. */
  manual: readSaved() !== null,
  isMobile: isMobileDevice(),
  /** Set once at startup: antialiasing can't change without recreating the context. */
  antialias: PRESETS[initialLevel].antialias,
  settings: PRESETS[initialLevel],

  setLevel: (level, manual = true) => {
    if (!QUALITY_LEVELS.includes(level)) return
    if (manual) {
      try {
        localStorage.setItem(STORAGE_KEY, level)
      } catch {
        // Private mode: the choice just won't persist.
      }
    }
    set({ level, manual, settings: PRESETS[level] })
  },

  /**
   * AUTO: forget the hand-picked level and go back to the one detected for this device,
   * which then drops by itself whenever the frame rate falls under budget.
   */
  setAuto: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Private mode: nothing was saved.
    }
    set({ level: DEFAULT_QUALITY, manual: false, settings: PRESETS[DEFAULT_QUALITY] })
  },

  /** Called by the performance monitor when FPS stays under budget. */
  degrade: () => {
    const { level, manual } = get()
    if (manual) return
    const index = QUALITY_LEVELS.indexOf(level)
    if (index <= 0) return
    const next = QUALITY_LEVELS[index - 1]
    console.info(`[quality] FPS under budget, dropping ${level} -> ${next}`)
    set({ level: next, settings: PRESETS[next] })
  },
}))

/** Non-reactive read, safe inside useFrame. */
export const getQuality = () => useQuality.getState().settings
