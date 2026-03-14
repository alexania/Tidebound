// ─────────────────────────────────────────────
// TIDEBOUND — Game Engine
// ─────────────────────────────────────────────

import type { Scenario, CheckpointId, LocationId, Difficulty, Clue } from '../types/scenario'
import type { GameState, LogEntry, PinnedCard } from '../types/gameState'
import type { EvalContext } from './conditions'
import { evaluateCondition } from './conditions'
import { initCheckpointStates, recomputeCheckpointStatuses } from './checkpoints'
import { FEEDBACK, formatFeedback } from './feedback'

// ─────────────────────────────────────────────
// Difficulty filtering (answer options)
// ─────────────────────────────────────────────

const OPTIONS_PER_DIFFICULTY: Record<Difficulty, number> = {
  easy:   3,
  medium: 4,
  hard:   99,
}

// Scenarios are generated with 5–6 answer options per checkpoint.
// This trims to the count appropriate for the chosen difficulty,
// keeping the correct answer and a subset of wrong answers.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function filterOptionsToDifficulty(scenario: Scenario, difficulty: Difficulty): Scenario {
  const keep = OPTIONS_PER_DIFFICULTY[difficulty]

  return {
    ...scenario,
    checkpoints: scenario.checkpoints.map(cp => {
      let options = cp.answer_options
      if (options.length > keep) {
        const correct = getCorrectAnswer(cp.id as CheckpointId, scenario)
        const wrong = options.filter(o => o !== correct)
        options = [correct, ...wrong.slice(0, keep - 1)]
      }
      return { ...cp, answer_options: shuffle(options) }
    }),
  }
}

// ─────────────────────────────────────────────
// Correct answer lookup
// ─────────────────────────────────────────────

