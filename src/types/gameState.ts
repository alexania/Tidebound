// ─────────────────────────────────────────────
// TIDEBOUND — Game State Types
// ─────────────────────────────────────────────

import type { CheckpointId, LocationId, Difficulty } from './scenario'

export interface CollectedClue {
  clueId: string
  turn: number
  text: string
}

export interface PinnedCard {
  id: string
  clueId: string | null
  text: string
  turn: number | null
  impliedAnswer: string
  locationId: LocationId | null
  checkpointId: CheckpointId | null
}

export type SubmissionResult = 'correct' | 'incorrect'

export interface CheckpointSubmission {
  checkpointId: CheckpointId
  submittedAnswer: string
  result: SubmissionResult
  turn: number
  citedClueIds: string[]
}

// All 5 investigative checkpoints are available from action 1.
// perpetrator, motive unlock only when all 3 investigative are confirmed.
export type CheckpointStatus = 'available' | 'confirmed' | 'locked'

export interface CheckpointState {
  id: CheckpointId
  status: CheckpointStatus
  confirmedAnswer: string | null
  submissions: CheckpointSubmission[]
  proofs: Record<string, string>  // wrong_answer → clue_id
}

export interface LogEntry {
  id: string
  turn: number         // maps to actionCount at time of entry
  locationId: LocationId
  text: string
  clueId: string | null
  isNew: boolean
  isLead?: boolean
  isMilestone?: boolean
}

export interface GameState {
  scenarioId: string
  difficulty: Difficulty
  actionCount: number

  investigatorLocation: LocationId
  inventory: string[]              // item IDs currently carried
  visitedLocationIds: string[]     // locations entered (reveals NPCs)
  inspectedLocationIds: string[]   // locations explicitly inspected (reveals items)
  attemptedActions: string[]       // e.g. "inspect:harbour", "talk:martha", "ask:martha:flask"
  lockedActionKeys: string[]       // action keys that returned locked feedback — shown as indicators

  foundCharacterIds: string[]
  foundItemIds: string[]           // items picked up into inventory

  collectedClueIds: string[]
  log: LogEntry[]

  pinnedCards: PinnedCard[]
  selected: string | null

  checkpoints: Record<CheckpointId, CheckpointState>

  solved: boolean
  finalScore: number | null
}
