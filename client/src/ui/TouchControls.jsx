import { useEffect, useRef, useState } from 'react'

import { runtime } from '../game/runtime'
import { useGame } from '../store/game'
import { GRADIENTS } from './hud/style'
import Icon from './Icon'

/** Joystick travel radius, in CSS pixels. */
const RADIUS = 56

function detectTouch() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
}

/** Which steer buttons are held, down the slide. */
const steering = { left: false, right: false }
const setSteer = (side) => (down) => {
  steering[side] = down
  runtime.input.steer = (steering.right ? 1 : 0) - (steering.left ? 1 : 0)
}

/** The chunky round look of the HUD's buttons, sized in CSS pixels. */
const roundButton = (size, background) => ({
  width: size,
  height: size,
  background,
  border: '4px solid #111',
})

/** A button that holds `set(true)` while pressed. */
function HoldButton({ label, style, set, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="pp-btn pp-chunky absolute z-20 flex touch-none items-center justify-center rounded-full text-white"
      style={style}
      onPointerDown={(e) => {
        e.preventDefault()
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onPointerLeave={() => set(false)}
    >
      <span className="pp-gloss" style={{ borderRadius: '40px 40px 20px 20px' }} />
      {children}
    </button>
  )
}

const arrow = (d) => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3.5">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * On-screen controls for touch devices, upright or sideways. In the lobby: a floating
 * joystick wherever the lower-left of the screen is touched, and a jump button. Down the
 * slide: hold the left or right half of the screen to steer, and a jump button (the rocket
 * is the ride HUD's). On the slingshot the whole screen is the band: see PullHud.
 *
 * Writes straight into `runtime.input` and moves the knob through refs, so dragging
 * never re-renders React.
 */
export function TouchControls() {
  const [isTouch, setIsTouch] = useState(detectTouch)
  const phase = useGame((s) => s.phase)
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const active = useRef({ id: null, x: 0, y: 0 })

  // A touchscreen laptop can start with a mouse; show the controls on first touch.
  useEffect(() => {
    if (isTouch) return undefined
    const onTouch = (e) => {
      if (e.pointerType === 'touch') setIsTouch(true)
    }
    window.addEventListener('pointerdown', onTouch)
    return () => window.removeEventListener('pointerdown', onTouch)
  }, [isTouch])

  useEffect(
    () => () => {
      Object.assign(runtime.input, { joyX: 0, joyY: 0, jump: false, steer: 0, rocket: false })
    },
    [],
  )

  if (!isTouch || phase === 'pull' || phase === 'result') return null

  if (phase === 'ride') {
    // Hold the left or right half of the screen to steer - whatever the phone's way up.
    // The ride HUD's own buttons (END, the rocket) sit above these and still get their taps.
    return (
      <>
        {['left', 'right'].map((side) => (
          <div
            key={side}
            aria-label={`Steer ${side}`}
            className="absolute bottom-0 z-10 touch-none"
            style={{ [side]: 0, width: '50%', height: '82%' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId)
              setSteer(side)(true)
            }}
            onPointerUp={() => setSteer(side)(false)}
            onPointerCancel={() => setSteer(side)(false)}
          >
            {/* A hint of which half steers which way, down at the bottom by your thumbs:
                right of the speedometer, left of the jump button. */}
            <span
              className="pointer-events-none absolute flex items-center justify-center rounded-full text-white/85"
              style={{ bottom: 22, [side]: side === 'left' ? 'max(150px, 16%)' : 130, width: 72, height: 72, background: 'rgba(20, 33, 74, 0.32)', border: '3px solid rgba(255,255,255,0.6)' }}
            >
              {arrow(side === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7')}
            </span>
          </div>
        ))}
        <HoldButton label="Jump" set={(down) => (runtime.input.jump = down)} style={{ ...roundButton(84, GRADIENTS.greenButton), right: 18, bottom: 18 }}>
          {arrow('M5 15l7-7 7 7')}
        </HoldButton>
        {/* The rocket, big and in reach of your right thumb (SHIFT on a keyboard). */}
        <HoldButton label="Rocket" set={(down) => (runtime.input.rocket = down)} style={{ ...roundButton(76, GRADIENTS.redButton), right: 26, bottom: 118 }}>
          <Icon name="rocket" size={46} />
        </HoldButton>
      </>
    )
  }

  const show = (x, y) => {
    const base = baseRef.current
    if (!base) return
    base.style.opacity = '1'
    base.style.left = `${x - RADIUS}px`
    base.style.top = `${y - RADIUS}px`
  }

  const onDown = (e) => {
    if (active.current.id !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    active.current = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top }
    show(active.current.x, active.current.y)
  }

  const onMove = (e) => {
    const a = active.current
    if (a.id !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    let dx = e.clientX - rect.left - a.x
    let dy = e.clientY - rect.top - a.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    // Unit direction times strength, with a small dead zone so a resting thumb
    // doesn't creep.
    const strength = Math.max(0, Math.min(len, RADIUS) / RADIUS - 0.08) / 0.92
    runtime.input.joyX = len > 0 ? (dx / Math.min(len, RADIUS)) * strength : 0
    runtime.input.joyY = len > 0 ? (-dy / Math.min(len, RADIUS)) * strength : 0
  }

  const onUp = (e) => {
    if (active.current.id !== e.pointerId) return
    active.current.id = null
    runtime.input.joyX = 0
    runtime.input.joyY = 0
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
    if (baseRef.current) baseRef.current.style.opacity = '0.35'
  }

  return (
    <>
      {/* Lifted clear of the upgrade cards when the phone is upright (index.css). */}
      <div className="pp-touch-lift absolute left-0 z-10 h-[62%] w-[50%] touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div
          ref={baseRef}
          className="pointer-events-none absolute rounded-full border-4 border-white/70 bg-black/25"
          style={{ width: RADIUS * 2, height: RADIUS * 2, opacity: 0.35, left: RADIUS * 0.6, top: `calc(100% - ${RADIUS * 2.3}px)` }}
        >
          <div ref={knobRef} className="absolute rounded-full border-4 border-black/40 bg-white/90 shadow-lg" style={{ width: RADIUS, height: RADIUS, left: RADIUS / 2, top: RADIUS / 2 }} />
        </div>
      </div>
      <HoldButton label="Jump" set={(down) => (runtime.input.jump = down)} style={{ ...roundButton(70, GRADIENTS.slate), right: 14, bottom: 'var(--touch-lift)' }}>
        {arrow('M5 15l7-7 7 7')}
      </HoldButton>
    </>
  )
}

export default TouchControls