export function getCorrectAnswer(checkpointId: CheckpointId, scenario: Scenario): string {
  const crime = scenario.crime
  switch (checkpointId) {
    case 'true_location': {
      const loc = scenario.locations.find(l => l.id === crime.murder_location)
      return loc?.name ?? crime.murder_location
    }
    case 'perpetrator': {
      const perpId = crime.perpetrator_ids[0]
      return scenario.characters.find(c => c.id === perpId)?.name ?? perpId
    }
    case 'motive': return crime.motive
    default: return ''
  }
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

export function initGameState(scenario: Scenario, difficulty: Difficulty): GameState {
  const arrival = scenario.location.arrival_location
  const victim = scenario.characters.find(c => c.isVictim)

  const charsAtArrival = scenario.characters.filter(c => c.location === arrival)

  const leadEntries: LogEntry[] = scenario.leads.map((lead, i) => ({
    id: `log_pre_lead_${i}`,
    turn: 0,
    locationId: lead.location_id ?? arrival,
    text: lead.text,
    clueId: null,
    isNew: false,
    isLead: true,
  }))

  const arrivalEntry: LogEntry = {
    id: 'log_pre_arrival',
    turn: 0,
    locationId: arrival,
    text: `Word has reached the investigator at [loc:${arrival}]${victim ? ` — [char:${victim.name}] has been found at [loc:${scenario.crime.body_found_location}]` : ''}. The investigation begins.`,
    clueId: null,
    isNew: false,
    isLead: true,
  }

  return {
    scenarioId: scenario.location.name,
    difficulty,
    actionCount: 0,
    investigatorLocation: arrival,
    inventory: [],
    visitedLocationIds: [arrival],
    inspectedLocationIds: [],
    attemptedActions: [],
    lockedActionKeys: [],
    foundCharacterIds: charsAtArrival.map(c => c.id),
    describedCharacterIds: [],
    foundItemIds: [],
    collectedClueIds: [],
    log: [...leadEntries, arrivalEntry],
    pinnedCards: [],
    selected: null,
    checkpoints: initCheckpointStates(scenario.checkpoints.map(cp => cp.id)),
    solved: false,
    finalScore: null,
  }
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function makeContext(state: GameState, scenario: Scenario): EvalContext {
  const characterLocations: Record<string, LocationId> = {}
  for (const char of scenario.characters) {
    characterLocations[char.id] = char.location
  }
  return {
    investigatorLocation: state.investigatorLocation,
    inventory: state.inventory,
    characterLocations,
    collectedClueIds: state.collectedClueIds,
  }
}

interface FireResult {
  ids: string[]
  entries: LogEntry[]
}

function fireClues(
  state: GameState,
  scenario: Scenario,
  ctx: EvalContext,
  predicate: (clue: Clue) => boolean
): FireResult {
  const collected = new Set(state.collectedClueIds)
  const ids: string[] = []
  const entries: LogEntry[] = []
  const ac = state.actionCount + 1

  for (const clue of scenario.clues) {
    if (collected.has(clue.id)) continue
    if (!predicate(clue)) continue
    if (!evaluateCondition(clue.condition, ctx)) continue

    ids.push(clue.id)
    entries.push({
      id: `log_${ac}_${clue.id}`,
      turn: ac,
      locationId: state.investigatorLocation,
      text: clue.text,
      clueId: clue.id,
      isNew: true,
    })
  }

  return { ids, entries }
}

type FeedbackCategory = 'empty' | 'missing'

function getFeedbackCategory(
  state: GameState,
  scenario: Scenario,
  relevantPredicate: (clue: Clue) => boolean,
): FeedbackCategory {
  const collected = new Set(state.collectedClueIds)

  for (const clue of scenario.clues) {
    if (collected.has(clue.id)) continue
    if (!relevantPredicate(clue)) continue

    if (state.difficulty === 'easy' &&
        (clue.condition.type === 'inspect_item_in_location' ||
         clue.condition.type === 'ask_character_about_item') &&
        clue.condition.item && !state.inventory.includes(clue.condition.item)) {
      return 'missing'
    }
  }

  return 'empty'
}

function buildAutoPinnedCards(
  existingCards: PinnedCard[],
  newEntries: LogEntry[],
  actionCount: number,
  clues: Clue[]
): PinnedCard[] {
  const existingIds = new Set(existingCards.map(c => c.clueId))
  const dialogIds = new Set(clues.filter(c => c.dialog).map(c => c.id))
  return newEntries
    .filter(e => e.clueId && !existingIds.has(e.clueId) && !dialogIds.has(e.clueId))
    .map(e => ({
      id: `card_${e.clueId}`,
      clueId: e.clueId!,
      text: e.text,
      turn: actionCount,
      impliedAnswer: '',
      locationId: e.locationId,
      checkpointId: null,
    }))
}

function feedbackEntry(
  id: string,
  ac: number,
  locId: LocationId,
  text: string
): LogEntry {
  return { id, turn: ac, locationId: locId, text, clueId: null, isNew: true }
}

// ─────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────

export function moveToLocation(
  state: GameState,
  scenario: Scenario,
  locationId: LocationId
): GameState {
  const adjacencies = scenario.location_adjacencies ?? []
  const isAdjacent = adjacencies.some(
    adj => (adj.from === state.investigatorLocation && adj.to === locationId) ||
           (adj.to === state.investigatorLocation && adj.from === locationId)
  )
  if (!isAdjacent) return state

  const ac = state.actionCount + 1
  const newEntries: LogEntry[] = []

  const newlyFoundCharIds = scenario.characters
    .filter(c => !state.foundCharacterIds.includes(c.id) && c.location === locationId)
    .map(c => c.id)

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))

  return {
    ...state,
    actionCount: ac,
    investigatorLocation: locationId,
    visitedLocationIds: state.visitedLocationIds.includes(locationId)
      ? state.visitedLocationIds
      : [...state.visitedLocationIds, locationId],
    foundCharacterIds: [...state.foundCharacterIds, ...newlyFoundCharIds],
    log: [...updatedLog, ...newEntries],
  }
}

