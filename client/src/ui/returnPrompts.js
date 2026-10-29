import { getGame, useGame } from '../store/game'

/**
 * The welcome for someone coming back, in turn, as soon as they're free in the lobby:
 * first the Coins their INCOME earned while they were away, then today's login-streak
 * prize. Each shows once a session; closing one brings on the next.
 */

let loginShown = false
let installed = false

export function promptReturn() {
  const game = getGame()
  if (!game.playable || !game.profileLoaded || game.panel || game.phase !== 'lobby') return
  if (game.welcome) {
    game.openPanel('away', game.welcome)
    game.setWelcome(null)
    return
  }
  if (!loginShown && game.profile.login?.claimed === false) {
    loginShown = true
    game.openPanel('login')
  }
}

/** Starts watching for the moments to welcome the player (once the game's on screen). */
export function installReturnPrompts() {
  if (installed) return
  installed = true
  useGame.subscribe((state, prev) => {
    const freed = (prev.panel && !state.panel) || (prev.phase !== 'lobby' && state.phase === 'lobby')
    const arrived = state.profileLoaded && (!prev.profileLoaded || state.welcome !== prev.welcome || state.profile.login !== prev.profile.login)
    if (freed || arrived) setTimeout(promptReturn, 600)
  })
  setTimeout(promptReturn, 1200)
}
