Play the Tidebound scenario given by $ARGUMENTS using the CLI.

Arguments: `<scenario> [difficulty]` — e.g. `scenario_01 hard`. Difficulty defaults to easy if omitted.

## How to play

Run commands by piping them to the CLI via Bash:

```sh
echo "<command>" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

You can pipe multiple commands at once for efficiency:

```sh
echo "move harbour
inspect
talk martha" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

State persists between runs — each invocation picks up where the last left off.

## CLI commands

| Command | Effect |
|---|---|
| `move <loc_id>` | Move investigator to an adjacent location — reveals NPCs present |
| `inspect` | Inspect current location — reveals items (`location_discovery_text`), fires `inspect_location` clues |
| `inspect <item_id>` | Pick up item into inventory and inspect it — fires `inspect_item` and `inspect_item_in_location` clues |
| `talk <char_id>` | Talk to a character at current location — fires `talk_to_character` clues |
| `ask <char_id> <item_id>` | Show inventory item to character — fires `ask_character_about_item` clues |
| `locs` | All locations (`*` = you, `>` = reachable, `[inspected]`) with found characters |
| `chars` | Found characters and their fixed locations |
| `items` | Inventory (carried items with IDs) |
| `clues` | All collected clues in action order |
| `cp` | Checkpoints with status and numbered answer options |
| `submit <cp_id> <n> <clue_id> [clue_id ...]` | Submit answer option N, citing the clue IDs that support it |
| `reset` | Wipe saved state and restart |

## Agent strategy

- On arrival, `inspect` the starting location before moving anywhere.
- After each action, read all output carefully before deciding the next step — clues fire immediately.
- Visit every location and `talk` to every character before attempting `ask` combinations.
- Only `ask` a character about an item when there a logical reason to do so.
- Items must be picked up (`inspect <item_id>`) before they can be shown to characters.
- Use `cp` before every `submit` to confirm option numbers. Use `clues` to get the clue IDs to cite.
- After each action, reason aloud: what you now know, what's still uncertain, and why you're making your next move.
- Perpetrator and motive clues will **not fire** until all three investigative checkpoints (`cause_of_death`, `true_location`, `time_of_death`) are confirmed. Solve the crime scene first — talking to suspects or asking about items before that point will yield no clues.
- Do not trust a clue just because it sounds specific or authoritative. Red herring clues may be outright lies, genuine but misleading observations, or true facts that point nowhere. Only two clues converging on the same answer gives you confidence.
