import { useState } from 'react'

import { WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { isRewardedAvailable } from '../../bloxity/services'
import { claimResult } from '../../game/ride/rideControl'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** A small chip under the Coins: what part of them came from where. */
function Chip({ icon, value }) {
  return (
    <span className="flex items-center" style={{ gap: u(4), padding: `${u(4)} ${u(12)}`, background: '#dfe7f6', border: `${u(3)} solid #9aa9c9`, borderRadius: u(20), fontSize: u(28) }}>
      <Icon name={icon} size={u(34)} />
      <StrokeText stroke={u(5)}>+{formatNumber(value)}</StrokeText>
    </span>
  )
}

/**
 * The results card when your sled stops, as in the reference: the world, how far you
 * got (NEW BEST!), how far along the world that is, the Coins it paid and where they
 * came from - CLAIM, or CLAIM 3x for watching an ad (Boxity's rewarded ads).
 */
export function ResultCard() {
  const result = useGame((s) => s.result)
  const [busy, setBusy] = useState(false)
  if (!result) return null
  const world = WORLDS[result.world] ?? WORLDS[0]
  const progress = Math.min(1, result.distance / world.length)
  const ad = isRewardedAvailable()
  const claim = async (triple) => {
    if (busy) return
    setBusy(true)
    try {
      await claimResult(triple)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pp-card-in pointer-events-auto absolute left-1/2 top-1/2 flex flex-col items-center" style={{ width: u(520), background: '#f4f7fb', border: `${u(6)} solid #14214a`, borderRadius: u(28), overflow: 'visible' }}>
      <div className="flex w-full items-center justify-center" style={{ height: u(96), gap: u(10), background: 'linear-gradient(180deg, #5fb3ff 0%, #2f7bff 100%)', borderRadius: `${u(22)} ${u(22)} 0 0`, fontSize: u(56) }}>
        <Icon name="mountain" size={u(70)} />
        <StrokeText stroke={u(9)}>{result.world + 1}</StrokeText>
      </div>
      {result.newBest && (
        <div className="absolute flex items-center" style={{ right: u(-34), top: u(-26), transform: 'rotate(12deg)', gap: u(4), padding: `${u(4)} ${u(16)}`, background: 'linear-gradient(180deg, #ff6a7a, #e2244a)', border: `${u(4)} solid #fff`, borderRadius: u(16), fontSize: u(34) }}>
          <StrokeText stroke={u(6)}>NEW BEST</StrokeText>
          <Icon name="starGold" size={u(40)} />
        </div>
      )}
      <span style={{ fontSize: u(100), lineHeight: 1.1, marginTop: u(10) }}>
        <StrokeText stroke={u(14)}>{formatNumber(result.distance)}m</StrokeText>
      </span>
      <div className="flex items-center" style={{ width: '82%', gap: u(10) }}>
        <div className="relative flex-1 overflow-hidden" style={{ height: u(28), background: '#dfe7f6', border: `${u(4)} solid #14214a`, borderRadius: u(16) }}>
          <div style={{ width: `${Math.max(3, progress * 100)}%`, height: '100%', background: 'linear-gradient(180deg, #8ff0ff, #2fb8ff)' }} />
        </div>
        <Icon name="flag" size={u(46)} />
      </div>
      {result.race ? (
        <span style={{ fontSize: u(28) }}>
          <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
            Race ride! The results come when everyone stops.
          </StrokeText>
        </span>
      ) : result.finished ? (
        <span style={{ fontSize: u(30) }}>
          <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
            {world.name} beaten!
          </StrokeText>
        </span>
      ) : (
        // How you did against your best: the jump when you beat it, the gap when you didn't.
        result.best > 0 && (
          <span style={{ fontSize: u(30) }}>
            {result.newBest ? (
              <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
                {`Best ${formatNumber(result.best)}m → ${formatNumber(result.distance)}m (+${formatNumber(result.gained)}m)`}
              </StrokeText>
            ) : (
              <StrokeText stroke={u(6)}>
                {result.best - result.distance < 1 ? 'So close - you matched your best!' : `Your best: ${formatNumber(result.best)}m · ${formatNumber(result.best - result.distance)}m to beat it!`}
              </StrokeText>
            )}
          </span>
        )
      )}
      <div className="flex items-center" style={{ width: '84%', marginTop: u(12), padding: `${u(10)} ${u(24)}`, gap: u(20), background: '#ffe9a8', border: `${u(5)} solid #e8a400`, borderRadius: u(20), fontSize: u(64) }}>
        <Icon name="coin" size={u(80)} />
        <StrokeText stroke={u(10)} fill="#ffffff">
          +{formatNumber(result.total)}
        </StrokeText>
      </div>
      <div className="flex flex-wrap justify-center" style={{ marginTop: u(14), gap: u(10) }}>
        {result.picked > 0 && <Chip icon="coin" value={result.picked} />}
        {result.far > 0 && <Chip icon="wind" value={result.far} />}
        {result.bonus > 0 && <Chip icon="upgrade" value={result.bonus} />}
      </div>
      <div className="flex w-full justify-center" style={{ gap: u(16), padding: `${u(22)} ${u(20)} ${u(26)}` }}>
        <ChunkyButton onClick={() => claim(false)} disabled={busy} gradient={GRADIENTS.greenButton} radius={16} border={5} style={{ width: u(ad ? 220 : 300), height: u(86), fontSize: u(46) }}>
          <StrokeText stroke={u(8)}>CLAIM</StrokeText>
        </ChunkyButton>
        {ad && result.total > 0 && !result.local && (
          <ChunkyButton onClick={() => claim(true)} disabled={busy} gradient={GRADIENTS.goldButton} radius={16} border={5} style={{ width: u(230), height: u(86), gap: u(8), fontSize: u(42) }}>
            <span className="absolute" style={{ top: u(-28), padding: `${u(2)} ${u(12)}`, background: '#14214a', borderRadius: u(10), fontSize: u(20), color: '#fff' }}>
              ▶ WATCH AD
            </span>
            <StrokeText stroke={u(8)}>CLAIM 3x</StrokeText>
          </ChunkyButton>
        )}
      </div>
    </div>
  )
}

export default ResultCard
