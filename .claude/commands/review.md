Review the Tidebound scenario given by $ARGUMENTS. Arguments: `<scenario> [difficulty]` — e.g. `scenario_01 hard`.

You are reviewing a generated scenario for quality before it is bundled. Work through three phases in order.

---

## Game mechanics reference

- **Characters are fixed.** They never move. The investigator moves freely between adjacent locations.
- **Items** start at `starting_location`, invisible until the player inspects that location (`inspect` command reveals them via `location_discovery_text`). Inspecting an item picks it up into inventory — items are carried, not placed on the map.
- **Clues fire immediately** when their action condition is met. All qualifying clues fire — no cap.
- **Five action types** — each fires specific clue conditions:
  - `move` → passive, reveals NPCs at destination, no clues fire
  - `inspect` (location) → fires `inspect_location` clues; reveals visible items; fires `inspect_item_in_location` for items already in inventory
  - `inspect <item_id>` → picks up item, fires `inspect_item` and `inspect_item_in_location` clues
  - `talk <char_id>` → fires `talk_to_character` clues
  - `ask <char_id> <item_id>` → fires `ask_character_about_item` clues (item must be in inventory)
- **`requires_clue_id`**: the prerequisite must be collected in a *previous* action. Both cannot fire from the same action.
- **Difficulty**: hard = 2 correct + 3 red herrings per checkpoint. Medium strips to 2 RH, easy to 1 RH. `requires_clue_id` must always point at a correct clue — red herrings are stripped and would make the dependent permanently unreachable.
- **Accusation gate**: `perpetrator` and `motive` clues will **not fire** until all three investigative checkpoints (`cause_of_death`, `true_location`, `time_of_death`) are confirmed. The engine suppresses them entirely — attempting the relevant actions before that point returns locked feedback, not clues.
- **Clue weights** (`correct` / `red_herring`) are not shown to the player. A single correct clue is suspicious but deniable. Both correct clues together should be conclusive.
- **Red herring clues are not reliable.** They may be outright lies, genuine observations that happen to be misleading, or true facts that point nowhere useful. A clue that sounds specific, confident, or authoritative is not necessarily correct. The only way to identify the right answer is convergence: two clues pointing at the same option.

---

## Phase 1 — Blind play

**Do not read the JSON before playing.**

Play using the CLI:
```sh
echo "<commands>" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

### Systematic strategy
1. On arrival: `inspect` the starting location. Note all leads, visible items, and characters present.
2. Pick up visible items with `inspect <item_id>` before moving on.
3. Visit every character at least once (`talk <char_id>`), following leads first.
4. After visiting all characters, return to any location where a clue suggested bringing a specific item.
5. Use `ask <char_id> <item_id>` only when a clue or lead explicitly suggested that pairing.
6. Stop when all checkpoints are solved or after 60 actions.

### Notes to keep during play
- Clue count from first `inspect` at arrival.
- Which checkpoints felt logically solvable vs. required guessing.
- Any action where no new clues fired and the next step was unclear.
- Any clue that could plausibly support multiple answers.

---

## Phase 2 — Structural audit

Read the full scenario JSON. Work through every item on this checklist.

### Arrival clue flood
Count `inspect_location` clues that fire on the first inspect of the arrival location (no item required). More than 4 is too many.

### Perpetrator clue timing
Identify both correct perpetrator clues. Can both realistically fire within the first 10 actions? If so, the killer is functionally obvious before red herrings have done their work.

### Item-chain discoverability
For every `ask_character_about_item` or `inspect_item_in_location` condition: the player must be carrying the item. Check whether a prior clue or `location_discovery_text` gives a clear reason to pick up that item *and* bring it to that character or location. If none exists, the player has no reason to attempt that combination.

### Timing elimination
For the `time_of_death` checkpoint: list every wrong answer_option. For each, identify which correct clue makes it logically impossible. "Less supported" is not enough — it must be contradicted. If any wrong option survives both correct clues, the timing answer is guessable not solvable.
Time clues should use standard and precise time descriptions. "Before dawn" is useless as it's not even sure when dawn is. "After one bell..." is useless as no one knows what a "bell" is. Time clues that simply imply "a lot" of time has passed is similarly useless.

### Red herring coverage
Confirm all 3 red herrings per checkpoint target different wrong answer_options. Confirm each is dismissible once both correct clues are collected.

### Motive traceability
Without the epilogue, can a player reconstruct the specific reason the perpetrator killed from clue texts alone? If it requires reading between lines, the motive clues are too vague.

---

## Quality rubric

**Good**: ≤4 clues on first arrival inspect · both perpetrator correct clues require deliberate routing · every `requires_clue_id` prerequisite prompts revisiting · item-chain clues have explicit signposting where needed · timing correct clues eliminate every wrong option · motive traceable from clue texts alone.

**Fixable**: arrival clue flood · missing item-chain signpost · timing options not fully eliminated · perpetrator obvious too early · `requires_clue_id` prerequisite doesn't prompt revisiting · one undismissible red herring.

**Unsalvageable**: perpetrator implied in opening narrative or character descriptions · fixing requires changing the perpetrator, murder location, or motive · more than 4 clues across different checkpoints need structural changes (not just text edits).

---

## Phase 3 — Improvements

If `src/scenarios/reasoning.txt` exists, read it now — **not before**. It contains the LLM's design narrative: the story it was trying to tell, the characters' hidden knowledge, and the intended clue logic. Use it to ensure your edits surface that narrative rather than inventing a different one. The JSON is authoritative; the reasoning is context.

For each issue, propose a specific JSON edit with a one-sentence reason. Keep changes minimal.

**Valid edits**: rewrite a clue `text` · change a clue `condition` · add or rewrite a `lead` · change an item's `starting_location` · rewrite `location_discovery_text` on an item · rewrite a character `description` (surface only) · add `requires_clue_id` to a clue currently set to null.

**Do not**: change character locations · change `crime` block values · add new characters or items · change checkpoint `answer_options`.

---

## Phase 4 - Prompt & Review Improvements

For each issue, consider whether we can modify the `src/engine/generator.ts` prompt to improve scenario generation and propose any improvements.
Consider whether there are any updates we should make to `.claude/commands/review.md` to improve future reviews.

### Output format

```
ISSUE: [audit category] — [one sentence]
FIX: [field path] — [proposed new value or rewrite]
REASON: [what player experience problem this addresses]
```

If unsalvageable, state clearly with the specific reason.
