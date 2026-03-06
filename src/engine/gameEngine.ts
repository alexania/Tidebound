// ─────────────────────────────────────────────
// TIDEBOUND — Game Engine
// All game state mutations go through here.
// Pure functions — no side effects, no React.
// ─────────────────────────────────────────────

import type { Scenario, CheckpointId, LocationId, Difficulty } from '../types/scenario'
import type { GameState, BoardState, LogEntry, CollectedClue, CheckpointSubmission } from '../types/gameState'
import { evaluateCondition } from './conditions'
import { initCheckpointStates, recomputeCheckpointStatuses, REQUIRED_CHECKPOINTS } from './checkpoints'

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────

export function initGameState(scenario: Scenario, difficulty: Difficulty): GameState {
  // Place all characters at their home locations
  const characterLocations: Record<string, LocationId> = {}
  for (const char of scenario.characters) {
    characterLocations[char.id] = char.home_location
  }

  // Items always have a physical location; discovery tracks player knowledge
  const itemLocations: Record<string, LocationId | null> = {}
  for (const item of scenario.items) {
    itemLocations[item.id] = item.starting_location
  }

  // Discover items that share a starting location with any character's home
  const homeLocations = new Set(scenario.characters.map(c => c.home_location))
  const discoveredItemIds = scenario.items
    .filter(item => homeLocations.has(item.starting_location))
    .map(item => item.id)

  const board: BoardState = { characterLocations, itemLocations }
  const checkpoints = initCheckpointStates(difficulty)

  return {
    scenarioId: scenario.village.name,
    difficulty,
    turn: 1,
    phase: 'setup',
    actionsRemaining: 3,
    board,
    collectedClueIds: [],
    discoveredItemIds,
    log: [],
    pinnedCards: [],
    connections: [],
    checkpoints,
    solved: false,
    finalScore: null,
  }
}

// ─────────────────────────────────────────────
// Setup phase actions
// ─────────────────────────────────────────────

// Move a character to a location. Costs 1 action.
// Automatically discovers items at the destination.
export function moveCharacter(
  state: GameState,
  characterId: string,
  targetLocation: LocationId,
  scenario: Scenario
): GameState {
  if (state.phase !== 'setup' || state.actionsRemaining <= 0) return state

  // Discover any items at the destination that aren't yet known
  const itemsAtDest = scenario.items
    .filter(item => item.starting_location === targetLocation || state.board.itemLocations[item.id] === targetLocation)
    .map(item => item.id)
  const newlyDiscovered = itemsAtDest.filter(id => !state.discoveredItemIds.includes(id))

  return {
    ...state,
    actionsRemaining: state.actionsRemaining - 1,
    discoveredItemIds: newlyDiscovered.length > 0
      ? [...state.discoveredItemIds, ...newlyDiscovered]
      : state.discoveredItemIds,
    board: {
      ...state.board,
      characterLocations: {
        ...state.board.characterLocations,
        [characterId]: targetLocation,
      },
    },
  }
}

// Move a discovered item to a location. Costs 1 action.
// Only possible if item has been discovered.
export function moveItem(
  state: GameState,
  itemId: string,
  targetLocation: LocationId
): GameState {
  if (state.phase !== 'setup' || state.actionsRemaining <= 0) return state
  if (!state.discoveredItemIds.includes(itemId)) return state // not discovered

  return {
    ...state,
    actionsRemaining: state.actionsRemaining - 1,
    board: {
      ...state.board,
      itemLocations: {
        ...state.board.itemLocations,
        [itemId]: targetLocation,
      },
    },
  }
}

// ─────────────────────────────────────────────
// Resolve phase
// ─────────────────────────────────────────────

// Priority order for clue weights — higher fires first per location
const WEIGHT_PRIORITY: Record<string, number> = {
  hard: 4,
  soft: 3,
  contradiction: 2,
  red_herring: 1,
}

