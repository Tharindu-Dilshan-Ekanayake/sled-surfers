import { useEffect, useState } from 'react'

import { COURSE as COURSE_RULES } from '@shared/balance'
import { stageAt, stageStart } from '@shared/course'
import { formatNumber } from '@shared/format'

import { COURSE, WORLD } from '../../game/ride/course'
import { endRide, ride } from '../../game/ride/rideControl'
import { stageTheme } from '../../game/ride/stages'
import { runtime } from '../../game/runtime'
import { sfx } from '../../audio/sfx'
import { useClearTop } from '../../bloxity/reserved'
import { remotePlayers } from '../../net/remotePlayers'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { u } from './style'

/** The speedometer's dial runs to this. */
const DIAL_MPH = 180

/** The furthest stage reached this ride, and when it was entered (for its banner). */
const stageSeen = { n: -1, at: 0 }

/** What the ride HUD shows, read from the ride ten times a second (never per frame). */
function snapshot() {
  const sim = ride.sim
  const now = performance.now()
  const riders = []
  for (const r of remotePlayers.values()) if (r.riding) riders.push({ id: r.sessionId, name: r.name, s: r.shownMeter })
  if (!sim || sim.s < 5) stageSeen.n = -1
  else if (stageAt(sim.s) > stageSeen.n) {
    stageSeen.n = stageAt(sim.s)
    stageSeen.at = now
    // A chime for each new stage (not the first: you've only just launched).
    if (stageSeen.n > 0) sfx.stage()
  }
  return {
    stage: stageSeen.n >= 0 && now - stageSeen.at < 2600 ? stageSeen.at : 0,
    stageN: stageSeen.n,
    s: sim ? Math.max(0, Math.min(COURSE.length, sim.s)) : 0,
    mph: Math.round(ride.mph ?? 0),
    earned: ride.earned,
    spare: sim ? sim.cans : 0,
    fuel: sim ? sim.fuel : 0,
    burning: Boolean(sim?.burning),
    finish: now - ride.finishAt < 2600 ? ride.finishAt : 0,
    riders,
  }
}

function useRide(ms = 100) {
  const [snap, setSnap] = useState(snapshot)
  useEffect(() => {
    const id = setInterval(() => setSnap(snapshot()), ms)
    return () => clearInterval(id)
  }, [ms])
  return snap
}

/** The speedometer, bottom-left: a dial of ticks lighting up with your speed, MPH in the middle. */
function Speedometer({ mph }) {
  const ticks = 22
  const lit = Math.round((Math.min(DIAL_MPH, mph) / DIAL_MPH) * ticks)
  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: u(200), height: u(200), borderRadius: '50%', background: '#2b3c78', border: `${u(6)} solid #14214a` }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
        {Array.from({ length: ticks }, (_, i) => {
          const a = (-225 + (270 * i) / (ticks - 1)) * (Math.PI / 180)
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * 36}
              y1={50 + Math.sin(a) * 36}
              x2={50 + Math.cos(a) * 44}
              y2={50 + Math.sin(a) * 44}
              stroke={i < lit ? '#5fd2ff' : '#40518c'}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          )
        })}
      </svg>
      <span style={{ fontSize: u(70), lineHeight: 1, marginTop: u(-34) }}>
        <StrokeText stroke={u(10)}>{mph}</StrokeText>
      </span>
      <span style={{ fontSize: u(28) }}>
        <StrokeText stroke={u(6)}>MPH</StrokeText>
      </span>
    </div>
  )
}