export function inspectLocation(state: GameState, scenario: Scenario): GameState {
  const locId = state.investigatorLocation
  const ac = state.actionCount + 1
  const ctx = makeContext(state, scenario)
  const newEntries: LogEntry[] = []

  if (!state.inspectedLocationIds.includes(locId)) {
    const loc = scenario.locations.find(l => l.id === locId)
    if (loc) {
      newEntries.push({
        id: `log_${ac}_loc_${locId}`,
        turn: ac,
        locationId: locId,
        text: loc.flavour,
        clueId: null,
        isNew: true,
      })
    }
  }

  const undescribedChars = scenario.characters.filter(
    c => c.location === locId && !state.describedCharacterIds.includes(c.id)
  )
  for (const char of undescribedChars) {
    newEntries.push({
      id: `log_${ac}_desc_${char.id}`,
      turn: ac,
      locationId: locId,
      text: char.isVictim
        ? `The investigator examines the body of [char:${char.name}]. ${char.description}`
        : `The investigator observes [char:${char.name}]. ${char.description}`,
      clueId: null,
      isNew: true,
    })
  }

  const visibleItems = scenario.items.filter(
    i => i.starting_location === locId && !state.inventory.includes(i.id)
  )
  for (const item of visibleItems) {
    const text = item.location_discovery_text ?? `[item:${item.name}] can be seen here.`
    newEntries.push({
      id: `log_${ac}_vis_${item.id}`,
      turn: ac,
      locationId: locId,
      text,
      clueId: null,
      isNew: true,
    })
  }

  const atLoc = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'inspect_location' && clue.condition.location === locId
  )

  const atLocWithItem = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'inspect_item_in_location' && clue.condition.location === locId
  )

  const newClueIds = [...atLoc.ids, ...atLocWithItem.ids]
  newEntries.push(...atLoc.entries, ...atLocWithItem.entries)

  const actionKey = `inspect:${locId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)

  const missingHint = state.difficulty === 'easy' && scenario.clues.some(clue => {
    if (state.collectedClueIds.includes(clue.id) || newClueIds.includes(clue.id)) return false
    if (clue.condition.type !== 'inspect_item_in_location') return false
    if (clue.condition.location !== locId) return false
    return !!clue.condition.item && !state.inventory.includes(clue.condition.item)
  })

  if (missingHint) {
    newEntries.push(feedbackEntry(`log_${ac}_fb_${locId}`, ac, locId, FEEDBACK.inspect_location_missing))
  } else if (newClueIds.length === 0) {
    newEntries.push(feedbackEntry(`log_${ac}_fb_${locId}`, ac, locId, FEEDBACK.inspect_location_empty))
  }

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac, scenario.clues)

  const newlyDescribedIds = undescribedChars.map(c => c.id)

  return {
    ...state,
    actionCount: ac,
    inspectedLocationIds: state.inspectedLocationIds.includes(locId)
      ? state.inspectedLocationIds
      : [...state.inspectedLocationIds, locId],
    describedCharacterIds: [...state.describedCharacterIds, ...newlyDescribedIds],
    collectedClueIds: [...state.collectedClueIds, ...newClueIds],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: state.lockedActionKeys,
  }
}

export function inspectItem(state: GameState, scenario: Scenario, itemId: string): GameState {
  const item = scenario.items.find(i => i.id === itemId)
  if (!item) return state

  const locId = state.investigatorLocation
  const isInInventory = state.inventory.includes(itemId)
  const isAtLocation = item.starting_location === locId && state.inspectedLocationIds.includes(locId)

  if (!isInInventory && !isAtLocation) return state

  const ac = state.actionCount + 1
  const newEntries: LogEntry[] = []
  let newInventory = state.inventory
  let newFoundItemIds = state.foundItemIds

  if (!isInInventory) {
    newInventory = [...state.inventory, itemId]
    newFoundItemIds = [...state.foundItemIds, itemId]
    newEntries.push({
      id: `log_${ac}_pickup_${itemId}`,
      turn: ac,
      locationId: locId,
      text: `The investigator picks up [item:${item.name}]. ${item.description}`,
      clueId: null,
      isNew: true,
    })
  }

  const ctx: EvalContext = {
    ...makeContext(state, scenario),
    inventory: newInventory,
  }

  const withItem = fireClues(
    { ...state, inventory: newInventory },
    scenario, ctx,
    clue => clue.condition.type === 'inspect_item' && clue.condition.item === itemId
  )

  const atLocWithItem = fireClues(
    { ...state, inventory: newInventory },
    scenario, ctx,
    clue => clue.condition.type === 'inspect_item_in_location' &&
             clue.condition.location === locId && clue.condition.item === itemId
  )

  const newClueIds = [...withItem.ids, ...atLocWithItem.ids]
  newEntries.push(...withItem.entries, ...atLocWithItem.entries)

  const actionKey = `inspect_item:${itemId}:${locId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)

  if (newClueIds.length === 0 && isInInventory) {
    const stateForFeedback = { ...state, inventory: newInventory }
    const category = getFeedbackCategory(stateForFeedback, scenario,
      clue => (clue.condition.type === 'inspect_item' && clue.condition.item === itemId) ||
              (clue.condition.type === 'inspect_item_in_location' && clue.condition.item === itemId)
    )
    const key = category === 'missing' ? 'inspect_item_missing' : 'inspect_item_empty'
    newEntries.push(feedbackEntry(`log_${ac}_fb_${itemId}`, ac, locId, FEEDBACK[key]))
  }

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const allCollected = [...state.collectedClueIds, ...newClueIds]
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac, scenario.clues)

  return {
    ...state,
    actionCount: ac,
    inventory: newInventory,
    foundItemIds: newFoundItemIds,
    collectedClueIds: allCollected,
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: state.lockedActionKeys,
  }
}

