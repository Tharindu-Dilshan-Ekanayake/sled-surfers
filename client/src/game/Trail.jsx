import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, ShaderMaterial, Vector3 } from 'three'

import { TRAILS } from '@shared/balance'

import { getGame } from '../store/game'
import { ride } from './ride/rideControl'
import { runtime } from './runtime'

/** How long a bit of trail hangs in the air before it's gone (ms). */
const LIFE_MS = 1000
/** The most points along it, and how often a new one's laid (ms). */
const POINTS = 40
const EVERY_MS = 1000 / 30
/** The one ribbon behind you: how wide, and how high it floats. */
const WIDTH_RIDING = 0.95
const WIDTH_WALKING = 0.45
const HEIGHT_RIDING = 0.55
const HEIGHT_WALKING = 0.95
/** Vertices along the ribbon. */
const VERTS = POINTS * 2

const vertexShader = /* glsl */ `
  attribute vec4 aColor;
  attribute float aAcross;
  attribute float aAlong;
  varying vec4 vColor;
  varying float vAcross;
  varying float vAlong;
  void main() {
    vColor = aColor;
    vAcross = aAcross;
    vAlong = aAlong;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec4 vColor;
  varying float vAcross;
  varying float vAlong;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    // Soft across: a white-hot core fading out to feathered edges.
    float d = abs(vAcross - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.3, 1.0, d);
    float core = 1.0 - smoothstep(0.0, 0.4, d);
    // Waves of light flowing back along it, and sparkles twinkling in it.
    float wave = 0.82 + 0.18 * sin(vAlong * 40.0 - uTime * 14.0);
    vec2 cell = floor(vec2(vAlong * 70.0, vAcross * 4.0));
    float twinkle = step(0.93, hash(cell + floor(uTime * 10.0))) * (1.0 - d) * (1.0 - vAlong);
    vec3 col = mix(vColor.rgb * wave, vec3(1.0), core * 0.5 + twinkle);
    gl_FragColor = vec4(col, vColor.a * edge * (0.85 + 0.15 * wave) + twinkle * 0.4);
  }
`

const _color = new Color()
const _white = new Color('#ffffff')
const _dir = new Vector3()
const _toCam = new Vector3()
const _side = new Vector3()

/**
 * The trail streaming out behind you through the air - down the slide and as you walk
 * about the lobby - as one glowing ribbon in your trail's colour (the rainbow one cycles
 * through them all): a white-hot core feathering out to soft edges, waves of light
 * flowing back along it and sparkles twinkling in it. Each bit lasts LIFE_MS, about a second: it thins and fades out
 * behind you, and it's gone a moment after you stop. The ribbon turns to face the
 * camera, so it never shows edge-on.
 *
 * One mesh whose vertices are rewritten each frame from a ring of the places you've been
 * (with when): nothing allocated per frame.
 */
