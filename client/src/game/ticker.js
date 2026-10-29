import { inWorldsPortal, nearFreeCoins, onLaunchPad, pedestalNear } from '@shared/world'

import { getGame, useGame } from '../store/game'
import { setWorld } from './ride/course'
import { ride } from './ride/rideControl'
import { runtime } from './runtime'

const TICK_MS = 100

const sameZone = (a, b) => a.pad === b.pad && a.pedestal === b.pedestal && a.freeCoins === b.freeCoins

/**
 * The 10 Hz bridge between the frame-rate world and the UI: works out what the player
 * is standing by (the slingshot's pad, a premium sled, the free coins) and walks them
 * into the WORLDS panel when they step through its portal. This - not the render loop -
 * is what writes that into the store, and only when something actually changed.
 *
 * @returns {() => void} stop
 */
export function startGameTicker() {
  let inPortal = false

  setWorld(getGame().profile.world)
  const unsubscribe = useGame.subscribe((state, prev) => {
    // Before React renders the new world: its slide is built from this (GameScene).
    if (state.profile.world !== prev.profile.world) setWorld(state.profile.world)
  })

  const tick = () => {
    const game = getGame()
    const p = runtime.player.position
    const lobby = !ride.active && game.phase === 'lobby'
    const zone = {
      pad: lobby && onLaunchPad(p.x, p.z),
      pedestal: lobby ? (pedestalNear(p.x, p.z)?.id ?? null) : null,
      freeCoins: lobby && nearFreeCoins(p.x, p.z),
    }
    if (!sameZone(zone, game.zone)) game.setZone(zone)

    // Through the WORLDS portal: the Worlds panel (once per walk in).
    const portal = lobby && inWorldsPortal(p.x, p.z)
    if (portal && !inPortal && !game.panel) game.openPanel('worlds')
    inPortal = portal
  }

  const id = setInterval(tick, TICK_MS)
  return () => {
    clearInterval(id)
    unsubscribe()
  }
}
