// ─────────────────────────────────────────────
// TIDEBOUND — Checkpoint Tree
//
// Sequential gating:
//   true_location  — always available
//   perpetrator    — unlocks when true_location confirmed
//   motive         — unlocks when perpetrator confirmed
// ─────────────────────────────────────────────

import type { CheckpointId } from '../types/scenario'
import type { CheckpointState } from '../types/gameState'

export function recomputeCheckpointStatuses(
  states: Record<CheckpointId, CheckpointState>
): Record<CheckpointId, CheckpointState> {
  const updated = { ...states }

  const locationConfirmed = updated['true_location']?.status === 'confirmed'
  const perpetratorConfirmed = updated['perpetrator']?.status === 'confirmed'

  for (const id of Object.keys(updated) as CheckpointId[]) {
    if (updated[id].status === 'confirmed') continue

    let status: 'available' | 'locked'

    if (id === 'true_location') {
      status = 'available'
    } else if (id === 'perpetrator') {
      status = locationConfirmed ? 'available' : 'locked'
    } else if (id === 'motive') {
      status = perpetratorConfirmed ? 'available' : 'locked'
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
      status: id === 'true_location' ? 'available' : 'locked',
      confirmedAnswer: null,
      submissions: [],
      proofs: {},
    }
  }

  return states
}
