import type { Scenario } from '../types/scenario'
import scenario01 from './scenario_11.json'

type BundledScenario = { id: string; scenario: Scenario }

// Add new bundled scenarios by importing the JSON and adding an entry here.
const BUNDLED: BundledScenario[] = [
  { id: 'scenario_01', scenario: scenario01 as unknown as Scenario }
]

export function getBundledScenarios(): BundledScenario[] {
  return BUNDLED
}
