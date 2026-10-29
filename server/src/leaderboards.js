import { saveProfile, topPlayers } from './db.js'
import { activePlayers, broadcastAll } from './registry.js'

const REFRESH_MS = 60_000
let cached = { playtime: [], distance: [], coins: [], updatedAt: 0 }

/** Latest top-10 boards for the plaza (Playtime, Distance, Coins). */
export function getLeaderboards() {
  return cached
}

async function refresh() {
  try {
    // Fold in progress from people still playing here, so the boards aren't a save
    // behind. Other pods do the same for theirs.
    await Promise.all(
      [...activePlayers.values()].map(({ room, client }) => {
        const member = room.members.get(client.sessionId)
        return member && !member.kicked ? saveProfile(member.session.profile, member.owner) : null
      }),
    )
    cached = { ...(await topPlayers(10)), updatedAt: Date.now() }
    broadcastAll('leaderboards', cached)
  } catch (err) {
    console.error('[leaderboards] refresh failed', err)
  }
}

export function startLeaderboards() {
  refresh()
  const id = setInterval(refresh, REFRESH_MS)
  return () => clearInterval(id)
}
