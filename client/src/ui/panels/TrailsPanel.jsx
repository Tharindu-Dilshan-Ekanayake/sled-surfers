import { useState } from 'react'

import { TRAILS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import { BrightPanel } from './Panel'

const RAINBOW = 'linear-gradient(90deg, #ff3b5c, #ff9a1f, #ffe53b, #4ef05a, #2fc6ff, #6a5cff, #ff4fd8)'

/** A trail's ribbon, swooping up behind a little sled. */
function Swoosh({ trail, size }) {
  const fill = trail.rainbow ? RAINBOW : `linear-gradient(90deg, ${trail.color}, ${trail.color})`
  return (
    <div className="relative" style={{ width: u(size), height: u(size * 0.62) }}>
      <div className="absolute" style={{ left: '4%', top: '18%', width: '74%', height: '42%', background: fill, clipPath: 'polygon(0 55%, 30% 10%, 60% 40%, 100% 0, 100% 45%, 60% 90%, 30% 60%, 0 100%)', border: '2px solid rgba(0,0,0,.25)' }} />
      <div className="absolute" style={{ right: '2%', bottom: '14%', width: '34%', height: '18%', background: 'linear-gradient(180deg, #5fb3ff, #1f6fd6)', borderRadius: '30%', border: '3px solid #14214a', transform: 'rotate(-12deg)' }} />
    </div>
  )
}

/**
 * The TRAILS panel, as in the reference: every trail with its Coin bonus, a big preview
 * of the one picked on the right, bought with Coins and worn with a tap.
 */
export default function TrailsPanel() {
  const profile = useGame((s) => s.profile)
  const [picked, setPicked] = useState(profile.trail)
  const trail = TRAILS[picked]
  const owned = profile.trails.includes(picked)
  const worn = profile.trail === picked
  const affordable = profile.coins >= trail.cost
  return (
    <BrightPanel title="TRAILS" header="linear-gradient(180deg, #b98bff 0%, #7a3fe6 100%)" width={1180}>
      <div className="flex" style={{ gap: u(22) }}>
        <div className="grid flex-1 grid-cols-3" style={{ gap: u(16) }}>
          {Object.entries(TRAILS).map(([id, t]) => {
            const have = profile.trails.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPicked(id)}
                className="pp-btn relative flex flex-col items-center"
                style={{ padding: u(8), background: '#f4f7fb', border: `${u(5)} solid ${picked === id ? '#3fd14a' : have ? '#8fd18a' : '#9aa9c9'}`, borderRadius: u(18) }}
              >
                {t.bonus > 0 && (
                  <span className="absolute flex items-center" style={{ right: u(8), top: u(6), gap: u(2), padding: `0 ${u(8)}`, background: '#ffd23a', border: `${u(3)} solid #e08a00`, borderRadius: u(14), fontSize: u(24) }}>
                    <Icon name="coin" size={u(24)} />
                    <StrokeText stroke={u(4)}>+{Math.round(t.bonus * 100)}%</StrokeText>
                  </span>
                )}
                <Swoosh trail={t} size={180} />
                <span className="flex w-full items-center justify-center" style={{ height: u(56), gap: u(6), background: profile.trail === id ? GRADIENTS.greenButton : GRADIENTS.greyButton, border: `${u(4)} solid #14214a`, borderRadius: u(12), fontSize: u(28) }}>
                  {profile.trail === id ? (
                    <Icon name="check" size={u(38)} />
                  ) : have ? (
                    <StrokeText stroke={u(5)}>OWNED</StrokeText>
                  ) : t.exclusive ? (
                    <StrokeText stroke={u(5)}>DAY 7 STREAK</StrokeText>
                  ) : (
                    <>
                      <Icon name="coin" size={u(30)} />
                      <StrokeText stroke={u(5)}>{formatNumber(t.cost)}</StrokeText>
                    </>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col items-center" style={{ width: u(330), padding: u(16), gap: u(14), background: '#dfe8f6', border: `${u(4)} solid #c3cfe6`, borderRadius: u(22) }}>
          <span style={{ fontSize: u(46) }}>
            <StrokeText stroke={u(8)}>{trail.name}</StrokeText>
          </span>
          <div className="flex w-full items-center justify-center" style={{ height: u(240), background: '#f4f7fb', border: `${u(4)} solid #c3cfe6`, borderRadius: u(18) }}>
            <Swoosh trail={trail} size={280} />
          </div>
          <span style={{ fontSize: u(28) }}>
            <StrokeText stroke={u(5)}>{trail.exclusive && !owned ? 'Log in 7 days in a row!' : trail.bonus > 0 ? `+${Math.round(trail.bonus * 100)}% Coins every ride` : 'Your first trail'}</StrokeText>
          </span>
          <ChunkyButton
            onClick={() => (owned ? actions.equipTrail(picked) : affordable && !trail.exclusive ? actions.buyTrail(picked) : null)}
            disabled={worn || (trail.exclusive && !owned)}
            gradient={worn || owned || (affordable && !trail.exclusive) ? GRADIENTS.greenButton : GRADIENTS.greyButton}
            radius={16}
            style={{ width: '100%', height: u(90), gap: u(10), fontSize: u(40), marginTop: 'auto' }}
          >
            {worn ? (
              <Icon name="check" size={u(54)} />
            ) : owned ? (
              <StrokeText stroke={u(7)}>EQUIP</StrokeText>
            ) : trail.exclusive ? (
              <Icon name="lock" size={u(56)} />
            ) : (
              <>
                <Icon name="coin" size={u(46)} />
                <StrokeText stroke={u(7)}>{formatNumber(trail.cost)}</StrokeText>
              </>
            )}
          </ChunkyButton>
        </div>
      </div>
    </BrightPanel>
  )
}
