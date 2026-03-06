// ─────────────────────────────────────────────
// TIDEBOUND — Checkpoint Tree
// Hardcoded unlock dependencies.
// The LLM fills content; the engine owns structure.
// ─────────────────────────────────────────────

import type { CheckpointId, Difficulty } from '../types/scenario'
import type { CheckpointState } from '../types/gameState'

// Which checkpoints must be confirmed before this one unlocks.
// 'any_two_of' means: at least 2 of the listed ids must be confirmed.
type UnlockRule =
  | { type: 'always' }
  | { type: 'requires'; ids: CheckpointId[] }
  | { type: 'any_two_of'; ids: CheckpointId[] }

export const CHECKPOINT_UNLOCK_RULES: Record<CheckpointId, UnlockRule> = {
  cause_of_death: { type: 'always' },
  time_of_death:  { type: 'requires', ids: ['cause_of_death'] },
  true_location:  { type: 'requires', ids: ['cause_of_death'] },
  last_seen:      { type: 'any_two_of', ids: ['true_location', 'time_of_death'] },
  victim_state:   { type: 'any_two_of', ids: ['true_location', 'time_of_death'] },
  perpetrator:    { type: 'requires', ids: ['last_seen', 'victim_state'] },
  motive:         { type: 'requires', ids: ['perpetrator'] },
  hidden_truth:   { type: 'requires', ids: ['motive'] },
}

// Which checkpoints are required to win, per difficulty
export const REQUIRED_CHECKPOINTS: Record<Difficulty, CheckpointId[]> = {
  easy:   ['cause_of_death', 'true_location', 'time_of_death', 'last_seen', 'victim_state', 'perpetrator'],
  medium: ['cause_of_death', 'true_location', 'time_of_death', 'last_seen', 'victim_state', 'perpetrator', 'motive'],
  hard:   ['cause_of_death', 'true_location', 'time_of_death', 'last_seen', 'victim_state', 'perpetrator', 'motive', 'hidden_truth'],
}

export function isCheckpointUnlocked(
  id: CheckpointId,
  states: Record<CheckpointId, CheckpointState>
): boolean {
  const rule = CHECKPOINT_UNLOCK_RULES[id]
  switch (rule.type) {
    case 'always':
      return true
    case 'requires':
      return rule.ids.every(dep => states[dep]?.status === 'confirmed')
    case 'any_two_of':
      return rule.ids.filter(dep => states[dep]?.status === 'confirmed').length >= 2
  }
}

// Recompute all checkpoint statuses from scratch.
// Called after every confirmation.
export function recomputeCheckpointStatuses(
  states: Record<CheckpointId, CheckpointState>,
  difficulty: Difficulty
): Record<CheckpointId, CheckpointState> {
  const required = REQUIRED_CHECKPOINTS[difficulty]
  const updated = { ...states }

  for (const id of required) {
    const current = updated[id]
    if (current.status === 'confirmed') continue // never un-confirm

    const unlocked = isCheckpointUnlocked(id, updated)
    updated[id] = {
      ...current,
      status: unlocked ? 'available' : 'locked',
    }
  }

  return updated
}

// Build the initial checkpoint state for a new game
export function initCheckpointStates(
  difficulty: Difficulty
): Record<CheckpointId, CheckpointState> {
  const required = REQUIRED_CHECKPOINTS[difficulty]
  const states = {} as Record<CheckpointId, CheckpointState>

  for (const id of required) {
    states[id] = {
      id,
      status: 'locked',
      confirmedAnswer: null,
      submissions: [],
    }
  }

  // Run once to set initial available checkpoints
  return recomputeCheckpointStatuses(states, difficulty)
}
