// ─────────────────────────────────────────────
// TIDEBOUND — Condition Evaluator
// Given a board state, evaluates whether a clue
// condition is satisfied. Fully deterministic.
// ─────────────────────────────────────────────

import type { ClueCondition, LocationId } from '../types/scenario'
import type { BoardState } from '../types/gameState'

interface EvalContext {
  board: BoardState
  // All character ids currently on the board (excludes victim if dead/removed)
  allCharacterIds: string[]
}

function getCharacterLocation(board: BoardState, characterId: string): LocationId | null {
  return board.characterLocations[characterId] ?? null
}

function getItemLocation(board: BoardState, itemId: string): LocationId | null {
  return board.itemLocations[itemId] ?? null
}

// Returns all character ids currently at a given location
function charactersAtLocation(board: BoardState, allIds: string[], location: LocationId): string[] {
  return allIds.filter(id => board.characterLocations[id] === location)
}

// ─────────────────────────────────────────────
// Main evaluator
// ─────────────────────────────────────────────

export function evaluateCondition(condition: ClueCondition, ctx: EvalContext): boolean {
  const { board, allCharacterIds } = ctx
  const chars = condition.characters ?? []

  switch (condition.type) {

    // A specific character is at a specific location
    case 'character_in_location': {
      if (chars.length === 0 || !condition.location) return false
      return getCharacterLocation(board, chars[0]) === condition.location
    }

    // N specific characters are ALL at a specific location
    case 'n_characters_in_location': {
      if (chars.length === 0 || !condition.location) return false
      return chars.every(id => getCharacterLocation(board, id) === condition.location)
    }

    // N specific characters are all at the same location (anywhere)
    case 'n_characters_together': {
      if (chars.length < 2) return false
      const firstLoc = getCharacterLocation(board, chars[0])
      if (!firstLoc) return false
      return chars.every(id => getCharacterLocation(board, id) === firstLoc)
    }

    // N specific characters together, with no one else present
    case 'n_characters_together_alone': {
      if (chars.length < 2) return false
      const firstLoc = getCharacterLocation(board, chars[0])
      if (!firstLoc) return false
      const allTogether = chars.every(id => getCharacterLocation(board, id) === firstLoc)
      if (!allTogether) return false
      const othersPresent = allCharacterIds.some(
        id => !chars.includes(id) && getCharacterLocation(board, id) === firstLoc
      )
      return !othersPresent
    }

    // Character(s) at a specific location, with a specific item also there
    case 'characters_in_location_with_item': {
      if (chars.length === 0 || !condition.location || !condition.item) return false
      const allCharsPresent = chars.every(
        id => getCharacterLocation(board, id) === condition.location
      )
      const itemPresent = getItemLocation(board, condition.item) === condition.location
      return allCharsPresent && itemPresent
    }

    // Character(s) alone at a specific location with a specific item
    case 'characters_alone_in_location_with_item': {
      if (chars.length === 0 || !condition.location || !condition.item) return false
      const allCharsPresent = chars.every(
        id => getCharacterLocation(board, id) === condition.location
      )
      const itemPresent = getItemLocation(board, condition.item) === condition.location
      if (!allCharsPresent || !itemPresent) return false
      const othersPresent = allCharacterIds.some(
        id => !chars.includes(id) && getCharacterLocation(board, id) === condition.location
      )
      return !othersPresent
    }

    // Character(s) at the same location as a specific item, anywhere
    case 'characters_anywhere_with_item': {
      if (chars.length === 0 || !condition.item) return false
      const itemLoc = getItemLocation(board, condition.item)
      if (!itemLoc) return false
      return chars.every(id => getCharacterLocation(board, id) === itemLoc)
    }

    // Character(s) alone with a specific item, anywhere
    case 'characters_anywhere_with_item_alone': {
      if (chars.length === 0 || !condition.item) return false
      const itemLoc = getItemLocation(board, condition.item)
      if (!itemLoc) return false
      const allWithItem = chars.every(id => getCharacterLocation(board, id) === itemLoc)
      if (!allWithItem) return false
      const othersPresent = allCharacterIds.some(
        id => !chars.includes(id) && getCharacterLocation(board, id) === itemLoc
      )
      return !othersPresent
    }

    default:
      return false
  }
}
