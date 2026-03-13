Review the Tidebound scenario given by $ARGUMENTS. Arguments: `<scenario> [difficulty]` — e.g. `scenario_01 hard`.

You are reviewing a generated scenario for quality before it is bundled. Work through three phases in order.

---

## Game mechanics reference

- **Characters are fixed.** They never move. The investigator moves freely between adjacent locations.
- **Items** start at `starting_location`, invisible until the player inspects that location (`inspect` command reveals them via `location_discovery_text`). Inspecting an item picks it up into inventory — items are carried, not placed on the map.
- **Clues fire immediately** when their action condition is met. All qualifying clues fire — no cap. No accusation gate on firing.
- **Five action types** — each fires specific clue conditions:
  - `move` → passive, reveals NPCs at destination, no clues fire
  - `inspect` (location) → fires `inspect_location` clues; reveals visible items; fires `inspect_item_in_location` for items already in inventory
  - `inspect <item_id>` → picks up item, fires `inspect_item` and `inspect_item_in_location` clues
  - `talk <char_id>` → fires `talk_to_character` clues
  - `ask <char_id> <item_id>` → fires `ask_character_about_item` clues (item must be in inventory)
- **Elimination model**: All clues are true observations. No red herrings. Each clue has a `contradicts` array. To confirm a checkpoint, the player must collect clues that contradict every wrong answer option. The remaining answer is confirmed automatically.
- **Accusation gate (submission only)**: `perpetrator` and `motive` checkpoint *submission* is locked until all three investigative checkpoints are confirmed. Clues for these fire freely — design their conditions to require deliberate routing so they are naturally collected after investigative facts are established.
- **Difficulty** trims answer options (not clues): easy = 3 options, medium = 4, hard = all 5–6.

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
6. Use `auto <cp_id>` once you believe you have enough clues to cover a checkpoint.
7. Stop when all checkpoints are solved or after 60 actions.

### Notes to keep during play
- Clue count from first `inspect` at arrival.
- Which checkpoints had obvious coverage vs. required deliberate routing.
- Any action where no new clues fired and the next step was unclear.
- Any wrong answer that you could not find a contradicting clue for.

---

## Phase 2 — Structural audit

Read the full scenario JSON. Work through every item on this checklist.

### Arrival clue flood
Count `inspect_location` clues that fire on the first inspect of the arrival location (no item required). More than 4 is too many.

### Coverage check
For every checkpoint, for every wrong answer option, identify which clue(s) contradict it. Build the full table. Any uncovered wrong answer is a structural failure — the player literally cannot confirm that checkpoint.

### Contradiction quality
For each (clue → wrong answer) pair: is the contradiction actually logically valid from the clue text alone? "No puncture wound found" validly contradicts "stabbing." "Witness seemed nervous" does not validly contradict anything specific. Flag weak contradictions.

### Anti-clustering
Identify any clue with 3+ contradicts entries. Is it genuinely specific enough to warrant that many contradictions, or is it a vague catch-all that shortcuts the investigation?

### Contradiction clarity
Confirm no clue can be construed to contradict a correct answer. A clue that appears to rule out the correct answer will derail the player.

### Timing elimination
For the `time_of_death` checkpoint: list every wrong answer_option. For each, identify which clue makes it logically impossible. "Less supported" is not enough — it must be contradicted. If any wrong option has no contradicting clue, the timing answer is unsolvable.
Time clues should use standard and precise time descriptions. "Before dawn" is useless. "After one bell" is useless. Use clock-style references that definitively rule out specific time windows.

### Routing check
Do the clues that contradict perpetrator and motive wrong answers require deliberate routing (item-chains, specific character visits)? Or are they trivially available from the arrival location? They should naturally be discovered after investigative facts are established.

### Item-chain discoverability
For every `ask_character_about_item` or `inspect_item_in_location` condition: the player must be carrying the item. Check whether a prior clue or `location_discovery_text` gives a clear reason to pick up that item *and* bring it to that character or location. If none exists, the player has no reason to attempt that combination.

### Motive traceability
Without the epilogue, can a player reconstruct the specific reason the perpetrator killed from clue texts alone? If it requires reading between lines, the motive clues are too vague.

---

## Quality rubric

**Good**: ≤4 clues on first arrival inspect · perpetrator/motive contradicting clues require deliberate routing · every item-chain clue has explicit signposting · every wrong answer has at least one contradicting clue · contradictions are logically valid · no clue seems to contradict a correct answer · motive traceable from clue texts alone.

**Fixable**: arrival clue flood · missing item-chain signpost · one uncovered wrong answer (add a clue) · weak contradiction that needs rewording · perpetrator clues available too trivially.

**Unsalvageable**: perpetrator implied in opening narrative or character descriptions · fixing requires changing the perpetrator, murder location, or motive · more than 4 wrong answers across different checkpoints have no contradicting clue.

---

## Phase 3 — Improvements

If `src/scenarios/reasoning.txt` exists, read it now — **not before**. It contains the LLM's design narrative. Use it to ensure your edits surface that narrative rather than inventing a different one.

For each issue, propose a specific JSON edit with a one-sentence reason. Keep changes minimal.

**Valid edits**: rewrite a clue `text` · change a clue `condition` · add or rewrite a `lead` · change an item's `starting_location` · rewrite `location_discovery_text` on an item · rewrite a character `description` (surface only) · add a new clue with a `contradicts` entry covering an uncovered wrong answer · adjust a clue's `contradicts` array.

**Do not**: change character locations · change `crime` block values · add new characters or items · change checkpoint `answer_options`.

---

## Phase 4 — Prompt & Review Improvements

For each issue, consider whether we can modify the `src/engine/generator.ts` prompt to improve scenario generation and propose any improvements.
Consider whether there are any updates we should make to `.claude/commands/review.md` to improve future reviews.

### Output format

```
ISSUE: [audit category] — [one sentence]
FIX: [field path] — [proposed new value or rewrite]
REASON: [what player experience problem this addresses]
```

If unsalvageable, state clearly with the specific reason.
