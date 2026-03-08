import type { Scenario, Difficulty } from '../types/scenario'
import easy01 from './easy/easy04.json'

type BundledScenario = { id: string; scenario: Scenario }

// Add new bundled scenarios by importing the JSON and adding an entry here.
// Files live in src/scenarios/<difficulty>/ — drop the JSON in and add an import + entry.
const BUNDLED: Record<Difficulty, BundledScenario[]> = {
  easy: [{ id: 'easy01', scenario: easy01 as unknown as Scenario }],
  medium: [],
  hard:   [],
}

export function getBundledScenarios(difficulty: Difficulty): BundledScenario[] {
  return BUNDLED[difficulty]
}
