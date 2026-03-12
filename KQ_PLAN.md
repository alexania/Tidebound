# KQ Mechanic Rewrite — Plan

Replace the turn-based drag-drop board with a action-driven adventure game loop. Clues
fire immediately on player actions rather than batching at end of turn. The checkpoint
system, evidence board, and scoring remain intact.

---

## 1. Schema addition — `scenario.ts`

**One new field on `Item`**:
```
location_discovery_text: string
```
A single sentence shown when the player inspects a location and this item is there,
before they've picked it up. e.g. *"A cracked flask lies near the hearth."* The item
isn't in inventory yet — it's just visible.

Everything else in the scenario schema is unchanged. All 5 condition types map directly
to the new verbs (see §3).

---

## 2. Game state changes — `gameState.ts`

**Remove**:
- `phase: 'setup' | 'resolve'` — no longer needed
- `actionsRemaining` — replaced by action counter
- `board.characterLocations` — characters were always fixed, this was redundant
- `board.itemLocations` — items no longer live on the map
- `turnStartItemLocations` — undo mechanic goes away

**Add**:
- `investigatorLocation: LocationId` — moved out of board, it's the primary state
- `inventory: string[]` — item IDs the player is currently carrying
- `actionCount: number` — replaces turn count for scoring
- `inspectedLocationIds: string[]` — locations the player has explicitly inspected (not just visited)
- `visitedLocationIds: string[]` — locations entered (triggers NPC visibility, not clues/items)
- `attemptedActions: Set<string>` — encoded strings like `inspect:harbour`,
  `talk:martha`, `ask:martha:flask`, `inspect:chapel:with:flask` — used to determine
  which feedback string to show

**Keep unchanged**: `collectedClueIds`, `log`, `pinnedCards`, `checkpoints`,
`foundCharacterIds`, `foundItemIds`, `solved`, `finalScore`

---

## 3. Engine rewrite — `gameEngine.ts`

Replace `resolveTurn()` with five discrete action handlers. Each is a pure function
returning new state. Each fires relevant clues immediately.

### `moveToLocation(state, scenario, locationId) → GameState`
- Validates adjacency
- Updates `investigatorLocation`
- Adds to `visitedLocationIds`
- Reveals NPCs at that location (adds to `foundCharacterIds`)
- Does **not** fire location description or any clues/items — arrival is passive
- Increments `actionCount`

### `inspectLocation(state, scenario) → GameState`
- Adds current location to `inspectedLocationIds`
- Reveals the location description
- Returns `location_discovery_text` for any items at this location not yet in inventory
  (shown in log as visible-but-not-held)
- Fires all matching `inspect_location` clues
- Fires all matching `inspect_item_in_location` clues for items currently in `inventory`
- Increments `actionCount`

### `inspectItem(state, scenario, itemId) → GameState`
- Validates item is in `inventory` or if in current location, adds item to `inventory` with pick up message.
- Reveals item description.
- Fires all matching `inspect_item` clues
- Fires all matching `inspect_item_in_location`
- Adds to `foundItemIds` (if not there already)
- Increments `actionCount`

### `talkToCharacter(state, scenario, charId) → GameState`
- Validates character is at current location
- Fires all matching `talk_to_character` clues
- Increments `actionCount`

### `askCharacterAboutItem(state, scenario, charId, itemId) → GameState`
- Validates character at current location, item in inventory
- Fires all matching `ask_character_about_item` clues
- Increments `actionCount`

**Clue firing in all handlers**: same logic as current `resolveTurn` — check
`collectedClueIds`, check accusation gate, create `LogEntry`, auto-pin `PinnedCard`.
No change to that machinery.

---

## 4. Conditions — `conditions.ts`

Minimal changes. Redefine what "has item" means:

- `inspect_item`: item is in `inventory` (previously: item at same location)
- `inspect_item_in_location`: investigator at location AND item in `inventory`
  (fires via `inspectLocation` or `inspectItem`)
- `ask_character_about_item`: character at investigator's location AND item
  in `inventory`

