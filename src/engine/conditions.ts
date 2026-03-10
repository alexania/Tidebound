// ─────────────────────────────────────────────
// TIDEBOUND — Condition Evaluator
// Given a board state, evaluates whether a clue
// condition is satisfied. Fully deterministic.
// ─────────────────────────────────────────────

import type { ClueCondition, LocationId } from '../types/scenario'
import type { BoardState } from '../types/gameState'

interface EvalContext {
  board: BoardState
}

function loc(board: BoardState, id: string): LocationId | null {
  return board.characterLocations[id] ?? null
}

function itemLoc(board: BoardState, itemId: string): LocationId | null {
  return board.itemLocations[itemId] ?? null
}

// ─────────────────────────────────────────────
// Main evaluator
// ─────────────────────────────────────────────

export function evaluateCondition(condition: ClueCondition, ctx: EvalContext): boolean {
  const { board } = ctx
  const invLoc = loc(board, 'investigator')
  const chars = condition.characters ?? []

  switch (condition.type) {

    // Investigator is at a specific location
    case 'investigator_at_location': {
      if (!condition.location) return false
      return invLoc === condition.location
    }

    // Investigator is at the same location as a specific character (characters are fixed)
    case 'investigator_with_character': {
      if (chars.length === 0) return false
      const charLoc = loc(board, chars[0])
      return invLoc !== null && invLoc === charLoc
    }

    // Investigator is at the same location as a specific item (item may be anywhere)
    case 'investigator_with_item': {
      if (!condition.item) return false
      return invLoc !== null && itemLoc(board, condition.item) === invLoc
    }

    // Investigator at a specific location with a specific item also present there
    case 'investigator_at_location_with_item': {
      if (!condition.location || !condition.item) return false
      return invLoc === condition.location && itemLoc(board, condition.item) === condition.location
    }

    // Investigator at a character's location with a specific item also present there
    case 'investigator_with_character_and_item': {
      if (chars.length === 0 || !condition.item) return false
      const charLoc = loc(board, chars[0])
      return invLoc !== null && invLoc === charLoc && itemLoc(board, condition.item) === charLoc
    }

    default:
      return false
  }
}
