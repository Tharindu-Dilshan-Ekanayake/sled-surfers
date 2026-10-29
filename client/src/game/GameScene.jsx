import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WebGLRenderer } from 'three'

import { WORLDS } from '@shared/balance'

import { useBloxity } from '../bloxity/BloxityContext'
import { useGame } from '../store/game'
import { useQuality } from '../store/quality'
import ErrorBoundary from '../ui/ErrorBoundary'
import BlobShadows from './BlobShadows'
import ChatBubbles from './ChatBubbles'
import FollowCamera from './FollowCamera'
import Particles from './fx/Particles'
import { updatePopups } from './fx/popups'
import SpeedFX from './fx/SpeedFX'
import SpeedLines from './fx/SpeedLines'
import WorldLabels from './labels/WorldLabels'
import Lighting from './Lighting'
import PerfProbe from './PerfProbe'
import Player from './Player'
import RemoteAvatars from './remote/RemoteAvatars'
import RemotePlayers from './remote/RemotePlayers'
import ShaderWarmup from './ShaderWarmup'
import { SKY } from './sceneStyle'
import { renderIcons3d } from './icons3d'
import { setBaseFov } from './runtime'
import { applyWorldLook } from './worldLook'
import Sky from './Sky'
import { attachIconRenderer, processIconQueue } from './sleds/sledIcons'
import Snowfall from './Snowfall'
import Slingshot from './Slingshot'
import Trail from './Trail'
import Leaderboards from './world/Leaderboards'
import Pedestals from './world/Pedestals'
import World from './world/World'

// r3f-perf is a dev-only overlay (?perf in the URL). The DEV check is static, so the
// import and the package are dropped from production builds entirely.
const DevPerf = import.meta.env.DEV
  ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
  : null
const showDevPerf = import.meta.env.DEV && new URLSearchParams(window.location.search).has('perf')

// The slide down the mountain is its own chunk, fetched once the lobby is on screen so
// it never delays time-to-playable.
const Slide = lazy(() => import('./ride/Slide'))

/** The longest the loading screen waits for your avatar before the game opens anyway. */
const AVATAR_WAIT_MS = 10000

/**
 * The scene's start-up, in a component of its own so each step re-renders only this,
 * not the whole scene (seconds of work on a slow phone): every shader compiled
 * (ShaderWarmup - last in the scene, so everything's in it), then the first real frame
 * drawn (`onSceneIn`), then the slide down the mountain, fetched only now so it never
 * delays time-to-playable.
 */
function StartUp({ onSceneIn }) {
  const world = useGame((s) => s.profile.world)
  const [warmedUp, setWarmedUp] = useState(false)
  const [firstFrame, setFirstFrame] = useState(false)
  const handleWarmedUp = useCallback(() => setWarmedUp(true), [])
  const handleFirstFrame = useCallback(() => setFirstFrame(true), [])
  return (
    <>
      {warmedUp && firstFrame && (
        <Suspense fallback={null}>
          {/* Built afresh for each world's slide (the ticker switches it first). */}
          <Slide key={world} />
        </Suspense>
      )}
      <ShaderWarmup onDone={handleWarmedUp} />
      {warmedUp && <FirstFrameSignal onFirstFrame={handleFirstFrame} onFirstFrameNow={onSceneIn} />}
    </>
  )
}

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * "Ready" should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame, onFirstFrameNow }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    performance.mark('pp:first-frame')
    // Right away, what touches no React state (it may open the game); the rest deferred:
    // never update React state from inside the frame loop.
    onFirstFrameNow?.()
    setTimeout(onFirstFrame, 0)
  })
  return null
}

/** Boxity's ad breaks: the scene stops drawing (and moving) until the ad is over. */
function PauseForAds() {
  const paused = useGame((s) => s.paused)
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    setFrameloop(paused ? 'never' : 'always')
  }, [paused, setFrameloop])
  return null
}

/**
 * Pictures made with the game's own renderer: the HUD's glossy 3D icons once at start-up
 * (a few an animation frame, while the loading screen is still up), and the SLEDS
 * panel's portraits a couple a frame as they're asked for.
 */
function SledIcons() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    attachIconRenderer(gl)
    renderIcons3d(gl, requestAnimationFrame)
  }, [gl])
  useFrame(() => processIconQueue(2))
  return null
}

/** Moves the floating words (BOOST!, SMASH!, NEW BEST!, the coins on returning) - DOM styles only. */
function PopupDriver() {
  useFrame(({ camera, size }) => updatePopups(camera, size.width, size.height))
  return null
}

/**
 * A screen taller than it's wide (a phone held upright) gets a wider view: with the
 * landscape field of view it would see only a narrow slice of the slide and the lobby.
 */
function ScreenFit() {
  const size = useThree((s) => s.size)
  // FollowCamera eases the camera to it (and wider still as you speed up).
  useEffect(() => setBaseFov(size.width / Math.max(1, size.height)), [size])
  return null
}

/** The sky behind everything: the world's horizon, whatever the canvas shows past the sky dome. */
function ClearColor({ color }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => gl.setClearColor(color), [gl, color])
  return null
}

/** Keeps the camera's far plane in step with the preset's view distance. */
function ViewDistance({ far }) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const { camera } = get()
    camera.far = far
    camera.updateProjectionMatrix()
  }, [get, far])
  return null
}

/**
 * The 3D view. Owns the renderer lifecycle: quality-driven settings, automatic preset
 * drops when FPS falls under budget, and recovery from a lost WebGL context.
 *
 * @param {{ onReady?: () => void }} props called once the avatar is in and a frame
 *   has been drawn
 */
