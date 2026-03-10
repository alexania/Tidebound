Play the Tidebound scenario given by $ARGUMENTS using the CLI.

Arguments: `<scenario> [difficulty]` — e.g. `scenario_01 hard`. Difficulty defaults to easy if omitted.

## How to play

Run commands by piping them to the CLI via Bash:

```sh
echo "<command>" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

You can pipe multiple commands at once for efficiency:

```sh
echo "move salt_works
end" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

State persists between runs — each invocation picks up where the last left off.

## CLI commands

| Command | Effect |
|---|---|
| `move <loc_id>` | Move investigator to an adjacent location |
| `item <item_id> <loc_id>` | Move a found item to any location (1 action/turn) |
| `end` | Resolve turn — fires clues, advances counter |
| `locs` | All locations with contents |
| `chars` | Found characters and their locations |
| `items` | Found items and their current locations |
| `clues` | All collected clues in turn order |
| `cp` | Checkpoints with status and numbered answer options |
| `submit <cp_id> <n>` | Submit answer option N for a checkpoint |
| `reset` | Wipe saved state and restart |

## Agent strategy

- After each `end`, read all new clues carefully before deciding the next move.
- Visit every character at least once before trying item combinations.
- Only move an item if a clue text or lead explicitly suggested that pairing.
- Use `cp` before every `submit` to confirm option numbers.
- After each turn, reason aloud: what you now know, what's still uncertain, and why you're making your next move.
- Do not trust a clue just because it sounds specific or authoritative. Red herring clues may be outright lies, genuine but misleading observations, or true facts that point nowhere. Only two clues converging on the same answer gives you confidence.
