// ─────────────────────────────────────────────
// TIDEBOUND — Game Engine
// ─────────────────────────────────────────────

import type { Scenario, CheckpointId, LocationId, Difficulty, Clue } from '../types/scenario'
import type { GameState, BoardState, LogEntry } from '../types/gameState'
import { evaluateCondition } from './conditions'
import { initCheckpointStates, recomputeCheckpointStatuses, REQUIRED_CHECKPOINTS } from './checkpoints'

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
    characterLocations[char.id] = char.starting_location
  }
  // Investigator always starts at the harbour
  characterLocations[INVESTIGATOR_ID] = 'harbour'

  const itemLocations: Record<string, LocationId> = {}
  for (const item of scenario.items) {
    itemLocations[item.id] = item.starting_location
  }

  const board: BoardState = { characterLocations, itemLocations }
  const checkpoints = initCheckpointStates(difficulty)

  const victim = scenario.characters.find(c => c.isVictim)

  const leadEntries: LogEntry[] = scenario.leads.map((lead, i) => ({
    id: `log_0_lead_${i}`,
    turn: 0,
    locationId: lead.location_id ?? 'harbour',
    text: lead.text,
    clueId: null,
    isNew: false,
    isLead: true,
  }))

  const seedEntry: LogEntry = {
    id: 'log_1_arrival',
    turn: 1,
    locationId: 'harbour',
    text: `Word has reached the investigator at [loc:harbour]${victim ? ` — [char:${victim.name}] has been found at [loc:${scenario.crime.body_found_location}]` : ''}. The investigation begins.`,
    clueId: null,
    isNew: false,
  }

  // Auto-pin opening narrative to the evidence board
  const openingCard = {
    id: 'card_opening',
    type: 'opening' as const,
    clueId: null,
    text: scenario.opening_narrative,
    turn: null,
    note: '',
    x: 40,
    y: 40,
  }

  return {
    scenarioId: scenario.village.name,
    difficulty,
    turn: 1,
    phase: 'setup',
    actionsRemaining: 3,
    board,
    foundCharacterIds: [],
    foundItemIds: [],
    collectedClueIds: [],
    log: [...leadEntries, seedEntry],
    pinnedCards: [openingCard],
    connections: [],
    selected: null,
    checkpoints,
    solved: false,
    finalScore: null,
  }
}

// ─────────────────────────────────────────────
// Setup phase actions (each costs 1 action)
// ─────────────────────────────────────────────

export function moveCharacter(
  state: GameState,
  characterId: string,
  targetLocation: LocationId
): GameState {
  if (state.phase !== 'setup' || state.actionsRemaining <= 0) return state
  if (characterId !== INVESTIGATOR_ID && !state.foundCharacterIds.includes(characterId)) return state

  return {
    ...state,
    actionsRemaining: state.actionsRemaining - 1,
    board: {
      ...state.board,
      characterLocations: {
        ...state.board.characterLocations,
        [characterId]: targetLocation,
      },
    },
  }
}

