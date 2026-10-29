import { GIFTS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { giftContents, giftStatus } from '@shared/logic'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import useNow from '../useNow'
import { BrightPanel } from './Panel'

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** One present: what's in it, and CLAIM / ✓ / the time until it opens. */
function Gift({ index, status, profile }) {
  const got = giftContents(profile, index)
  const ready = status.state === 'ready'
  const claimed = status.state === 'claimed'
  const rainbow = GIFTS[index].chest === 'rainbow'
  return (
    <div className="relative flex flex-col items-center" style={{ padding: u(8), background: ready ? 'linear-gradient(180deg, #fff3b0, #ffd84a)' : '#f4f7fb', border: `${u(5)} solid ${ready ? '#ffb21e' : '#c3cfe6'}`, borderRadius: u(18), boxShadow: rainbow ? `0 0 0 ${u(4)} #ff5fc8` : 'none' }}>
      {got.chest && got.diamonds > 0 && (
        <span className="absolute flex items-center" style={{ right: u(-10), top: u(-14), gap: u(2), padding: `0 ${u(8)}`, background: '#5fd2ff', border: `${u(3)} solid #fff`, borderRadius: u(14), fontSize: u(22) }}>
          <Icon name="diamond" size={u(22)} />
          <StrokeText stroke={u(4)}>+{got.diamonds}</StrokeText>
        </span>
      )}
      {!got.chest && got.coins > 0 && got.diamonds > 0 && (
        <span className="absolute flex items-center" style={{ right: u(-10), top: u(-14), gap: u(2), padding: `0 ${u(8)}`, background: '#5fd2ff', border: `${u(3)} solid #fff`, borderRadius: u(14), fontSize: u(22) }}>
          <Icon name="diamond" size={u(22)} />
          <StrokeText stroke={u(4)}>+{got.diamonds}</StrokeText>
        </span>
      )}
      <span style={{ fontSize: u(34), height: u(40) }}>
        <StrokeText stroke={u(6)}>{got.chest ? '' : got.coins > 0 ? formatNumber(got.coins) : `+${got.diamonds}`}</StrokeText>
      </span>
      <Icon name={got.chest ? `chest:${got.chest}` : got.coins > 0 ? 'coins' : 'diamond'} size={u(96)} />
      <ChunkyButton
        onClick={() => ready && actions.claimGift(index)}
        disabled={!ready && !claimed}
        gradient={ready ? GRADIENTS.goldButton : claimed ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        radius={12}
        style={{ marginTop: u(6), width: '100%', height: u(56), gap: u(6), fontSize: u(30) }}
      >
        {ready ? <StrokeText stroke={u(6)}>CLAIM</StrokeText> : claimed ? <Icon name="check" size={u(38)} /> : <StrokeText stroke={u(6)}>{clock(status.unlocksIn)}</StrokeText>}
      </ChunkyButton>
    </div>
  )
}

/**
 * The GIFTS panel, as in the reference: twelve presents a day that open as you play (a
 * refresh or a new lobby never starts them over), each with its countdown, and CLAIM ALL.
 */
export default function GiftsPanel() {
  const gifts = useGame((s) => s.profile.gifts)
  const profileAt = useGame((s) => s.profileAt)
  const profile = useGame((s) => s.profile)
  const now = useNow(1000)
  const status = giftStatus(gifts, Math.max(0, now - profileAt))
  const ready = status.some((g) => g.state === 'ready')
  return (
    <BrightPanel title="GIFTS" header="linear-gradient(180deg, #ff7a8a 0%, #e2244a 100%)" width={860}>
      <div className="grid grid-cols-4" style={{ gap: u(18), padding: u(6) }}>
        {status.map((s) => (
          <Gift key={s.index} index={s.index} status={s} profile={profile} />
        ))}
      </div>
      <div className="flex justify-center" style={{ marginTop: u(18) }}>
        <ChunkyButton onClick={() => actions.claimAllGifts()} disabled={!ready} gradient={ready ? GRADIENTS.greenButton : GRADIENTS.greyButton} radius={18} border={5} style={{ width: u(360), height: u(90), fontSize: u(48) }}>
          <StrokeText stroke={u(8)}>CLAIM ALL</StrokeText>
        </ChunkyButton>
      </div>
    </BrightPanel>
  )
}