export function talkToCharacter(state: GameState, scenario: Scenario, charId: string): GameState {
  const char = scenario.characters.find(c => c.id === charId)
  if (!char || char.location !== state.investigatorLocation) return state

  const ac = state.actionCount + 1
  const ctx = makeContext(state, scenario)

  const { ids, entries } = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'talk_to_character' &&
             (clue.condition.characters ?? []).includes(charId)
  )

  const actionKey = `talk:${charId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)
  const newEntries = [...entries]

  if (ids.length === 0) {
    newEntries.push(feedbackEntry(
      `log_${ac}_fb_${charId}`, ac, state.investigatorLocation,
      formatFeedback(FEEDBACK.talk_empty, { name: char.name })
    ))
  }

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac, scenario.clues)

  return {
    ...state,
    actionCount: ac,
    collectedClueIds: [...state.collectedClueIds, ...ids],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: state.lockedActionKeys,
  }
}

export function askCharacterAboutItem(
  state: GameState,
  scenario: Scenario,
  charId: string,
  itemId: string
): GameState {
  const char = scenario.characters.find(c => c.id === charId)
  if (!char || char.location !== state.investigatorLocation) return state
  if (!state.inventory.includes(itemId)) return state

  const ac = state.actionCount + 1
  const ctx = makeContext(state, scenario)

  const { ids, entries } = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'ask_character_about_item' &&
             (clue.condition.characters ?? []).includes(charId) && clue.condition.item === itemId
  )

  const actionKey = `ask:${charId}:${itemId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)
  const newEntries = [...entries]

  if (ids.length === 0) {
    newEntries.push(feedbackEntry(
      `log_${ac}_fb_${charId}_${itemId}`, ac, state.investigatorLocation,
      formatFeedback(FEEDBACK.ask_empty, { name: char.name })
    ))
  }

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac, scenario.clues)

  return {
    ...state,
    actionCount: ac,
    collectedClueIds: [...state.collectedClueIds, ...ids],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: state.lockedActionKeys,
  }
}

