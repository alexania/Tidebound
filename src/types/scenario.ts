// ─────────────────────────────────────────────
// TIDEBOUND — Core Types
// These mirror the JSON schema the LLM generates.
// The engine only reads tags; text is presentation.
// ─────────────────────────────────────────────

export type LocationId =
  | 'harbour'
  | 'tavern'
  | 'lighthouse'
  | 'chapel'
  | 'doctors_house'
  | 'manor'
  | 'cottage_row'
  | 'cliffs'
  | 'forest_edge'

export type CheckpointId =
  | 'cause_of_death'
  | 'true_location'
  | 'time_of_death'
  | 'last_seen'
  | 'victim_state'
  | 'perpetrator'
  | 'motive'
  | 'hidden_truth'

export type CharacterRole = 'perpetrator' | 'suspect' | 'victim' | 'noise'
export type ClueWeight = 'hard' | 'soft' | 'red_herring' | 'contradiction'
export type Difficulty = 'easy' | 'medium' | 'hard'

export type ConditionType =
  | 'character_in_location'
  | 'n_characters_in_location'
  | 'n_characters_together'
  | 'n_characters_together_alone'
  | 'characters_in_location_with_item'
  | 'characters_alone_in_location_with_item'
  | 'characters_anywhere_with_item'
  | 'characters_anywhere_with_item_alone'

// ─────────────────────────────────────────────
// Schema objects — direct mirrors of JSON
// ─────────────────────────────────────────────

export interface Village {
  name: string
  history: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  weather: string
}

export interface Crime {
  cause_of_death: string
  murder_location: LocationId
  body_found_location: LocationId
  body_was_moved: boolean
  time_of_death: string
  perpetrator_ids: string[]
  motive: string
  hidden_truth: string | null
}

export interface Character {
  id: string
  name: string
  role: CharacterRole
  local: boolean
  home_location: LocationId
  description: string
}

export interface Item {
  id: string
  name: string
  description: string
  starting_location: LocationId
}

export interface Location {
  id: LocationId
  flavour: string
}

export interface Checkpoint {
  id: CheckpointId
  label: string
  answer_options: string[]
}

export interface ClueCondition {
  type: ConditionType
  characters?: string[]
  location?: LocationId | null
  item?: string | null
}

export interface Clue {
  id: string
  checkpoint: CheckpointId
  answer: string
  weight: ClueWeight
  unlocked_by: CheckpointId | null
  condition: ClueCondition
  text: string
  red_herring_explanation: string | null
}

export interface Scenario {
  village: Village
  crime: Crime
  characters: Character[]
  items: Item[]
  locations: Location[]
  checkpoints: Checkpoint[]
  clues: Clue[]
  opening_narrative: string
}
