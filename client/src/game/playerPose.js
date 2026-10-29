/**
 * The player's body language, shared by the Bloxity avatar and the blocky stand-in so
 * both move the same way.
 *
 * `computePose` turns the motion state into joint angles; each avatar applies them to
 * its own limbs. Angles are radians in character space (the character faces +Z, its
 * left side is +X), about each joint's pivot:
 *   swing - about X: negative swings a limb forward (arm up in front, knee up)
 *   sway  - about Z: positive moves a limb towards +X
 *   twist - about Y: positive turns the right shoulder forward
 * `lift` raises (or, to keep bent legs on the ground, lowers) the body, in metres.
 */

export const POSED_BONES = [
  'Spine1',
  'Neck1',
  'ArmL1',
  'ArmL2',
  'ArmR1',
  'ArmR2',
  'LegL1',
  'LegL2',
  'LegR1',
  'LegR2',
]

/**
 * How built every body is, 0 (skinny) to 1 (a bodybuilder): the same healthy middle for
 * everyone - in Sled Surfers nobody trains, so nobody bulks up.
 */
export const BODY_BULK = 0.38

/**
 * How a blocky stand-in's parts are built against its own, skinny (bulk 0) and
 * bodybuilder (1): the chest's width and torso's depth, the arms' and the legs' width
 * and depth. (The real avatar's body is muscleBody's.)
 */
const SKINNY = { chestX: 0.6, torsoZ: 0.7, armX: 0.5, armZ: 0.6, legX: 0.66, legZ: 0.72 }
const BUFF = { chestX: 1.85, torsoZ: 1.35, armX: 1.95, armZ: 1.6, legX: 1.2, legZ: 1.2 }
const BUILD_KEYS = Object.keys(SKINNY)
const build = { ...SKINNY }

/** The build (see SKINNY) of a body of `bulk`: one shared result, to use at once. */
export function bodyBuild(bulk = 0.5) {
  const t = Math.min(1, Math.max(0, bulk))
  for (const key of BUILD_KEYS) build[key] = SKINNY[key] + (BUFF[key] - SKINNY[key]) * t
  return build
}

/**
 * A classic blocky figure's part of `kind` ('torso', 'arm' or 'leg'; anything else is
 * left be), on `side` (+1 left, -1 right), built as `b`: writes its width and depth
 * multipliers and its middle's x, in studs, into `out` as (x, y, z). Arms and legs stay
 * at the body's sides however broad it gets.
 */
export function blockyPart(kind, side, b, out) {
  if (kind === 'torso') return out.set(b.chestX, b.torsoZ, 0)
  if (kind === 'arm') return out.set(b.armX, b.armZ, side * (b.chestX + 0.5 * b.armX))
  if (kind === 'leg') return out.set(b.legX, b.legZ, side * 0.5 * b.legX)
  return out.set(1, 1, 0)
}

/** Written by `computePose` every frame; one shared result, never reallocated. */
export const pose = {
  lift: 0,
  bones: Object.fromEntries(POSED_BONES.map((name) => [name, { swing: 0, sway: 0, twist: 0 }])),
}

/** Sway sign that moves a limb away from the body, per side. */
const OUT_L = 1
const OUT_R = -1

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Adds to a joint, scaled by weight `w`. */
function add(name, swing, sway, twist, w) {
  const b = pose.bones[name]
  b.swing += swing * w
  b.sway += sway * w
  b.twist += twist * w
}

/** Relaxed stance: arms hanging a little out from the sides, knees soft, breathing. */
function stance(w, time) {
  const breath = Math.sin(time * 1.8)
  add('LegL1', -0.04, 0.06 * OUT_L, 0, w)
  add('LegL2', 0.08, 0, 0, w)
  add('LegR1', 0.04, 0.06 * OUT_R, 0, w)
  add('LegR2', 0.08, 0, 0, w)
  add('Spine1', -0.03 + breath * 0.015, 0, 0, w)
  add('ArmL1', -0.08 + breath * 0.03, 0.14 * OUT_L, 0, w)
  add('ArmL2', -0.25, 0, 0, w)
  add('ArmR1', -0.08 + breath * 0.03, 0.14 * OUT_R, 0, w)
  add('ArmR2', -0.25, 0, 0, w)
  pose.lift += (-0.01 + breath * 0.006) * w
}

