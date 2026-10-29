import { useEffect } from 'react'

import { formatNumber } from '@shared/format'

import { useGame } from '../../store/game'
import { flyCoins } from '../coinsFly'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import { BrightPanel } from './Panel'

const awayText = (minutes) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * WELCOME BACK: what your INCOME earned while you were away (already banked by the
 * server), and a nudge to upgrade it so next time it's more. CLAIM sends the Coins
 * flying to the counter.
 */
export default function AwayPanel() {
  const away = useGame((s) => s.panelData)
  const closePanel = useGame((s) => s.closePanel)
  const coins = away?.coins ?? 0

  // However it's closed (CLAIM, the X, a click outside), the Coins fly to the counter.
  useEffect(() => () => setTimeout(() => flyCoins(coins), 200), [coins])

  if (!away) return null
  return (
    <BrightPanel title="WELCOME BACK!" header="linear-gradient(180deg, #6fb6ff 0%, #2f7bff 100%)" width={780}>
      <div className="flex flex-col items-center" style={{ gap: u(12), padding: u(8) }}>
        <span style={{ fontSize: u(32) }}>
          <StrokeText stroke={u(6)}>You were away {awayText(away.minutes)}</StrokeText>
        </span>
        <span style={{ fontSize: u(26) }}>
          <StrokeText stroke={u(5)}>Your INCOME kept earning:</StrokeText>
        </span>
        <div className="pp-tile flex items-center justify-center" style={{ gap: u(16), padding: `${u(12)} ${u(40)}`, borderWidth: u(5), borderRadius: u(22), background: 'linear-gradient(180deg, #fff3b0 0%, #ffd84a 100%)', '--edge': '#8a5a00', fontSize: u(70) }}>
          <Icon name="income" size={u(110)} className="pp-icon-drop" />
          <StrokeText stroke={u(11)}>+{formatNumber(coins)}</StrokeText>
        </div>
        <span style={{ fontSize: u(22) }}>
          <StrokeText stroke={u(5)}>Upgrade INCOME to earn more while you're away!</StrokeText>
        </span>
        <ChunkyButton onClick={closePanel} gradient={GRADIENTS.greenButton} radius={18} border={5} style={{ marginTop: u(8), width: u(300), height: u(86), fontSize: u(46) }}>
          <StrokeText stroke={u(8)}>CLAIM</StrokeText>
        </ChunkyButton>
      </div>
    </BrightPanel>
  )
}
