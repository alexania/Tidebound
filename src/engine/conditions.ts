// ─────────────────────────────────────────────
// TIDEBOUND — Condition Evaluator
// Given action context, evaluates whether a clue
// condition is satisfied. Fully deterministic.
// ─────────────────────────────────────────────

import type { ClueCondition, LocationId } from '../types/scenario'

export interface EvalContext {
  investigatorLocation: LocationId
  inventory: string[]                       // item IDs in player's possession
  characterLocations: Record<string, LocationId>
}

// ─────────────────────────────────────────────
// Main evaluator
// ─────────────────────────────────────────────

export function evaluateCondition(condition: ClueCondition, ctx: EvalContext): boolean {
  const { investigatorLocation, inventory, characterLocations } = ctx
  const chars = condition.characters ?? []

  switch (condition.type) {

    // Investigator is at a specific location
    case 'investigator_at_location':
      return !!condition.location && investigatorLocation === condition.location

    // Investigator is at the same location as a specific character
    case 'investigator_with_character': {
      if (chars.length === 0) return false
      const charLoc = characterLocations[chars[0]]
      return !!charLoc && investigatorLocation === charLoc
    }

    // Item is in the investigator's inventory
    case 'investigator_with_item':
      return !!condition.item && inventory.includes(condition.item)

    // Investigator at a specific location AND item in inventory
    case 'investigator_at_location_with_item':
      return !!condition.location && !!condition.item &&
        investigatorLocation === condition.location &&
        inventory.includes(condition.item)

    // Investigator at a character's location AND item in inventory
    case 'investigator_with_character_and_item': {
      if (chars.length === 0 || !condition.item) return false
      const charLoc = characterLocations[chars[0]]
      return !!charLoc && investigatorLocation === charLoc && inventory.includes(condition.item)
    }

    default:
      return false
  }
}
