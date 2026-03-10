// ─────────────────────────────────────────────
// TIDEBOUND — Checkpoint Tree
//
// Investigative checkpoints (cause_of_death, true_location, time_of_death)
// are available from turn 1.
// Accusation phase unlocks in sequence once all investigative are confirmed:
//   perpetrator → motive → hidden_truth (if present)
// ─────────────────────────────────────────────

import type { CheckpointId } from '../types/scenario'
import type { CheckpointState } from '../types/gameState'

const ACCUSATION_CHECKPOINTS = new Set<string>(['perpetrator', 'motive'])

function allInvestigativeConfirmed(states: Record<string, CheckpointState>): boolean {
  return Object.entries(states)
    .filter(([id]) => !ACCUSATION_CHECKPOINTS.has(id))
    .every(([, state]) => state.status === 'confirmed')
}

export function recomputeCheckpointStatuses(
  states: Record<CheckpointId, CheckpointState>
): Record<CheckpointId, CheckpointState> {
  const updated = { ...states }
  const investigativeDone = allInvestigativeConfirmed(updated)

  for (const id of Object.keys(updated) as CheckpointId[]) {
    if (updated[id].status === 'confirmed') continue

    let status: 'available' | 'locked'

    if (!ACCUSATION_CHECKPOINTS.has(id)) {
      status = 'available'
    } else if (id === 'perpetrator') {
      status = investigativeDone ? 'available' : 'locked'
    } else if (id === 'motive') {
      status = updated['perpetrator']?.status === 'confirmed' ? 'available' : 'locked'
    } else {
      status = 'locked'
    }

    updated[id] = { ...updated[id], status }
  }

  return updated
}

export function initCheckpointStates(
  checkpointIds: CheckpointId[]
): Record<CheckpointId, CheckpointState> {
  const states = {} as Record<CheckpointId, CheckpointState>

  for (const id of checkpointIds) {
    states[id] = {
      id,
      status: ACCUSATION_CHECKPOINTS.has(id) ? 'locked' : 'available',
      confirmedAnswer: null,
      submissions: [],
    }
  }

  return states
}
