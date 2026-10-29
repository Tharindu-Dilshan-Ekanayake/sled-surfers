import { useEffect, useState } from 'react'

import { isMuted, onMutedChange, setMuted } from '../../audio/sfx'
import { useClearTop } from '../../bloxity/reserved'
import { useBloxityStore } from '../../bloxity/store'
import { useGame } from '../../store/game'
import AuthHUD from '../AuthHUD'
import Icon from '../Icon'
import { AlertBadge, ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

function RoundButton({ icon, label, onClick, alert, iconSize = 38 }) {
  return (
    <ChunkyButton gradient={GRADIENTS.slate} onClick={onClick} title={label} radius={32} style={{ width: u(64), height: u(64) }}>
      <Icon name={icon} size={u(iconSize)} />
      {alert && <AlertBadge size={26} style={{ top: u(-8), right: u(-8) }} />}
    </ChunkyButton>
  )
}

/** Turns the music and sound effects on and off (remembered on this device). */
function SoundButton() {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMutedChange(setMutedState), [])
  return <RoundButton icon={muted ? 'soundOff' : 'sound'} label={muted ? 'Sound: off' : 'Sound: on'} onClick={() => setMuted(!muted)} iconSize={36} />
}

/**
 * The top-right corner: daily rewards, sound, settings, leaderboards and your name tag.
 */
export function TopBar() {
  const openPanel = useGame((s) => s.openPanel)
  // Inside Boxity its trophy button has the leaderboards; on a phone its toolbar spans
  // the top, so this sits below it.
  const embedded = useBloxityStore((s) => s.embedded)
  // Clear of the platform's toolbar over the right of the screen - not its chat feed,
  // which on a phone held upright reaches most of the way across: the bar keeps to the
  // right of it, wrapping your name tag onto a second row when it's narrow.
  const clear = useClearTop(0.62, 1)
  const loginWaiting = useGame((s) => s.profile.login?.claimed === false)

  return (
    <div className="pointer-events-none absolute flex flex-wrap items-center justify-end" style={{ right: u(16), top: `calc(${u(14)} + ${clear}px)`, gap: u(12), maxWidth: '37vw' }}>
      <RoundButton icon="chest:rainbow" label="Daily rewards" onClick={() => openPanel('login')} alert={loginWaiting} iconSize={46} />
      <SoundButton />
      <RoundButton icon="gear" label="Settings" onClick={() => openPanel('settings')} iconSize={36} />
      {!embedded && <RoundButton icon="star" label="Leaderboards" onClick={() => openPanel('leaderboards')} iconSize={34} />}
      <AuthHUD />
    </div>
  )
}

export default TopBar
