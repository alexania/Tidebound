# Tidebound CLI

Agent-first interactive game interface. Can also be used by humans.

## Launch

```sh
npx tsx scripts/play.ts <scenario> [difficulty]
```

- `scenario` — filename without `.json` (e.g. `scenario_01`, `easy/haulwick_easy_01`). Omit to pick from a list.
- `difficulty` — `easy` | `medium` | `hard`. Defaults to `easy` if omitted.

## Game loop

Each turn:
1. Optionally move (`move <loc_id>`) and/or reposition a found item (`item <item_id> <loc_id>`).
2. Resolve the turn (`end`). The engine fires any clues whose board conditions are now met.
3. Repeat until all checkpoints are confirmed.

State is persisted between runs — you can quit and resume without losing progress.

## Commands

| Command | Description |
|---|---|
| `move [loc_id]` | Move to an adjacent location. No arg: show reachable locations. |
| `item <item_id> <loc_id>` | Move a found item to any location (1 action per turn). |
| `end` | Resolve the turn. Prints new clues, found items/chars, then state. |
| `status` | Compact state: location, reachable, items, checkpoint summary. |
| `locs` | All locations (`*` = you, `>` = reachable), with visible characters and items. |
| `chars` | Found characters and their fixed locations. |
| `items` | Found items, their IDs, and current locations. |
| `clues` | All collected clues in turn order. |
| `cp` | All checkpoints with status and numbered answer options. |
| `submit <cp_id> <n>` | Submit answer option N for a checkpoint. |
| `reset` | Wipe saved state and restart from turn 1. |
| `help` | Command reference. |
| `quit` | Exit. |

## State block

Shown on startup, after `end`, and via `status`:

```
--- Turn 3 | salt_works | 1 item action(s) ---
Reachable: quayside (The Quayside), upper_walkway (The Upper Walkway)
Here: Tessek Oravi (tessek_oravi) [VICTIM], Maret Doun (maret_doun)
Items: salt_scraper @ salt_works | records_room_key @ salt_works
Checkpoints: cause_of_death[?] true_location[?] time_of_death[?] | perpetrator[locked] motive[locked]
Clues: 5
```

- `[?]` = available, `[✓]` = confirmed, `[locked]` = not yet unlocked
- Investigative checkpoints first, then `|`, then accusatory

## `end` output

```
--- Turn 2 | 4 new clue(s) ---
[CLUE] ...
[FOUND CHAR] Maret Doun (maret_doun) at salt_works
  Description text...
[FOUND ITEM] Salt-Scraper (salt_scraper) at salt_works
  Description text...
```

Location/atmosphere descriptions are suppressed — only evidence and discoveries are shown.

## Checkpoints

`cp` always shows answer options for available checkpoints:

```
cause_of_death [available]  How did Tessek Oravi die?
  1. Stabbing
  2. Drowning
  ...
perpetrator [locked]  Who killed Tessek Oravi?
```

Submit with: `submit cause_of_death 1`

Investigative checkpoints (`cause_of_death`, `true_location`, `time_of_death`) unlock first.
Accusatory checkpoints (`perpetrator`, `motive`) unlock once all investigative are confirmed.

## Notes for agents

- Location IDs are shown in `locs` and the state block. Use exact IDs in `move` and `item`.
- Item IDs are shown when discovered (`[FOUND ITEM]`) and in `items`. Use in `item`.
- `submit` always requires the option number — use `cp` first to see options, then `submit <id> <n>`.
- Clue text is the only evidence. Character/item descriptions provide context, not answers.
- Accusatory checkpoints (`perpetrator`, `motive`) are locked until all investigative ones are confirmed.
