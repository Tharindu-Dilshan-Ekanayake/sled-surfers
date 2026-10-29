import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three'

import { mulberry32 } from '@shared/rng'

import { useQuality } from '../store/quality'

/** The box of snow that travels with the camera, in metres. */
const BOX = { x: 70, y: 36, z: 70 }

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform vec3 uCamera;
  uniform vec3 uBox;
  uniform float uScale;
  uniform float uFall;
  uniform float uDrift;
  varying float vAlpha;
  void main() {
    // Each flake falls at its own pace and sways on its own little loop; the box of
    // snow wraps round the camera, so it never runs out wherever you go.
    float fall = (1.4 + aSeed * 1.6) * uFall;
    vec3 p = position;
    p.y -= uTime * fall;
    p.x += sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * 0.9 + uTime * uDrift;
    p.z += cos(uTime * (0.5 + aSeed * 0.7) + aSeed * 17.0) * 0.7;
    vec3 rel = mod(p - uCamera + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = modelViewMatrix * vec4(uCamera + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    gl_PointSize = uScale * (1.0 + aSeed * 1.6) * (34.0 / max(d, 1.0));
    // Thin out right at the camera (no flakes in your face) and far off (into the fog).
    vAlpha = smoothstep(0.8, 3.0, d) * (1.0 - smoothstep(BOX_FADE * 0.6, BOX_FADE, d)) * (0.55 + 0.45 * aSeed);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    // A soft round flake.
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(c)) * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor, a * 0.9);
  }
`

/**
 * The world's weather falling everywhere, all the time - in the lobby and down the
 * slide: snow in World 1, as in the reference, blowing sand glints in World 2, embers
 * drifting up in World 3 (the `weather` prop: worldLook.js).
 * all of the motion in the vertex shader: the CPU only hands it the time and the camera.
 */
export default function Snowfall({ weather }) {
  const count = useQuality((s) => s.settings.snowCount)
  const dpr = useQuality((s) => s.settings.dpr)
  const pointsRef = useRef(null)

  const points = useMemo(() => {
    const rand = mulberry32(2024)
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = rand() * BOX.x
      positions[i * 3 + 1] = rand() * BOX.y
      positions[i * 3 + 2] = rand() * BOX.z
      seeds[i] = rand()
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCamera: { value: [0, 0, 0] },
        uBox: { value: [BOX.x, BOX.y, BOX.z] },
        uScale: { value: dpr * weather.size },
        uFall: { value: weather.fall },
        uDrift: { value: weather.drift },
        uColor: { value: new Color(weather.color) },
      },
      defines: { BOX_FADE: (BOX.z * 0.5).toFixed(1) },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const mesh = new Points(geometry, material)
    mesh.frustumCulled = false
    mesh.renderOrder = 3
    return mesh
  }, [count, dpr, weather])

  useEffect(
    () => () => {
      points.geometry.dispose()
      points.material.dispose()
    },
    [points],
  )

  useFrame((state) => {
    const mesh = pointsRef.current
    if (!mesh) return
    const u = mesh.material.uniforms
    u.uTime.value = state.clock.elapsedTime
    const p = state.camera.position
    // A plain array uniform: written in place, nothing allocated per frame.
    u.uCamera.value[0] = p.x
    u.uCamera.value[1] = p.y + BOX.y * 0.2
    u.uCamera.value[2] = p.z
  })

  return <primitive ref={pointsRef} object={points} />
}