The other two condition types are unchanged.

---

## 5. Feedback strings — new file `src/engine/feedback.ts`

A static dictionary, keyed by action type and result:

```ts
FEEDBACK = {
  inspect_location_empty:   "There is nothing more to find here.",
  inspect_location_locked:  "Your instinct says there is more here — let's focus on the crime scene first.",
  inspect_location_missing: "Something feels incomplete. Perhaps there is more with the right evidence.",  // easy only
  talk_empty:               "[Name] has nothing more to tell you.",
  talk_locked:              "[Name] hesitates, then looks away. Perhaps after we've established the crime scene.",
  ask_empty:                "[Name] looks at it, but says nothing useful.",
  ask_locked:               "[Name] glances at it and falls quiet. We should come back after resolving the crime scene.",
  inspect_item_empty:       "The item reveals nothing new for now.",
  inspect_item_locked:      "<need a line here>",
  inspect_item_missing:     "<need a line here>", // easy only
}
```

The `locked` variants require knowing a clue exists but is accusation-gated. The engine
distinguishes: no matching clue vs. matching clue exists but gate is closed.

The `missing` variant (easy only): a `inspect_item_in_location` clue exists for this location/item but the
required item isn't in inventory. Is should be displayed even if the action triggered a `inspect_location` 
or `inspect_item` clue.

---

## 6. UI overhaul

The map is the primary **input** surface. The Action Log remains the sole **output** surface — all clue text, discovery text, and feedback strings appear there, as now.

### VillageMap.tsx
- Remove all drag-drop
- Click an adjacent location → move there
- Adjacent locations always highlighted
- NPCs shown as static tokens on their fixed location (no dragging)
- Items removed from the map entirely
- Click current location cell → location context menu
- Click NPC token → NPC context menu
- Only one context menu open at a time — clicking anything closes the current one before opening a new one

### Location context menu (on current location cell)
Evolves as the player learns more:

- **Before inspecting**: `Inspect`
- **After inspecting, items visible but not held**: `Inspect` · `Inspect [Item]` per visible item
- **After picking up an item**: that item disappears from this menu, appears in inventory bar

`Inspect [Item]` triggers `inspectItem` — picks up the item, fires clues, logs result.

### NPC context menu (on NPC token)
- **Always**: `Talk`
- **When holding one or more items**: `Ask about [Item]` per inventory item

### InventoryBar (new, small — below map)
- Carried items shown as chips
- Clicking a chip re-triggers `inspectItem` (fires remaining clues or shows feedback string)
- No drop mechanic needed

### ActionBar
- Remove "End Turn" button
- Action counter shown quietly (score-relevant info only)

### Evidence board
- Unchanged

---

## 7. Generator update — `generator.ts`

**Schema addition**: add `location_discovery_text: string` to the item schema block.
One sentence, present tense, physical only. e.g. *"A tarnished flask rests on its side
near the door."*

**System prompt addition**: short paragraph explaining the new interaction model so the
LLM understands what each condition type means in player terms — specifically that
`ask_character_about_item` means the player is holding the item and showing
it to the character, so the clue text should read as a reaction to being shown the item.

No other generation changes.

---

## 8. Scoring

Replace `max(base - turn * 50, 100)` with `max(base - actionCount * N, 100)`.

Calibration: a well-played hard scenario currently takes ~10–15 turns × 3 actions =
30–45 meaningful actions. Penalty of `15` per action gives a similar score range to the
current `50` per turn. Needs playtesting once the mechanic is in.

---

## Implementation order

1. `gameState.ts` — new state shape
2. `conditions.ts` — redefine item-holding semantics
3. `gameEngine.ts` — five action handlers, remove resolveTurn
4. `feedback.ts` — static string dictionary
5. `scenario.ts` — add `location_discovery_text` to Item
6. Generator — add field to schema + system prompt paragraph
7. UI — LocationPanel, InventoryBar, VillageMap simplification, ActionBar
8. Scoring — calibrate action penalty
