// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Validator
// ─────────────────────────────────────────────

import type { Scenario } from '../types/scenario'

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

  // ── Clues ──────────────────────────────────

  // Per checkpoint: check red herrings don't share the same answer
  const cluesByCheckpoint = new Map<string, typeof s.clues>()
  for (const clue of s.clues) {
    const group = cluesByCheckpoint.get(clue.checkpoint) ?? []
    group.push(clue)
    cluesByCheckpoint.set(clue.checkpoint, group)
  }
  for (const [cpId, clues] of cluesByCheckpoint) {
    const redHerringAnswers = clues
      .filter(c => c.weight === 'red_herring')
      .map(c => c.answer)
    const unique = new Set(redHerringAnswers)
    if (unique.size < redHerringAnswers.length) {
      errors.push({ rule: 'red_herring_distinct', message: `Checkpoint ${cpId} has red herrings pointing at the same answer` })
    }
  }

  const clueIds = new Set(s.clues.map(c => c.id))

  for (const clue of s.clues) {
    if (!checkpointIds.has(clue.checkpoint)) {
      errors.push({ rule: 'clue_checkpoint', message: `Clue ${clue.id} references unknown checkpoint: ${clue.checkpoint}` })
    }

    const cp = s.checkpoints.find(c => c.id === clue.checkpoint)
    if (cp && !cp.answer_options.includes(clue.answer)) {
      errors.push({ rule: 'clue_answer', message: `Clue ${clue.id} answer "${clue.answer}" not in checkpoint answer_options` })
    }

    if (clue.weight === 'red_herring' && !clue.red_herring_explanation) {
      errors.push({ rule: 'red_herring_explanation', message: `Clue ${clue.id} is red_herring but has no red_herring_explanation` })
    }

    if (clue.requires_clue_id) {
      if (!clueIds.has(clue.requires_clue_id)) {
        errors.push({ rule: 'requires_clue_id', message: `Clue ${clue.id} requires_clue_id "${clue.requires_clue_id}" is not a valid clue id` })
      } else {
        const dep = s.clues.find(c => c.id === clue.requires_clue_id)
        if (dep?.weight === 'red_herring') {
          errors.push({ rule: 'requires_clue_id_red_herring', message: `Clue ${clue.id} requires_clue_id "${clue.requires_clue_id}" is a red_herring — red herrings are trimmed on lower difficulties, making this clue permanently unreachable` })
        }
      }
    }

    const validConditionTypes = new Set([
      'investigator_at_location',
      'investigator_with_character',
      'investigator_with_item',
      'investigator_at_location_with_item',
      'investigator_with_character_and_item',
    ])
    if (!validConditionTypes.has(clue.condition.type)) {
      errors.push({ rule: 'condition_type', message: `Clue ${clue.id} has unknown condition type: ${clue.condition.type}` })
    }

    for (const cid of (clue.condition.characters ?? [])) {
      if (cid === 'investigator') continue  // always valid — added by engine, not in scenario characters
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
