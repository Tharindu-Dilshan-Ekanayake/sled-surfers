/**
 * Player intents. The UI never changes game state itself: it calls one of these, the
 * authority (the Colyseus room, or the offline stand-in) validates it, and the result
 * comes back as an updated profile or an event.
 */

let transport = null

/** Installs the active connection: `{ send(type, payload) }`. */
export function setTransport(next) {
  transport = next
}

export function send(type, payload) {
  if (!transport) return
  transport.send(type, payload)
}

export const actions = {
  /** Let go of the slingshot, standing on its pad: a ride begins. */
  startRide: (id, race) => send('startRide', race ? { id, race } : { id }),
  /** Join the race whose window is open. */
  joinRace: () => send('joinRace'),
  /** Where the ride has got to (a few times a second). */
  rideAt: (s, x, y) => send('rideAt', { s, x, y }),
  /** Pickups carry where the sled is (`s`): the server's last report may be behind a fast sled. */
  collectCoin: (index, s) => send('collectCoin', { index, s }),
  collectDiamond: (index, s) => send('collectDiamond', { index, s }),
  /** A wall smashed or a boost pad hit, for the daily tasks. */
  rideHit: (kind, index, s) => send('rideHit', { kind, index, s }),
  /** The ride's over: bank it. */
  endRide: (s, id) => send('endRide', { s, id }),
  upgrade: (kind) => send('upgrade', { kind }),
  buySled: (id) => send('buySled', { id }),
  equipSled: (id) => send('equipSled', { id }),
  buyTrail: (id) => send('buyTrail', { id }),
  equipTrail: (id) => send('equipTrail', { id }),
  setWorld: (world) => send('setWorld', { world }),
  claimGift: (index) => send('claimGift', { index }),
  claimAllGifts: () => send('claimAllGifts'),
  claimTask: (index) => send('claimTask', { index }),
  claimTaskChest: () => send('claimTaskChest'),
  claimFreeCoins: () => send('claimFreeCoins'),
  /** Today's login-streak prize. */
  claimLogin: () => send('claimLogin'),
  notifyMe: () => send('notifyMe'),
  /** A rewarded ad watched to the end: the server checks the token with Boxity. */
  adReward: (placement, rewardToken) => send('adReward', { placement, rewardToken }),
  /** Something from the Diamond shop: a coin pack, a premium sled, Gold Rush early. */
  buyDiamondItem: (id) => send('buyDiamondItem', { id }),
  /** A Boxity emote started ('' when it stops), so the room sees it. */
  emote: (id) => send('emote', { id }),
  /** Back to the spawn point (Boxity's "Reset Character"). */
  respawn: () => send('respawn'),
}
