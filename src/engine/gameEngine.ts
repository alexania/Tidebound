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
// Difficulty filtering
// ─────────────────────────────────────────────

const RED_HERRINGS_PER_DIFFICULTY: Record<Difficulty, number> = {
  easy:   1,
  medium: 2,
  hard:   3,
}

// Scenarios are always generated at "hard" (2 correct + 3 red herrings per checkpoint).
// This trims red herrings down to the count appropriate for the chosen difficulty.
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

  const npcEntries: LogEntry[] = charsAtArrival.map(char => ({
    id: `log_pre_met_${char.id}`,
    turn: 0,
    locationId: arrival,
    text: char.isVictim
      ? `The investigator examines the body of [char:${char.name}]. ${char.description}`
      : `The investigator encounters [char:${char.name}] at [loc:${arrival}]. ${char.description}`,
    clueId: null,
    isNew: false,
    isLead: true,
  }))

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
    foundItemIds: [],
    collectedClueIds: [],
    log: [...leadEntries, arrivalEntry, ...npcEntries],
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

const ACCUSATION_CHECKPOINTS = new Set(['perpetrator', 'motive'])

function makeContext(state: GameState, scenario: Scenario): EvalContext {
  const characterLocations: Record<string, LocationId> = {}
  for (const char of scenario.characters) {
    characterLocations[char.id] = char.location
  }
  return {
    investigatorLocation: state.investigatorLocation,
    inventory: state.inventory,
    characterLocations,
  }
}

function investigativeAllConfirmed(state: GameState): boolean {
  return Object.entries(state.checkpoints)
    .filter(([id]) => !ACCUSATION_CHECKPOINTS.has(id))
    .every(([, cp]) => cp.status === 'confirmed')
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
  const investigativeDone = investigativeAllConfirmed(state)
  const ids: string[] = []
  const entries: LogEntry[] = []
  const ac = state.actionCount + 1  // entries use the post-increment count

  for (const clue of scenario.clues) {
    if (collected.has(clue.id)) continue
    if (ACCUSATION_CHECKPOINTS.has(clue.checkpoint) && !investigativeDone) continue
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
      weight: clue.weight,
    })
  }

  return { ids, entries }
}

type FeedbackCategory = 'empty' | 'locked' | 'missing'

// Determines why no clue fired for an action.
// relevantPredicate: does this clue relate to the action (condition type + params match)?
function getFeedbackCategory(
  state: GameState,
  scenario: Scenario,
  relevantPredicate: (clue: Clue) => boolean,
): FeedbackCategory {
  const collected = new Set(state.collectedClueIds)
  const investigativeDone = investigativeAllConfirmed(state)
  let hasLocked = false
  let hasMissing = false

  for (const clue of scenario.clues) {
    if (collected.has(clue.id)) continue
    if (!relevantPredicate(clue)) continue

    if (ACCUSATION_CHECKPOINTS.has(clue.checkpoint) && !investigativeDone) {
      hasLocked = true
      continue
    }

    // Easy mode: clue exists but requires an item not in inventory
    if (state.difficulty === 'easy' &&
        (clue.condition.type === 'investigator_at_location_with_item' ||
         clue.condition.type === 'investigator_with_character_and_item') &&
        clue.condition.item && !state.inventory.includes(clue.condition.item)) {
      hasMissing = true
      continue
    }
  }

  if (hasLocked) return 'locked'
  if (hasMissing) return 'missing'
  return 'empty'
}

const INVESTIGATIVE_COMPLETE_LOG_ID = 'investigative_complete'

// Returns a log entry the first time all investigative clues are collected,
// null if already fired or not yet complete.
function maybeInvestigativeCompleteEntry(
  state: GameState,
  scenario: Scenario,
  newClueIds: string[],
  ac: number
): LogEntry | null {
  if (state.log.some(e => e.id === INVESTIGATIVE_COMPLETE_LOG_ID)) return null

  const investigativeClues = scenario.clues.filter(c => !ACCUSATION_CHECKPOINTS.has(c.checkpoint))
  const allCollected = new Set([...state.collectedClueIds, ...newClueIds])
  if (!investigativeClues.every(c => allCollected.has(c.id))) return null

  return {
    id: INVESTIGATIVE_COMPLETE_LOG_ID,
    turn: ac,
    locationId: state.investigatorLocation,
    text: "Something clicks into place — the investigator has gathered enough evidence to explain the crime scene. Open the Evidence Board and make your deductions.",
    clueId: null,
    isNew: true,
    isMilestone: true,
  }
}

function updateLockedKeys(existing: string[], key: string, isLocked: boolean, cluesFired: boolean): string[] {
  if (cluesFired) return existing.filter(k => k !== key)
  if (isLocked && !existing.includes(key)) return [...existing, key]
  if (!isLocked && existing.includes(key)) return existing.filter(k => k !== key)
  return existing
}

