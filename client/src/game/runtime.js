import { Vector3 } from 'three'

import { SPAWN } from '@shared/world'

/**
 * Per-frame mutable state shared between systems.
 *
 * Deliberately outside React and zustand: it changes every frame, nothing should
 * re-render because of it, and every reader lives in a `useFrame` or a timer. UI that
 * needs a slow-changing derivative of it (whether you're on the slingshot's pad, say)
 * gets it from the 10 Hz game ticker, which is the only thing that copies from here
 * into the store.
 */
export const runtime = {
  player: {
    position: new Vector3(SPAWN.x, 0, SPAWN.z),
    /** Facing, radians about +Y. PI faces north (-Z), towards the slingshot. */
    yaw: Math.PI,
    speed: 0,
    grounded: true,
    /** When the win dance (back in the lobby after a ride) started; 0 when not dancing. */
    danceAt: 0,
    /** 'idle' | 'walk' | 'jump' | 'pull' | 'ride' | 'dance' - what other players see. */
    anim: 'idle',
    /** Set when the controller should ignore input (on the slingshot, riding). */
    frozen: false,
    /** The Boxity emote playing: `{ id, at }` (at = performance.now() it started), or null. */
    emote: null,
  },

  /** Touch input, written by the on-screen controls. -1..1, +y = forward. */
  input: {
    joyX: 0,
    joyY: 0,
    jump: false,
    /** Riding: the on-screen steer, jump and rocket buttons. */
    steer: 0,
    rocket: false,
  },

  camera: {
    /** 'follow' orbits the player; 'ride' is the chase camera down the slide. */
    mode: 'follow',
    yaw: 0,
    pitch: 0.26,
    distance: 11.5,
    /** Field of view at rest (wider on a phone held upright); speed widens it down the slide. */
    baseFov: 60,
    /** Set to jump the follow camera straight to its target next frame. */
    snap: false,
  },

  /** What the sun's shadow box centres on while the camera is down the slide with you. */
  focus: null,

  /** Walls that come and go at runtime (none at the moment; the controller reads it). */
  dynamicColliders: [],

  /**
   * Things that get a blob shadow on low presets. Each entry is
   * `{ position: Vector3, size: number, visible?: boolean }`.
   */
  shadowCasters: new Set(),
}

/** Puts the player back at spawn, e.g. after a reconnect into a fresh lobby. */
export function respawn() {
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = Math.PI
}

/**
 * The field of view at rest for a screen of this aspect (width / height): wider on a phone
 * held upright, which would otherwise see only a narrow slice of the slide and lobby.
 */
export function setBaseFov(aspect) {
  runtime.camera.baseFov = aspect < 1 ? 60 + 22 * Math.min(1, (1 - aspect) / 0.55) : 60
}
