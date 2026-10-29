import { launchSpeed, MPH, incomeMultiplier, rocketCans, speedoSpeed, WORLDS, SLEDS, sledSpeedPercent } from '@shared/balance'
import { formatMultiplier, formatNumber } from '@shared/format'
import { nextSled, upgradeCost } from '@shared/logic'

import { enterSlingshot } from '../../game/ride/rideControl'
import { useSledIcon } from '../../game/sleds/sledIcons'
import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** An upgrade card: its name, a picture, its level in a badge, and the price to level it. */
function Card({ title, color, edge, image, level, price, currency, affordable, maxed, onBuy, caption, hint }) {
  return (
    <div
      className="pp-tile pointer-events-auto relative flex flex-col items-center"
      title={hint}
      style={{ width: u(192), padding: u(9), paddingTop: u(4), background: color, borderWidth: u(5), borderRadius: u(20), '--edge': edge }}
    >
      <span style={{ fontSize: u(34) }}>
        <StrokeText stroke={u(7)}>{title}</StrokeText>
      </span>
      <div className="pp-well relative flex items-center justify-center" style={{ width: '100%', height: u(132), background: 'radial-gradient(90% 80% at 50% 40%, #ffffff 0%, #fbeef2 60%, #efdbe2 100%)', borderRadius: u(14) }}>
        {image}
        {caption && (
          <span className="absolute" style={{ bottom: u(2), fontSize: u(20) }}>
            <StrokeText stroke={u(5)}>{caption}</StrokeText>
          </span>
        )}
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{ top: u(-10), right: u(-10), minWidth: u(58), height: u(58), padding: `0 ${u(6)}`, background: 'radial-gradient(circle at 40% 30%, #ffffff, #e6ecf5)', border: `${u(4)} solid ${edge}`, boxShadow: `0 ${u(3)} 0 ${edge}`, fontSize: u(32) }}
        >
          <span style={{ color: edge, lineHeight: 1 }}>{level}</span>
        </span>
      </div>
      <ChunkyButton
        onClick={onBuy}
        disabled={maxed}
        gradient={affordable ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        radius={12}
        style={{ marginTop: u(8), width: '100%', height: u(62), gap: u(6), fontSize: u(34) }}
      >
        {maxed ? (
          <StrokeText stroke={u(7)}>MAX</StrokeText>
        ) : (
          <>
            <Icon name={currency === 'diamonds' ? 'diamond' : 'coin'} size={u(38)} />
            <StrokeText stroke={u(7)}>{formatNumber(price)}</StrokeText>
          </>
        )}
      </ChunkyButton>
    </div>
  )
}

function SledPicture({ id }) {
  const url = useSledIcon(id)
  if (!url) return <Icon name="sled" size={u(100)} style={{ opacity: 0.3 }} />
  return <img src={url} alt="" draggable={false} style={{ width: u(118), height: u(118) }} />
}

/**
 * The bottom of the lobby, as in the reference: the big green PLAY (straight onto the
 * slingshot), the V that folds the cards away, and the four upgrade cards - SLINGSHOT,
 * SLED, INCOME, ROCKET - each with its level and the price of the next.
 */
export function PlayBar() {
  const profile = useGame((s) => s.profile)
  const hidden = useGame((s) => s.cardsHidden)
  const toggleCards = useGame((s) => s.toggleCards)
  const showToast = useGame((s) => s.showToast)
  const up = profile.upgrades
  const sled = nextSled(profile)
  const shown = sled ?? SLEDS[profile.sled]
  const buy = (cost, act) => () => {
    if (!cost) return
    if (profile[cost.currency] < cost.amount) {
      showToast(cost.currency === 'diamonds' ? 'Not enough Diamonds! Finish tasks and open gifts.' : 'Not enough Coins!')
      return
    }
    act()
  }
  const sling = upgradeCost(profile, 'slingshot')
  const income = upgradeCost(profile, 'income')
  const rocket = upgradeCost(profile, 'rocket')
  const owned = profile.sleds.filter((id) => SLEDS[id]?.world === shown.world && !SLEDS[id].premium).length

  return (
    <div className="pointer-events-none absolute left-1/2 flex flex-col items-center" style={{ bottom: u(14), transform: 'translateX(-50%)', gap: u(18) }}>
      <div className="flex items-center" style={{ gap: u(12) }}>
        <ChunkyButton onClick={enterSlingshot} gradient={GRADIENTS.greenButton} radius={20} border={5} style={{ width: u(330), height: u(92), gap: u(26), fontSize: u(58) }}>
          <StrokeText stroke={u(9)}>PLAY</StrokeText>
          <Icon name="play" size={u(54)} />
        </ChunkyButton>
        <ChunkyButton onClick={toggleCards} gradient={GRADIENTS.greyButton} radius={14} border={5} style={{ width: u(76), height: u(76), fontSize: u(44) }}>
          <StrokeText stroke={u(8)}>{hidden ? 'Λ' : 'V'}</StrokeText>
        </ChunkyButton>
      </div>
      {!hidden && (
        <div className="flex" style={{ gap: u(16) }}>
          <Card
            title="SLINGSHOT"
            color="linear-gradient(180deg, #ff8a7a 0%, #f0473a 40%, #c8182a 100%)"
            edge="#6a0a12"
            image={<Icon name="slingshot" size={u(122)} className="pp-icon-drop" />}
            level={up.slingshot}
            price={sling?.amount}
            currency="coins"
            affordable={sling && profile.coins >= sling.amount}
            maxed={!sling}
            hint={`Launch at ${Math.round(speedoSpeed(launchSpeed(up.slingshot), WORLDS[profile.world]) * MPH)} MPH`}
            onBuy={buy(sling, () => actions.upgrade('slingshot'))}
          />
          <Card
            title="SLED"
            color="linear-gradient(180deg, #8fd0ff 0%, #4a9bff 40%, #1f63d6 100%)"
            edge="#0b3a8a"
            image={<SledPicture id={shown.id} />}
            caption={shown.name}
            level={owned}
            price={sled?.cost}
            currency="coins"
            affordable={sled && profile.coins >= sled.cost}
            maxed={!sled}
            hint={`${shown.name}: +${sledSpeedPercent(shown)}% speed`}
            onBuy={sled ? buy({ amount: sled.cost, currency: 'coins' }, () => actions.buySled(sled.id)) : undefined}
          />
          <Card
            title="INCOME"
            color="linear-gradient(180deg, #ffe680 0%, #ffcc2e 40%, #e8a000 100%)"
            edge="#8a5a00"
            image={<Icon name="income" size={u(122)} className="pp-icon-drop" />}
            level={up.income}
            price={income?.amount}
            currency="coins"
            affordable={income && profile.coins >= income.amount}
            maxed={!income}
            hint={`${formatMultiplier(incomeMultiplier(up.income))} Coins`}
            onBuy={buy(income, () => actions.upgrade('income'))}
          />
          <Card
            title="ROCKET"
            color="linear-gradient(180deg, #ffb86b 0%, #ff8a2a 40%, #e05a00 100%)"
            edge="#7a2a00"
            image={<Icon name="rocket" size={u(122)} className="pp-icon-drop" />}
            level={up.rocket}
            price={rocket?.amount}
            currency="diamonds"
            affordable={rocket && profile.diamonds >= rocket.amount}
            maxed={!rocket}
            hint={`${rocketCans(up.rocket)} fuel can${rocketCans(up.rocket) > 1 ? 's' : ''} a ride`}
            onBuy={buy(rocket, () => actions.upgrade('rocket'))}
          />
        </div>
      )}
    </div>
  )
}

export default PlayBar