export default function Trail() {
  const mesh = useMemo(() => {
    const geometry = new BufferGeometry()
    const index = []
    for (let i = 0; i < POINTS - 1; i += 1) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(VERTS * 3), 3))
    geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(VERTS * 4), 4))
    // Where each vertex is across the ribbon (0 one edge, 1 the other) and along it (0 at you).
    const across = new Float32Array(VERTS)
    const along = new Float32Array(VERTS)
    for (let i = 0; i < POINTS; i += 1) {
      across[i * 2 + 1] = 1
      along[i * 2] = along[i * 2 + 1] = i / (POINTS - 1)
    }
    geometry.setAttribute('aAcross', new BufferAttribute(across, 1))
    geometry.setAttribute('aAlong', new BufferAttribute(along, 1))
    geometry.setIndex(index)
    // Plain blending, not additive: the Black and White trails must show on snow and sky too.
    const material = new ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: DoubleSide })
    const ribbon = new Mesh(geometry, material)
    ribbon.frustumCulled = false
    ribbon.renderOrder = 2
    return ribbon
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
    },
    [mesh],
  )
  const meshRef = useRef(null)
  /** Where you've been, newest first, and when (performance.now()). */
  const ring = useRef({ points: Array.from({ length: POINTS }, () => new Vector3()), times: new Float64Array(POINTS), count: 0, lastAt: 0 })

  useFrame((state) => {
    const ribbon = meshRef.current
    if (!ribbon) return
    const now = performance.now()
    const riding = ride.active && ride.phase !== 'pull'
    const at = riding ? ride.position : runtime.player.position
    const lift = riding ? HEIGHT_RIDING : HEIGHT_WALKING
    const r = ring.current
    // A jump back to the lobby (or onto the slingshot) starts a new trail.
    if (r.count > 0 && r.points[0].distanceToSquared(at) > 400) r.count = 0
    if (now - r.lastAt >= EVERY_MS || r.count === 0) {
      // Shift the ring: newest first, the oldest point reused.
      const oldest = r.points[POINTS - 1]
      for (let i = POINTS - 1; i > 0; i -= 1) {
        r.points[i] = r.points[i - 1]
        r.times[i] = r.times[i - 1]
      }
      r.points[0] = oldest.set(at.x, at.y + lift, at.z)
      r.times[0] = now
      r.count = Math.min(POINTS, r.count + 1)
      r.lastAt = now
    } else {
      // Between new points, the head follows you exactly.
      r.points[0].set(at.x, at.y + lift, at.z)
    }
    // Gone: what's older than LIFE_MS.
    while (r.count > 0 && now - r.times[r.count - 1] > LIFE_MS) r.count -= 1

    const trail = TRAILS[getGame().profile.trail] ?? TRAILS.red
    const width = riding ? WIDTH_RIDING : WIDTH_WALKING
    const t = state.clock.elapsedTime
    const cam = state.camera.position
    const positions = ribbon.geometry.attributes.position.array
    const colors = ribbon.geometry.attributes.aColor.array
    ribbon.material.uniforms.uTime.value = t
    for (let i = 0; i < POINTS; i += 1) {
      const live = i < r.count
      const last = Math.max(0, r.count - 1)
      const p = r.points[Math.min(i, last)]
      const q = r.points[Math.min(i + 1, last)]
      _dir.subVectors(p, q)
      if (_dir.lengthSq() < 1e-8) _dir.set(0, 0, 1)
      // Fresh at your back, thinning and fading as it ages.
      const age = live ? Math.min(1, (now - r.times[i]) / LIFE_MS) : 1
      const fresh = 1 - age
      if (trail.rainbow) _color.setHSL((t * 0.5 + i / POINTS) % 1, 0.95, 0.55)
      else _color.set(trail.color)
      // A hint of white right at your back, the trail's own colour behind.
      const hot = fresh > 0.85 ? (fresh - 0.85) * 2 : 0
      const alpha = live ? Math.min(1, fresh * 1.25) * 0.95 : 0
      // Across the ribbon: square to the way you went and to the camera.
      _toCam.subVectors(cam, p)
      _side.crossVectors(_dir, _toCam)
      if (_side.lengthSq() < 1e-8) _side.set(0, 1, 0)
      _side.normalize().multiplyScalar(width * 0.5 * (0.15 + 0.85 * fresh))
      const o = i * 2 * 3
      positions[o] = p.x + _side.x
      positions[o + 1] = p.y + _side.y
      positions[o + 2] = p.z + _side.z
      positions[o + 3] = p.x - _side.x
      positions[o + 4] = p.y - _side.y
      positions[o + 5] = p.z - _side.z
      const c = i * 2 * 4
      colors[c] = colors[c + 4] = _color.r + (_white.r - _color.r) * hot
      colors[c + 1] = colors[c + 5] = _color.g + (_white.g - _color.g) * hot
      colors[c + 2] = colors[c + 6] = _color.b + (_white.b - _color.b) * hot
      colors[c + 3] = colors[c + 7] = alpha
    }
    ribbon.geometry.attributes.position.needsUpdate = true
    ribbon.geometry.attributes.aColor.needsUpdate = true
  })

  return <primitive ref={meshRef} object={mesh} />
}
