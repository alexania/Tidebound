// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Validator
// Runs after LLM response, before game starts.
// Returns list of errors. Empty = valid.
// ─────────────────────────────────────────────

import type { Scenario, LocationId } from '../types/scenario'

const REQUIRED_LOCATIONS: LocationId[] = [
  'harbour', 'tavern', 'lighthouse', 'chapel',
  'doctors_house', 'manor', 'cottage_row', 'cliffs', 'forest_edge'
]

export interface ValidationError {
  rule: string
  message: string
}

export function validateScenario(s: Scenario): ValidationError[] {
  const errors: ValidationError[] = []

  const characterIds = new Set(s.characters.map(c => c.id))
  const itemIds = new Set(s.items.map(i => i.id))
  const locationIds = new Set(s.locations.map(l => l.id))
  const checkpointIds = new Set(s.checkpoints.map(c => c.id))

  // ── Locations ──────────────────────────────
  for (const loc of REQUIRED_LOCATIONS) {
    if (!locationIds.has(loc)) {
      errors.push({ rule: 'required_location', message: `Missing required location: ${loc}` })
    }
  }

  // ── Characters ─────────────────────────────
  const noiseChars = s.characters.filter(c => c.role === 'noise')
  if (noiseChars.length !== 2) {
    errors.push({ rule: 'noise_count', message: `Expected exactly 2 noise characters, found ${noiseChars.length}` })
  }

  const perpetrators = s.characters.filter(c => c.role === 'perpetrator')
  if (perpetrators.length === 0) {
    errors.push({ rule: 'no_perpetrator', message: 'No character with role perpetrator' })
  }

  const victims = s.characters.filter(c => c.role === 'victim')
  if (victims.length !== 1) {
    errors.push({ rule: 'victim_count', message: `Expected exactly 1 victim, found ${victims.length}` })
  }

  for (const char of s.characters) {
    if (!locationIds.has(char.home_location)) {
      errors.push({ rule: 'char_home_location', message: `Character ${char.id} has invalid home_location: ${char.home_location}` })
    }
  }

  // crime.perpetrator_ids must match perpetrator-role characters
  for (const pid of s.crime.perpetrator_ids) {
    if (!characterIds.has(pid)) {
      errors.push({ rule: 'perp_id', message: `crime.perpetrator_ids references unknown character: ${pid}` })
    }
    const char = s.characters.find(c => c.id === pid)
    if (char && char.role !== 'perpetrator') {
      errors.push({ rule: 'perp_role', message: `Character ${pid} is in perpetrator_ids but has role ${char.role}` })
    }
  }

  // ── Items ──────────────────────────────────
  for (const item of s.items) {
    if (!locationIds.has(item.starting_location)) {
      errors.push({ rule: 'item_location', message: `Item ${item.id} has invalid starting_location: ${item.starting_location}` })
    }
  }

  // ── Crime ──────────────────────────────────
  if (!locationIds.has(s.crime.murder_location)) {
    errors.push({ rule: 'crime_location', message: `crime.murder_location is invalid: ${s.crime.murder_location}` })
  }
  if (!locationIds.has(s.crime.body_found_location)) {
    errors.push({ rule: 'crime_location', message: `crime.body_found_location is invalid: ${s.crime.body_found_location}` })
  }

  // ── Clues ──────────────────────────────────
  const noiseIds = new Set(noiseChars.map(c => c.id))

  for (const clue of s.clues) {
    // Checkpoint must exist
    if (!checkpointIds.has(clue.checkpoint)) {
      errors.push({ rule: 'clue_checkpoint', message: `Clue ${clue.id} references unknown checkpoint: ${clue.checkpoint}` })
    }

    // unlocked_by checkpoint must exist
    if (clue.unlocked_by && !checkpointIds.has(clue.unlocked_by)) {
      errors.push({ rule: 'clue_unlock', message: `Clue ${clue.id} unlocked_by unknown checkpoint: ${clue.unlocked_by}` })
    }

    // Answer must be in the checkpoint's answer_options
    const cp = s.checkpoints.find(c => c.id === clue.checkpoint)
    if (cp && !cp.answer_options.includes(clue.answer)) {
      errors.push({ rule: 'clue_answer', message: `Clue ${clue.id} answer "${clue.answer}" not in checkpoint answer_options` })
    }

    // Red herrings must have explanations
    if ((clue.weight === 'red_herring' || clue.weight === 'contradiction') && !clue.red_herring_explanation) {
      errors.push({ rule: 'red_herring_explanation', message: `Clue ${clue.id} is ${clue.weight} but has no red_herring_explanation` })
    }

    // Noise characters must not appear in conditions
    const condChars = clue.condition.characters ?? []
    for (const cid of condChars) {
      if (noiseIds.has(cid)) {
        errors.push({ rule: 'noise_in_condition', message: `Clue ${clue.id} condition references noise character: ${cid}` })
      }
      if (!characterIds.has(cid)) {
        errors.push({ rule: 'unknown_char_in_condition', message: `Clue ${clue.id} condition references unknown character: ${cid}` })
      }
    }

    // Item references must exist
    if (clue.condition.item && !itemIds.has(clue.condition.item)) {
      errors.push({ rule: 'unknown_item_in_condition', message: `Clue ${clue.id} condition references unknown item: ${clue.condition.item}` })
    }

    // Location references must exist
    if (clue.condition.location && !locationIds.has(clue.condition.location)) {
      errors.push({ rule: 'unknown_loc_in_condition', message: `Clue ${clue.id} condition references unknown location: ${clue.condition.location}` })
    }
  }

  // ── Red herring balance (Medium/Hard rule) ──
  // For each checkpoint: no wrong answer should have 2+ soft/red_herring clues
  // This is a warning not a hard error — log it separately if needed
  // (Skipping for now — validator can be extended later)

  return errors
}