export function resolveTurn(state: GameState, scenario: Scenario): GameState {
  if (state.phase !== 'setup') return state

  const allCharacterIds = scenario.characters
    .filter(c => c.role !== 'victim') // victim doesn't move
    .map(c => c.id)

  const ctx = { board: state.board, allCharacterIds }

  // Determine which clues are currently face-up (unlocked by confirmed checkpoints)
  const confirmedCheckpoints = new Set(
    Object.values(state.checkpoints)
      .filter(cp => cp.status === 'confirmed')
      .map(cp => cp.id)
  )

  const availableClues = scenario.clues.filter(clue => {
    // Already collected — skip
    if (state.collectedClueIds.includes(clue.id)) return false
    // Locked behind a checkpoint not yet confirmed
    if (clue.unlocked_by && !confirmedCheckpoints.has(clue.unlocked_by)) return false
    return true
  })

  // From turn 9, all uncollected available clues auto-fire (conditions bypassed)
  const guaranteed = state.turn >= 9

  // Evaluate all conditions, group by location
  const firedByLocation: Record<string, typeof availableClues> = {}

  for (const clue of availableClues) {
    if (!guaranteed && !evaluateCondition(clue.condition, ctx)) continue

    // Determine the location this clue fires in (for log grouping)
    const loc = clue.condition.location
      ?? getClueLocation(clue, state.board, scenario)
      ?? 'harbour' // fallback

    if (!firedByLocation[loc]) firedByLocation[loc] = []
    firedByLocation[loc].push(clue)
  }

  // Per location: pick only the highest-priority clue
  const newClueIds: string[] = []
  const newLogEntries: LogEntry[] = []
  const newlyDiscoveredItems: string[] = []

  for (const [loc, clues] of Object.entries(firedByLocation)) {
    const winner = clues.reduce((best, clue) =>
      (WEIGHT_PRIORITY[clue.weight] ?? 0) > (WEIGHT_PRIORITY[best.weight] ?? 0) ? clue : best
    )
    newClueIds.push(winner.id)
    newLogEntries.push({
      id: `log_${state.turn}_${winner.id}`,
      turn: state.turn,
      locationId: loc as LocationId,
      text: winner.text,
      clueId: winner.id,
      isNew: true,
    })
    // Discover items referenced by fired clues
    if (winner.condition.item && !state.discoveredItemIds.includes(winner.condition.item)) {
      newlyDiscoveredItems.push(winner.condition.item)
    }
  }

  // Mark previous log entries as no longer new
  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))

  return {
    ...state,
    phase: 'review',
    collectedClueIds: [...state.collectedClueIds, ...newClueIds],
    discoveredItemIds: newlyDiscoveredItems.length > 0
      ? [...state.discoveredItemIds, ...newlyDiscoveredItems]
      : state.discoveredItemIds,
    log: [...updatedLog, ...newLogEntries],
  }
}

// Helper: find what location a clue fired in when condition has no explicit location
function getClueLocation(clue: { condition: { characters?: string[] } }, board: BoardState, _scenario: Scenario): LocationId | null {
  const chars = clue.condition.characters
  if (chars && chars.length > 0) {
    return board.characterLocations[chars[0]] ?? null
  }
  return null
}

// ─────────────────────────────────────────────
// Checkpoint submission
// ─────────────────────────────────────────────

export function submitCheckpoint(
  state: GameState,
  scenario: Scenario,
  checkpointId: CheckpointId,
  answer: string,
  citedClueIds: string[]
): GameState {
  if (state.phase !== 'review') return state

  const checkpoint = state.checkpoints[checkpointId]
  if (!checkpoint || checkpoint.status !== 'available') return state

  // Derive correct answer from the crime object
  const correctAnswer = getCorrectAnswer(checkpointId, scenario)
  const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()

  const submission: CheckpointSubmission = {
    checkpointId,
    submittedAnswer: answer,
    result: isCorrect ? 'correct' : 'incorrect',
    turn: state.turn,
    citedClueIds,
  }

  const updatedCheckpoint = {
    ...checkpoint,
    status: isCorrect ? ('confirmed' as const) : checkpoint.status,
    confirmedAnswer: isCorrect ? answer : checkpoint.confirmedAnswer,
    submissions: [...checkpoint.submissions, submission],
  }

  const updatedCheckpoints = recomputeCheckpointStatuses(
    { ...state.checkpoints, [checkpointId]: updatedCheckpoint },
    state.difficulty
  )

  const required = REQUIRED_CHECKPOINTS[state.difficulty]
  const solved = required.every(id => updatedCheckpoints[id]?.status === 'confirmed')

  return {
    ...state,
    checkpoints: updatedCheckpoints,
    solved,
    finalScore: solved && !state.solved ? calculateScore(state.turn, state.difficulty) : state.finalScore,
  }
}

function getCorrectAnswer(checkpointId: CheckpointId, scenario: Scenario): string {
  const crime = scenario.crime
  switch (checkpointId) {
    case 'cause_of_death': return crime.cause_of_death
    case 'true_location':  return crime.murder_location
    case 'time_of_death':  return crime.time_of_death
    case 'perpetrator':    return crime.perpetrator_ids[0] // single perp for now
    case 'motive':         return crime.motive
    case 'hidden_truth':   return crime.hidden_truth ?? ''
    // last_seen and victim_state answers live in the checkpoint answer_options
    // The correct answer is the one that matches what the scenario says —
    // we derive it from the clue set: the hard/soft clue answers for that checkpoint
    case 'last_seen':
    case 'victim_state': {
      // The correct answer is whichever answer_option the hard or soft clues point at
      const cp = scenario.checkpoints.find(c => c.id === checkpointId)
      const correctClue = scenario.clues.find(
        c => c.checkpoint === checkpointId && (c.weight === 'hard' || c.weight === 'soft')
      )
      return correctClue?.answer ?? cp?.answer_options[0] ?? ''
    }
    default: return ''
  }
}

function calculateScore(turns: number, difficulty: Difficulty): number {
  const base = { easy: 1000, medium: 2000, hard: 3000 }[difficulty]
  const penalty = turns * 50
  return Math.max(base - penalty, 100)
}

// ─────────────────────────────────────────────
// End turn — move from review back to setup
// ─────────────────────────────────────────────

export function endTurn(state: GameState): GameState {
  if (state.phase !== 'review') return state
  return {
    ...state,
    phase: 'setup',
    turn: state.turn + 1,
    actionsRemaining: 3,
  }
}
