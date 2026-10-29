import { DIAMOND_SHOP } from '@shared/balance'

import { sfx } from '../audio/sfx'
import { actions } from '../net/actions'
import { getGame } from '../store/game'

/**
 * Buys DIAMOND_SHOP item `id` (a coin pack, a premium sled, Gold Rush early) with
 * Diamonds - or, short of them, says how to get more. The server has the final say.
 */
export function buyWithDiamonds(id) {
  const item = DIAMOND_SHOP[id]
  const game = getGame()
  if (!item) return
  if (game.profile.diamonds < item.diamonds) {
    sfx.error()
    game.showToast(`Need ${item.diamonds - game.profile.diamonds} more Diamonds! Do tasks & open gifts`)
    return
  }
  actions.buyDiamondItem(id)
}
