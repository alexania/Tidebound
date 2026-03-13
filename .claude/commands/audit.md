Audit the Tidebound scenario given by $ARGUMENTS and propose improvements. Arguments: `<scenario>` — e.g. `scenario_01`.

Read the full scenario JSON located at `src/scenarios/<scenario_name>.json` first, then work through the checklist below.

---

## Game mechanics reference

- **Characters are fixed.** They never move. The investigator moves freely between adjacent locations.
- **Items** start at `starting_location`, invisible until the player inspects that location (`inspect` command reveals them via `location_discovery_text`). Inspecting an item picks it up into inventory — items are carried, not placed on the map.
- **Clues fire immediately** when their action condition is met. All qualifying clues fire — no cap. No gate on clue firing.
- **Five action types** — each fires specific clue conditions:
  - `move` → passive, reveals NPCs at destination, no clues fire
  - `inspect` (location) → fires `inspect_location` clues; reveals visible items; fires `inspect_item_in_location` for items already in inventory
  - `inspect <item_id>` → picks up item, fires `inspect_item` and `inspect_item_in_location` clues
  - `talk <char_id>` → fires `talk_to_character` clues
  - `ask <char_id> <item_id>` → fires `ask_character_about_item` clues (item must be in inventory)
- **Elimination model**: All clues are true observations. No red herrings. To confirm a checkpoint, the player must collect clues whose text makes every wrong answer option impossible. The remaining answer is confirmed automatically.
- **Given facts**: Cause of death and time of death are not checkpoints. They are stated in the `opening_narrative` as established facts before the investigator arrives. The medical authority's clues are for elaboration and alibi only.
- **3 checkpoints, sequential**:
  1. `true_location` — always available
  2. `perpetrator` — locked until `true_location` confirmed
  3. `motive` — locked until `perpetrator` confirmed
- **Difficulty** trims answer options (not clues): easy = 3 options, medium = 4, hard = all 5–6.

---

## Structural audit checklist

### Opening narrative check
Does the `opening_narrative` explicitly state the cause of death and a precise clock-style time window as established facts? Flag if either is vague, absent, or uses non-clock-style time references. The medical authority character's clues should serve elaboration and alibi — they must not be the sole source of cause/time.

### Arrival clue flood
Count `inspect_location` clues that fire on the first inspect of the arrival location (no item required). More than 4 is too many.

### Coverage check
For every checkpoint, for every wrong answer option, identify which clue(s) contradict it. Build the full table. Any uncovered wrong answer is a structural failure — the player literally cannot confirm that checkpoint.

### Elimination direction test
For each (clue → wrong answer) pair: does it pass "if wrong answer X were true, this clue would be impossible — without assuming any other checkpoint's answer"? Evidence of what happened is not evidence of what didn't happen. Flag any contradiction that fails this test.

### Location coverage
For each wrong location option: is it made impossible by (a) an alibi witness — a non-perpetrator character demonstrably present there during the murder window, (b) victim-trajectory — a witness places the victim alive leaving that location during the window, or (c) inaccessibility — the location was physically closed/blocked? If none of these apply, the location cannot be eliminated.

**Positive evidence trap**: finding physical evidence at the correct location does NOT eliminate wrong locations. "Blood found at X" is positive evidence for X, not a contradiction of Y or Z. Any location contradiction that works by pointing to the correct location rather than ruling out the wrong one fails the elimination direction test — flag it.

### Perpetrator coverage
For each wrong suspect: is there a clue placing them elsewhere during the confirmed murder window at the confirmed location — alibi only? The alibi must satisfy two conditions: (a) it comes from a third-party witness, not the suspect's own testimony — a suspect reporting their own whereabouts is not an alibi; (b) it covers the full murder time window with no gaps — a witness seeing someone at one moment in the window leaves the rest open. Flag any alibi that fails either condition. Does the perpetrator conspicuously lack any such alibi?

### Motive coverage
Are the wrong motive options specific falsifiable theories (not generic categories like "jealousy")? Does each have a specific clue — testimony, document, or relationship fact — that makes it impossible?

### Contradiction quality
For each (clue → wrong answer) pair: is the contradiction actually logically valid from the clue text alone? "No puncture wound found" validly contradicts "stabbing." "Witness seemed nervous" does not validly contradict anything specific. Flag weak contradictions. A clue telling you the correct answer is bad.

### Anti-clustering
Identify any clue with 3+ contradicts entries. Is it genuinely specific enough to warrant that many contradictions, or is it a vague catch-all that shortcuts the investigation?

### Contradiction clarity
Confirm no clue can be construed to contradict a correct answer. A clue that appears to rule out the correct answer will derail the player.

### Clue count
Flag if outside 12–16 clues.

### Routing check
Do the clues that contradict perpetrator and motive wrong answers require deliberate routing (item-chains, specific character visits)? Or are they trivially available from the arrival location? They should naturally be discovered after the location is established.

### Item-chain discoverability
For every `ask_character_about_item` or `inspect_item_in_location` condition: the player must be carrying the item. Check whether a prior clue or `location_discovery_text` gives a clear reason to pick up that item *and* bring it to that character or location. If none exists, the player has no reason to attempt that combination.

### Motive traceability
Without the epilogue, can a player reconstruct the specific reason the perpetrator killed from clue texts alone? If it requires reading between lines, the motive clues are too vague.

---

## Quality rubric

**Good**: ≤4 clues on first arrival inspect · 12–16 clues total · opening_narrative explicitly states cause and clock-style time window · every wrong answer covered · elimination direction test passes for all pairs · location eliminations use alibi/victim-trajectory/inaccessibility · perpetrator wrong answers eliminated by alibi · motive wrong answers are specific falsifiable theories · perpetrator/motive clues require deliberate routing · every item-chain clue has explicit signposting · no clue seems to contradict a correct answer · motive traceable from clue texts alone.

**Fixable**: arrival clue flood · missing item-chain signpost · one uncovered wrong answer (add a clue) · weak contradiction that needs rewording · perpetrator clues available too trivially · opening_narrative missing cause/time · clue count outside 12–16.

**Unsalvageable**: perpetrator implied in opening narrative or character descriptions · fixing requires changing the perpetrator, murder location, or motive · more than 4 wrong answers across different checkpoints have no contradicting clue · elimination direction test fails for multiple clues in a way that cannot be fixed without restructuring the scenario.

---

## Phase 3 — Improvements

If `src/scenarios/reasoning.txt` exists, read it now. It contains the LLM's design narrative. Use it to ensure your edits surface that narrative rather than inventing a different one.

For each issue, propose a specific JSON edit with a one-sentence reason. Keep changes minimal.

**Valid edits**: rewrite a clue `text` · change a clue `condition` · add or rewrite a `lead` · change an item's `starting_location` · rewrite `location_discovery_text` on an item · rewrite a character `description` (surface only) · add a new clue with a `contradicts` entry covering an uncovered wrong answer · adjust a clue's `contradicts` array.

**Do not**: change character locations · change `crime` block values · add new characters or items · change checkpoint `answer_options`.

---

## Phase 4 — Prompt & Review improvements

For each issue found, consider whether we can modify `src/engine/generator.ts` to prevent it in future generations and propose any specific prompt improvements.
Consider whether there are any updates we should make to `.claude/commands/audit.md` or `.claude/commands/review.md` to improve future reviews.

---

### Output format

```
ISSUE: [audit category] — [one sentence]
FIX: [field path] — [proposed new value or rewrite]
REASON: [what player experience problem this addresses]
```

If unsalvageable, state clearly with the specific reason.
