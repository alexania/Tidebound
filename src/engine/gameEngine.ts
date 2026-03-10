// ─────────────────────────────────────────────
// TIDEBOUND — Game Engine
// ─────────────────────────────────────────────

import type { Scenario, CheckpointId, LocationId, Difficulty, Clue } from '../types/scenario'
import type { GameState, BoardState, LogEntry } from '../types/gameState'
import { evaluateCondition } from './conditions'
import { initCheckpointStates, recomputeCheckpointStatuses } from './checkpoints'

// ─────────────────────────────────────────────
// Difficulty filtering
// ─────────────────────────────────────────────

const RED_HERRINGS_PER_DIFFICULTY: Record<Difficulty, number> = {
  easy:   1,
  medium: 2,
  hard:   3,
}

// Scenarios are always generated at "hard" (2 correct + 3 red herrings per checkpoint).
// This trims red herrings down to the count appropriate for the chosen difficulty,
// keeping the first N red herrings per checkpoint by array order.
export function filterCluesToDifficulty(scenario: Scenario, difficulty: Difficulty): Scenario {
  const keep = RED_HERRINGS_PER_DIFFICULTY[difficulty]
  const redHerringCount: Record<string, number> = {}

  const filtered = scenario.clues.filter(clue => {
    if (clue.weight !== 'red_herring') return true
    const cp = clue.checkpoint
    redHerringCount[cp] = (redHerringCount[cp] ?? 0) + 1
    return redHerringCount[cp] <= keep
  })

  return { ...scenario, clues: filtered }
}

// ─────────────────────────────────────────────
// Investigator — reserved id, always present
// ─────────────────────────────────────────────

export const INVESTIGATOR_ID = 'investigator'

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

export function initGameState(scenario: Scenario, difficulty: Difficulty): GameState {
  const characterLocations: Record<string, LocationId> = {}
  for (const char of scenario.characters) {
    characterLocations[char.id] = char.location
  }
  characterLocations[INVESTIGATOR_ID] = scenario.location.arrival_location

  const itemLocations: Record<string, LocationId> = {}
  for (const item of scenario.items) {
    itemLocations[item.id] = item.starting_location
  }

  const board: BoardState = { characterLocations, itemLocations }
  const checkpoints = initCheckpointStates(scenario.checkpoints.map(cp => cp.id))

  const victim = scenario.characters.find(c => c.isVictim)

  const arrival = scenario.location.arrival_location

  const leadEntries: LogEntry[] = scenario.leads.map((lead, i) => ({
    id: `log_0_lead_${i}`,
    turn: 0,
    locationId: lead.location_id ?? arrival,
    text: lead.text,
    clueId: null,
    isNew: false,
    isLead: true,
  }))

  const seedEntry: LogEntry = {
    id: 'log_1_arrival',
    turn: 1,
    locationId: arrival,
    text: `Word has reached the investigator at [loc:${arrival}]${victim ? ` — [char:${victim.name}] has been found at [loc:${scenario.crime.body_found_location}]` : ''}. The investigation begins.`,
    clueId: null,
    isNew: false,
  }

  return {
    scenarioId: scenario.location.name,
    difficulty,
    turn: 1,
    phase: 'setup',
    actionsRemaining: 1,
    board,
    foundLocationIds: [],
    foundCharacterIds: [],
    foundItemIds: [],
    turnStartItemLocations: { ...itemLocations },
    collectedClueIds: [],
    log: [...leadEntries, seedEntry],
    pinnedCards: [],
    selected: null,
    checkpoints,
    solved: false,
    finalScore: null,
  }
}

// ─────────────────────────────────────────────
// Setup phase actions (each costs 1 action)
// ─────────────────────────────────────────────

// Investigator movement is free — no action cost.
// Other characters cannot be moved by the player; they are fixed.
export function moveInvestigator(
  state: GameState,
  targetLocation: LocationId
): GameState {
  if (state.phase !== 'setup') return state

  return {
    ...state,
    board: {
      ...state.board,
      characterLocations: {
        ...state.board.characterLocations,
        [INVESTIGATOR_ID]: targetLocation,
      },
    },
  }
}

