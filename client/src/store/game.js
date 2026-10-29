import { create } from 'zustand'

import { createProfile, createSession } from '@shared/logic'

/**
 * Everything the UI renders from. Written by the network layer (profile, events), the
 * 10 Hz game ticker (where you're standing) and the ride's timers - never from a frame
 * loop.
 *
 * Components must select narrowly (`useGame((s) => s.profile.coins)`), so a coin
 * picked up re-renders the counter and nothing else.
 */

export const useGame = create((set) => ({
  /** Authoritative copy of the player's save, as last sent by the server. */
  profile: createProfile('local', 'Player'),
  /** Per-connection state: session start, gifts claimed. */
  session: createSession(Date.now()),
  /** True once the first real profile has arrived. */
  profileLoaded: false,
  /** When it arrived (this device's clock): today's gifts count on from it until the next. */
  profileAt: Date.now(),
  /** True once the game is on screen; non-essential start-up work waits for it. */
  playable: false,

  net: {
    /** 'connecting' | 'online' | 'offline' | 'replaced' */
    mode: 'connecting',
    lobbyId: null,
    /** Short code friends join with, for private lobbies. */
    code: null,
    isPrivate: false,
    players: 1,
    maxPlayers: 8,
    message: null,
  },
  leaderboards: null,

  /** Where the player is standing, from the ticker. */
  zone: {
    /** On the slingshot's pad. */
    pad: false,
    /** By a premium sled's pedestal: its id. */
    pedestal: null,
    /** At the free-coins money bag. */
    freeCoins: false,
  },

  /**
   * What you're doing: 'lobby' (walking about), 'pull' (on the slingshot), 'ride' (down
   * the slide) or 'result' (the results card, at the bottom).
   */
  phase: 'lobby',
  /** The last ride's results, from the authority: see the session's 'rideResult'. */
  result: null,
  /** Which modal panel is open: 'worlds' | 'sleds' | 'trails' | 'tasks' | 'gifts' | ... */
  panel: null,
  /** Extra data for the open panel (e.g. which world's sleds). */
  panelData: null,
  /** Whether the upgrade cards under PLAY are folded away (the V button). */
  cardsHidden: false,
  /** Coins earned while away (`{ coins, minutes }`), until the Welcome Back panel shows them. */
  welcome: null,
  /** The races (RaceHost): `{ phase, startsAt, racers, joined }`, and the last one's results. */
  race: null,
  raceResult: null,
  /** True while Boxity shows an ad break: the game stands still. */
  paused: false,
  /** A short message over the HUD ("Not enough Coins!"), with an id so repeats re-show. */
  toast: null,
  /**
   * The Coins the counter shows while a ride's Coins fly home to it (it counts up as
   * each lands); null the rest of the time, when it shows your Coins.
   */
  coinsShown: null,

  // --- Actions -----------------------------------------------------------------

  setProfile: (profile, session) => set((s) => ({ profile, session: session || s.session, profileLoaded: true, profileAt: Date.now() })),
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  setZone: (zone) => set({ zone }),
  setPlayable: () => set({ playable: true }),
  setLeaderboards: (leaderboards) => set({ leaderboards }),

  openPanel: (panel, panelData = null) => set({ panel, panelData }),
  closePanel: () => set({ panel: null, panelData: null }),
  togglePanel: (panel) => set((s) => (s.panel === panel ? { panel: null, panelData: null } : { panel, panelData: null })),
  toggleCards: () => set((s) => ({ cardsHidden: !s.cardsHidden })),

  setPhase: (phase) => set(phase === 'lobby' ? { phase } : { phase, panel: null, panelData: null }),
  setResult: (result) => set({ result }),
  setPaused: (paused) => set({ paused }),
  setWelcome: (welcome) => set({ welcome }),
  showToast: (text) => set({ toast: text ? { text, id: performance.now() } : null }),
  /** Holds the Coins counter at `coins` (what you had before a payout), for the Coins on their way. */
  holdCoins: (coins) => set((s) => ({ coinsShown: s.coinsShown ?? Math.min(coins, s.profile.coins) })),
  /** Some of them have landed: the counter counts up (never past your real Coins). */
  landCoins: (amount) => set((s) => (s.coinsShown === null ? {} : { coinsShown: Math.min(s.profile.coins, Math.round(s.coinsShown + amount)) })),
  /** All home: the counter shows your Coins again. */
  showCoins: () => set({ coinsShown: null }),
}))

/** Non-reactive snapshot for timers and non-React code. */
export const getGame = () => useGame.getState()
