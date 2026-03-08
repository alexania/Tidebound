// ─────────────────────────────────────────────
// TIDEBOUND — Checkpoint Tree
//
// All 5 investigative checkpoints are available from turn 1.
// Accusation checkpoints lock until all 5 investigative confirmed.
// ─────────────────────────────────────────────

import type { CheckpointId, Difficulty } from '../types/scenario'
import type { CheckpointState } from '../types/gameState'

const INVESTIGATIVE_CHECKPOINTS: CheckpointId[] = [
  'cause_of_death',
  'true_location',
  'time_of_death',
  'last_seen',
  'victim_state',
]

export const REQUIRED_CHECKPOINTS: Record<Difficulty, CheckpointId[]> = {
  easy:   [...INVESTIGATIVE_CHECKPOINTS, 'perpetrator'],
  medium: [...INVESTIGATIVE_CHECKPOINTS, 'perpetrator', 'motive'],
  hard:   [...INVESTIGATIVE_CHECKPOINTS, 'perpetrator', 'motive', 'hidden_truth'],
}

function allInvestigativeConfirmed(states: Record<CheckpointId, CheckpointState>): boolean {
  return INVESTIGATIVE_CHECKPOINTS.every(id => states[id]?.status === 'confirmed')
}

export function recomputeCheckpointStatuses(
  states: Record<CheckpointId, CheckpointState>,
  difficulty: Difficulty
): Record<CheckpointId, CheckpointState> {
  const required = REQUIRED_CHECKPOINTS[difficulty]
  const updated = { ...states }
  const investigativeDone = allInvestigativeConfirmed(updated)

  for (const id of required) {
    if (updated[id].status === 'confirmed') continue

    let status: 'available' | 'locked'

    if (INVESTIGATIVE_CHECKPOINTS.includes(id)) {
      status = 'available'
    } else if (id === 'perpetrator') {
      status = investigativeDone ? 'available' : 'locked'
    } else if (id === 'motive') {
      status = updated['perpetrator']?.status === 'confirmed' ? 'available' : 'locked'
    } else if (id === 'hidden_truth') {
      status = updated['motive']?.status === 'confirmed' ? 'available' : 'locked'
    } else {
      status = 'locked'
    }

    updated[id] = { ...updated[id], status }
  }

  return updated
}

export function initCheckpointStates(
  difficulty: Difficulty
): Record<CheckpointId, CheckpointState> {
  const required = REQUIRED_CHECKPOINTS[difficulty]
  const states = {} as Record<CheckpointId, CheckpointState>

  for (const id of required) {
    states[id] = {
      id,
      status: INVESTIGATIVE_CHECKPOINTS.includes(id) ? 'available' : 'locked',
      confirmedAnswer: null,
      submissions: [],
    }
  }

  return states
}
