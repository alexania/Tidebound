// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Validator
// ─────────────────────────────────────────────

import type { Scenario } from '../types/scenario'
import { getCorrectAnswer } from './gameEngine'

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
  if (s.locations.length < 1 || s.locations.length > 9) {
    errors.push({ rule: 'location_count', message: `Expected 1–9 locations, found ${s.locations.length}` })
  }

  const occupiedCells = new Set<string>()
  for (const loc of s.locations) {
    if (loc.col !== undefined) {
      if (loc.col < 0 || loc.col > 2) {
        errors.push({ rule: 'location_col', message: `Location ${loc.id} has invalid col: ${loc.col} (must be 0–2)` })
      }
    }
    if (loc.row !== undefined) {
      if (loc.row < 0 || loc.row > 2) {
        errors.push({ rule: 'location_row', message: `Location ${loc.id} has invalid row: ${loc.row} (must be 0–2)` })
      }
    }
    if (loc.col !== undefined && loc.row !== undefined) {
      const cell = `${loc.col},${loc.row}`
      if (occupiedCells.has(cell)) {
        errors.push({ rule: 'location_cell_conflict', message: `Multiple locations share grid cell (${loc.col}, ${loc.row})` })
      }
      occupiedCells.add(cell)
    }
  }

  for (const adj of (s.location_adjacencies ?? [])) {
    if (!locationIds.has(adj.from)) {
      errors.push({ rule: 'adjacency_location', message: `location_adjacencies references unknown location: ${adj.from}` })
    }
    if (!locationIds.has(adj.to)) {
      errors.push({ rule: 'adjacency_location', message: `location_adjacencies references unknown location: ${adj.to}` })
    }
  }

  if (!s.location.arrival_location) {
    errors.push({ rule: 'arrival_location', message: 'location.arrival_location is missing' })
  } else if (!locationIds.has(s.location.arrival_location)) {
    errors.push({ rule: 'arrival_location', message: `location.arrival_location "${s.location.arrival_location}" is not a valid location id` })
  }

  // ── Characters ─────────────────────────────
  if (s.characters.filter(c => c.isVictim).length !== 1) {
    errors.push({ rule: 'victim_count', message: 'Expected exactly 1 victim (isVictim: true)' })
  }

  for (const char of s.characters) {
    if (!locationIds.has(char.location)) {
      errors.push({ rule: 'char_location', message: `Character ${char.id} has invalid location: ${char.location}` })
    }
  }

  for (const pid of s.crime.perpetrator_ids) {
    if (!characterIds.has(pid)) {
      errors.push({ rule: 'perp_id', message: `perpetrator_ids references unknown character: ${pid}` })
    }
  }

  // ── Items ──────────────────────────────────
  for (const item of s.items) {
    if (!locationIds.has(item.starting_location)) {
      errors.push({ rule: 'item_location', message: `Item ${item.id} has invalid starting_location: ${item.starting_location}` })
    }
  }

  // ── Crime locations ─────────────────────────
  if (!locationIds.has(s.crime.murder_location)) {
    errors.push({ rule: 'crime_location', message: `crime.murder_location is invalid: ${s.crime.murder_location}` })
  }
  if (!locationIds.has(s.crime.body_found_location)) {
    errors.push({ rule: 'crime_location', message: `crime.body_found_location is invalid: ${s.crime.body_found_location}` })
  }

  // ── Checkpoints ────────────────────────────
  // Verify each checkpoint has the correct answer in its answer_options
  for (const cp of s.checkpoints) {
    const correct = getCorrectAnswer(cp.id as any, s)
    if (correct && !cp.answer_options.includes(correct)) {
      errors.push({ rule: 'checkpoint_correct_answer', message: `Checkpoint ${cp.id}: correct answer "${correct}" not found in answer_options` })
    }
    if (cp.answer_options.length < 3 || cp.answer_options.length > 6) {
      errors.push({ rule: 'checkpoint_options_count', message: `Checkpoint ${cp.id}: expected 3–6 answer_options, found ${cp.answer_options.length}` })
    }
  }

  // ── Clues ──────────────────────────────────
  const clueIds = new Set(s.clues.map(c => c.id))

  for (const clue of s.clues) {
    // Condition validity
    const validConditionTypes = new Set([
      'inspect_location',
      'talk_to_character',
      'inspect_item',
      'inspect_item_in_location',
      'ask_character_about_item',
    ])
    if (!validConditionTypes.has(clue.condition.type)) {
      errors.push({ rule: 'condition_type', message: `Clue ${clue.id} has unknown condition type: ${clue.condition.type}` })
    }

    for (const cid of (clue.condition.characters ?? [])) {
      if (cid === 'investigator') continue
      if (!characterIds.has(cid)) {
        errors.push({ rule: 'unknown_char', message: `Clue ${clue.id} condition references unknown character: ${cid}` })
      }
    }

    if (clue.condition.item && !itemIds.has(clue.condition.item)) {
      errors.push({ rule: 'unknown_item', message: `Clue ${clue.id} condition references unknown item: ${clue.condition.item}` })
    }

    if (clue.condition.location && !locationIds.has(clue.condition.location)) {
      errors.push({ rule: 'unknown_location', message: `Clue ${clue.id} condition references unknown location: ${clue.condition.location}` })
    }

    // contradicts array validation
    if (!Array.isArray(clue.contradicts) || clue.contradicts.length === 0) {
      errors.push({ rule: 'clue_contradicts_empty', message: `Clue ${clue.id} has no contradicts entries` })
      continue
    }

    // Anti-clustering: max 3 contradicts entries per clue
    if (clue.contradicts.length > 3) {
      errors.push({ rule: 'anti_clustering', message: `Clue ${clue.id} has ${clue.contradicts.length} contradicts entries (max 3)` })
    }

    for (const entry of clue.contradicts) {
      // Must reference a valid checkpoint
      if (!checkpointIds.has(entry.checkpoint as any)) {
        errors.push({ rule: 'contradicts_checkpoint', message: `Clue ${clue.id} contradicts references unknown checkpoint: ${entry.checkpoint}` })
        continue
      }

      const cp = s.checkpoints.find(c => c.id === entry.checkpoint)!
      // Must reference a valid answer_option
      if (!cp.answer_options.includes(entry.answer)) {
        errors.push({ rule: 'contradicts_answer', message: `Clue ${clue.id} contradicts answer "${entry.answer}" not in checkpoint ${entry.checkpoint} answer_options` })
        continue
      }

      // Must NOT contradict the correct answer
      const correct = getCorrectAnswer(entry.checkpoint as any, s)
      if (entry.answer === correct) {
        errors.push({ rule: 'contradicts_correct', message: `Clue ${clue.id} contradicts the correct answer "${entry.answer}" for checkpoint ${entry.checkpoint}` })
      }
    }
  }

  // ── Coverage ───────────────────────────────
  // For every checkpoint, every wrong answer must have at least one clue contradicting it
  for (const cp of s.checkpoints) {
    const correct = getCorrectAnswer(cp.id as any, s)
    const wrongAnswers = cp.answer_options.filter(o => o !== correct)

    for (const wrong of wrongAnswers) {
      const covered = s.clues.some(clue =>
        Array.isArray(clue.contradicts) &&
        clue.contradicts.some(c => c.checkpoint === cp.id && c.answer === wrong)
      )
      if (!covered) {
        errors.push({ rule: 'coverage', message: `Checkpoint ${cp.id}: wrong answer "${wrong}" has no contradicting clue` })
      }
    }
  }

  // ── Clue count ─────────────────────────────
  if (s.clues.length < 20 || s.clues.length > 28) {
    errors.push({ rule: 'clue_count', message: `Expected 20–28 clues, found ${s.clues.length}` })
  }

  // ── Relations ──────────────────────────────
  for (const rel of (s.relations ?? [])) {
    if (!characterIds.has(rel.from)) {
      errors.push({ rule: 'relation_char', message: `Relation references unknown character: ${rel.from}` })
    }
    if (!characterIds.has(rel.to)) {
      errors.push({ rule: 'relation_char', message: `Relation references unknown character: ${rel.to}` })
    }
  }

  // ── Leads ──────────────────────────────────
  if (!s.leads || s.leads.length < 2) {
    errors.push({ rule: 'leads_count', message: `Expected at least 2 starting leads, found ${s.leads?.length ?? 0}` })
  }

  for (const lead of (s.leads ?? [])) {
    if (lead.character_id && !characterIds.has(lead.character_id)) {
      errors.push({ rule: 'lead_char', message: `Lead ${lead.id} references unknown character: ${lead.character_id}` })
    }
    if (lead.location_id && !locationIds.has(lead.location_id)) {
      errors.push({ rule: 'lead_location', message: `Lead ${lead.id} references unknown location: ${lead.location_id}` })
    }
  }

  return errors
}
