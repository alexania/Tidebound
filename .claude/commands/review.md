Review the Tidebound scenario given by $ARGUMENTS. Arguments: `<scenario> [difficulty]` — e.g. `scenario_01 hard`.

You are reviewing a generated scenario for quality before it is bundled. Work through three phases in order.

---

## Game mechanics reference

- **Characters are fixed.** They never move. The investigator moves freely between adjacent locations each turn.
- **Items** start at `starting_location`, are discovered when the investigator visits that location, and can be moved to *any* location at a cost of 1 action per turn.
- **Clues fire** at end of turn when their condition is met. All qualifying clues fire — no cap.
- **Condition types**: `investigator_at_location` · `investigator_with_character` · `investigator_with_item` · `investigator_at_location_with_item` · `investigator_with_character_and_item`
- **`requires_clue_id`**: the prerequisite must be collected in a *previous* turn. Both cannot fire in the same turn resolution.
- **Difficulty**: hard = 2 correct + 3 red herrings per checkpoint. Medium strips to 2 RH, easy to 1 RH. `requires_clue_id` must always point at a correct clue — red herrings are stripped and would make the dependent permanently unreachable.
- **Checkpoint unlock**: `cause_of_death`, `true_location`, `time_of_death` available from turn 1. `perpetrator` and `motive` unlock only after all three investigative checkpoints are confirmed.
- **Clue weights** (`correct` / `red_herring`) are not shown to the player. A single correct clue is suspicious but deniable. Both correct clues together should be conclusive.
- **Red herring clues are not reliable.** They may be outright lies, genuine observations that happen to be misleading, or true facts that point nowhere useful. A clue that sounds specific, confident, or authoritative is not necessarily correct. The only way to identify the right answer is convergence: two clues pointing at the same option.

---

## Phase 1 — Blind play

**Do not read the `crime` block of the scenario JSON before playing.**

Play using the CLI:
```sh
echo "<commands>" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

### Systematic strategy
1. Note all leads, characters, and items visible from the arrival location on turn 1.
2. Visit every character at least once, following leads first.
3. Move items only when a clue text or lead explicitly suggested the pairing — never randomly.
4. After visiting all characters, revisit any location where a prior clue mentioned an item not yet there.
5. Stop when all checkpoints are solved or after 20 turns.

### Notes to keep during play
- Turn 1 clue count.
- Which checkpoints felt logically solvable vs. required guessing.
- Any turn where no new clues fired and the next step was unclear.
- Any clue that could plausibly support multiple answers.

---

## Phase 2 — Structural audit

Read the full scenario JSON. Work through every item on this checklist.

### Turn 1 clue flood
Count clues whose conditions fire at turn 1 (arrival location, no item required). More than 4 is too many.

### Perpetrator clue timing
Identify both correct perpetrator clues. Can both realistically fire before turn 3? If so, the killer is functionally obvious before red herrings have done their work.

### `requires_clue_id` signposting
For every clue with `requires_clue_id`: read the prerequisite's clue text. Does it leave an explicit unresolved thread — a named object not examined, an open question, a reference to follow up — that gives the player a concrete reason to return? A self-contained, conclusive prerequisite text leaves nothing to revisit.

### Item-chain discoverability
For every `investigator_with_character_and_item` or `investigator_at_location_with_item` condition: check if the item's `starting_location` matches the condition location or character's fixed location. If it does, no signposting needed. If the item must be *carried* there from elsewhere: find the prior visible text that explicitly names both the item and the target together. If none exists, the player has no reason to attempt that combination.

### Timing elimination
For the `time_of_death` checkpoint: list every wrong answer_option. For each, identify which correct clue makes it logically impossible. "Less supported" is not enough — it must be contradicted. If any wrong option survives both correct clues, the timing answer is guessable not solvable.

### Red herring coverage
Confirm all 3 red herrings per checkpoint target different wrong answer_options. Confirm each is dismissible once both correct clues are collected.

### Motive traceability
Without the epilogue, can a player reconstruct the specific reason the perpetrator killed from clue texts alone? If it requires reading between lines, the motive clues are too vague.

---

## Quality rubric

**Good**: ≤4 clues on turn 1 · both perpetrator correct clues require deliberate routing · every `requires_clue_id` prerequisite prompts revisiting · item-chain clues have explicit signposting where needed · timing correct clues eliminate every wrong option · motive traceable from clue texts alone.

**Fixable**: turn 1 flood · missing item-chain signpost · timing options not fully eliminated · perpetrator obvious too early · `requires_clue_id` prerequisite doesn't prompt revisiting · one undismissible red herring.

**Unsalvageable**: perpetrator implied in opening narrative or character descriptions · fixing requires changing the perpetrator, murder location, or motive · more than 4 clues across different checkpoints need structural changes (not just text edits).

---

## Phase 3 — Improvements

If `src/scenarios/reasoning.txt` exists, read it now — **not before**. It contains the LLM's design narrative: the story it was trying to tell, the characters' hidden knowledge, and the intended clue logic. Use it to ensure your edits surface that narrative rather than inventing a different one. The JSON is authoritative; the reasoning is context.

For each issue, propose a specific JSON edit with a one-sentence reason. Keep changes minimal.

**Valid edits**: rewrite a clue `text` · change a clue `condition` · add or rewrite a `lead` · change an item's `starting_location` · rewrite a character `description` (surface only) · add `requires_clue_id` to a clue currently set to null.

**Do not**: change character locations · change `crime` block values · add new characters or items · change checkpoint `answer_options`.

### Output format

```
ISSUE: [audit category] — [one sentence]
FIX: [field path] — [proposed new value or rewrite]
REASON: [what player experience problem this addresses]
```

If unsalvageable, state clearly with the specific reason.