export function moveItem(
  state: GameState,
  itemId: string,
  targetLocation: LocationId
): GameState {
  if (state.phase !== 'setup' || state.actionsRemaining <= 0) return state
  if (!state.foundItemIds.includes(itemId)) return state

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

export function setSelected(state: GameState, selected: string | null): GameState {
  return { ...state, selected }
}

// ─────────────────────────────────────────────
// Resolve phase
// ─────────────────────────────────────────────

export function resolveTurn(state: GameState, scenario: Scenario): GameState {
  if (state.phase !== 'setup') return state

  const allCharacterIds = [
    INVESTIGATOR_ID,
    ...scenario.characters.filter(c => !c.isVictim).map(c => c.id),
  ]

  const ctx = { board: state.board, allCharacterIds }

  // ── Clue evaluation ─────────────────────────
  const availableClues = scenario.clues.filter(
    clue => !state.collectedClueIds.includes(clue.id)
  )

  // From turn 9, all uncollected clues auto-fire
  const guaranteed = state.turn >= 9

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
    if (!guaranteed && !evaluateCondition(clue.condition, ctx)) continue

    const loc = resolveClueLocation(clue, state.board)
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

  // Auto-pin hard clues
  const existingPinnedClueIds = new Set(state.pinnedCards.map(c => c.clueId))
  const autoPinnedCards = newLogEntries
    .filter(e => e.weight === 'hard' && e.clueId && !existingPinnedClueIds.has(e.clueId))
    .map((e, i) => ({
      id: `card_${e.clueId}`,
      type: 'clue' as const,
      clueId: e.clueId!,
      text: e.text,
      turn: state.turn,
      note: '',
      x: 60 + (state.pinnedCards.length + i) * 20,
      y: 60 + (state.pinnedCards.length + i) * 20,
    }))

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))

  return {
    ...state,
    phase: 'setup',
    turn: state.turn + 1,
    actionsRemaining: 3,
    foundCharacterIds: [...state.foundCharacterIds, ...newlyFoundCharacterIds],
    foundItemIds: [...state.foundItemIds, ...newlyFoundItemIds],
    collectedClueIds: [...state.collectedClueIds, ...newClueIds],
    pinnedCards: [...state.pinnedCards, ...autoPinnedCards],
    log: [...updatedLog, ...newLogEntries],
  }
}

function resolveClueLocation(clue: Clue, board: BoardState): LocationId {
  if (clue.condition.location) return clue.condition.location

  const chars = clue.condition.characters
  if (chars && chars.length > 0) {
    return board.characterLocations[chars[0]] ?? 'harbour'
  }

  return 'harbour'
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
    { ...state.checkpoints, [checkpointId]: updatedCheckpoint },
    state.difficulty
  )

  const required = REQUIRED_CHECKPOINTS[state.difficulty]
  const solved = required.every(id => updatedCheckpoints[id]?.status === 'confirmed')

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
  const crime = scenario.crime
  switch (checkpointId) {
    case 'cause_of_death': return crime.cause_of_death
    case 'true_location':  return crime.murder_location
    case 'time_of_death':  return crime.time_of_death
    case 'perpetrator':    return crime.perpetrator_ids[0]
    case 'motive':         return crime.motive
    case 'hidden_truth':   return crime.hidden_truth ?? ''
    case 'last_seen':
    case 'victim_state': {
      const correctClue = scenario.clues.find(
        c => c.checkpoint === checkpointId && (c.weight === 'hard' || c.weight === 'soft')
      )
      const cp = scenario.checkpoints.find(c => c.id === checkpointId)
      return correctClue?.answer ?? cp?.answer_options[0] ?? ''
    }
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

  const offset = state.pinnedCards.length * 20
  const newCard = {
    id: `card_${clueId}`,
    type: 'clue' as const,
    clueId,
    text,
    turn: state.turn,
    note: '',
    x: 60 + offset,
    y: 60 + offset,
  }

  return { ...state, pinnedCards: [...state.pinnedCards, newCard] }
}

export function updateCardNote(state: GameState, cardId: string, note: string): GameState {
  return {
    ...state,
    pinnedCards: state.pinnedCards.map(c => c.id === cardId ? { ...c, note } : c),
  }
}

export function moveCard(state: GameState, cardId: string, x: number, y: number): GameState {
  return {
    ...state,
    pinnedCards: state.pinnedCards.map(c => c.id === cardId ? { ...c, x, y } : c),
  }
}

export function addConnection(
  state: GameState,
  fromCardId: string,
  toCardId: string,
  label = ''
): GameState {
  const id = `conn_${fromCardId}_${toCardId}`
  // Also block reverse duplicate
  const reverseId = `conn_${toCardId}_${fromCardId}`
  if (state.connections.some(c => c.id === id || c.id === reverseId)) return state
  return {
    ...state,
    connections: [...state.connections, { id, fromCardId, toCardId, label }],
  }
}

export function removeConnection(state: GameState, connectionId: string): GameState {
  return {
    ...state,
    connections: state.connections.filter(c => c.id !== connectionId),
  }
}

