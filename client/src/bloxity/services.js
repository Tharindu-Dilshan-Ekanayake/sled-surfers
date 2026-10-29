import { actions } from '../net/actions'
import { isOnline } from '../net/connection'
import { getGame } from '../store/game'
import { getSDK, safeCall } from './sdk'

/**
 * Boxity services for the game's UI: rewarded ads (CLAIM 3x), signing in (the free
 * coins) and Boxity's leaderboards. Nothing in the game is sold for Bloxity Gems: it all
 * goes on Coins and Diamonds earned playing. Plain functions - call them from anywhere.
 *
 * Every call is safe without the SDK (offline, outside Boxity, script blocked): it
 * reports "not available" instead of throwing. Async ones never reject.
 *
 * Grants are never decided here. Online, the game server checks the rewarded-ad token
 * with Boxity. Offline there is no server, so the offline stand-in (net/localServer.js)
 * grants - and it is only told to after Boxity reported the ad watched to the end.
 */

const errorText = (err) => (err instanceof Error ? err.message : String(err ?? 'error'))

/** Is the game playing offline against its local stand-in? */
const playingOffline = () => !isOnline() && getGame().net.mode === 'offline'

// --- Rewarded ads ---------------------------------------------------------------------

/** True when Boxity can show a rewarded ad here (inside the portal, ads enabled). */
export function isRewardedAvailable() {
  const ads = getSDK()?.ads
  if (typeof ads?.showRewarded !== 'function') return false
  const available = safeCall(ads.isAvailable?.bind(ads))
  return available === undefined ? true : Boolean(available)
}

/**
 * Shows a rewarded ad for `placement` and, if it was watched to the end, claims the
 * reward. Resolves `{ ok, status, reason? }`: `ok` once the claim was sent (the reward
 * itself arrives as a 'reward' event); `status` is Boxity's ('completed', 'skipped'...).
 */
export async function watchRewardedAd(placement) {
  try {
    const sdk = getSDK()
    if (typeof sdk?.ads?.showRewarded !== 'function') return { ok: false, status: 'disabled', reason: 'no-sdk' }
    const result = await sdk.ads.showRewarded(placement)
    const status = result?.status || 'error'
    if (status !== 'completed') return { ok: false, status, reason: result?.reason }
    if (isOnline()) {
      // The server checks the token with Boxity once; no token, no reward.
      if (!result.rewardToken) return { ok: false, status, reason: 'no-reward-token' }
      actions.adReward(placement, result.rewardToken)
      return { ok: true, status }
    }
    if (playingOffline()) {
      actions.adReward(placement, result.rewardToken ?? null)
      return { ok: true, status }
    }
    return { ok: false, status, reason: 'not-connected' }
  } catch (err) {
    return { ok: false, status: 'error', reason: errorText(err) }
  }
}

// --- Signing in ------------------------------------------------------------------------

/** Opens Boxity's sign-in. Resolves once it's been shown (or there's no SDK). */
export async function signIn() {
  const auth = getSDK()?.auth
  await safeCall(auth?.showAuthPopup?.bind(auth))
}

// --- Leaderboards ----------------------------------------------------------------------

/** Opens Boxity's leaderboard overlay on board `id`. False when the portal can't show it. */
export function openBoxityLeaderboard(id) {
  const board = getSDK()?.leaderboard
  return Boolean(safeCall(board?.open?.bind(board), id))
}