/**
 * Standing about: a little dance to yourself - a bounce in the knees on the beat, a
 * sway, the arms swinging along.
 */
function grooving(time, w) {
  const beat = time * 4.2
  const bob = Math.sin(beat)
  const sway = Math.sin(beat * 0.5)
  add('LegL1', -0.08 * Math.max(0, bob), 0, 0, w)
  add('LegR1', -0.08 * Math.max(0, -bob), 0, 0, w)
  add('LegL2', 0.18 * Math.max(0, bob), 0, 0, w)
  add('LegR2', 0.18 * Math.max(0, -bob), 0, 0, w)
  add('Spine1', 0, sway * 0.07, sway * 0.12, w)
  add('Neck1', 0, -sway * 0.08, 0, w)
  add('ArmL1', -0.22 - 0.22 * Math.max(0, bob), 0, 0, w)
  add('ArmR1', -0.22 - 0.22 * Math.max(0, -bob), 0, 0, w)
  add('ArmL2', -0.45, 0, 0, w)
  add('ArmR2', -0.45, 0, 0, w)
  pose.lift -= Math.abs(bob) * 0.03 * w
}

/**
 * Walk to sprint: arms and legs swing against each other, the body leans in and bobs
 * once per step. `phase` advances faster with speed, so the steps quicken.
 */
function stride(phase, ratio) {
  const cycle = Math.sin(phase)
  const leg = 0.85 * ratio
  const arm = 0.75 * ratio
  add('LegL1', cycle * leg, 0, 0, 1)
  add('LegR1', -cycle * leg, 0, 0, 1)
  // Knees fold on the back swing only.
  add('LegL2', Math.max(0, -cycle) * 1.1 * ratio, 0, 0, 1)
  add('LegR2', Math.max(0, cycle) * 1.1 * ratio, 0, 0, 1)
  add('ArmL1', -cycle * arm, 0.08 * OUT_L * ratio, 0, 1)
  add('ArmR1', cycle * arm, 0.08 * OUT_R * ratio, 0, 1)
  add('ArmL2', -(0.35 + Math.max(0, -cycle) * 0.5) * ratio, 0, 0, 1)
  add('ArmR2', -(0.35 + Math.max(0, cycle) * 0.5) * ratio, 0, 0, 1)
  add('Spine1', -(0.08 + 0.14 * ratio) * ratio, 0, cycle * 0.12 * ratio, 1)
  pose.lift += (Math.abs(Math.cos(phase)) * 0.05 - 0.015) * ratio
}

/**
 * In the air: one knee up and the arms out on the way up; falling, the legs straighten
 * and reach down for the ground.
 */
function airborne(vy) {
  const f = smooth(0, 1, clamp01((2 - vy) / 9))
  add('LegL1', lerp(-1.3, -0.35, f), 0.08 * OUT_L, 0, 1)
  add('LegL2', lerp(1.6, 0.25, f), 0, 0, 1)
  add('LegR1', lerp(0.25, -0.1, f), 0.08 * OUT_R, 0, 1)
  add('LegR2', lerp(0.5, 0.2, f), 0, 0, 1)
  add('ArmL1', lerp(-0.35, -0.6, f), lerp(1.15, 1.45, f) * OUT_L, 0, 1)
  add('ArmL2', -0.35, 0, 0, 1)
  add('ArmR1', lerp(-0.25, -0.5, f), lerp(1.05, 1.35, f) * OUT_R, 0, 1)
  add('ArmR2', -0.4, 0, 0, 1)
  add('Spine1', lerp(-0.15, 0.06, f), 0, 0, 1)
}



/** How far sitting lowers the body: from standing hips down to just over a bench seat. */
const SIT_DROP = 0.26


/**
 * Sat on a sled: legs out in front, knees a little up, hands gripping the sides, leaning
 * into the turns (`lean` -1..1) and back against the band while it's pulled
 * (`pull` 0-1). In the air the arms fly up and out.
 */
