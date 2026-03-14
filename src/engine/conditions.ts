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
  collectedClueIds: string[]
}

// ─────────────────────────────────────────────
// Main evaluator
// ─────────────────────────────────────────────

export function evaluateCondition(condition: ClueCondition, ctx: EvalContext): boolean {
  const { investigatorLocation, inventory, characterLocations, collectedClueIds } = ctx
  const chars = condition.characters ?? []

  switch (condition.type) {

    // Investigator is at a specific location
    case 'inspect_location':
      return !!condition.location && investigatorLocation === condition.location

    // Investigator is at the same location as a specific character
    case 'talk_to_character': {
      if (chars.length === 0) return false
      const charLoc = characterLocations[chars[0]]
      return !!charLoc && investigatorLocation === charLoc
    }

    // Item is in the investigator's inventory
    case 'inspect_item':
      return !!condition.item && inventory.includes(condition.item)

    // Investigator at a specific location AND item in inventory
    case 'inspect_item_in_location':
      return !!condition.location && !!condition.item &&
        investigatorLocation === condition.location &&
        inventory.includes(condition.item)

    // Investigator at a character's location AND item in inventory
    case 'ask_character_about_item': {
      if (chars.length === 0 || !condition.item) return false
      const charLoc = characterLocations[chars[0]]
      return !!charLoc && investigatorLocation === charLoc && inventory.includes(condition.item)
    }

    // Investigator at a character's location AND a specific clue has already been collected
    case 'ask_character_about_clue': {
      if (chars.length === 0 || !condition.clue) return false
      const charLoc = characterLocations[chars[0]]
      return !!charLoc && investigatorLocation === charLoc && collectedClueIds.includes(condition.clue)
    }

    default:
      return false
  }
}