/** The rocket: SHIFT (or the button) burns a fuel can; the bar is what's left of this one. */
function Rocket({ mph, spare, fuel, burning }) {
  const can = spare > 0 || fuel > 0
  return (
    <div className="pointer-events-none absolute" style={{ left: u(28), bottom: u(52) }}>
      <Speedometer mph={mph} />
      <button
        type="button"
        aria-label="Rocket"
        className="pp-btn pointer-events-auto absolute flex flex-col items-center justify-center rounded-full"
        style={{ left: u(52), bottom: u(-46), width: u(96), height: u(96), background: can ? 'radial-gradient(circle at 40% 35%, #ffb86b, #ff6a00 70%)' : '#7d858e', border: `${u(5)} solid #14214a`, filter: burning ? 'brightness(1.3)' : 'none' }}
        onPointerDown={(e) => {
          e.preventDefault()
          runtime.input.rocket = true
        }}
        onPointerUp={() => {
          runtime.input.rocket = false
        }}
        onPointerLeave={() => {
          runtime.input.rocket = false
        }}
      >
        <Icon name="rocket" size={u(52)} />
        {/* The key, on a keyboard; a touchscreen has its own big ROCKET button (TouchControls). */}
        {!touchDevice() && (
          <span style={{ fontSize: u(18), marginTop: u(-6) }}>
            <StrokeText stroke={u(4)}>SHIFT</StrokeText>
          </span>
        )}
      </button>
      <div className="absolute flex flex-col items-center" style={{ left: u(214), bottom: u(4), gap: u(4) }}>
        <span style={{ fontSize: u(30) }}>
          <StrokeText stroke={u(6)}>{spare}</StrokeText>
        </span>
        <Icon name="fuel" size={u(40)} />
        <div className="relative overflow-hidden" style={{ width: u(36), height: u(190), background: '#2b3c78', border: `${u(4)} solid #14214a`, borderRadius: u(12) }}>
          <div className="absolute bottom-0 left-0 right-0" style={{ height: `${Math.round(fuel * 100)}%`, background: 'linear-gradient(180deg, #ffd23a 0%, #ff6a00 100%)' }} />
        </div>
      </div>
    </div>
  )
}

