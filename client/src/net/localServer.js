import { normalizeProfile } from '@shared/logic'
import { RaceHost } from '@shared/race'
import { PlayerSession } from '@shared/session'

import { useBloxityStore } from '../bloxity/store'
import { runtime } from '../game/runtime'

const SAVE_KEY = 'sled.save.v1'
const TICK_MS = 100
const SAVE_MS = 5000

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
  } catch {
    return null
  }
}

/**
 * Offline stand-in for the game server: runs the same PlayerSession the Colyseus room
 * runs, against a save in localStorage. Used when no server is configured or it can't
 * be reached, so the game is always playable.
 *
 * With no server to ask Boxity, a rewarded ad is granted here - only ever after the SDK
 * itself reported it watched to the end (see bloxity/services.js).
 *
 * @param {{ id: string, name: string, onEvent: (type: string, payload: object) => void }} options
 * @returns {{ send: (type: string, payload?: object) => void, close: () => void }}
 */
export function createLocalServer({ id, name, onEvent }) {
  const profile = normalizeProfile(loadSave(), id, name)
  const startedAt = Date.now()

  const session = new PlayerSession(profile, {
    now: startedAt,
    // The session mutates its profile in place; the UI must get its own copy or it
    // would never see a change (same reference) and could edit server state.
    emit: (type, payload) => onEvent(type, payload ? structuredClone(payload) : payload),
    getPosition: () => runtime.player.position,
    verified: Boolean(useBloxityStore.getState().user),
  })

  // The races run here too, with you the only racer (too few for prizes).
  const races = new RaceHost()
  const me = { name, session, send: (type, payload) => session.emit(type, payload) }
  const members = new Map([['me', me]])
  session.onJoinRace = (now) => races.join('me', me, now, members)
  session.onRaceStart = (raceId) => races.started('me', raceId)
  session.onRaceEnd = (raceId, s) => races.finished('me', raceId, s)

  const save = () => {
    try {
      profile.lastSeen = Date.now()
      localStorage.setItem(SAVE_KEY, JSON.stringify(profile))
    } catch {
      // Storage full or blocked: progress just won't persist this session.
    }
  }

  let last = performance.now()
  const tickId = setInterval(() => {
    const t = performance.now()
    session.tick(Math.min(0.5, (t - last) / 1000), Date.now())
    races.tick(Date.now(), members)
    last = t
  }, TICK_MS)
  const saveId = setInterval(save, SAVE_MS)
  const onHide = () => {
    if (document.visibilityState === 'hidden') save()
  }
  window.addEventListener('beforeunload', save)
  document.addEventListener('visibilitychange', onHide)
  // Signing in mid-game counts for the free coins.
  const unsubscribe = useBloxityStore.subscribe((s) => {
    session.verified = Boolean(s.user)
  })

  session.sendProfile()
  session.greet()
  races.hello('me', me, Date.now())

  return {
    send(type, payload) {
      if (type === 'adReward') {
        session.grantAdReward(String(payload?.placement), Date.now())
        save()
        return
      }
      session.handle(type, payload, Date.now())
    },
    close() {
      clearInterval(tickId)
      clearInterval(saveId)
      unsubscribe()
      window.removeEventListener('beforeunload', save)
      document.removeEventListener('visibilitychange', onHide)
      save()
    },
  }
}
