// Engine smoke test — run with: npx tsx src/engine/test.ts
// Tests: validation, init, move, resolve, checkpoint submission

import scenario from '../scenarios/haulwick_easy_01.json' assert { type: 'json' }
import type { Scenario } from '../types/scenario'
import { validateScenario } from './validator'
import { initGameState, moveCharacter, moveItem, resolveTurn, submitCheckpoint, endTurn } from './gameEngine'

const s = scenario as unknown as Scenario

// ── 1. Validate ────────────────────────────────────────────────
console.log('\n═══ VALIDATION ═══')
const errors = validateScenario(s)
if (errors.length === 0) {
  console.log('✓ Scenario valid')
} else {
  console.log(`✗ ${errors.length} validation error(s):`)
  errors.forEach(e => console.log(`  [${e.rule}] ${e.message}`))
}

// ── 2. Init ────────────────────────────────────────────────────
console.log('\n═══ INIT ═══')
let state = initGameState(s, 'easy')
console.log(`Turn: ${state.turn}, Phase: ${state.phase}, Actions: ${state.actionsRemaining}`)
console.log('Character locations:')
for (const [id, loc] of Object.entries(state.board.characterLocations)) {
  const char = s.characters.find(c => c.id === id)
  console.log(`  ${char?.name ?? id} → ${loc}`)
}

// ── 3. Turn 1: move physician_aldric to doctors_house with physicians_notes ──
console.log('\n═══ TURN 1 — Setup ═══')
// physician_aldric starts at doctors_house, physicians_notes starts at doctors_house
// condition: characters_in_location_with_item — should fire clue_cod_hard
console.log('physician_aldric already at doctors_house, physicians_notes already there')
console.log('Actions remaining:', state.actionsRemaining)

// Move sister_orvyn to chapel (for clue_cod_soft_2)
state = moveCharacter(state, 'sister_orvyn', 'chapel', s)
console.log(`After move: actions remaining = ${state.actionsRemaining}`)

console.log('\n═══ TURN 1 — Resolve ═══')
state = resolveTurn(state, s)
console.log(`Phase: ${state.phase}`)
console.log(`Clues collected: ${state.collectedClueIds.length}`)
console.log('Log entries:')
state.log.forEach(e => console.log(`  [${e.locationId}] ${e.text.slice(0, 80)}...`))

// ── 4. Submit cause_of_death ───────────────────────────────────
console.log('\n═══ CHECKPOINT SUBMISSION ═══')
console.log('Available checkpoints:', Object.entries(state.checkpoints)
  .filter(([,v]) => v.status === 'available')
  .map(([k]) => k))

state = submitCheckpoint(state, s, 'cause_of_death', 'Drowning', state.collectedClueIds)
const codState = state.checkpoints['cause_of_death']
console.log(`cause_of_death: ${codState.status} (answer: ${codState.confirmedAnswer})`)
console.log('Now available:', Object.entries(state.checkpoints)
  .filter(([,v]) => v.status === 'available')
  .map(([k]) => k))

// ── 5. End turn ────────────────────────────────────────────────
state = endTurn(state)
console.log(`\n═══ END TURN 1 ═══`)
console.log(`Turn: ${state.turn}, Phase: ${state.phase}, Actions: ${state.actionsRemaining}`)
console.log(`Solved: ${state.solved}`)
