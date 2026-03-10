# Tidebound — Scenario Review Guide

Agent instructions for post-generation scenario review. Read this before reviewing any scenario.

---

## Purpose

After a scenario is generated it must be reviewed before being bundled. The review has three phases:

1. **Blind play** — play the scenario without reading the answers, to experience it as a first-time player
2. **Structural audit** — read the full JSON and trace every clue chain for discoverability and fairness failures
3. **Improvements** — edit the JSON to fix identified issues, or flag the scenario as unsalvageable

---

## Game mechanics reference

Read this carefully. The audit depends on understanding exactly how the engine works.

### Map and movement
- Locations form a 3×3 grid. Not all 9 cells need to be occupied.
- The investigator starts at `arrival_location`. Each turn the investigator may move to one adjacent location (free — no action cost).
- **Characters are fixed.** They never move. Character placement is permanent.
- The investigator discovers a character or item the first time they visit that character/item's location. Before discovery, the character/item does not exist for the player.

### Items
- Items start at `starting_location`. They are discovered (and become moveable) when the investigator visits that location.
- The player may move a discovered item to **any location** — not just adjacent — at a cost of 1 action per turn.
- Each turn the player has **1 item action**.
- Items do not move themselves. If a clue condition requires item X at location Y, the player must have moved it there deliberately.

### Turn structure
1. **Setup phase**: investigator moves (free), then optionally move one item (1 action).
2. **Resolve**: engine evaluates all uncollected clues whose conditions are now met. Fires all that qualify — no cap.
3. **Review**: player may submit checkpoint answers.

### Clue conditions — exactly 5 types
```
investigator_at_location          — investigator is at a specific location (no item required)
investigator_with_character       — investigator is at the same location as a specific character
investigator_with_item            — investigator has a specific item at their current location
investigator_at_location_with_item — investigator is at a specific location AND item is there
investigator_with_character_and_item — investigator is with a specific character AND item is at that location
```
All conditions are checked against the board state at the moment of resolve, not during movement.

### `requires_clue_id`
A clue with `requires_clue_id: "X"` will **not fire** until clue X has been collected in a **previous turn**. It cannot fire in the same turn as its prerequisite, even if both conditions are satisfied simultaneously. The player must revisit the condition the following turn.

### Clue structure per checkpoint
- Each checkpoint has exactly **2 correct** clues and **3 red_herring** clues (at hard difficulty).
- Difficulty strips red herrings: easy keeps 1 per checkpoint, medium keeps 2, hard keeps all 3.
- `correct` clues all point at the right answer. Both must be collected before a player can confidently distinguish the correct answer from wrong ones — a single correct clue is suspicious but deniable.
- `red_herring` clues each point at a **different** wrong answer_option. They are false evidence; the player must collect enough correct clues to dismiss them.
- Clue `weight` and `answer` fields are not shown to the player. The player sees only clue text.

### Checkpoint unlock sequence
Investigative checkpoints (`cause_of_death`, `true_location`, `time_of_death`) are available from turn 1. Accusatory checkpoints (`perpetrator`, `motive`) unlock only after all three investigative checkpoints are confirmed correct.

---

## Phase 1 — Blind play

**Do not read the `crime` block before playing.** Do not read clue `answer`, `weight`, or `red_herring_explanation` fields. Play using only the CLI (`npx tsx scripts/play.ts <scenario> hard`).

### Systematic play strategy
The goal is to collect all available clues efficiently, not to solve as fast as possible.

1. On turn 1: note all characters, items, and leads visible from the arrival location. Read the opening narrative.
2. Visit every character at least once, prioritising leads that name a specific person or location.
3. When a clue text mentions a specific item, note it. When it mentions a specific character, note it. These are signals for item movement.
4. Only move an item if a clue text, lead, or character description explicitly suggested that pairing. Do not move items randomly.
5. After visiting all characters once, revisit locations where item conditions may apply — specifically: locations where a clue text mentioned an item that is not yet there.
6. If you collected a clue with `requires_clue_id` semantics (i.e. a clue that references something from an earlier clue), revisit its condition on the next turn.
7. Stop playing once all checkpoints are solved, or after 20 turns if stuck.

### What to note during play
- Which checkpoints felt logically clear vs. which required guessing.
- Any turn where you ended with no new clues and no obvious next move.
- Which answer you submitted first for each checkpoint, and whether it was correct.
- Any clue that felt genuinely ambiguous — could be cited for multiple answers.
- Turn 1 clue count: how many clues fired on the very first resolve?

---

## Phase 2 — Structural audit

After playing, read the full scenario JSON. Work through this checklist.

### Turn 1 clue flood
Count how many clues can fire on turn 1 (arrival location, before the investigator moves anywhere). Conditions at the arrival location with no item requirement fire immediately. More than 4 clues on turn 1 overwhelms the player and removes the need to plan routes.

