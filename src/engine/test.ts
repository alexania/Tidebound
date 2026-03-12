// Engine smoke test — run with: npx tsx src/engine/test.ts

import scenario from '../scenarios/easy/hallow_cove_02.json' assert { type: 'json' }
import type { Scenario } from '../types/scenario'
import { validateScenario } from './validator'
import { initGameState, moveToLocation, inspectLocation, talkToCharacter, submitCheckpoint } from './gameEngine'

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
console.log(`ActionCount: ${state.actionCount}`)
console.log('Investigator at:', state.investigatorLocation)
console.log('Checkpoints available:',
  Object.entries(state.checkpoints).filter(([,v]) => v.status === 'available').map(([k]) => k))
console.log('Items:', s.items.length)
console.log('Character locations:')
for (const char of s.characters) {
  console.log(`  ${char.name} → ${char.location}`)
}

// ── 3. Inspect arrival location ──────────────────────────────
console.log('\n═══ ACTION 1 — Inspect Arrival Location ═══')
state = inspectLocation(state, s)
console.log(`ActionCount: ${state.actionCount}`)
console.log(`Clues collected: ${state.collectedClueIds.length}`)
console.log('New log entries:')
state.log.filter(e => e.isNew).forEach(e => console.log(`  [${e.locationId}] ${e.text.slice(0, 80)}...`))

// ── 4. Move to another location ──────────────────────────────
const firstNonVictim = s.characters.find(c => !c.isVictim)
if (firstNonVictim && firstNonVictim.location !== state.investigatorLocation) {
  // Try to find an adjacent location toward the character
  const adjacencies = s.location_adjacencies ?? []
  const nextLoc = adjacencies.find(
    adj => adj.from === state.investigatorLocation || adj.to === state.investigatorLocation
  )
  if (nextLoc) {
    const targetLoc = nextLoc.from === state.investigatorLocation ? nextLoc.to : nextLoc.from
    console.log(`\n═══ ACTION 2 — Move to ${targetLoc} ═══`)
    state = moveToLocation(state, s, targetLoc)
    console.log(`ActionCount: ${state.actionCount}, At: ${state.investigatorLocation}`)
    console.log('New NPCs found:', state.foundCharacterIds.length)
  }
}

// ── 5. Talk to a character ───────────────────────────────────
const charAtLocation = s.characters.find(c =>
  c.location === state.investigatorLocation && !c.isVictim
)
if (charAtLocation) {
  console.log(`\n═══ ACTION 3 — Talk to ${charAtLocation.name} ═══`)
  state = talkToCharacter(state, s, charAtLocation.id)
  console.log(`ActionCount: ${state.actionCount}`)
  console.log(`Clues collected: ${state.collectedClueIds.length}`)
}

// ── 6. Submit cause_of_death ──────────────────────────────────
console.log('\n═══ CHECKPOINT SUBMISSION ═══')
console.log('Available:', Object.entries(state.checkpoints)
  .filter(([,v]) => v.status === 'available').map(([k]) => k))

const causeOfDeathCp = s.checkpoints.find(c => c.id === 'cause_of_death')
const correctAnswer = causeOfDeathCp?.answer_options[0] ?? 'unknown'
state = submitCheckpoint(state, s, 'cause_of_death', correctAnswer, state.collectedClueIds)
const codState = state.checkpoints['cause_of_death']
console.log(`cause_of_death: ${codState.status} (submitted: ${correctAnswer})`)
console.log(`Solved: ${state.solved}`)