export function GameScene({ onReady }) {
  const { game } = useBloxity()
  const settings = useQuality((s) => s.settings)
  // The world's look (worldLook.js): applied before the lobby, sky and light below are
  // built from it, and they're rebuilt (keyed by world) when you change worlds.
  const worldId = useGame((s) => WORLDS[s.profile.world]?.id ?? WORLDS[0].id)
  const look = useMemo(() => applyWorldLook(worldId), [worldId])
  const antialias = useQuality((s) => s.antialias)
  const degrade = useQuality((s) => s.degrade)

  const [contextKey, setContextKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  const readySent = useRef(false)

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  // Playable once every shader is compiled, the first real frame is drawn and your
  // Bloxity avatar is in, dressed: the game opens with it, never a stand-in - unless the
  // avatar CDN can't deliver it in AVATAR_WAIT_MS, which mustn't hold the game up.
  // Refs, not state: none of it should re-render the whole scene.
  const sceneIn = useRef(false)
  const avatarIn = useRef(false)
  // Called from the frame loop too (the first frame drawn), so the loading screen goes
  // the moment the game's there; App's state is set after it.
  const sendReady = useCallback(() => {
    if (readySent.current || !sceneIn.current || !avatarIn.current) return
    readySent.current = true
    performance.mark('pp:ready')
    game.loadingEnd()
    setTimeout(() => onReady?.(), 0)
  }, [game, onReady])
  const handleAvatarReady = useCallback(() => {
    avatarIn.current = true
    sendReady()
  }, [sendReady])
  useEffect(() => {
    const id = setTimeout(handleAvatarReady, AVATAR_WAIT_MS)
    return () => clearTimeout(id)
  }, [handleAvatarReady])
  const handleSceneIn = useCallback(() => {
    sceneIn.current = true
    sendReady()
  }, [sendReady])

  // A lost context (GPU reset, too many tabs, backgrounded on mobile) is recovered by
  // remounting the canvas, which builds a fresh context and re-uploads everything.
  // Game state lives in stores, so nothing is lost but a moment of rendering.
  const handleCreated = useCallback(({ gl }) => {
    performance.mark('pp:gl-created')
    gl.setClearColor(SKY.horizon)
    // Checking every program's compile status forces the driver to finish it on the
    // spot. Worth it while developing; in production it only costs start-up time.
    gl.debug.checkShaderErrors = import.meta.env.DEV
    const canvas = gl.domElement
    let remountTimer = null
    const remount = () => {
      clearTimeout(remountTimer)
      setContextLost(false)
      setContextKey((k) => k + 1)
    }
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      setContextLost(true)
      // Don't wait forever for a 'restored' that may never come.
      remountTimer = setTimeout(remount, 1500)
    })
    canvas.addEventListener('webglcontextrestored', remount)
  }, [])

  // Never set state from the monitor's frame callback directly.
  const handleDecline = useCallback(() => setTimeout(degrade, 0), [degrade])

  const dpr = Math.min(settings.dpr, window.devicePixelRatio || 1)

  // The renderer is built here rather than by R3F so its creation (the WebGL context,
  // often the slowest single step of start-up) is measured, and so the canvas is opaque:
  // the sky covers it anyway, and an opaque canvas is cheaper for the browser to
  // composite.
  const createRenderer = useMemo(
    () => (defaults) => {
      performance.mark('pp:gl-start')
      const renderer = new WebGLRenderer({
        ...defaults,
        alpha: false,
        antialias,
        stencil: false,
        powerPreference: 'high-performance',
      })
      performance.mark('pp:gl-end')
      return renderer
    },
    [antialias],
  )

  return (
    <>
      <Canvas
        key={contextKey}
        dpr={dpr}
        gl={createRenderer}
        // PCF, not R3F's default "soft": three r18x removed PCFSoftShadowMap.
        shadows={settings.shadows === 'realtime' ? 'percentage' : false}
        // No tone mapping. The default (ACES) desaturates the toy colours; the palette
        // and light levels in sceneStyle.js are chosen to look right without it.
        flat
        camera={{ position: [0, 6, 26], fov: 60, near: 0.5, far: settings.viewDistance }}
        onCreated={handleCreated}
      >
        <fog attach="fog" args={[look.sky.horizon, settings.fogNear, settings.viewDistance * 0.95]} />
        <ClearColor color={look.sky.horizon} />
        <ViewDistance far={settings.viewDistance} />
        <ScreenFit />
        <PerformanceMonitor bounds={() => [45, Infinity]} onDecline={handleDecline} />

        <Sky clouds={look.clouds} />
        <Lighting lights={look.lights} />
        <World key={worldId} />
        <WorldLabels />
        <Pedestals />
        <Slingshot />
        <Leaderboards />
        <Particles />
        {settings.particles && <SpeedFX />}
        {settings.particles && <SpeedLines />}
        <RemotePlayers />
        <RemoteAvatars />
        <Player onAvatarReady={handleAvatarReady} />
        <Trail />
        <Snowfall weather={look.weather} />
        <ChatBubbles />
        <PauseForAds />
        <BlobShadows />
        <SledIcons />
        <PopupDriver />

        <FollowCamera />
        <StartUp onSceneIn={handleSceneIn} />
        <PerfProbe />
        {showDevPerf && DevPerf && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <DevPerf position="bottom-right" minimal />
            </Suspense>
          </ErrorBoundary>
        )}
      </Canvas>

      {contextLost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-sky-400/80 text-2xl text-white">
          <span className="pp-stroke">Reloading graphics…</span>
        </div>
      )}
    </>
  )
}

export default GameScene
