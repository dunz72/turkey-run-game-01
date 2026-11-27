# Gobble Dash — The Great Turkey Escape

[![Gobble Dash](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![Rank](https://make.fun/badge/turkey-run-game-01/dunz72/turkey-run-game-01/rank.svg)](https://make.fun/bounty/turkey-run-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![Reward](https://make.fun/badge/turkey-run-game-01/dunz72/turkey-run-game-01/reward.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

Thanksgiving is coming, and the farmer has the oven preheated. You are the turkey.
Run 1,600 metres from the farmyard, through the barn and the kitchen, to the forest
gate — jumping fences, hay bales, ovens and the carving knife that drops from above,
grabbing corn, pumpkins and golden feathers, and diving into haystacks to lose the
farmer on your tail. Get caught three times, or let him close the gap, and you are
dinner.

## How to play

- **← → or A D** — dawdle or sprint (sprinting opens the gap to the farmer; dawdling closes it)
- **Space / ↑ / W / click** — jump
- **↓ / S** — dive into a haystack to hide (only next to one)
- **P / Esc** — pause · **M** — mute

The HUD shows score, distance with a progress bar to the forest gate, lives and the
stage. The farmer slides in from the left as the gap closes — when he is right behind
you, sprint, grab corn or hide.

## Stages

Farmyard → Barn → Kitchen → Forest Edge. Each stretch is faster and spawns hazards
closer together; the oven only appears from the barn on, and the kitchen is full of
them.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files and all art and sound are
drawn and synthesized in code.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.
