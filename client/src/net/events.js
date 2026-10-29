import { SLEDS, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'

import { sfx } from '../audio/sfx'
import { burst } from '../game/fx/fxQueue'
import { spawnPopup } from '../game/fx/popups'
import { raceGo, rideEndedByServer, rideResult, ride } from '../game/ride/rideControl'
import { runtime } from '../game/runtime'
import { getGame, useGame } from '../store/game'

const patchGame = (patch) => useGame.setState(patch)
import { flyCoins } from '../ui/coinsFly'
import { fadeThrough } from '../ui/fade'
import { iconUrl } from '../ui/icons'

/** A new world's name, big in the middle of the screen. */
const BIG_POPUP = { screen: true, u: 0, v: 0.25, scale: 3, gradient: 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)', life: 2600 }
// Read when used: the 3D diamond replaces the SVG one once it's rendered.
const DIAMOND = () => iconUrl('diamond')

/** A point above wherever you're drawn: the lobby, or down the slide mid-ride. */
const atPlayer = (dy = 1.2) => {
  const p = ride.active ? ride.position : runtime.player.position
  return { x: p.x, y: p.y + dy, z: p.z }
}

/**
 * Applies one authority event to the client: updates the store and kicks off any
 * visual effect. The same handler serves the Colyseus connection and offline mode.
 */
export function handleServerEvent(type, payload) {
  const game = getGame()
  switch (type) {
    case 'profile': {
      const before = game.profile
      const after = payload.profile
      game.setProfile(after, payload.session)
      if (!game.profileLoaded) break
      // Celebrate the purchases, whatever made them.
      const up = before.upgrades
      if (after.sleds.length > before.sleds.length || after.trails.length > before.trails.length || ['slingshot', 'income', 'rocket'].some((k) => after.upgrades[k] > up[k])) {
        sfx.buy()
        burst({ ...atPlayer(1.6), count: 30, palette: 'gold' })
      }
      break
    }

    case 'rideResult':
      rideResult(payload)
      break

    case 'rideEnd':
      rideEndedByServer(payload?.reason, payload?.id)
      break

    case 'diamond':
      sfx.reveal()
      spawnPopup('+1', atPlayer(2), { iconUrl: DIAMOND(), scale: 1.3, gradient: 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)' })
      break

    case 'reward': {
      sfx.wins()
      burst({ ...atPlayer(1.6), count: 40, palette: 'gold', speed: 8 })
      if (payload.coins > 0) {
        game.holdCoins(game.profile.coins)
        setTimeout(() => flyCoins(payload.coins), 150)
      }
      if (payload.diamonds > 0) spawnPopup(`+${payload.diamonds}`, atPlayer(2.6), { iconUrl: DIAMOND(), scale: 1.4, gradient: BIG_POPUP.gradient })
      if (payload.sled) spawnPopup(`${SLEDS[payload.sled]?.name ?? 'New sled'}!`, atPlayer(), { ...BIG_POPUP, gradient: 'linear-gradient(180deg, #fff6a3 0%, #ffcf2e 45%, #f08c00 100%)' })
      if (payload.source === 'ad' && payload.coins > 0) spawnPopup(`+${formatNumber(payload.coins)}`, atPlayer(), { ...BIG_POPUP, iconUrl: iconUrl('coin') })
      break
    }

    // The races: where they're at (a span to the start: our clocks differ), the start
    // itself, and how it went.
    case 'race':
      patchGame({ race: { ...payload, startsAt: Date.now() + (payload.inMs || 0) } })
      break
    case 'raceGo':
      sfx.newBest()
      raceGo(payload)
      break
    case 'raceRefused':
      sfx.error()
      game.showToast(payload.text)
      break
    case 'raceResult':
      if (payload.place === 1) sfx.wins()
      else sfx.reveal()
      patchGame({ raceResult: payload })
      break

    // Back after a while: the Welcome Back panel shows what INCOME earned (already banked).
    case 'away':
      game.setWelcome(payload)
      break

    case 'badge':
      sfx.wins()
      break

    // To another world: a flash to black and the new world's name.
    case 'world': {
      const name = WORLDS[payload.world]?.name ?? 'Snowy Peaks'
      fadeThrough(() => null)
      sfx.wins()
      setTimeout(() => spawnPopup(`${name.toUpperCase()}!`, runtime.player.position, BIG_POPUP), 300)
      break
    }

    default:
      break
  }
}

