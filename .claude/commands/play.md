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
| `clues` | All collected clues in action order, with their `contradicts` arrays |
| `cp` | Checkpoints with status — shows which wrong answers are disproved and which remain |
| `prove <cp_id> "<wrong_answer>" with <clue_id>` | Assign a clue to disprove a specific wrong answer for a checkpoint |
| `auto <cp_id>` | Auto-assign collected clues to all wrong answers; submits if coverage is complete |
| `reset` | Wipe saved state and restart |

## Elimination model

All clues are true observations. There are no red herrings. The correct answer for each checkpoint is the one not contradicted by any clue.

To confirm a checkpoint, you must collect clues that contradict every wrong answer option. Once all wrong answers are disproved, the remaining answer is automatically confirmed.

Use `cp` to see which wrong answers still need to be disproved. Use `clues` to see each clue's `contradicts` array — this shows which wrong answers each clue makes impossible.

## Agent strategy

- On arrival, `inspect` the starting location before moving anywhere.
- After each action, read all output carefully before deciding the next step — clues fire immediately.
- Visit every location and `talk` to every character.
- Items must be picked up (`inspect <item_id>`) before they can be shown to characters.
- Use `clues` to review what you have collected and what each clue contradicts.
- Use `cp` before every `prove` or `auto` to see the elimination state for each checkpoint.
- After collecting clues, try `auto <cp_id>` for each available checkpoint. If it succeeds, all wrong answers were covered. If not, the output tells you which wrong answer has no contradicting clue yet.
- Perpetrator and motive checkpoints are **locked until all three investigative checkpoints** (`cause_of_death`, `true_location`, `time_of_death`) are confirmed — but their clues fire freely. Collect them throughout the investigation.
- After each action, reason aloud: what you now know, which wrong answers are eliminated, what's still uncertain, and why you're making your next move.