**Fix**: move characters or items away from the arrival location, or add `requires_clue_id` to some arrival clues.

### Perpetrator clue distribution
Identify both correct perpetrator clues. At what turn could each realistically fire for the first time? If both can fire within the first 2 turns before the player has gathered any conflicting evidence, the killer is functionally obvious — the red herrings haven't had time to work.

**Fix**: add `requires_clue_id` on the second perpetrator correct clue pointing at the first, or move a character/item so the second clue requires deliberate routing.

### `requires_clue_id` signposting
For every clue with `requires_clue_id`: read the prerequisite clue's text. Does it leave an explicit unresolved thread — a named object not examined, a reference to follow up, an open question — that gives the player a reason to return to that condition? If the prerequisite text is self-contained and conclusive, the player has no reason to revisit, and the dependent clue becomes practically unreachable.

**Fix**: rewrite the prerequisite's clue text to end on something unresolved, or restructure so the dependent clue has a different condition that is independently motivated.

### Item-chain discoverability
For every clue whose condition is `investigator_with_character_and_item` or `investigator_at_location_with_item`: check whether the item's `starting_location` matches the condition's location (or the character's fixed location). If it does, the player discovers the item there naturally and no further signposting is needed.

If the item starts *elsewhere* and must be carried to the target: find what prior visible text (lead, character description, item description, or earlier clue) explicitly names both the item and the relevant character or location together. If no such text exists, the player has no reason to attempt that combination.

**Fix**: rewrite a prior clue's text to name the item and character/location together, or add a lead that does so.

### Timing elimination
For the `time_of_death` checkpoint: list all wrong answer_options. For each, identify which correct clue contradicts it and how. If any wrong option is merely "less supported" rather than "logically impossible given the correct clue", the answer is guessable rather than solvable.

A correct timing clue that establishes a lower bound ("alive at X") eliminates all options before X. A correct timing clue that establishes an upper bound ("condition Y implies death before Z") eliminates all options after Z. Together they should pinch to a single option.

**Fix**: rewrite one or both correct timing clues to be explicitly bounding rather than merely suggestive.

### Red herring distinctiveness
For each checkpoint: confirm all 3 red herrings point at different wrong answer_options. Two red herrings targeting the same wrong answer means the player cannot eliminate it — it appears doubly supported while the correct answer has fewer clues pointing at it.

Also check: are the red herrings dismissible once both correct clues are collected? A red herring that cannot be dismissed even with full evidence is a broken clue.

### Motive traceability
Without reading the epilogue, trace what a player could conclude about the motive from clue texts alone. The specific reason the perpetrator killed must be reconstructable from clue evidence, not just implied by narrative atmosphere. If the answer requires reading between the lines, the motive clues are too vague.

---

## Quality rubric

### Good scenario
- Turn 1 fires ≤ 4 clues
- Both correct perpetrator clues cannot both fire before turn 4
- Every `requires_clue_id` prerequisite text actively prompts revisiting
- Every item-condition clue has a prior visible text naming both item and target
- Timing correct clues together eliminate every wrong option explicitly
- Red herrings are genuinely misleading but become dismissible once both correct clues are collected
- Motive is traceable from clue texts without reading the epilogue

### Fixable issues
- Turn 1 clue flood (character/item repositioning)
- Item-chain clue lacks signposting (lead addition or prerequisite rewrite)
- Timing options not fully eliminated (correct clue strengthening)
- Perpetrator obvious too early (add requires_clue_id or restructure route)
- `requires_clue_id` prerequisite doesn't prompt revisiting (clue text rewrite)
- One red herring undismissible (clue text edit)

### Unsalvageable
Flag as unsalvageable if fixing it requires changing the core crime — the perpetrator identity, the murder location, or the motive — because those changes cascade through the entire clue set and character descriptions. Also unsalvageable if more than 4 clues across different checkpoints need substantial rewrites (not just text edits, but condition or structure changes). In those cases, discard and regenerate.

---

## Phase 3 — Improvements

For each issue identified, propose a specific JSON edit with a one-sentence reason. Keep changes minimal — fix the identified problem without touching anything else.

Valid edit types:
- Rewrite a clue's `text` field
- Change a clue's `condition` (type, location, character, item)
- Add or rewrite a `lead`
- Change an item's `starting_location`
- Rewrite a character's `description` (surface-level only — do not add crime-relevant information to character descriptions)
- Add `requires_clue_id` to a clue that currently has `null`
- Rewrite a `red_herring_explanation` (audit only — not player-visible)

Do not: change character locations, change `crime` block values, add new characters or items, change checkpoint `answer_options` (the correct answer must still be present).

### Output format

```
ISSUE: [audit category] — [one sentence description]
FIX: [field path] — [proposed new value or rewrite]
REASON: [why this fixes the player experience problem]
```

List all issues first, then proposed fixes. If the scenario is unsalvageable, state that clearly with the specific reason.