function buildAutoPinnedCards(
  existingCards: PinnedCard[],
  newEntries: LogEntry[],
  actionCount: number
): PinnedCard[] {
  const existingIds = new Set(existingCards.map(c => c.clueId))
  return newEntries
    .filter(e => e.clueId && !existingIds.has(e.clueId))
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

  // Reveal new NPCs at destination
  const newlyFoundCharIds = scenario.characters
    .filter(c => !state.foundCharacterIds.includes(c.id) && c.location === locationId)
    .map(c => c.id)

  for (const charId of newlyFoundCharIds) {
    const char = scenario.characters.find(c => c.id === charId)!
    newEntries.push({
      id: `log_${ac}_met_${charId}`,
      turn: ac,
      locationId,
      text: char.isVictim
        ? `The investigator examines the body of [char:${char.name}]. ${char.description}`
        : `The investigator encounters [char:${char.name}] at [loc:${locationId}]. ${char.description}`,
      clueId: null,
      isNew: true,
    })
  }

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

  // Location flavour on first inspect
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

  // Visible items: at this location, not in inventory
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

  // Fire investigator_at_location clues
  const atLoc = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'investigator_at_location' && clue.condition.location === locId
  )

  // Fire investigator_at_location_with_item clues (items already in inventory)
  const atLocWithItem = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'investigator_at_location_with_item' && clue.condition.location === locId
  )

  const newClueIds = [...atLoc.ids, ...atLocWithItem.ids]
  newEntries.push(...atLoc.entries, ...atLocWithItem.entries)

  const actionKey = `inspect:${locId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)

  // Missing hint: easy mode, uncollected at_location_with_item clue exists for this location
  // but required item not in inventory — show even if other clues fired
  const missingHint = state.difficulty === 'easy' && scenario.clues.some(clue => {
    if (state.collectedClueIds.includes(clue.id) || newClueIds.includes(clue.id)) return false
    if (clue.condition.type !== 'investigator_at_location_with_item') return false
    if (clue.condition.location !== locId) return false
    if (ACCUSATION_CHECKPOINTS.has(clue.checkpoint) && !investigativeAllConfirmed(state)) return false
    return !!clue.condition.item && !state.inventory.includes(clue.condition.item)
  })

  let lockedFeedback = false
  if (missingHint) {
    newEntries.push(feedbackEntry(`log_${ac}_fb_${locId}`, ac, locId, FEEDBACK.inspect_location_missing))
  } else if (newClueIds.length === 0) {
    const category = getFeedbackCategory(state, scenario,
      clue => (clue.condition.type === 'investigator_at_location' && clue.condition.location === locId) ||
              (clue.condition.type === 'investigator_at_location_with_item' && clue.condition.location === locId)
    )
    lockedFeedback = category === 'locked'
    const key = lockedFeedback ? 'inspect_location_locked' : 'inspect_location_empty'
    newEntries.push(feedbackEntry(`log_${ac}_fb_${locId}`, ac, locId, FEEDBACK[key]))
  }

  const completeEntry = maybeInvestigativeCompleteEntry(state, scenario, newClueIds, ac)
  if (completeEntry) newEntries.push(completeEntry)

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac)

  return {
    ...state,
    actionCount: ac,
    inspectedLocationIds: state.inspectedLocationIds.includes(locId)
      ? state.inspectedLocationIds
      : [...state.inspectedLocationIds, locId],
    collectedClueIds: [...state.collectedClueIds, ...newClueIds],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: updateLockedKeys(state.lockedActionKeys, actionKey, lockedFeedback, newClueIds.length > 0),
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

  // Pick up if not already held
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

  // Build context with updated inventory
  const ctx: EvalContext = {
    ...makeContext(state, scenario),
    inventory: newInventory,
  }

  // Fire investigator_with_item clues
  const withItem = fireClues(
    { ...state, inventory: newInventory },
    scenario, ctx,
    clue => clue.condition.type === 'investigator_with_item' && clue.condition.item === itemId
  )

  // Fire investigator_at_location_with_item clues (current location + this item)
  const atLocWithItem = fireClues(
    { ...state, inventory: newInventory },
    scenario, ctx,
    clue => clue.condition.type === 'investigator_at_location_with_item' &&
             clue.condition.location === locId && clue.condition.item === itemId
  )

  const newClueIds = [...withItem.ids, ...atLocWithItem.ids]
  newEntries.push(...withItem.entries, ...atLocWithItem.entries)

  const actionKey = `inspect_item:${itemId}:${locId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)

  let itemLockedFeedback = false
  if (newClueIds.length === 0 && isInInventory) {
    // Item was already in inventory, no new clues — show feedback
    const stateForFeedback = { ...state, inventory: newInventory }
    const category = getFeedbackCategory(stateForFeedback, scenario,
      clue => (clue.condition.type === 'investigator_with_item' && clue.condition.item === itemId) ||
              (clue.condition.type === 'investigator_at_location_with_item' && clue.condition.item === itemId)
    )
    itemLockedFeedback = category === 'locked'
    const key = itemLockedFeedback ? 'inspect_item_locked'
      : category === 'missing' ? 'inspect_item_missing'
      : 'inspect_item_empty'
    newEntries.push(feedbackEntry(`log_${ac}_fb_${itemId}`, ac, locId, FEEDBACK[key]))
  }

  const completeEntry2 = maybeInvestigativeCompleteEntry(state, scenario, newClueIds, ac)
  if (completeEntry2) newEntries.push(completeEntry2)

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const allCollected = [...state.collectedClueIds, ...newClueIds]
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac)

  return {
    ...state,
    actionCount: ac,
    inventory: newInventory,
    foundItemIds: newFoundItemIds,
    collectedClueIds: allCollected,
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: updateLockedKeys(state.lockedActionKeys, actionKey, itemLockedFeedback, newClueIds.length > 0),
  }
}

