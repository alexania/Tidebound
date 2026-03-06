# TIDEBOUND — Claude Code Handoff

## What this is

A single-player browser-based murder mystery deduction game with folk horror atmosphere. The player moves characters and items around a village map to satisfy conditions that surface clue cards. Clues are used to confirm checkpoints in a branching investigation tree. Solve all checkpoints to win.

## Tech stack

- **React + TypeScript + Vite + plain CSS**
- No other dependencies needed beyond React
- Target: runs in browser, no backend, no server

## What's already done

### `/src/types/`
- `scenario.ts` — TypeScript interfaces mirroring the LLM-generated JSON schema (Village, Crime, Character, Item, Location, Checkpoint, Clue, Scenario)
- `gameState.ts` — mutable game state interfaces (BoardState, GameState, LogEntry, PinnedCard, CheckpointState etc.)

### `/src/engine/`
- `conditions.ts` — evaluates all 8 clue condition types against board state. Pure function, fully deterministic.
- `checkpoints.ts` — hardcoded checkpoint unlock tree, init and recompute functions
- `gameEngine.ts` — all state mutations: initGameState, moveCharacter, moveItem, resolveTurn, submitCheckpoint, endTurn
- `validator.ts` — validates LLM-generated scenario JSON before game starts, returns array of errors
- `test.ts` — smoke test for the engine (see below)

### `/src/scenarios/`
- `haulwick_easy_01.json` — a real LLM-generated scenario, ready to play

## What needs to be built

### 1. Scaffold the Vite project

```bash
npm create vite@latest . -- --template react-ts
npm install
```

Then move the existing `src/` files into the scaffolded project, replacing the boilerplate.

### 2. Verify the engine works

```bash
npx tsx src/engine/test.ts
```

Expected output:
- Validation passes (0 errors)
- Turn 1 resolves and fires clue_cod_hard (physician_aldric at doctors_house with physicians_notes)
- cause_of_death checkpoint becomes available, submitting "Drowning" confirms it
- true_location and time_of_death unlock after confirmation

Fix any TypeScript errors before moving to UI.

### 3. Build the UI

Three main views, rendered as React components:

#### `<GameScreen>` — main layout
```
┌─────────────────────────────────────────────┐
│  Village name + weather + turn counter       │
├──────────────────┬──────────────────────────┤
│                  │                           │
│   <VillageMap>   │   <ActionLog>             │
│                  │                           │
│   Drag chars     │   Scrollable log of       │
│   and items      │   fired clue text,        │
│   to locations   │   grouped by turn         │
│                  │                           │
├──────────────────┴──────────────────────────┤
│  <ActionBar> — 3 action pips, End Turn btn   │
└─────────────────────────────────────────────┘
```

#### `<EvidenceBoard>` — toggled via a button
- Pinned cards (player drags clues from log onto board)
- Player can annotate cards with notes
- Player draws connections between cards
- Submit checkpoint button — opens modal to select answer + cite clues

#### `<OpeningNarrative>` — shown once at game start
- Full-screen, displays `scenario.opening_narrative`
- Continue button enters the game

### 4. Key UI behaviours

**Village map:**
- 9 named locations arranged as a rough coastal village layout
- Each location shows: its flavour text on hover, which characters are there (avatar/token), which discovered items are there
- Player drags a character token to a location = calls `moveCharacter()`
- Player drags a discovered item to a location = calls `moveItem()`
- Undiscovered items are invisible (not shown until a character visits their starting location)
- Item discovery: when a character moves to a location that contains an undiscovered item, the item becomes visible there. This happens automatically — no "search" action needed, no action cost. Items reveal themselves when any character arrives at their location.

**Action log:**
- New entries for the current turn are highlighted
- Each log entry has a "pin to board" button
- Log is grouped by turn with a separator

**Checkpoints panel:**
- Shows all checkpoints, locked ones greyed out
- Available ones have a submit button
- Confirmed ones show the confirmed answer in green
- Submitting opens a modal: select answer from dropdown + optionally cite pinned cards as evidence (at least one citation required per our design)

**End Turn flow:**
1. Player sets up board (drags pieces, 3 actions)
2. Clicks End Turn
3. Engine calls `resolveTurn()` — log fills with new entries
4. Phase becomes 'review'
5. Player reads log, pins cards, optionally submits checkpoints
6. Player clicks Next Turn → `endTurn()` → back to setup