const initials = (name) => (name || '?').slice(0, 1).toUpperCase()
const hue = (text) => {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

/** The progress bar up the right: the flag at the top, the Diamonds on the way, you and everyone else riding. */
function Progress({ s, riders }) {
  const name = useGame((st) => st.profile.name)
  const best = useGame((st) => st.profile.best[WORLD] ?? 0)
  const length = COURSE.length
  const at = (m) => `${(1 - Math.min(1, m / length)) * 100}%`
  const pct = Math.floor((s / length) * 100)
  return (
    <div className="pointer-events-none absolute" style={{ right: u(40), top: u(240), height: u(470), width: u(40) }}>
      <Icon name="flag" size={u(46)} style={{ position: 'absolute', top: u(-50), left: u(4) }} />
      <div className="absolute" style={{ left: u(10), top: 0, bottom: 0, width: u(22), background: '#e8eef6', border: `${u(4)} solid #14214a`, borderRadius: u(12) }} />
      {COURSE_RULES.diamonds
        .filter((d) => d < length)
        .map((d) => (
          <Icon key={d} name="diamond" size={u(30)} style={{ position: 'absolute', left: u(6), top: at(d), transform: 'translateY(-50%)' }} />
        ))}
      {best > 0 && <Icon name="starGold" size={u(36)} style={{ position: 'absolute', left: u(-30), top: at(best), transform: 'translateY(-50%)' }} />}
      {riders.map((r) => (
        <span
          key={r.id}
          className="absolute flex items-center justify-center rounded-full"
          title={r.name}
          style={{ right: u(46), top: at(r.s), transform: 'translateY(-50%)', width: u(46), height: u(46), background: `hsl(${hue(r.name)} 70% 55%)`, border: `${u(4)} solid #fff`, fontSize: u(24) }}
        >
          <StrokeText stroke={u(5)}>{initials(r.name)}</StrokeText>
        </span>
      ))}
      <div className="absolute flex flex-col items-center" style={{ right: u(40), top: at(s), transform: 'translateY(-50%)' }}>
        <span className="flex items-center justify-center rounded-full" style={{ width: u(62), height: u(62), background: 'linear-gradient(180deg, #ffd23a, #ff9a12)', border: `${u(5)} solid #fff`, fontSize: u(30) }}>
          <StrokeText stroke={u(6)}>{initials(name)}</StrokeText>
        </span>
        <span style={{ fontSize: u(24), padding: `0 ${u(8)}`, background: '#2b3c78', borderRadius: u(10) }}>
          <StrokeText stroke={u(5)}>{pct}%</StrokeText>
        </span>
      </div>
    </div>
  )
}

/**
 * BOOST!, SMASH!, NEW BEST!, FINISH!: small, floating up from just above your sled's
 * head, so the track ahead and the walls on it stay clear to see.
 */
function Banner({ id, text, gradient, top = '47%', size = 34 }) {
  if (!id) return null
  return (
    <div key={id} className="pp-banner pointer-events-none absolute left-1/2" style={{ top, fontSize: u(size) }}>
      <StrokeText stroke={u(8)} gradient={gradient}>
        {text}
      </StrokeText>
    </div>
  )
}

/** The keys, along the bottom on a keyboard: A D to steer, SPACE to jump, SHIFT for the rocket. */
function KeyHints() {
  const key = (label, w = 64) => (
    <span className="flex items-center justify-center" style={{ minWidth: u(w), height: u(64), padding: `0 ${u(10)}`, background: '#fff', border: `${u(4)} solid #14214a`, borderRadius: u(12), color: '#14214a', fontSize: u(30) }}>
      {label}
    </span>
  )
  const group = (children) => (
    <span className="flex items-center" style={{ gap: u(8), padding: u(8), background: 'rgba(43,60,120,.85)', border: `${u(4)} solid #14214a`, borderRadius: u(20) }}>
      {children}
    </span>
  )
  return (
    <div className="pointer-events-none absolute left-1/2 flex" style={{ bottom: u(18), transform: 'translateX(-50%)', gap: u(30) }}>
      {group(
        <>
          {key('A')}
          {key('D')}
          <span style={{ fontSize: u(40), color: '#5ff07a' }}>◀▶</span>
        </>,
      )}
      {group(
        <>
          {key('SPACE', 150)}
          <span style={{ fontSize: u(40), color: '#5ff07a' }}>▲</span>
        </>,
      )}
      {group(
        <>
          {key('SHIFT', 130)}
          <Icon name="rocket" size={u(48)} />
        </>,
      )}
    </div>
  )
}

const touchDevice = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)

/**
 * Down the slide, as in the reference: the Coins this ride top-left, the metres (and
 * your best) top-centre, END top-right, the speedometer and the rocket bottom-left, the
 * progress bar up the right, the keys along the bottom, and BOOST! / SMASH! as they
 * happen.
 */
