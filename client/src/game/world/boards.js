import { formatNumber } from '@shared/format'

/** The plaza's three leaderboards, as in the reference: title, colour and how values read. */
export const BOARD_INFO = {
  playtime: { title: 'PLAYTIME', color: '#2f8ff2', format: (v) => (v >= 60 ? `${Math.floor(v / 60)}h ${v % 60}m` : `${v}m`) },
  distance: { title: 'DISTANCE', color: '#22b14c', format: (v) => (v >= 1000 ? `${formatNumber(Math.round(v / 100) / 10)}km` : `${formatNumber(v)}m`) },
  coins: { title: 'COINS', color: '#e8a400', format: (v) => formatNumber(v) },
}

/** A player's own number on board `id`, from their profile. */
function ownValue(profile, id) {
  if (id === 'playtime') return Math.floor((profile.stats.playtime || 0) / 60)
  if (id === 'distance') return Math.floor(profile.stats.bestDistance || 0)
  return Math.floor(profile.stats.coinsEarned || 0)
}

/**
 * Board `id`'s rows: the server's top ten, or - offline, with no boards from a server -
 * just you.
 */
export function boardRows(leaderboards, profile, id) {
  const rows = leaderboards?.[id]
  if (rows?.length) return rows
  return [{ name: profile.name, value: ownValue(profile, id) }]
}
