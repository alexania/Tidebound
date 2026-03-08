// Engine smoke test — run with: npx tsx src/engine/test.ts

import scenario from '../scenarios/easy/hallow_cove_02.json' assert { type: 'json' }
import type { Scenario } from '../types/scenario'
import { validateScenario } from './validator'
import { initGameState, moveCharacter, resolveTurn, submitCheckpoint } from './gameEngine'

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
console.log('Checkpoints available from turn 1:',
  Object.entries(state.checkpoints).filter(([,v]) => v.status === 'available').map(([k]) => k))
console.log('Items:', s.items.length)
console.log('Character starting locations:')
for (const [id, loc] of Object.entries(state.board.characterLocations)) {
  const char = s.characters.find(c => c.id === id)
  console.log(`  ${char?.name ?? id} → ${loc}`)
}

// ── 3. Turn 1: move aldric to doctors_house to trigger clue_cod_hard ──
console.log('\n═══ TURN 1 — Setup ═══')
// Move first two characters to create conditions for early clues
const [char1, char2] = s.characters.filter(c => !c.isVictim).slice(0, 2)
state = moveCharacter(state, char1.id, char1.starting_location)
state = moveCharacter(state, char2.id, char2.starting_location)
console.log(`Moved ${char1.name} and ${char2.name}. Actions remaining: ${state.actionsRemaining}`)

console.log('\n═══ TURN 1 — Resolve ═══')
state = resolveTurn(state, s)
console.log(`Phase: ${state.phase}`)
console.log(`Clues collected: ${state.collectedClueIds.length}`)
console.log('Log entries:')
state.log.forEach(e => console.log(`  [${e.locationId}] ${e.text.slice(0, 80)}...`))

// ── 4. Submit cause_of_death ───────────────────────────────────
console.log('\n═══ CHECKPOINT SUBMISSION ═══')
console.log('Available:', Object.entries(state.checkpoints)
  .filter(([,v]) => v.status === 'available').map(([k]) => k))

const causeOfDeathCp = s.checkpoints.find(c => c.id === 'cause_of_death')
const correctAnswer = causeOfDeathCp?.answer_options[0] ?? 'unknown'
state = submitCheckpoint(state, s, 'cause_of_death', correctAnswer, state.collectedClueIds)
const codState = state.checkpoints['cause_of_death']
console.log(`cause_of_death: ${codState.status} (submitted: ${correctAnswer})`)

console.log('Still locked:', Object.entries(state.checkpoints)
  .filter(([,v]) => v.status === 'locked').map(([k]) => k))

console.log(`\n═══ AFTER RESOLVE ═══`)
console.log(`Turn: ${state.turn}, Phase: ${state.phase}, Actions: ${state.actionsRemaining}`)
console.log(`Solved: ${state.solved}`)
