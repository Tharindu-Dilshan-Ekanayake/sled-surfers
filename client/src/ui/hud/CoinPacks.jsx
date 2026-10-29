import { DIAMOND_SHOP, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { useClearTop } from '../../bloxity/reserved'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import { buyWithDiamonds } from '../diamondShop'
import StrokeText from '../StrokeText'
import { u } from './style'

const PACKS = [
  { sku: 'coins_small', gradient: 'linear-gradient(180deg, #9fdcff 0%, #4ea3ff 45%, #2f6fe6 100%)', edge: '#17306e' },
  { sku: 'coins_medium', gradient: 'linear-gradient(180deg, #d9b3ff 0%, #9a5cff 45%, #6a2fd6 100%)', edge: '#3a1478' },
  { sku: 'coins_large', gradient: 'linear-gradient(180deg, #fff3a3 0%, #ffcf2e 45%, #f0a000 100%)', edge: '#8a4a00' },
]

/**
 * The three coin packs down the right, as in the reference - more Coins in later worlds -
 * bought with Diamonds earned playing.
 */
export function CoinPacks() {
  const world = useGame((s) => s.profile.world)
  const scale = WORLDS[world]?.scale ?? 1
  // Below the top bar, wherever the platform's toolbar has pushed it.
  const clear = useClearTop(0.62, 1)
  return (
    <div className="pointer-events-none absolute flex flex-col items-end" style={{ right: u(14), top: `calc(${u(330)} + ${clear}px)`, gap: u(18) }}>
      {PACKS.map(({ sku, gradient, edge }) => {
        const product = DIAMOND_SHOP[sku]
        return (
          <button
            key={sku}
            type="button"
            title={`${product.name}: ${product.diamonds} Diamonds`}
            onClick={() => buyWithDiamonds(sku)}
            className="pp-btn pp-tile pointer-events-auto relative flex items-center justify-end"
            style={{
              width: u(220),
              height: u(74),
              paddingRight: u(22),
              background: gradient,
              borderWidth: u(5),
              borderRadius: u(22),
              fontSize: u(42),
              '--edge': edge,
            }}
          >
            <Icon name="coins" size={u(100)} className="pp-icon-drop" style={{ position: 'absolute', left: u(-38), top: u(-18) }} />
            <StrokeText stroke={u(8)}>+{formatNumber(product.grant.coins * scale)}</StrokeText>
            <span
              className="absolute flex items-center"
              style={{ bottom: u(-16), right: u(10), gap: u(2), padding: `0 ${u(8)}`, background: '#14214a', borderRadius: u(10), fontSize: u(20) }}
            >
              <Icon name="diamond" size={u(26)} />
              <StrokeText stroke={u(4)}>{product.diamonds}</StrokeText>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default CoinPacks