export function moveItem(
  state: GameState,
  itemId: string,
  targetLocation: LocationId
): GameState {
  if (state.phase !== 'setup') return state
  if (!state.foundItemIds.includes(itemId)) return state

  const currentLoc = state.board.itemLocations[itemId]
  const turnStartLoc = state.turnStartItemLocations[itemId]
  const isUndoing = targetLocation === turnStartLoc && currentLoc !== turnStartLoc

  if (!isUndoing && state.actionsRemaining <= 0) return state

  return {
    ...state,
    actionsRemaining: isUndoing ? state.actionsRemaining + 1 : state.actionsRemaining - 1,
    board: {
      ...state.board,
      itemLocations: {
        ...state.board.itemLocations,
        [itemId]: targetLocation,
      },
    },
  }
}

export function setSelected(state: GameState, selected: string | null): GameState {
  return { ...state, selected }
}

// ─────────────────────────────────────────────
// Resolve phase
// ─────────────────────────────────────────────

export function resolveTurn(state: GameState, scenario: Scenario): GameState {
  if (state.phase !== 'setup') return state

  const ctx = { board: state.board }

  // ── Clue evaluation ─────────────────────────
  const collectedSet = new Set(state.collectedClueIds)
  const availableClues = scenario.clues.filter(clue => {
    if (collectedSet.has(clue.id)) return false
    if (clue.requires_clue_id && !collectedSet.has(clue.requires_clue_id)) return false
    return true
  })

  // ── Character and item discovery ─────────────
  const investigatorLoc = state.board.characterLocations[INVESTIGATOR_ID]

  const newlyFoundCharacterIds = scenario.characters
    .filter(char =>
      !state.foundCharacterIds.includes(char.id) &&
      state.board.characterLocations[char.id] === investigatorLoc
    )
    .map(char => char.id)

  const newlyFoundItemIds = scenario.items
    .filter(item =>
      !state.foundItemIds.includes(item.id) &&
      state.board.itemLocations[item.id] === investigatorLoc
    )
    .map(item => item.id)

  const newClueIds: string[] = []
  const newLogEntries: LogEntry[] = []

  // Location discovery — fires first, before characters and items
  const isNewLocation = !state.foundLocationIds.includes(investigatorLoc as string)
  if (isNewLocation && investigatorLoc) {
    const loc = scenario.locations.find(l => l.id === investigatorLoc)
    if (loc) {
      newLogEntries.push({
        id: `log_${state.turn}_loc_${investigatorLoc}`,
        turn: state.turn,
        locationId: investigatorLoc as LocationId,
        text: loc.flavour,
        clueId: null,
        isNew: true,
      })
    }
  }

  for (const charId of newlyFoundCharacterIds) {
    const char = scenario.characters.find(c => c.id === charId)!
    const text = char.isVictim
      ? `The investigator examines the body of [char:${char.name}]. ${char.description}`
      : `The investigator encounters [char:${char.name}] at [loc:${investigatorLoc}]. ${char.description}`
    newLogEntries.push({
      id: `log_${state.turn}_met_${charId}`,
      turn: state.turn,
      locationId: investigatorLoc as LocationId,
      text,
      clueId: null,
      isNew: true,
    })
  }

  for (const itemId of newlyFoundItemIds) {
    const item = scenario.items.find(i => i.id === itemId)!
    newLogEntries.push({
      id: `log_${state.turn}_found_${itemId}`,
      turn: state.turn,
      locationId: investigatorLoc as LocationId,
      text: `The investigator finds [item:${item.name}]. ${item.description}`,
      clueId: null,
      isNew: true,
    })
  }

  for (const clue of availableClues) {
    if (!evaluateCondition(clue.condition, ctx)) continue

    const loc = resolveClueLocation(clue, state.board, scenario.location.arrival_location)
    newClueIds.push(clue.id)
    newLogEntries.push({
      id: `log_${state.turn}_${clue.id}`,
      turn: state.turn,
      locationId: loc as LocationId,
      text: clue.text,
      clueId: clue.id,
      isNew: true,
      weight: clue.weight,
    })
  }

  const existingPinnedClueIds = new Set(state.pinnedCards.map(c => c.clueId))
  const autoPinnedCards = newLogEntries
    .filter(e => e.clueId && !existingPinnedClueIds.has(e.clueId))
    .map(e => ({
      id: `card_${e.clueId}`,
      clueId: e.clueId!,
      text: e.text,
      turn: state.turn,
      impliedAnswer: '',
      locationId: e.locationId,
      checkpointId: null,
    }))

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))

  return {
    ...state,
    phase: 'setup',
    turn: state.turn + 1,
    actionsRemaining: 1,
    foundLocationIds: isNewLocation && investigatorLoc
      ? [...state.foundLocationIds, investigatorLoc as string]
      : state.foundLocationIds,
    foundCharacterIds: [...state.foundCharacterIds, ...newlyFoundCharacterIds],
    foundItemIds: [...state.foundItemIds, ...newlyFoundItemIds],
    turnStartItemLocations: { ...state.board.itemLocations },
    collectedClueIds: [...state.collectedClueIds, ...newClueIds],
    pinnedCards: [...state.pinnedCards, ...autoPinnedCards],
    log: [...updatedLog, ...newLogEntries],
  }
}