export function talkToCharacter(state: GameState, scenario: Scenario, charId: string): GameState {
  const char = scenario.characters.find(c => c.id === charId)
  if (!char || char.location !== state.investigatorLocation) return state

  const ac = state.actionCount + 1
  const ctx = makeContext(state, scenario)

  const { ids, entries } = fireClues(state, scenario, ctx,
    clue => clue.condition.type === 'investigator_with_character' &&
             (clue.condition.characters ?? []).includes(charId)
  )

  const actionKey = `talk:${charId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)
  const newEntries = [...entries]

  let talkLockedFeedback = false
  if (ids.length === 0) {
    const category = getFeedbackCategory(state, scenario,
      clue => clue.condition.type === 'investigator_with_character' &&
               (clue.condition.characters ?? []).includes(charId)
    )
    talkLockedFeedback = category === 'locked'
    const key = talkLockedFeedback ? 'talk_locked' : 'talk_empty'
    newEntries.push(feedbackEntry(
      `log_${ac}_fb_${charId}`, ac, state.investigatorLocation,
      formatFeedback(FEEDBACK[key], { name: char.name })
    ))
  }

  const completeEntry3 = maybeInvestigativeCompleteEntry(state, scenario, ids, ac)
  if (completeEntry3) newEntries.push(completeEntry3)

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac)

  return {
    ...state,
    actionCount: ac,
    collectedClueIds: [...state.collectedClueIds, ...ids],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: updateLockedKeys(state.lockedActionKeys, actionKey, talkLockedFeedback, ids.length > 0),
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
    clue => clue.condition.type === 'investigator_with_character_and_item' &&
             (clue.condition.characters ?? []).includes(charId) && clue.condition.item === itemId
  )

  const actionKey = `ask:${charId}:${itemId}`
  const alreadyAttempted = state.attemptedActions.includes(actionKey)
  const newEntries = [...entries]

  let askLockedFeedback = false
  if (ids.length === 0) {
    const category = getFeedbackCategory(state, scenario,
      clue => clue.condition.type === 'investigator_with_character_and_item' &&
               (clue.condition.characters ?? []).includes(charId) && clue.condition.item === itemId
    )
    askLockedFeedback = category === 'locked'
    const key = askLockedFeedback ? 'ask_locked' : 'ask_empty'
    newEntries.push(feedbackEntry(
      `log_${ac}_fb_${charId}_${itemId}`, ac, state.investigatorLocation,
      formatFeedback(FEEDBACK[key], { name: char.name })
    ))
  }

  const completeEntry4 = maybeInvestigativeCompleteEntry(state, scenario, ids, ac)
  if (completeEntry4) newEntries.push(completeEntry4)

  const updatedLog = state.log.map(e => ({ ...e, isNew: false }))
  const autoPinned = buildAutoPinnedCards(state.pinnedCards, newEntries, ac)

  return {
    ...state,
    actionCount: ac,
    collectedClueIds: [...state.collectedClueIds, ...ids],
    pinnedCards: [...state.pinnedCards, ...autoPinned],
    log: [...updatedLog, ...newEntries],
    attemptedActions: alreadyAttempted ? state.attemptedActions : [...state.attemptedActions, actionKey],
    lockedActionKeys: updateLockedKeys(state.lockedActionKeys, actionKey, askLockedFeedback, ids.length > 0),
  }
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

function getCorrectAnswer(checkpointId: CheckpointId, scenario: Scenario): string {
  const correctClue = scenario.clues.find(c => c.checkpoint === checkpointId && c.weight === 'correct')
  if (correctClue) return correctClue.answer

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

function calculateScore(actionCount: number, difficulty: Difficulty): number {
  const base = { easy: 1000, medium: 2000, hard: 3000 }[difficulty]
  return Math.max(base - actionCount * 15, 100)
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