export function RideHud() {
  const snap = useRide()
  const best = useGame((s) => s.profile.best[WORLD] ?? 0)
  // Your first three rides: a tip on what makes you go further, as you set off.
  const firstRides = useGame((s) => (s.profile.stats?.rides ?? 0) < 3)
  // Under Boxity's toolbar and chat feed, top-left.
  const clear = useClearTop(0, 0.22)
  return (
    <>
      <div className="pointer-events-none absolute flex items-center" style={{ left: u(24), top: `calc(${u(clear ? 8 : 66)} + ${clear}px)`, height: u(70) }}>
        <div className="absolute flex items-center" style={{ left: u(36), height: u(56), width: u(240), paddingLeft: u(48), background: 'linear-gradient(90deg, rgba(255,196,30,.95), rgba(255,170,0,0))', borderRadius: u(8), fontSize: u(42) }}>
          <StrokeText stroke={u(8)}>+{formatNumber(snap.earned)}</StrokeText>
        </div>
        <Icon name="coin" size={u(76)} style={{ position: 'relative' }} />
      </div>
      <div className="pointer-events-none absolute left-1/2 flex flex-col items-center" style={{ top: u(100), transform: 'translateX(-50%)' }}>
        <span style={{ fontSize: u(78), lineHeight: 1 }}>
          <StrokeText stroke={u(12)}>{formatNumber(Math.floor(snap.s))}m</StrokeText>
        </span>
        <span className="flex items-center" style={{ fontSize: u(34), gap: u(6) }}>
          <Icon name="starGold" size={u(34)} />
          <StrokeText stroke={u(7)}>{formatNumber(Math.floor(best))}m</StrokeText>
        </span>
        {/* The stage you've just entered: a small pill under the distance, never over the slide. */}
        {snap.stage ? (
          <div key={snap.stage} className="pp-pill flex items-center" style={{ marginTop: u(10), gap: u(10), padding: `${u(6)} ${u(22)}`, background: 'rgba(20, 33, 74, 0.78)', border: `${u(4)} solid #fff`, borderRadius: u(22), fontSize: u(34), whiteSpace: 'nowrap' }}>
            <StrokeText stroke={u(6)} gradient="linear-gradient(180deg, #ffffff 0%, #dff3ff 45%, #7fc4ff 100%)">{`STAGE ${snap.stageN + 1}`}</StrokeText>
            <StrokeText stroke={u(6)} gradient="linear-gradient(180deg, #fffaa8 0%, #ffd52a 100%)">{stageTheme(stageStart(snap.stageN)).name}</StrokeText>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={endRide}
        className="pp-btn pp-chunky pointer-events-auto absolute flex items-center justify-center"
        style={{ right: u(18), top: u(64), width: u(200), height: u(78), background: 'linear-gradient(180deg, #ff6a5c 0%, #d4142a 100%)', border: `${u(5)} solid #6a0a12`, borderRadius: u(22), fontSize: u(48) }}
      >
        <StrokeText stroke={u(9)}>END</StrokeText>
      </button>
      <Rocket mph={snap.mph} spare={snap.spare} fuel={snap.fuel} burning={snap.burning} />
      <Progress s={snap.s} riders={snap.riders} />
      {!touchDevice() && <KeyHints />}
      {firstRides && snap.s < 90 && (
        <div className="pp-card-in pointer-events-none absolute left-1/2 flex items-center" style={{ bottom: u(120), transform: 'translateX(-50%)', gap: u(12), padding: `${u(10)} ${u(26)}`, background: 'rgba(20, 33, 74, 0.82)', border: `${u(4)} solid #fff`, borderRadius: u(24), fontSize: u(34), whiteSpace: 'nowrap' }}>
          <Icon name="boost" size={u(44)} />
          <StrokeText stroke={u(6)}>Hit the yellow BOOST pads, dodge the walls - and fire the ROCKET when you slow down!</StrokeText>
        </div>
      )}
      {/* Slowing down with fuel to spare: the rocket is what takes you further. */}
      {snap.s > 40 && snap.mph < 30 && !snap.burning && (snap.fuel > 0 || snap.spare > 0) && (
        <div className="pp-pulse pointer-events-none absolute left-1/2 flex items-center" style={{ bottom: u(120), transform: 'translateX(-50%)', gap: u(10), padding: `${u(8)} ${u(22)}`, background: 'linear-gradient(180deg, #ff9a3c, #e2442a)', border: `${u(4)} solid #fff`, borderRadius: u(22), fontSize: u(34), whiteSpace: 'nowrap' }}>
          <Icon name="rocket" size={u(44)} />
          <StrokeText stroke={u(6)}>Slowing down? Fire your ROCKET!</StrokeText>
        </div>
      )}
      <Banner id={snap.finish} text="FINISH!" gradient="linear-gradient(180deg, #fffaa8 0%, #ffd52a 45%, #ff9c00 100%)" top="21%" size={64} />
    </>
  )
}

export default RideHud
