import { nextRaceAt, RACE } from './balance.js'

/**
 * The races, for one room of players - the game server's room, or the offline stand-in
 * with its one player. Every RACE.everyMs, on the clock: a join window opens RACE.joinMs
 * before the start; at the start everyone who joined launches together on the same race
 * sled; once they've all stopped (or RACE.maxMs on), the racers in each world are ranked
 * by how far they got and, if there were at least RACE.minRacers of them, the top three
 * win Diamonds. The server decides all of it: a client only asks to join and rides.
 *
 * Members are a Map of id -> `{ name, session, send(type, payload) }`; their sessions
 * report a race ride starting and ending (\`started\`, \`finished\`).
 */
export class RaceHost {
  /** The race open or running: `{ id, startsAt, phase: 'join' | 'running', racers }`, or null. */
  race = null

  /** Call at a steady rate. */
  tick(now, members) {
    if (!this.race) {
      const at = nextRaceAt(now)
      if (at - now > RACE.joinMs) return
      this.race = { id: at, startsAt: at, phase: 'join', racers: new Map() }
      this.announce(now, members)
      return
    }
    const race = this.race
    if (race.phase === 'join' && now >= race.startsAt) {
      if (race.racers.size === 0) {
        this.race = null
        this.announce(now, members)
        return
      }
      race.phase = 'running'
      for (const [id, racer] of race.racers) {
        const member = members.get(id)
        // Gone, or already riding (they set off on their own): out of this one.
        if (!member || member.session.ride) {
          racer.done = true
          continue
        }
        member.session.raceId = race.id
        member.send('raceGo', { id: race.id, stats: RACE.stats })
      }
      this.announce(now, members)
      return
    }
    if (race.phase !== 'running') return
    const late = now - race.startsAt
    for (const [id, racer] of race.racers) {
      if (racer.done) continue
      const member = members.get(id)
      // Never set off (the client didn't start the ride), or still going at the end.
      if (!racer.started && late > RACE.startGraceMs) racer.done = true
      else if (late > RACE.maxMs) {
        if (member?.session.ride?.race === race.id) member.session.finish(now, 'race')
        racer.done = true
      }
    }
    if ([...race.racers.values()].every((r) => r.done)) this.settle(now, members)
  }

  /** `id` asks to race: only while the join window is open, and not mid-ride. */
  join(id, member, now, members) {
    const race = this.race
    if (!race || race.phase !== 'join') {
      member.send('raceRefused', { text: 'The next race opens soon!' })
      return
    }
    if (member.session.ride) {
      member.send('raceRefused', { text: 'Finish your ride first!' })
      return
    }
    if (race.racers.has(id)) return
    race.racers.set(id, { id, name: member.name, world: member.session.profile.world, distance: 0, started: false, done: false })
    this.announce(now, members)
  }

  /** `id`'s race ride has set off. */
  started(id, raceId) {
    const racer = this.race?.id === raceId ? this.race.racers.get(id) : null
    if (racer) racer.started = true
  }

  /** `id`'s race ride is over, `distance` metres down the slide. */
  finished(id, raceId, distance) {
    const racer = this.race?.id === raceId ? this.race.racers.get(id) : null
    if (!racer) return
    racer.distance = distance
    racer.started = true
    racer.done = true
  }

  /** `id` has left the room. */
  leave(id) {
    const race = this.race
    const racer = race?.racers.get(id)
    if (!racer) return
    if (race.phase === 'join') race.racers.delete(id)
    else racer.done = true
  }

  /** Tells `id` (just arrived) where the races are at. */
  hello(id, member, now) {
    member.send('race', this.statusFor(id, now))
  }

  /** Ranks each world's racers, pays the top three, tells every racer how it went. */
  settle(now, members) {
    const race = this.race
    this.race = null
    const byWorld = new Map()
    for (const racer of race.racers.values()) {
      if (!racer.started) continue
      if (!byWorld.has(racer.world)) byWorld.set(racer.world, [])
      byWorld.get(racer.world).push(racer)
    }
    for (const list of byWorld.values()) {
      list.sort((a, b) => b.distance - a.distance)
      const prized = list.length >= RACE.minRacers
      const standings = list.map((r, i) => ({ name: r.name, distance: Math.floor(r.distance), prize: prized ? (RACE.prizes[i] ?? 0) : 0 }))
      list.forEach((racer, i) => {
        const member = members.get(racer.id)
        if (!member) return
        if (standings[i].prize) member.session.awardRace(standings[i].prize)
        member.send('raceResult', { id: race.id, standings: standings.slice(0, 8), place: i + 1, of: list.length, prize: standings[i].prize, prized })
      })
    }
    this.announce(now, members)
  }

  announce(now, members) {
    for (const [id, member] of members) member.send('race', this.statusFor(id, now))
  }

  /**
   * What `id` should know: time to the next start (\`inMs\`: clocks differ, so a span, not
   * a time), the phase, how many have joined, and whether they have.
   */
  statusFor(id, now) {
    const race = this.race
    if (!race) return { phase: 'idle', inMs: nextRaceAt(now) - now }
    return { phase: race.phase, id: race.id, inMs: Math.max(0, race.startsAt - now), racers: race.racers.size, joined: race.racers.has(id) }
  }
}
