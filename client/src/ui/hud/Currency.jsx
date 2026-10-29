import { formatNumber } from '@shared/format'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { u } from './style'

/** One counter: a big icon over the end of a gradient bar with the number on it. */
function Counter({ icon, value, gradient, target, iconSize = 92 }) {
  return (
    <div className="relative flex items-center" style={{ height: u(iconSize * 0.9) }}>
      <div
        className="absolute flex items-center"
        style={{
          left: u(iconSize * 0.45),
          height: u(iconSize * 0.62),
          width: u(300),
          paddingLeft: u(iconSize * 0.6),
          background: gradient,
          borderRadius: u(10),
          fontSize: u(46),
        }}
      >
        <span {...(target ? { [target]: '' } : {})}>
          <StrokeText stroke={u(9)}>{value}</StrokeText>
        </span>
      </div>
      <Icon name={icon} size={u(iconSize)} className="pp-icon-drop" style={{ position: 'relative' }} />
    </div>
  )
}

/**
 * Coins, Diamonds and your world, at the top of the left column as in the reference:
 * gold and blue bars fading out to the right, and the WORLD badge under them. The Coins
 * number holds while a payout's coins fly home to it (coinsShown).
 */
export function Currency() {
  const coins = useGame((s) => s.coinsShown ?? s.profile.coins)
  const diamonds = useGame((s) => s.profile.diamonds)
  const world = useGame((s) => s.profile.world)
  const openPanel = useGame((s) => s.openPanel)
  return (
    <div className="pointer-events-none flex flex-col" style={{ gap: u(4) }}>
      <Counter icon="coin" value={formatNumber(coins)} gradient="linear-gradient(90deg, rgba(255,196,30,.95) 0%, rgba(255,170,0,.7) 55%, rgba(255,170,0,0) 100%)" target="data-coins-target" />
      <Counter icon="diamond" value={formatNumber(diamonds)} gradient="linear-gradient(90deg, rgba(63,140,255,.9) 0%, rgba(150,90,255,.6) 55%, rgba(150,90,255,0) 100%)" iconSize={78} />
      <button
        type="button"
        onClick={() => openPanel('worlds')}
        className="pp-btn pp-tile pointer-events-auto flex items-center self-start"
        style={{
          marginTop: u(6),
          gap: u(10),
          padding: `${u(5)} ${u(16)} ${u(5)} ${u(10)}`,
          background: 'linear-gradient(180deg, #5b8ee6 0%, #3561c4 55%, #284c9e 100%)',
          borderWidth: u(4),
          borderRadius: u(16),
          fontSize: u(32),
          '--edge': '#14214a',
        }}
      >
        <Icon name="mountain" size={u(46)} />
        <StrokeText stroke={u(7)}>WORLD: {world + 1}</StrokeText>
      </button>
    </div>
  )
}

export default Currency
