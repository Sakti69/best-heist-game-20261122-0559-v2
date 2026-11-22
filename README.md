# Meridian Vault II — The Grand Take

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Sakti69/best-heist-game-20261122-0559-v2/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Sakti69/best-heist-game-20261122-0559-v2/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

An original top-down heist game for the make.fun bounty **"Make the best heist game"**
($50 USDC, 10 winners). No library, no network request: plain static files
that open in desktop Chrome.

You are Rook, a thief in the Meridian Bank after closing. Lift every piece of
loot on each of the five floors — The Lobby, The Vault Hall, The Gallery,
The Bullion Room, The Rooftop Getaway — then reach the helipad, unseen.

## How it plays

- **Guards with vision cones** — cones are raycast against walls and cover,
  so a cone stops at the wall it hits. Patrols walk fixed routes you can
  learn; a sentry sweeps his cone back and forth. A guard who half-sees you
  shows "?", one who is sure shows "!", one on the hunt shows "!!".
- **Cameras** — wall-mounted, sweeping cones. They see you too, and they never blink.
- **Lasers** — red beams blink on and off across the corridors. Crossing a live
  beam spikes the alarm meter. Time the blink, or kill the beam with an EMP.
- **The alarm meter** — it rises while any guard or camera sees you (faster up
  close, slower crouched or in shadow). At full it trips the alarm and the
  guards hunt you; break line of sight for a few seconds and the alarm stands down.
- **Cover and shadow** — desks, pillars, display cases and vaults block sight;
  dark floor patches slow detection. Running is fast but loud: guards in earshot
  come to look.
- **Gadgets** — coins (click anywhere to toss one, 3 per floor, and pull the
  nearest guard over to investigate), EMP (key 2: cameras and lasers dark for
  8 seconds), smoke (key 3: a cloud no watcher sees through for 6 seconds).
- **Safes** — press E beside one to crack it: stop the needle in the green zone
  three times for +750. A miss feeds the alarm meter and pulls the guards in.
- **Keycard door** — the Bullion Room hides a bonus vault behind a red keycard
  door. Lift the card, open the door, lift the two bonus pieces inside.
- **Black market** — between floors, spend score on EMPs, smoke, extra lives
  and coins, then move on.
- **Minimap** — the whole floor in the corner: walls, loot, guards, cameras,
  exit and you.
- **Score and grade** — 500 per piece of loot, floor-clear and time bonuses, a
  300 ghost bonus for a floor cleared without an alarm, −150 per catch.
  Three lives. Finish the job and the game grades the run: S for a perfect
  ghost, down to C.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

WASD / arrows move, Shift sprints, C crouches, click tosses a coin, 2 fires the
EMP, 3 drops smoke, E cracks a safe, P pauses, M mutes. Sound is synthesized
with WebAudio — no audio files.

## Layout

- `game/` — the playable game as static files (`index.html` + ES modules under `src/`)
- `screenshots/` — four real renders of the game's own code
- `main.ts` — the program that hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's library, unchanged
