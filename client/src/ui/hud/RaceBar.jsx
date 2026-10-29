import { actions } from '../../net/actions'
import { useClearTop } from '../../bloxity/reserved'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The races, top middle of the lobby: when the next one starts; while its window is
 * open, a big countdown with how many have joined and a JOIN button (JOINED once you
 * have); while one is running, that it is. The race itself starts you (rideControl).
 */
export function RaceBar() {
  const race = useGame((s) => s.race)
  const phase = useGame((s) => s.phase)
  const now = useNow(250)
  // Clear of whatever the platform puts right above it (its own span, mid-screen): its
  // toolbar and chat on the left don't push it down.
  const clear = useClearTop(0.47, 0.53)
  if (!race || (phase !== 'lobby' && phase !== 'pull')) return null
  const left = race.startsAt - now
  const top = `calc(${u(4)} + ${clear}px)`

  if (race.phase === 'join') {
    return (
      <div className="pp-card-in pointer-events-auto absolute left-1/2 flex items-center" style={{ top, transform: 'translateX(-50%)', gap: u(16), padding: `${u(10)} ${u(14)} ${u(10)} ${u(22)}`, background: 'linear-gradient(180deg, #2b3c78, #1a2656)', border: `${u(5)} solid #ffd23a`, borderRadius: u(26), boxShadow: `0 ${u(6)} 0 rgba(0,0,0,.35)` }}>
        <Icon name="flag" size={u(56)} />
        <div className="flex flex-col items-start" style={{ lineHeight: 1.05 }}>
          <span style={{ fontSize: u(40) }}>
            <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>{`RACE IN ${clock(left)}`}</StrokeText>
          </span>
          <span style={{ fontSize: u(24) }}>
            <StrokeText stroke={u(5)}>{`${race.racers} racing · top 3 win Diamonds`}</StrokeText>
          </span>
        </div>
        {race.joined ? (
          <span className="flex items-center" style={{ gap: u(6), padding: `${u(8)} ${u(18)}`, background: '#22a52c', border: `${u(4)} solid #0e5a1a`, borderRadius: u(16), fontSize: u(34) }}>
            <Icon name="check" size={u(36)} />
            <StrokeText stroke={u(6)}>JOINED</StrokeText>
          </span>
        ) : (
          <ChunkyButton onClick={() => actions.joinRace()} gradient={GRADIENTS.greenButton} radius={16} border={5} className="pp-pulse" style={{ width: u(170), height: u(72), fontSize: u(40) }}>
            <StrokeText stroke={u(7)}>JOIN!</StrokeText>
          </ChunkyButton>
        )}
      </div>
    )
  }

  // Between races, and while one's running without you: a small reminder.
  return (
    <div className="pointer-events-none absolute left-1/2 flex items-center" style={{ top, transform: 'translateX(-50%)', gap: u(8), padding: `${u(6)} ${u(18)}`, background: 'rgba(20, 33, 74, 0.72)', border: `${u(4)} solid rgba(255,255,255,.8)`, borderRadius: u(22), fontSize: u(28) }}>
      <Icon name="flag" size={u(34)} />
      <StrokeText stroke={u(6)}>{race.phase === 'running' ? 'Race on now!' : `Next race in ${clock(left)}`}</StrokeText>
    </div>
  )
}

export default RaceBar
