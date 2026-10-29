import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Mesh, PlaneGeometry, ShaderMaterial } from 'three'

import { ride } from '../ride/rideControl'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Straight onto the screen, whatever the camera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n * 91.345) * 47453.53);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= uAspect;
    float r = length(p);
    // Streaks: thin wedges round the screen, each dashing outward at its own pace,
    // about half of them lit at a time.
    float t = atan(p.y, p.x) / 6.2831853 * 90.0;
    float id = floor(t);
    float across = abs(fract(t) - 0.5) * 2.0;
    float width = 0.08 + 0.12 * hash(id + 3.0);
    float line = 1.0 - smoothstep(width * 0.5, width, across);
    float run = fract(r * 0.8 - uTime * (1.6 + hash(id) * 1.4) + hash(id + 7.0));
    float dash = smoothstep(0.0, 0.15, run) * (1.0 - smoothstep(0.35, 0.7, run));
    float streak = line * dash * smoothstep(0.4, 1.1, r) * step(0.4, hash(id + 11.0));
    // A soft haze over the edges: the blur of speed.
    float haze = smoothstep(0.65, 1.5, r) * 0.5;
    gl_FragColor = vec4(0.94, 0.97, 1.0, (streak * 0.85 + haze) * uAmount);
  }
`

/** How fast (real m/s) the lines start, and how much faster they're at full strength. */
const FROM = 14
const SPAN = 40

/**
 * The rush of speed down the slide: thin white streaks flying out along the edges of the
 * screen and a soft haze over them, stronger the faster you go and with a kick on a boost.
 * One full-screen quad, one draw call, only while riding; mounted on presets with
 * particles only (GameScene).
 */
export default function SpeedLines() {
  const mesh = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uAspect: { value: 1 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
    const quad = new Mesh(new PlaneGeometry(2, 2), material)
    quad.frustumCulled = false
    quad.renderOrder = 999
    quad.visible = false
    return quad
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
    },
    [mesh],
  )

  const ref = useRef(null)
  useFrame((state, delta) => {
    const quad = ref.current
    if (!quad) return
    const u = quad.material.uniforms
    const riding = ride.phase === 'ride' && ride.sim
    const boost = riding && performance.now() - ride.boostAt < 900 ? 0.35 : 0
    const want = riding ? Math.min(1, Math.max(0, (ride.speed - FROM) / SPAN) + boost) : 0
    u.uAmount.value += (want - u.uAmount.value) * (1 - Math.exp(-4 * Math.min(delta, 0.05)))
    u.uTime.value = state.clock.elapsedTime
    u.uAspect.value = state.size.width / Math.max(1, state.size.height)
    quad.visible = u.uAmount.value > 0.01
  })

  return <primitive ref={ref} object={mesh} />
}
