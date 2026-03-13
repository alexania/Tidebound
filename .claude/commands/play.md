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
| `cp` | Checkpoints with status — shows which wrong answers are disproved and which remain |
| `prove <cp_id> "<wrong_answer>" with <clue_id>` | Assign a clue to disprove a specific wrong answer for a checkpoint |
| `reset` | Wipe saved state and restart |

## Elimination model

All clues are true observations. There are no red herrings. The correct answer for each checkpoint is the one not contradicted by any clue.

To confirm a checkpoint, you must collect clues that contradict every wrong answer option. Once all wrong answers are disproved, the remaining answer is automatically confirmed.

Use `cp` to see which wrong answers still need to be disproved. Use `clues` to see each clue's `contradicts` array — this shows which wrong answers each clue makes impossible.

## Checkpoints

There are exactly **3 checkpoints**, unlocking sequentially:

1. **`true_location`** — available immediately. Where was the murder committed?
2. **`perpetrator`** — **locked** until `true_location` is confirmed. Who committed the murder?
3. **`motive`** — **locked** until `perpetrator` is confirmed. Why did they do it?

## IDs

All commands take IDs, not display names. IDs are surfaced in output:
- **Location IDs**: shown in `Reachable:` line and via `locs`
- **Character IDs**: shown in `Here:` line when encountered, and via `chars`
- **Item IDs**: shown in `Visible items:` line after inspecting a location, and via `items` once carried

Use `locs`, `chars`, and `items` freely — they don't cost actions.

## Agent strategy

- Start fresh: run `reset` if there is any saved state from a prior session.
- On arrival, `inspect` the starting location. Note the `Visible items:` line for item IDs.
- After each action, read all output carefully before deciding the next step — clues fire immediately.
- Use `locs` to see all location IDs. Use `chars` to see all encountered character IDs.
- Visit every location and `talk` to every character.
- Items must be picked up (`inspect <item_id>`) before they can be shown to characters.
- Use `clues` to review what you have collected.
- Use `cp` before every `prove` to see the elimination state for each checkpoint.
- To confirm a checkpoint: read each collected clue, decide which wrong answer it makes impossible, then use `prove <cp_id> "<wrong_answer>" with <clue_id>`. Once all wrong answers are disproved, the correct answer is confirmed automatically.
- **`true_location`** is available immediately — start elimination here.
- **`perpetrator`** unlocks once `true_location` is confirmed. Each wrong suspect is eliminated by placing them elsewhere during the confirmed murder window.
- **`motive`** unlocks once `perpetrator` is confirmed. Each wrong motive is a specific falsifiable theory contradicted by a clue.
- After each action, reason aloud: what you now know, which wrong answers are eliminated, what's still uncertain, and why you're making your next move.
