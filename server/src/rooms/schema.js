import { schema, t } from '@colyseus/schema'

/** `rideMeter` while not riding. */
export const NOT_RIDING = -1000

/**
 * Synced state, kept deliberately small: only what other players need to draw you.
 * Everything private (Coins, Diamonds, upgrades, tasks...) goes to its owner alone as
 * 'profile' messages, never through the shared state.
 */
export const PlayerState = schema(
  {
    name: t.string(),
    /** Their Boxity account id, as Boxity verified it ('' for our own guests): what chat bubbles are matched by. */
    uid: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    rotY: t.float32(),
    /** 'idle' | 'walk' | 'jump' | 'pull' (on the slingshot) | 'ride' | 'dance' */
    anim: t.string(),
    /** The Boxity emote they're playing ('' = none), and when it started (ms since its own epoch, for its phase). */
    emote: t.string(),
    emoteAt: t.float64(),
    /** What their Bloxity avatar wears, as JSON `{ equipped, proportions }` ('' = base). */
    look: t.string(),
    /** The sled they ride and the trail behind it. */
    sled: t.string(),
    trail: t.string(),
    /** Down the slide: how far (NOT_RIDING in the lobby), how far across, and how high. */
    rideMeter: t.float32(),
    rideX: t.float32(),
    rideY: t.float32(),
    /** The world they're in (WORLDS index): others only see their ride in the same one. */
    world: t.uint8(),
    /** Their best ride in that world, for the progress bar. */
    best: t.float32(),
  },
  'PlayerState',
)

export const GameState = schema(
  {
    /** sessionId -> player */
    players: t.map(PlayerState),
    /** Short code for private lobbies ('' for public ones). */
    code: t.string(),
    isPrivate: t.boolean(),
  },
  'GameState',
)
