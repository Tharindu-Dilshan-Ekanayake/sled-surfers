import { giftStatus } from '@shared/logic'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { AlertBadge } from './parts'
import { u } from './style'

/** A square menu tile: a big icon with its name across the bottom. */
function Tile({ icon, label, onClick, alert = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pp-btn pp-tile pointer-events-auto relative flex flex-col items-center justify-end"
      style={{
        width: u(122),
        height: u(128),
        paddingBottom: u(5),
        background: 'radial-gradient(120% 90% at 50% 18%, #b9e2ff 0%, #6fb2ff 38%, #3f7fe6 75%, #2f63c9 100%)',
        borderWidth: u(5),
        borderRadius: u(20),
        '--edge': '#17306e',
      }}
    >
      <Icon name={icon} size={u(104)} className="pp-icon-drop" style={{ position: 'absolute', top: u(-12) }} />
      <span style={{ fontSize: u(31), position: 'relative' }}>
        <StrokeText stroke={u(7)}>{label}</StrokeText>
      </span>
      {alert > 0 && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{ top: u(-10), right: u(-10), width: u(40), height: u(40), background: '#3fd14a', border: `${u(3)} solid #fff`, fontSize: u(24) }}
        >
          <StrokeText stroke={u(5)}>{alert}</StrokeText>
        </span>
      )}
    </button>
  )
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The gifts bar: CLAIM! with how many are ready, or the time to the next one. */
function GiftBar() {
  const gifts = useGame((s) => s.profile.gifts)
  const profileAt = useGame((s) => s.profileAt)
  const openPanel = useGame((s) => s.openPanel)
  const now = useNow(1000)
  // Today's play, counted on from the last profile update (no clocks compared).
  const status = giftStatus(gifts, Math.max(0, now - profileAt))
  const ready = status.filter((g) => g.state === 'ready').length
  const next = status.find((g) => g.state === 'locked')
  if (!ready && !next) return null
  return (
    <button
      type="button"
      onClick={() => openPanel('gifts')}
      className={`pp-btn pp-tile pointer-events-auto relative flex items-center ${ready ? 'pp-pulse' : ''}`}
      style={{
        width: u(256),
        height: u(72),
        paddingLeft: u(16),
        gap: u(8),
        background: ready ? 'linear-gradient(180deg, #8ef15e 0%, #4fd23a 48%, #22a52c 100%)' : 'linear-gradient(180deg, #8ef15e 0%, #3fc53a 60%, #22a52c 100%)',
        borderWidth: u(5),
        borderRadius: u(18),
        fontSize: u(34),
        '--edge': '#0e5a1a',
      }}
    >
      {!ready && <Icon name="timer" size={u(50)} className="pp-icon-drop" />}
      <StrokeText stroke={u(7)}>{ready ? 'CLAIM!' : clock(next.unlocksIn)}</StrokeText>
      <Icon name="gift" size={u(96)} className="pp-icon-drop" style={{ position: 'absolute', right: u(-22), top: u(-26) }} />
      {ready > 0 && <AlertBadge size={38} style={{ right: u(-18), top: u(-22), background: '#3fd14a' }} />}
    </button>
  )
}

/** The menu tiles down the left, as in the reference: WORLDS, SLEDS, TRAILS, TASKS, and the gifts. */
export function LeftMenu() {
  const openPanel = useGame((s) => s.openPanel)
  const tasksReady = useGame((s) => s.profile.tasks.list.filter((t) => !t.claimed && t.progress >= t.goal).length + (!s.profile.tasks.chest && s.profile.tasks.list.length > 0 && s.profile.tasks.list.every((t) => t.claimed) ? 1 : 0))
  return (
    <div className="pointer-events-none flex flex-col" style={{ gap: u(12), marginTop: u(8) }}>
      <div className="grid grid-cols-2" style={{ gap: u(12) }}>
        <Tile icon="worlds" label="WORLDS" onClick={() => openPanel('worlds')} />
        <Tile icon="sled" label="SLEDS" onClick={() => openPanel('sleds')} />
        <Tile icon="trail" label="TRAILS" onClick={() => openPanel('trails')} />
        <Tile icon="tasks" label="TASKS" onClick={() => openPanel('tasks')} alert={tasksReady} />
      </div>
      <GiftBar />
    </div>
  )
}

export default LeftMenu
