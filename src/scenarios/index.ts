import type { Scenario, Difficulty } from '../types/scenario'
import haulwick from './haulwick_easy_01.json'

type BundledScenario = { id: string; scenario: Scenario }

// Add new bundled scenarios by importing the JSON and adding an entry here.
const BUNDLED: Record<Difficulty, BundledScenario[]> = {
  easy:   [{ id: 'haulwick_easy_01', scenario: haulwick as unknown as Scenario }],
  medium: [],
  hard:   [],
}

export function getBundledScenarios(difficulty: Difficulty): BundledScenario[] {
  return BUNDLED[difficulty]
}