function resolveClueLocation(clue: Clue, board: BoardState, arrivalLocation: string): LocationId {
  // Clues always fire at the investigator's current location
  return board.characterLocations[INVESTIGATOR_ID] ?? clue.condition.location ?? arrivalLocation
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
  const checkpoint = state.checkpoints[checkpointId]
  if (!checkpoint || checkpoint.status !== 'available') return state

  const correctAnswer = getCorrectAnswer(checkpointId, scenario)
  const isCorrect = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()

  const updatedCheckpoint = {
    ...checkpoint,
    status: isCorrect ? ('confirmed' as const) : checkpoint.status,
    confirmedAnswer: isCorrect ? answer : checkpoint.confirmedAnswer,
    submissions: [
      ...checkpoint.submissions,
      {
        checkpointId,
        submittedAnswer: answer,
        result: isCorrect ? 'correct' as const : 'incorrect' as const,
        turn: state.turn,
        citedClueIds,
      },
    ],
  }

  const updatedCheckpoints = recomputeCheckpointStatuses(
    { ...state.checkpoints, [checkpointId]: updatedCheckpoint }
  )

  const solved = Object.values(updatedCheckpoints).every(cp => cp.status === 'confirmed')

  return {
    ...state,
    checkpoints: updatedCheckpoints,
    solved,
    finalScore: solved && !state.solved
      ? calculateScore(state.turn, state.difficulty)
      : state.finalScore,
  }
}

function getCorrectAnswer(checkpointId: CheckpointId, scenario: Scenario): string {
  // clue.answer is validated to exactly match an answer_option, so it's the most
  // reliable source — avoids name/id mismatches in LLM-generated scenarios.
  const correctClue = scenario.clues.find(c => c.checkpoint === checkpointId && c.weight === 'correct')
  if (correctClue) return correctClue.answer

  // Fallback for bundled scenarios without correct clues
  const crime = scenario.crime
  switch (checkpointId) {
    case 'cause_of_death': return crime.cause_of_death
    case 'true_location':  return crime.murder_location
    case 'time_of_death':  return crime.time_of_death
    case 'perpetrator': {
      const perpId = crime.perpetrator_ids[0]
      return scenario.characters.find(c => c.id === perpId)?.name ?? perpId
    }
    case 'motive':       return crime.motive
    default: return ''
  }
}

function calculateScore(turns: number, difficulty: Difficulty): number {
  const base = { easy: 1000, medium: 2000, hard: 3000 }[difficulty]
  return Math.max(base - turns * 50, 100)
}

// ─────────────────────────────────────────────
// Evidence board actions
// ─────────────────────────────────────────────

export function pinClue(state: GameState, clueId: string, text: string): GameState {
  if (state.pinnedCards.some(c => c.clueId === clueId)) return state

  const locationId = state.log.find(e => e.clueId === clueId)?.locationId ?? null

  const newCard = {
    id: `card_${clueId}`,
    clueId,
    text,
    turn: state.turn,
    impliedAnswer: '',
    locationId,
    checkpointId: null,
  }

  return { ...state, pinnedCards: [...state.pinnedCards, newCard] }
}

export function updateCardImplied(state: GameState, cardId: string, impliedAnswer: string): GameState {
  return {
    ...state,
    pinnedCards: state.pinnedCards.map(c => c.id === cardId ? { ...c, impliedAnswer } : c),
  }
}

export function assignCardToLane(
  state: GameState,
  cardId: string,
  checkpointId: import('../types/scenario').CheckpointId | null
): GameState {
  return {
    ...state,
    pinnedCards: state.pinnedCards.map(c => c.id === cardId ? { ...c, checkpointId } : c),
  }
}

export function unpinCard(state: GameState, cardId: string): GameState {
  return {
    ...state,
    pinnedCards: state.pinnedCards.filter(c => c.id !== cardId),
  }
}

