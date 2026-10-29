import { LOGIN_STREAK, TRAILS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { loginPrize, streakSlot } from '@shared/logic'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import useNow from '../useNow'
import { BrightPanel } from './Panel'

/** Time left until the next UTC day, as 5h 12m. */
function untilTomorrow(now) {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  const left = Math.max(0, next.getTime() - now)
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** One day's card: its number, the prize's picture and what's in it, and its state. */
function DayCard({ day, prize, state, onClaim }) {
  const big = day === 7
  const icon = prize.trail ? 'trail' : prize.chest ? `chest:${prize.chest}` : prize.coins > 0 ? 'coins' : 'diamond'
  const today = state === 'today'
  const done = state === 'claimed'
  return (
    <div
      className={`pp-tile relative flex flex-col items-center ${today ? 'pp-pulse' : ''}`}
      style={{
        gridColumn: big ? 'span 2' : 'auto',
        padding: u(10),
        paddingTop: u(6),
        borderWidth: u(5),
        borderRadius: u(20),
        background: today ? 'linear-gradient(180deg, #fff3a3 0%, #ffd23a 50%, #ffaa12 100%)' : done ? 'linear-gradient(180deg, #c9f7b6 0%, #8fe07a 100%)' : big ? 'linear-gradient(180deg, #e9d8ff 0%, #b98bff 100%)' : 'linear-gradient(180deg, #f4f7fb 0%, #dbe6f6 100%)',
        '--edge': today ? '#8a4a00' : done ? '#1f6a2a' : big ? '#4a127a' : '#7d8db0',
      }}
    >
      <span style={{ fontSize: u(30) }}>
        <StrokeText stroke={u(6)}>DAY {day}</StrokeText>
      </span>
      <div className="relative flex items-center justify-center" style={{ height: u(big ? 150 : 110), gap: u(6) }}>
        <Icon name={icon} size={u(big ? 140 : 100)} className="pp-icon-drop" style={{ opacity: done ? 0.55 : 1 }} />
        {big && prize.trail && <Icon name="chest:rainbow" size={u(120)} className="pp-icon-drop" />}
        {done && <Icon name="check" size={u(70)} style={{ position: 'absolute' }} />}
      </div>
      <span className="flex flex-wrap items-center justify-center" style={{ minHeight: u(40), gap: u(6), fontSize: u(26) }}>
        {prize.trail && <StrokeText stroke={u(5)} gradient={GRADIENTS.rainbow}>{`${TRAILS[prize.trail].name} Trail!`}</StrokeText>}
        {prize.coins > 0 && (
          <span className="flex items-center" style={{ gap: u(2) }}>
            <Icon name="coin" size={u(30)} />
            <StrokeText stroke={u(5)}>{formatNumber(prize.coins)}</StrokeText>
          </span>
        )}
        {prize.diamonds > 0 && (
          <span className="flex items-center" style={{ gap: u(2) }}>
            <Icon name="diamond" size={u(30)} />
            <StrokeText stroke={u(5)}>{prize.diamonds}</StrokeText>
          </span>
        )}
      </span>
      {today && (
        <ChunkyButton onClick={onClaim} gradient={GRADIENTS.greenButton} radius={14} style={{ marginTop: u(8), width: '100%', height: u(66), fontSize: u(34) }}>
          <StrokeText stroke={u(7)}>CLAIM!</StrokeText>
        </ChunkyButton>
      )}
    </div>
  )
}

/**
 * The 7-day login streak, as Roblox games do it: a prize for every day in a row you play,
 * bigger as the week goes on, with the exclusive Aurora trail (and the rainbow chest) on
 * day 7 - and back to day 1 if you miss a day. Opens by itself the first time you join
 * each day, and from the calendar button.
 */
export default function LoginPanel() {
  const profile = useGame((s) => s.profile)
  const closePanel = useGame((s) => s.closePanel)
  const now = useNow(30000)
  const { streak, claimed } = profile.login
  // The week the streak is in: days 1-7 of it, today among them.
  const slot = streakSlot(streak)
  const weekStart = streak - slot
  return (
    <BrightPanel title="DAILY REWARDS" icon="chest:rainbow" header="linear-gradient(180deg, #ffb86b 0%, #ff7a1e 100%)" width={1100}>
      <div className="grid grid-cols-4" style={{ gap: u(16), padding: u(4) }}>
        {LOGIN_STREAK.map((_, i) => {
          const dayStreak = weekStart + i
          const state = i < slot || (i === slot && claimed) ? 'claimed' : i === slot ? 'today' : 'locked'
          return (
            <DayCard
              key={i}
              day={i + 1}
              prize={loginPrize(profile, dayStreak)}
              state={state}
              onClaim={() => {
                actions.claimLogin()
                setTimeout(closePanel, 900)
              }}
            />
          )
        })}
      </div>
      <div className="flex flex-col items-center" style={{ marginTop: u(18), gap: u(4) }}>
        <span style={{ fontSize: u(34) }}>
          <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
            {claimed ? `Come back tomorrow for Day ${(slot + 1) % LOGIN_STREAK.length + 1}!` : `${streak} day${streak > 1 ? 's' : ''} in a row!`}
          </StrokeText>
        </span>
        <span style={{ fontSize: u(24) }}>
          <StrokeText stroke={u(5)}>New prize in {untilTomorrow(now)} · Miss a day and the streak starts over</StrokeText>
        </span>
      </div>
    </BrightPanel>
  )
}
