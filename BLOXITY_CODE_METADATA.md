---
gameId: sled-surfers
clientDir: client
buildCommand: npm run build
distDir: client/dist
# Nobody dies: a ride ends when the sled stops (or at the finish), with a results card.
# Boxity's "Reset Character" ends a ride (banked) or sends you to spawn.
canDie: false
# Leaderboards, declared by the client and scored by the server.
hasScore: true
leaderboards:
  - { id: distance, label: Longest Ride, mode: best, format: number, reset: none }
  - { id: coins, label: Most Coins, mode: sum, format: compact, reset: weekly }
  - { id: playtime, label: Minutes Played, mode: best, format: number, reset: none }
roomSize: 8
rewardedAds:
  - { placement: triple-coins, reward: "CLAIM 3x - the last ride's Coins twice more" }
notApplicable:
  gems: Nothing is sold for Gems. Everything is bought with Coins (earned riding) and Diamonds (from daily tasks, gifts and the login streak) - coin packs, the premium sleds and early world unlocks included.
  playWithFriends: Hosted on Boxity and joining through its matchmaker, so Boxity's own private rooms seat invited friends together; the game makes no private rooms of its own.
---

# Sled Surfers on Boxity

Launch your sled down a giant snowy slide: pull back the slingshot, steer for the
coins, hit the boost pads, smash the brick walls and burn rocket fuel, then spend your
Coins on a stronger SLINGSHOT, better SLEDS, more INCOME and TRAILS (Diamonds buy
ROCKET fuel, coin packs and the premium sleds). Each slide comes in stages with their
own scenery and wall patterns. Beat Snowy Peaks to open Gold Rush (a desert canyon),
and Gold Rush to open Lava Volcano - or open them early with Diamonds.

The game rules are shared by client and server (`shared/`): `balance.js` (every number),
`course.js` (each world's slide, seeded), `ride.js` (the ride's physics), `logic.js`
(the rules), `session.js` (one player's authoritative session). The client simulates
the ride for instant feel; the server holds it to what the player's gear could do and
works out what it pays.

Where each piece of the Boxity integration lives:

| Feature | Where |
| --- | --- |
| Environment (prod / stage / local), every Boxity URL | `client/src/bloxity/env.js`, `server/src/boxity.js` |
| Sign-in, avatar and proportions (the one `onUserChanged`) | `client/src/bloxity/BloxityProvider.jsx` |
| Rewarded ads (CLAIM 3x) | `client/src/bloxity/services.js`; verified by `server/src/boxity.js` (`verifyAdReward`) |
| Emotes, leaderboards, settings, ad breaks, player events, chat, Escape menu, screen ads | `client/src/bloxity/platform.js` |
| Free 5,000 Coins for signing in (once per account) | `shared/logic.js` `claimFreeCoins`, the money bag in the plaza |
| Chat bubbles | `client/src/game/speechBubbles.js`, `client/src/game/ChatBubbles.jsx` |
| Matchmaker, ?roomId= joins, rejoining after signing in, room and friend reporting | `client/src/net/connection.js` |
| Token check, guest progress, room directory, leaderboard scores | `server/src/boxity.js`, `server/src/rooms/GameRoom.js`, `server/src/db.js` |
| Deploy to prod and stage | `.github/workflows/deploy.yml` |

## Server environment

| Variable | Purpose |
| --- | --- |
| `BLOXITY_REPORT_TOKEN` | Token for leaderboard reports (none set = no reports) |
| `BLOXITY_GAME_ID` | Hosted game id (`sled-surfers`) |
| `MONGODB_URI` | Shared database for profiles (SQLite without) |
