import { DIAMOND_SHOP, FREE_COINS, NEXT_WORLD, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { BANNER, FREE_COINS_STATUE, PEDESTALS, WORLDS_PORTAL } from '@shared/world'

/** Text styles, as gradients top-to-bottom, matching the reference signage. */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
  orange: ['#fff1c2', '#ffb03b', '#ff6a00'],
}

/** "8d 16h 49m": how long until the next world opens. */
export function countdownText(now = Date.now()) {
  const left = Math.max(0, NEXT_WORLD.opensAt - now)
  const d = Math.floor(left / 86400000)
  const h = Math.floor((left % 86400000) / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  return left > 0 ? `${d}d ${h}h ${m}m` : 'SOON!'
}

/** The banner over the entrance: the world you're in. */
export const bannerLabelSpec = (world = 0) => ({
  lines: [{ text: `WORLD ${world + 1}: ${(WORLDS[world]?.name ?? '').toUpperCase()}`, size: 52, fill: '#2b3c78' }],
  pxPerUnit: 70,
})

/** Every label in the lobby. */
export function lobbyLabels(profile) {
  return [
    {
      id: 'worlds-portal',
      position: [WORLDS_PORTAL.x, 10.4, WORLDS_PORTAL.z + 1],
      spec: { lines: [{ text: 'WORLDS', size: 78, fill: '#ffffff' }], pxPerUnit: 46 },
      fade: 130,
    },
    ...PEDESTALS.map((p) => ({
      id: `pedestal-${p.id}`,
      position: [p.x, 5.3, p.z],
      spec: {
        lines: [
          { text: DIAMOND_SHOP[p.product].name, size: 46, fill: '#ffffff' },
          { text: String(DIAMOND_SHOP[p.product].diamonds), size: 46, icon: 'diamond', gradient: TEXT.blue },
        ],
        pxPerUnit: 54,
      },
      fade: 110,
    })),
    {
      id: 'free-coins',
      position: [FREE_COINS_STATUE.x, 7.6, FREE_COINS_STATUE.z],
      spec: {
        lines: [
          { text: `FREE ${formatNumber(FREE_COINS).replace('K', ',000')} COINS!`, size: 60, rainbow: true },
          { text: profile.freeCoins ? 'Claimed - thanks for playing!' : 'Sign in to Bloxity & claim!', size: 34, gradient: TEXT.green },
        ],
        pxPerUnit: 50,
      },
      fade: 120,
    },
    {
      id: 'banner',
      position: [BANNER.x, 5.4, BANNER.z - 0.4],
      spec: bannerLabelSpec(profile.world),
      reserve: bannerLabelSpec(1),
      fade: 120,
    },
  ]
}
