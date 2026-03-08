// ─────────────────────────────────────────────
// TIDEBOUND — Game State Types
// ─────────────────────────────────────────────

import type { CheckpointId, LocationId, Difficulty, ClueWeight } from './scenario'

export interface BoardState {
  characterLocations: Record<string, LocationId>
  itemLocations: Record<string, LocationId>
}

export interface CollectedClue {
  clueId: string
  turn: number
  text: string
}

export interface PinnedCard {
  id: string
  // 'opening' is the special auto-pinned opening narrative card
  type: 'clue' | 'opening'
  clueId: string | null
  text: string
  turn: number | null
  note: string
  x: number
  y: number
}

export interface BoardConnection {
  id: string
  fromCardId: string
  toCardId: string
  label: string
}

export type SubmissionResult = 'correct' | 'incorrect'

export interface CheckpointSubmission {
  checkpointId: CheckpointId
  submittedAnswer: string
  result: SubmissionResult
  turn: number
  citedClueIds: string[]
}

// All 5 investigative checkpoints are available from turn 1.
// perpetrator, motive, hidden_truth unlock only when all 5 are confirmed.
export type CheckpointStatus = 'available' | 'confirmed' | 'locked'

export interface CheckpointState {
  id: CheckpointId
  status: CheckpointStatus
  confirmedAnswer: string | null
  submissions: CheckpointSubmission[]
}

export interface LogEntry {
  id: string
  turn: number
  locationId: LocationId
  text: string
  clueId: string | null
  isNew: boolean
  isLead?: boolean
  weight?: ClueWeight
}

export interface GameState {
  scenarioId: string
  difficulty: Difficulty
  turn: number
  phase: 'setup' | 'resolve'
  actionsRemaining: number

  board: BoardState

  // Characters and items found by the investigator visiting their location
  foundCharacterIds: string[]
  foundItemIds: string[]

  collectedClueIds: string[]
  log: LogEntry[]

  // Evidence board
  pinnedCards: PinnedCard[]
  connections: BoardConnection[]

  // Currently selected entity in the info panel
  // Format: "char:id" | "item:id" | "loc:id" | null
  selected: string | null

  checkpoints: Record<CheckpointId, CheckpointState>

  solved: boolean
  finalScore: number | null
}
