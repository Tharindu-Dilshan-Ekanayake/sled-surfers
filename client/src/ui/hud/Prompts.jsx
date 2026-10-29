import { useEffect } from 'react'

import { DIAMOND_SHOP, FREE_COINS, SLEDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { PEDESTALS } from '@shared/world'

import { signIn } from '../../bloxity/services'
import { useBloxityStore } from '../../bloxity/store'
import { enterSlingshot } from '../../game/ride/rideControl'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import { buyWithDiamonds } from '../diamondShop'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { u } from './style'

/** What E (or a tap) does where you're standing, and what the prompt says. */
function usePrompt() {
  const zone = useGame((s) => s.zone)
  const freeClaimed = useGame((s) => s.profile.freeCoins)
  const ownedSleds = useGame((s) => s.profile.sleds)
  const signedIn = useBloxityStore((s) => Boolean(s.user))
  if (zone.pad) return { title: 'Slingshot', action: 'Ride!', run: enterSlingshot }
  if (zone.pedestal) {
    const p = PEDESTALS.find((d) => d.id === zone.pedestal)
    const item = DIAMOND_SHOP[p.product]
    if (ownedSleds.includes(p.id)) return { title: SLEDS[p.id].name, action: 'Owned!', run: null }
    return { title: item.name, action: `Buy · ${item.diamonds}`, icon: 'diamond', run: () => buyWithDiamonds(p.product) }
  }
  if (zone.freeCoins) {
    if (freeClaimed) return { title: 'Free Coins', action: 'Claimed!', run: null }
    if (!signedIn) return { title: `Free ${formatNumber(FREE_COINS)} Coins`, action: 'Sign in!', run: signIn }
    return { title: `Free ${formatNumber(FREE_COINS)} Coins`, action: 'Claim!', icon: 'coin', run: actions.claimFreeCoins }
  }
  return null
}

/**
 * The small "[E] Slingshot · Ride!" box over whatever you're standing by, as in the
 * reference - pressed with E or tapped - and the toast for short messages.
 */
export function Prompts() {
  const prompt = usePrompt()
  const run = prompt?.run

  useEffect(() => {
    if (!run) return undefined
    const onKey = (e) => {
      if (e.code === 'KeyE' && !e.repeat && !getGame().panel) run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  if (!prompt) return null
  return (
    <button
      type="button"
      onClick={() => run?.()}
      disabled={!run}
      className="pp-btn pointer-events-auto absolute left-1/2 flex items-center"
      style={{ top: '44%', transform: 'translateX(-50%)', gap: u(14), padding: `${u(10)} ${u(22)} ${u(10)} ${u(12)}`, background: 'rgba(25, 28, 36, 0.82)', borderRadius: u(12), color: '#fff' }}
    >
      <span className="flex items-center justify-center" style={{ width: u(48), height: u(48), border: `${u(3)} solid #fff`, borderRadius: u(10), fontSize: u(26) }}>
        E
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span style={{ fontSize: u(20), opacity: 0.8 }}>{prompt.title}</span>
        <span className="flex items-center" style={{ fontSize: u(28), gap: u(6) }}>
          {prompt.icon && <Icon name={prompt.icon} size={u(28)} />}
          {prompt.action}
        </span>
      </span>
    </button>
  )
}

/** A short message over the HUD ("Not enough Coins!") that fades by itself. */
export function Toast() {
  const toast = useGame((s) => s.toast)
  const showToast = useGame((s) => s.showToast)
  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => showToast(null), 2600)
    return () => clearTimeout(id)
  }, [toast, showToast])
  if (!toast) return null
  return (
    <div className="pointer-events-none absolute left-1/2 text-center" style={{ top: '28%', transform: 'translateX(-50%)', fontSize: u(44) }}>
      <div key={toast.id} className="pp-bounce">
        <StrokeText stroke={u(9)} gradient="linear-gradient(180deg, #ffffff 0%, #ffe6e2 100%)">
          {toast.text}
        </StrokeText>
      </div>
    </div>
  )
}