### 5. LLM generation (later, not blocking)

`/src/engine/generator.ts` is complete. It contains:
- `SYSTEM_PROMPT` — the full system prompt sent to the LLM
- `SCHEMA` — the full JSON schema with condition type vocabulary and checkpoint unlock tree embedded
- `generateScenario(difficulty, apiKey)` — calls Anthropic API, validates response, retries up to 3 times
- `saveScenario` / `loadScenarios` / `getUnplayedScenario` — localStorage helpers for scenario reuse
- `markPlayed` — call this when a game is completed so the scenario isn't reused

For now, hardcode Haulwick as the only scenario. When the player starts a game and no unplayed scenarios exist for the difficulty, prompt for an API key and call `generateScenario()`. Save the result with `saveScenario()` so it's reused on future plays.

Model to use: `claude-opus-4-6` (already set in generator.ts). Max tokens: 8000 — scenarios are long.

### 6. CSS approach

Plain CSS, one file per component, CSS custom properties for the palette:

```css
:root {
  --color-bg:        #0e0e12;
  --color-surface:   #1a1a2e;
  --color-border:    #4a3728;
  --color-accent:    #c4a882;
  --color-text:      #e8ddd0;
  --color-text-dim:  #8b7355;
  --color-confirmed: #5a8a5a;
  --color-locked:    #3a3a4a;
  --font-body:       'Georgia', serif;
  --font-mono:       'Courier New', monospace;
}
```

Dark, aged-paper feel. No rounded corners. Subtle borders. No animations except log entry fade-in.

## Design decisions already made

- **Player actions per turn:** 3, always. Only action type is moving characters or items.
- **Clue firing:** one clue per location per turn, highest weight wins.
- **Item discovery:** automatic when any character arrives at the item's location. No action cost.
- **Checkpoint submission:** player must cite at least one pinned clue card as evidence.
- **No lose state:** player scores based on turns taken to full solve.
- **Scoring:** base score (1000/2000/3000 by difficulty) minus 50 per turn.
- **Guaranteed clue surfacing:** from turn 9, any un-fired clue's condition is automatically met. (Not yet implemented in engine — add to `resolveTurn`.)

## Engine notes

### `getCorrectAnswer` in gameEngine.ts
`last_seen` and `victim_state` correct answers are derived from the clue set (first hard/soft clue's answer for that checkpoint). This is slightly fragile — if the LLM generates contradicting soft clues pointing at different answers, the first one wins. A stricter approach: derive from the hard clue if present, else from the majority of soft clues.

### Perpetrator checkpoint
Currently only handles single perpetrator (`crime.perpetrator_ids[0]`). For multiple perpetrators, the answer comparison needs to check all ids. The checkpoint answer_options will contain character names, not ids — so the comparison needs a name→id lookup.

### Item discovery trigger
Currently items start visible at their starting locations. The design intent is they should be hidden until a character visits. Add a `discoveredItemIds: Set<string>` to GameState and reveal items in `moveCharacter()` when the destination location matches an item's current location.

## File structure

```
tidebound/
├── CLAUDE.md                          ← this file
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── types/
    │   ├── scenario.ts                ← done
    │   └── gameState.ts               ← done
    ├── engine/
    │   ├── conditions.ts              ← done
    │   ├── checkpoints.ts             ← done
    │   ├── gameEngine.ts              ← done
    │   ├── validator.ts               ← done
    │   ├── generator.ts               ← done
    │   └── test.ts                    ← done
    ├── components/
    │   ├── OpeningNarrative.tsx       ← todo
    │   ├── GameScreen.tsx             ← todo
    │   ├── VillageMap.tsx             ← todo
    │   ├── ActionLog.tsx              ← todo
    │   ├── ActionBar.tsx              ← todo
    │   ├── EvidenceBoard.tsx          ← todo
    │   ├── CheckpointPanel.tsx        ← todo
    │   └── CheckpointModal.tsx        ← todo
    └── scenarios/
        └── haulwick_easy_01.json      ← done
```

## Good first task for Claude Code

1. Scaffold the Vite project and verify `npx tsx src/engine/test.ts` passes
2. Build `<OpeningNarrative>` and `<GameScreen>` with a static map (no drag yet) just to get something visible
3. Add drag-and-drop to the map
4. Wire up End Turn → resolve → log display
5. Add checkpoint panel and submission modal
6. Add evidence board