export function askCharacterAboutClue(
  state: GameState,
  scenario: Scenario,
  charId: string,
  clueId: string
): GameState {
  const char = scenario.characters.find(c => c.id === charId)
  if (!char || char.location !== state.investigatorLocation) return state
  if (!state.collectedClueIds.includes(clueId)) return state

  const ac = state.actionCount + 1
  const ctx = makeContext(state, scenario)

  const { ids, entries } = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'ask_character_about_clue' &&
             (clue.condition.characters ?? []).includes(charId) && clue.condition.clue === clueId
  )

  const actionKey = `ask_clue:${charId}:${clueId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)
  const newEntries = [...entries]

  if (ids.length === 0) {
    newEntries.push(feedbackEntry(
      `log_${ac}_fb_${charId}_${clueId}`, ac, state.investigatorLocation,
      formatFeedback(FEEDBACK.ask_empty, { name: char.name })
    ))
  }

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac, scenario.clues)

  return {
    ...state,
    actionCount: ac,
    collectedClueIds: [...state.collectedClueIds, ...ids],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: state.lockedActionKeys,
  }
}

// ─────────────────────────────────────────────
// Proof assignment + checkpoint submission
// ─────────────────────────────────────────────

export function assignProof(
  state: GameState,
  scenario: Scenario,
  checkpointId: CheckpointId,
  wrongAnswer: string,
  clueId: string,
): GameState {
  const cp = state.checkpoints[checkpointId]
  if (!cp || cp.status !== 'available') return state
  if (!state.collectedClueIds.includes(clueId)) return state

  const clue = scenario.clues.find(c => c.id === clueId)
  if (!clue?.contradicts.some(c => c.checkpoint === checkpointId && c.answer === wrongAnswer)) return state

  const updatedProofs = { ...cp.proofs, [wrongAnswer]: clueId }
  const nextState: GameState = {
    ...state,
    checkpoints: {
      ...state.checkpoints,
      [checkpointId]: { ...cp, proofs: updatedProofs },
    },
  }

  // Auto-submit if all wrong answers are now covered
  const scenarioCp = scenario.checkpoints.find(c => c.id === checkpointId)!
  const correctAnswer = getCorrectAnswer(checkpointId, scenario)
  const wrongAnswers = scenarioCp.answer_options.filter(o => o !== correctAnswer)
  const allCovered = wrongAnswers.every(w => updatedProofs[w])

  if (allCovered) {
    return submitCheckpoint(nextState, scenario, checkpointId)
  }

  return nextState
}

export function submitCheckpoint(
  state: GameState,
  scenario: Scenario,
  checkpointId: CheckpointId,
): GameState {
  const checkpoint = state.checkpoints[checkpointId]
  if (!checkpoint || checkpoint.status !== 'available') return state

  const scenarioCp = scenario.checkpoints.find(c => c.id === checkpointId)!
  const correctAnswer = getCorrectAnswer(checkpointId, scenario)
  const wrongAnswers = scenarioCp.answer_options.filter(o => o !== correctAnswer)

  // Validate all wrong answers have valid proofs
  for (const wrong of wrongAnswers) {
    const clueId = checkpoint.proofs[wrong]
    if (!clueId || !state.collectedClueIds.includes(clueId)) return state
    const clue = scenario.clues.find(c => c.id === clueId)
    if (!clue?.contradicts.some(c => c.checkpoint === checkpointId && c.answer === wrong)) return state
  }

  const citedClueIds = Object.values(checkpoint.proofs)

  const updatedCheckpoint = {
    ...checkpoint,
    status: 'confirmed' as const,
    confirmedAnswer: correctAnswer,
    submissions: [
      ...checkpoint.submissions,
      {
        checkpointId,
        submittedAnswer: correctAnswer,
        result: 'correct' as const,
        turn: state.actionCount,
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
      ? calculateScore(state.actionCount, state.difficulty)
      : state.finalScore,
  }
}

function calculateScore(actionCount: number, difficulty: Difficulty): number {
  const base = { easy: 1000, medium: 2000, hard: 3000 }[difficulty]
  return Math.max(base - actionCount * 15, 100)
}

// ─────────────────────────────────────────────
// Evidence board actions (kept for ActionLog compat)
// ─────────────────────────────────────────────

export function pinClue(state: GameState, clueId: string, text: string): GameState {
  if (state.pinnedCards.some(c => c.clueId === clueId)) return state

  const locationId = state.log.find(e => e.clueId === clueId)?.locationId ?? null

  const newCard = {
    id: `card_${clueId}`,
    clueId,
    text,
    turn: state.actionCount,
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

export function setSelected(state: GameState, selected: string | null): GameState {
  return { ...state, selected }
}
