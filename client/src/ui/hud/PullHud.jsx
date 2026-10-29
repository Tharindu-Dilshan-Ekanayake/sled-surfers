import { useEffect, useRef } from 'react'

import { holdBand, leaveSlingshot, ride } from '../../game/ride/rideControl'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { CloseButton } from '../panels/Panel'
import { u } from './style'

/**
 * On the slingshot, as in the reference: the power bar along the top filling as you
 * pull, "PULL" with a pointing hand while you haven't, "LET GO!" once it's full, and the
 * red X to get off. The whole screen is the band: hold anywhere (or SPACE) to pull,
 * let go to fly. The bar and the words are moved by a timer, not by React renders.
 */
export function PullHud() {
  const fillRef = useRef(null)
  const pullRef = useRef(null)
  const letGoRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => {
      const p = ride.power
      if (fillRef.current) fillRef.current.style.width = `${Math.round(p * 100)}%`
      if (pullRef.current) pullRef.current.style.display = ride.holding ? 'none' : 'flex'
      if (letGoRef.current) letGoRef.current.style.display = ride.holding && p > 0.6 ? 'block' : 'none'
    }, 50)
    return () => {
      clearInterval(id)
      holdBand(false)
    }
  }, [])

  return (
    <>
      <div
        className="pointer-events-auto absolute inset-0 touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          holdBand(true)
        }}
        onPointerUp={() => holdBand(false)}
        onPointerCancel={() => holdBand(false)}
      />
      <div
        className="pointer-events-none absolute left-1/2 overflow-hidden"
        style={{ top: u(110), transform: 'translateX(-50%)', width: u(400), height: u(64), padding: u(6), background: '#1f2d6b', border: `${u(5)} solid #e8eef6`, borderRadius: u(40), boxShadow: `0 0 0 ${u(4)} #14214a` }}
      >
        <div ref={fillRef} style={{ width: '0%', height: '100%', borderRadius: u(30), background: 'linear-gradient(90deg, #ffd23a 0%, #ff8a1c 60%, #ff3b3b 100%)' }} />
      </div>
      <div ref={pullRef} className="pointer-events-none absolute left-1/2 flex flex-col items-center" style={{ top: '50%', transform: 'translateX(-50%)', fontSize: u(70) }}>
        <div className="pp-bounce">
          <Icon name="hand" size={u(84)} />
        </div>
        <span className="flex items-center" style={{ gap: u(8) }}>
          <StrokeText stroke={u(12)}>PULL</StrokeText>
          <Icon name="arrowDown" size={u(70)} />
        </span>
      </div>
      <div ref={letGoRef} className="pp-pulse pointer-events-none absolute left-1/2" style={{ display: 'none', top: '62%', transform: 'translateX(-50%)', fontSize: u(90) }}>
        <StrokeText stroke={u(14)}>LET GO!</StrokeText>
      </div>
      <CloseButton onClick={leaveSlingshot} style={{ right: u(28), top: u(64) }} />
    </>
  )
}

export default PullHud
