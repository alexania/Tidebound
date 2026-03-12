// ─────────────────────────────────────────────
// TIDEBOUND — Core Types
// ─────────────────────────────────────────────

export type LocationId = string

export type CheckpointId =
  | 'cause_of_death'
  | 'true_location'
  | 'time_of_death'
  | 'perpetrator'
  | 'motive'

export type ClueWeight = 'correct' | 'red_herring'
export type Difficulty = 'easy' | 'medium' | 'hard'

export type ConditionType =
  | 'inspect_location'
  | 'talk_to_character'
  | 'inspect_item'
  | 'inspect_item_in_location'
  | 'ask_character_about_item'

export interface Village {
  name: string
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
}

export interface Character {
  id: string
  name: string
  isVictim: boolean
  local: boolean
  location: LocationId  // fixed for the whole game
  description: string
}

export interface Item {
  id: string
  name: string
  description: string
  location_discovery_text?: string  // shown when player inspects the location; reveals item is there
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
  location: Village
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
  epilogue?: string
}
