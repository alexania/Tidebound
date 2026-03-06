// ─────────────────────────────────────────────
// TIDEBOUND — Game State Types
// Scenario is static (the puzzle).
// GameState is dynamic (what the player has done).
// ─────────────────────────────────────────────

import type { CheckpointId, LocationId, Difficulty } from './scenario'

// Where every character and item currently is
export interface BoardState {
  // characterId -> current location
  characterLocations: Record<string, LocationId>
  // itemId -> current location (null = not yet discovered)
  itemLocations: Record<string, LocationId | null>
}

// A clue the player has collected
export interface CollectedClue {
  clueId: string
  turn: number
  // The text shown to the player (copied from Clue.text at collection time)
  text: string
}

// A card the player has pinned to the evidence board
export interface PinnedCard {
  id: string           // matches CollectedClue.clueId
  clueId: string
  text: string
  turn: number
  note: string         // player's annotation, starts empty
  // Position on the evidence board canvas
  x: number
  y: number
}

// A connection the player has drawn between two pinned cards
export interface BoardConnection {
  id: string
  fromCardId: string
  toCardId: string
  label: string
}

// The result of a checkpoint submission
export type SubmissionResult = 'correct' | 'incorrect'

export interface CheckpointSubmission {
  checkpointId: CheckpointId
  submittedAnswer: string
  result: SubmissionResult
  turn: number
  // Which clue ids the player cited as evidence
  citedClueIds: string[]
}

// Status of each checkpoint from the player's perspective
export type CheckpointStatus =
  | 'locked'      // prerequisites not yet confirmed
  | 'available'   // can be submitted against
  | 'confirmed'   // player submitted correct answer

export interface CheckpointState {
  id: CheckpointId
  status: CheckpointStatus
  confirmedAnswer: string | null
  submissions: CheckpointSubmission[]
}

// One entry in the action log
export interface LogEntry {
  id: string
  turn: number
  locationId: LocationId
  text: string          // the clue text or atmospheric event text
  clueId: string | null // null for pure atmosphere entries (future)
  isNew: boolean        // true on the turn it fires, for highlighting
}

// The complete mutable game state
export interface GameState {
  scenarioId: string
  difficulty: Difficulty
  turn: number
  phase: 'setup' | 'resolve' | 'review'

  // Actions remaining in setup phase (always 3)
  actionsRemaining: number

  // Where everyone/everything is right now
  board: BoardState

  // Clue ids the player has collected so far
  collectedClueIds: string[]

  // Item ids the player has discovered (became visible by visiting their location)
  discoveredItemIds: string[]

  // The full log of everything that has happened
  log: LogEntry[]

  // Evidence board
  pinnedCards: PinnedCard[]
  connections: BoardConnection[]

  // Checkpoint progress
  checkpoints: Record<CheckpointId, CheckpointState>

  // True once all required checkpoints confirmed
  solved: boolean
  finalScore: number | null
}
