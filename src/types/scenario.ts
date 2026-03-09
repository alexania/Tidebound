// ─────────────────────────────────────────────
// TIDEBOUND — Core Types
// ─────────────────────────────────────────────

export type LocationId = string

export type CheckpointId =
  | 'cause_of_death'
  | 'true_location'
  | 'time_of_death'
  | 'hidden_truth'
  | 'perpetrator'
  | 'motive'

export type ClueWeight = 'correct' | 'red_herring'
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

export interface Village {
  name: string
  history: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  weather: string
  arrival_location: string
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
  isVictim: boolean
  local: boolean
  // Where this character lives — shown in info panel
  home_location: LocationId
  // Where this character is when the game starts — may differ from home_location
  starting_location: LocationId
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
  name?: string  // display name; falls back to formatted id if absent (old scenarios)
  flavour: string
  col?: number   // 0–2, grid column; falls back to index % 3 for old scenarios
  row?: number   // 0–2, grid row; falls back to Math.floor(index / 3) for old scenarios
}

export interface LocationAdjacency {
  from: LocationId
  to: LocationId
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
  // All clues are available from turn 1 — no unlocked_by gating.
  condition: ClueCondition
  text: string
  red_herring_explanation: string | null
}

// 2-3 starting leads shown to the player on turn 1 before any clues have fired.
export interface Lead {
  id: string
  text: string
  character_id: string | null
  location_id: LocationId | null
}

export interface Relation {
  from: string   // char_id
  to: string     // char_id
  label: string  // short, directional: "employs", "sister of", "in love with"
}

export interface Scenario {
  village: Village
  crime: Crime
  characters: Character[]
  items: Item[]
  locations: Location[]
  checkpoints: Checkpoint[]
  clues: Clue[]
  leads: Lead[]
  relations: Relation[]
  location_adjacencies?: LocationAdjacency[]
  opening_narrative: string
}
