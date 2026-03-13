Review the Tidebound scenario given by $ARGUMENTS via blind playthrough. Arguments: `<scenario> [difficulty]` — e.g. `scenario_01 hard`.

Play the scenario as a real player would. Do not read the scenario JSON at any point during this review. Afterwards, record findings and propose play-experience-driven improvements.

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

## Blind play

**Do not read the JSON at any point. This means: no reading the scenario file, no reading any source file that would reveal answers.**

Play using the CLI:
```sh
echo "<commands>" | npx tsx scripts/play.ts $ARGUMENTS 2>&1
```

**Start with `reset`** to clear any saved state from prior runs.

IDs are surfaced in output — do not guess:
- Location IDs: shown in `Reachable:` and via `locs`
- Character IDs: shown in `Here:` when encountered, and via `chars`
- Item IDs: shown in `Visible items:` after inspecting a location, and via `items` once carried

### Systematic strategy
1. Run `reset` to start fresh.
2. On arrival: `inspect` the starting location. Note the `Visible items:` line for item IDs, leads, and characters present.
4. Use `locs` to see all location IDs before moving anywhere.
5. Pick up visible items with `inspect <item_id>` before moving on.
6. Visit every character at least once (`talk <char_id>`), following leads first.
7. After visiting all characters, return to any location where a clue suggested bringing a specific item.
8. Use `ask <char_id> <item_id>` only when a clue or lead explicitly suggested that pairing or it makes logical sense to do so.
9. **Solve `true_location` first.** Run `clues` and `cp` to review what you have. For each wrong location, ask: does any clue text make it impossible that the murder occurred there? Use `prove true_location "<wrong_answer>" with <clue_id>` when you have a valid contradiction.
10. **Once `true_location` is confirmed, solve `perpetrator`.** Each wrong suspect must be placed elsewhere during the confirmed murder window at the confirmed location.
11. **Once `perpetrator` is confirmed, solve `motive`.** Each wrong motive is a specific falsifiable theory — find the clue that makes it impossible.
12. **The scenario may be bad.** If you cannot find a clue that logically rules out a wrong answer, do not guess randomly — you get only 2 failed `prove` attempts per wrong answer option before it is permanently locked out. If you exhaust them without a valid proof, record that option as unresolvable. This is a structural failure to report.
13. Stop when all checkpoints are solved, or when you have exhausted reasonable deduction, or after 60 actions.

### What "blind" means
You are simulating a real player. A real player cannot read the JSON. They see only what the CLI prints. Your `prove` deductions must come from your own reasoning about clue texts — not from any knowledge of the JSON structure, `contradicts` arrays, or correct answers.

---

## Notes to record during play

After completing play, record:
- Whether the opening narrative clearly stated cause of death and a precise clock-style time window
- Clue count from first `inspect` at arrival (flag if more than 4)
- Which checkpoints had obvious coverage vs. required deliberate routing
- Any action where no new clues fired and the next step was unclear
- Any wrong answer you could not find a contradicting clue for
- Whether item-chains were signposted or felt like guesswork
- Whether the motive was traceable from clue texts alone, without the epilogue

---

## Play-experience improvements

Based solely on what you experienced during play — not from reading the JSON — propose improvements.

**Valid edits**: rewrite a clue `text` · change a clue `condition` · add or rewrite a `lead` · change an item's `starting_location` · rewrite `location_discovery_text` on an item · rewrite a character `description` (surface only) · add a new clue with a `contradicts` entry covering an uncovered wrong answer · adjust a clue's `contradicts` array.

**Do not**: change character locations · change `crime` block values · add new characters or items · change checkpoint `answer_options`.

Focus on: unclear signposting · dead ends with no next-step signal · wrong answers you could not disprove · clues that were confusing or misleading in isolation.

Run `/audit $ARGUMENTS` for the full structural audit.

---

### Output format

```
OBSERVATION: [what happened during play]
FIX: [field path] — [proposed new value or rewrite]
REASON: [what player experience problem this addresses]
```

If the scenario was unplayable (could not solve a checkpoint despite exhausting all reasonable moves), state clearly with specifics.
