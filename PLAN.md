# Tidebound — Checkpoint Redesign Plan

## Design decisions

**Given on arrival** (not player-deduced):
- Cause of death — specific mechanism
- Time of death — a narrow window (e.g. "between ten o'clock and midnight")

These come from a new `scene_report` field: a prose paragraph in the medical authority's
voice, displayed at game start and persistently accessible. The `crime` block retains
`cause_of_death` and `time_of_death` as machine-readable values for validation.

**Three player-deduced checkpoints, sequential:**
1. `true_location` — available immediately
2. `perpetrator` — unlocks when `true_location` confirmed
3. `motive` — unlocks when `perpetrator` confirmed

**Elimination rules by checkpoint type:**
- `true_location`: each wrong location eliminated by (a) alibi — location was inaccessible or
  a non-perpetrator character was present there during the given time window, or (b) victim trajectory —
  witness places victim alive leaving that location.
- `perpetrator`: each wrong suspect eliminated by alibi — they were demonstrably
  elsewhere during the confirmed murder window at the confirmed location. Alibi only.
- `motive`: each wrong motive is a specific falsifiable theory (not a generic category
  like "personal vendetta"). Each has a contradicting document, testimony, or
  relationship fact.

**Clue count**: ~15. Each clue has a job. Clues should also serve to tell the story where possible.

**All clues are true**. The perpetrator cannot give a false alibi because false clues
don't exist — their testimony is either incriminating, conspicuously partial, or absent.
No special handling needed.

**Elimination direction rule**: every contradiction must pass "if the wrong answer were
true, this clue would be impossible" — without assuming any other checkpoint's answer.
Evidence of what happened is not evidence of what didn't happen.

**No backward compability needed**

---

## Files to change

### `src/types/scenario.ts`
- Remove `cause_of_death` and `time_of_death` from `CheckpointId` union
- Add `scene_report: string` to `Scenario`

### `src/engine/checkpoints.ts`
Full rewrite. Replace investigative/accusation split with sequential unlocking:
- `true_location`: always available
- `perpetrator`: locked until `true_location` confirmed
- `motive`: locked until `perpetrator` confirmed

Remove `ACCUSATION_CHECKPOINTS`, `allInvestigativeConfirmed`.

### `src/engine/gameEngine.ts`
- Update `getCorrectAnswer` — remove `cause_of_death` and `time_of_death` cases
- Check `filterOptionsToDifficulty` — no change needed, still trims by option count
- Update any feedback strings referencing removed checkpoints

### `src/engine/validator.ts`
- Expect exactly 3 checkpoints: `true_location`, `perpetrator`, `motive`
- Validate `scene_report` is present and non-empty
- Remove checkpoint count/ID validation that expects the old 5

### `src/engine/generator.ts`
Significant rewrite of `SYSTEM_PROMPT`. Key changes:

- **Given facts**: generator writes a `scene_report` field — medical authority prose
  stating cause of death and time of death window. Crime block values are the
  machine-readable versions.
- **3 checkpoints only**: `true_location`, `perpetrator`, `motive`. Cause and time are
  not checkpoints.
- **Clue count**: 12–16 (down from 20–28).
- **Location wrong answers**: Each must be proved to have been inaccessibile, have a character 
  witness or victim-trajectory elimination.
  Generator must plan this explicitly.
- **Perpetrator elimination rule**: alibi only. Each wrong suspect placed elsewhere
  during the confirmed window. Perpetrator has no solid alibi.
- **Motives should expand on on the supplied input**: The motive input to the scenario is a guide.
  Generate must generate a more specific motive from it.
- **Motive wrong answers**: specific falsifiable theories, not generic categories.
  Generator must state what evidence contradicts each.
- **Elimination direction test**: added to Phase 1 story bible and Phase 3 audit steps.
- **Time notation**: clock-style only ("eleven o'clock at night", "between midnight and
  two in the morning"). No "bell of night" constructions.
- **Medical authority**: every scenario must include a character who functions as the
  medical examiner. Their findings form the `scene_report`. Their clues may elaborate on
  specifics but carry no primary contradiction responsibility.
- Update JSON schema to include `scene_report`.

### UI — `scene_report` display
Add a persistent "Case File" element to `GameScreen` — collapsible, visible throughout
play. Shows `scene_report` text. We don't need to support old scenarios without one.

### `src/components/EvidenceBoard.tsx`
3 swim lanes instead of 5. The component is data-driven from `scenario.checkpoints` so
this mostly handles itself. Confirm layout still works with fewer lanes.

### `scripts/play.ts`
- Print `scene_report` on `reset` and on first load, after the location header
- Status line: `true_location[0/N] | perpetrator[locked] | motive[locked]` — remove
  `cause_of_death` and `time_of_death`
- `cp` output: show sequential gate status (what needs confirming before next checkpoint
  unlocks)

### `.claude/commands/play.md`
- Rewrite mechanics reference: 3 checkpoints, sequential gating
- Add: scene_report gives cause of death and time of death — reference it as ground truth
- Update systematic strategy: cause and time are given, not proved
- Update gating description: perpetrator locks until location confirmed, motive locks
  until perpetrator confirmed
- Remove all references to proving `cause_of_death` and `time_of_death`

### `.claude/commands/review.md`
- Rewrite mechanics reference section entirely
- **Phase 2 audit** — new checklist:
  - `scene_report` check: does it clearly state cause of death and time window?
  - Location coverage: for each wrong location, was the location inaccessible or is there
    an alibi witness (non-perpetrator, present during window) or victim-trajectory clue?
  - Perpetrator coverage: does each wrong suspect have an alibi clue? Is the
    perpetrator's absence of alibi visible?
  - Motive coverage: is each wrong motive a specific falsifiable theory? Does a clue
    exist that makes it impossible?
  - Elimination direction test: for each contradiction, "if wrong answer X were true,
    this clue would be false" — without assuming another checkpoint.
  - Clue count: 12–16. Flag if over.
  - Time notation: flag any reference not in clock-style.
- **Phase 1 strategy**: update for 3 checkpoints; note that cause and time are given in
  scene_report, not deduced.

---

## Order of implementation

1. `src/types/scenario.ts` — unblocks everything else
2. `src/engine/checkpoints.ts` — core logic
3. `src/engine/gameEngine.ts` — dependent on types
4. `src/engine/validator.ts` — dependent on types
5. `src/engine/generator.ts` — independent, but needed for new scenarios
6. UI — `scene_report` display, evidence board check
7. `scripts/play.ts` — reflects new checkpoint structure
8. `.claude/commands/play.md` and `.claude/commands/review.md` — last