function sledding(time, lean, pull, air) {
  const shiver = Math.sin(time * 37) * 0.02
  add('LegL1', -1.35, 0.22 * OUT_L, 0, 1)
  add('LegR1', -1.35, 0.22 * OUT_R, 0, 1)
  add('LegL2', 0.55, 0, 0, 1)
  add('LegR2', 0.55, 0, 0, 1)
  add('Spine1', 0.12 + 0.35 * pull + shiver, lean * 0.22, -lean * 0.25, 1)
  add('Neck1', -0.1 - 0.25 * pull, -lean * 0.1, 0, 1)
  add('ArmL1', lerp(-0.35, -2.2, air), lerp(0.5, 1.2, air) * OUT_L, 0, 1)
  add('ArmR1', lerp(-0.35, -2.2, air), lerp(0.5, 1.2, air) * OUT_R, 0, 1)
  add('ArmL2', -0.5, 0, 0, 1)
  add('ArmR2', -0.5, 0, 0, 1)
  pose.lift -= SIT_DROP + 0.18
}


/** The win dance: fists punching the air in turn, hips swinging, bouncing to the beat. */
function dancing(time, w) {
  const beat = time * 7
  const a = Math.sin(beat)
  const sway = Math.sin(beat * 0.5)
  add('ArmL1', -2.5 + a * 0.55, 0.32 * OUT_L, 0, w)
  add('ArmR1', -2.5 - a * 0.55, 0.32 * OUT_R, 0, w)
  add('ArmL2', -0.35 - Math.max(0, a) * 0.9, 0, 0, w)
  add('ArmR2', -0.35 - Math.max(0, -a) * 0.9, 0, 0, w)
  add('Spine1', 0.06, sway * 0.16, sway * 0.3, w)
  add('Neck1', -0.1, -sway * 0.12, 0, w)
  add('LegL1', -0.35 * Math.max(0, a), 0.1 * OUT_L, 0, w)
  add('LegR1', -0.35 * Math.max(0, -a), 0.1 * OUT_R, 0, w)
  add('LegL2', 0.6 * Math.max(0, a), 0, 0, w)
  add('LegR2', 0.6 * Math.max(0, -a), 0, 0, w)
  pose.lift += Math.abs(a) * 0.14 * w
}

/**
 * @param {{ time?: number, speed?: number, maxSpeed?: number, grounded?: boolean,
 *   vy?: number, stride?: number, riding?: boolean, lean?: number, pull?: number,
 *   air?: number, cheer?: number, dance?: number }} motion
 *   `riding` sits you on your sled: `lean` (-1..1) into the turns, `pull` (0-1) back
 *   against the slingshot's band, `air` (0-1) in the air, `cheer` (0-1) arms up at the
 *   end. Otherwise you stand, walk or jump, and `dance` (0-1) is the win dance.
 */
export function computePose(motion) {
  const {
    time = 0,
    speed = 0,
    maxSpeed = 6,
    grounded = true,
    vy = 0,
    stride: phase = time * 5,
    riding = false,
    lean = 0,
    pull = 0,
    air = 0,
    cheer = 0,
    dance = 0,
  } = motion
  for (const name of POSED_BONES) {
    const b = pose.bones[name]
    b.swing = 0
    b.sway = 0
    b.twist = 0
  }
  pose.lift = 0

  if (riding) {
    sledding(time, lean, pull, air)
    if (cheer > 0) {
      add('ArmL1', -2.1 * cheer, 0, 0, 1)
      add('ArmR1', -2.1 * cheer, 0, 0, 1)
      add('ArmL1', Math.sin(time * 10) * 0.25 * cheer, 0, 0, 1)
    }
    return pose
  }
  if (grounded) {
    const ratio = clamp01(speed / Math.max(maxSpeed, 0.001))
    const still = (1 - smooth(0.05, 0.4, ratio)) * (1 - dance)
    stance(still, time)
    if (still > 0.01) grooving(time, still)
    if (ratio > 0.02) stride(phase, ratio)
    if (dance > 0) dancing(time, dance)
  } else {
    airborne(vy)
  }
  return pose
}
