import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { BOXITY_BOARDS } from '../../shared/balance.js'
import { createProfile } from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { LAUNCH_PAD } from '../../shared/world.js'
import { isGuestId, legionId, noteScores } from '../src/boxity.js'
import { adoptGuestProgress, closeStorage, loadProfile, openStorage, saveProfile, topPlayers } from '../src/db.js'

before(() => openStorage({ mongoUri: '', path: ':memory:' }))
after(() => closeStorage())

test('Boxity report ids: legion_<id>, no mode suffix; our own guests are never reported', () => {
  assert.equal(legionId('abc123'), 'legion_abc123')
  assert.equal(legionId('legion_abc123'), 'legion_abc123')
  assert.equal(legionId('abc123#m2'), 'legion_abc123')
  assert.equal(isGuestId('guest-1f2e'), true)
  assert.equal(isGuestId('abc123'), false)
  // A guest's scores are dropped before they're even queued.
  noteScores('guest-1f2e', createProfile('guest-1f2e', 'G'), 50)
})

test('the leaderboards are declared as Boxity takes them', () => {
  assert.deepEqual(
    BOXITY_BOARDS.map((b) => b.id),
    ['distance', 'coins', 'playtime'],
  )
  for (const board of BOXITY_BOARDS) {
    assert.match(board.id, /^[a-z0-9_-]{1,32}$/)
    assert.ok(['best', 'sum', 'latest'].includes(board.mode))
    assert.ok(['number', 'compact', 'time'].includes(board.format))
    assert.ok(['none', 'daily', 'weekly', 'monthly'].includes(board.reset))
  }
})

test('a guest who signs in brings their progress to a new account - once', async () => {
  const guest = await loadProfile('boxity-guest-1', 'Guest', 'pod:a')
  guest.coins = 500
  guest.upgrades.slingshot = 4
  await saveProfile(guest, 'pod:a')

  assert.equal(await adoptGuestProgress('account-1', ['boxity-guest-1']), 'boxity-guest-1')
  const account = await loadProfile('account-1', 'Player', 'pod:b')
  assert.equal(account.id, 'account-1')
  assert.equal(account.coins, 500)
  assert.equal(account.upgrades.slingshot, 4)

  // That guest save can never go to a second account...
  assert.equal(await adoptGuestProgress('account-2', ['boxity-guest-1']), null)
  // ...and an account that already has progress keeps its own.
  const other = await loadProfile('boxity-guest-2', 'Guest', 'pod:a')
  other.coins = 9
  await saveProfile(other, 'pod:a')
  assert.equal(await adoptGuestProgress('account-1', ['boxity-guest-2']), null)
  assert.equal((await loadProfile('account-1', 'Player', 'pod:b')).coins, 500)
})

test('the plaza boards rank distance, coins and playtime', async () => {
  const p = await loadProfile('ranked', 'Ranked', 'pod:a')
  p.stats.bestDistance = 4321
  p.stats.coinsEarned = 99999
  p.stats.playtime = 600
  await saveProfile(p, 'pod:a')
  const top = await topPlayers(10)
  assert.equal(top.distance[0].value, 4321)
  assert.equal(top.coins[0].value, 99999)
  assert.equal(top.playtime[0].value, 10)
})

test('Coins earned riding are counted for the Most Coins board', () => {
  const p = createProfile('a', 'A')
  const s = new PlayerSession(p, { now: 0, emit: () => {}, getPosition: () => ({ x: LAUNCH_PAD.x, y: 0, z: LAUNCH_PAD.z }) })
  s.handle('startRide', {}, 0)
  s.handle('rideAt', { s: 150, x: 0 }, 20000)
  s.handle('endRide', { s: 150 }, 20000)
  assert.ok(p.coins > 0)
  assert.equal(s.coinsEarned, p.coins)
})
