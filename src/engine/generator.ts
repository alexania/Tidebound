// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Generator
// Calls the Anthropic API to generate a new scenario.
// One call per game. Engine runs locally after that.
// ─────────────────────────────────────────────

import type { Scenario, Difficulty } from '../types/scenario'
import { validateScenario } from './validator'

// ─────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are generating a complete murder mystery scenario for a single-player deduction game set in a remote coastal village with folk horror undertones. The game world has three permanent background elements that should flavour all generated content:

1. An old religion — pre-Christian, pre-memory. The founding families either brought it with them or found it waiting. It is not discussed openly but it shapes behaviour.
2. A founding event — something happened here long ago that the village was built on top of. It is not forgotten. It surfaces in how people speak and what they avoid.
3. The lighthouse — it stands on the headland and its keeper has seen things. What it signals toward has never been named.

Tone: matter-of-fact, restrained, eerie without being explicit. Folk horror. Violence and sexuality are not sanitised but not gratuitous. The supernatural is real but never confirmed — it lives in implication.

You must return ONLY a valid JSON object. No preamble, no explanation, no markdown fences. Raw JSON only.

HARD RULES:
- No clue text may directly name the perpetrator or directly state the cause of death. Clues imply, witness, contradict, and suggest.
- The opening_narrative must describe only what was found and where. It must not reveal cause of death, true murder location, or the perpetrator.
- Every character id referenced in a clue condition must exist in the characters array. Every item id referenced must exist in the items array. Every location id referenced must exist in the locations array.
- The correct answer for each checkpoint must appear in that checkpoint's answer_options but must not be marked or flagged in any way.
- Red herring clues must point at a wrong answer_option. They must have a red_herring_explanation that makes them internally consistent with the story.
- Characters with role "noise" must not appear in any clue condition. There must be exactly 2 noise characters.
- All nine location ids must be present: harbour, tavern, lighthouse, chapel, doctors_house, manor, cottage_row, cliffs, forest_edge.
- Every item in the items array must be referenced in at least one clue condition. No orphan items.`

const CLUE_COUNTS: Record<Difficulty, string> = {
  easy:   '1 hard clue + 2 soft clues + 1 red herring per checkpoint',
  medium: '2 soft clues + 2 red herrings per checkpoint (no hard clues)',
  hard:   '3 soft clues + 1 contradiction + 2 red herrings per checkpoint',
}

const SCHEMA = `{
  "village": {
    "name": string,
    "history": string (one paragraph — draws on old religion, founding event, lighthouse),
    "season": "spring" | "summer" | "autumn" | "winter",
    "weather": string (one short evocative phrase, e.g. "low fog that has not lifted in four days")
  },

  "crime": {
    "cause_of_death": string (e.g. "drowning", "poisoning", "strangulation", "blunt trauma", "stabbing", "exposure", "arson", "ritual act", "shooting", "decapitation", "torture", "throat cut"),
    "murder_location": location_id,
    "body_found_location": location_id,
    "body_was_moved": boolean,
    "time_of_death": string (human-readable window, e.g. "between ten and midnight"),
    "perpetrator_ids": [char_id] (one or two character ids — must match characters with role "perpetrator"),
    "motive": string (e.g. "self-preservation", "jealousy", "inheritance", "revenge", "protection", "belief", "debt", "obsession"),
    "hidden_truth": string | null (null unless difficulty is hard)
  },

  "characters": [
    {
      "id": string (unique, snake_case, e.g. "aldric_fetch"),
      "name": string,
      "role": "perpetrator" | "suspect" | "victim" | "noise",
      "local": boolean (true = village resident, false = outsider),
      "home_location": location_id,
      "description": string (2-3 sentences — who they are, their role in the village, their connection to the victim woven into the prose. Noise characters must feel suspicious without providing anything the player can use.)
    }
  ],

  "items": [
    {
      "id": string (unique, snake_case, e.g. "parish_ledger"),
      "name": string (short display name, e.g. "Parish Ledger"),
      "description": string (one atmospheric sentence),
      "starting_location": location_id
    }
  ],

  "locations": [
    {
      "id": "harbour" | "tavern" | "lighthouse" | "chapel" | "doctors_house" | "manor" | "cottage_row" | "cliffs" | "forest_edge",
      "flavour": string (one atmospheric sentence specific to this run)
    }
    // All nine location ids must be present
  ],

  "checkpoints": [
    {
      "id": "cause_of_death" | "true_location" | "time_of_death" | "last_seen" | "victim_state" | "perpetrator" | "motive",
      "label": string (question shown to player, e.g. "How did the victim die?"),
      "answer_options": [string] (4-6 options — must include the correct answer, others are plausible alternatives. Do not mark or flag the correct one.)
    }
    // Include all 7 checkpoints. For hard difficulty, also include "hidden_truth".
  ],

  "clues": [
    {
      "id": string (unique, e.g. "clue_cod_hard"),
      "checkpoint": checkpoint_id,
      "answer": string (must exactly match one entry in that checkpoint's answer_options),
      "weight": "hard" | "soft" | "red_herring" | "contradiction",
      "unlocked_by": checkpoint_id | null (null = available from turn 1, otherwise face-down until that checkpoint is confirmed by the player),
      "condition": {
        "type": one of the 8 condition types below,
        "characters": [char_id, ...] (omit if not applicable),
        "location": location_id | null (omit or null if not applicable),
        "item": item_id | null (omit or null if not applicable)
      },
      "text": string (1-3 sentences using one of these shapes — use actual character names not placeholders:
        - [CHAR] noticed [DETAIL] about the body or scene.
        - [CHAR] admitted to [CHAR_B] that [DETAIL].
        - [CHAR] was heard saying [FRAGMENT] to no one in particular.
        - [CHAR] reacted strangely when [TRIGGER].
        - [CHAR] found [ITEM] at [LOCATION] showing [DETAIL].),
      "red_herring_explanation": string | null (required if weight is "red_herring" or "contradiction" — the internal reason this false evidence exists. Never shown to the player.)
    }
  ],

  "opening_narrative": string (2-3 paragraphs — describes what was found and where, establishes atmosphere and season, introduces the victim by name and role. Must not reveal cause of death, true murder location, or the perpetrator.)
}

CONDITION TYPES — use exactly these type strings:
  "character_in_location"               — characters: [id], location: location_id
  "n_characters_in_location"            — characters: [id, id, ...], location: location_id
  "n_characters_together"               — characters: [id, id, ...], location: null (any shared location)
  "n_characters_together_alone"         — characters: [id, id, ...], location: null (shared location, no others present)
  "characters_in_location_with_item"    — characters: [id, ...], location: location_id, item: item_id
  "characters_alone_in_location_with_item" — characters: [id, ...], location: location_id, item: item_id (no others present)
  "characters_anywhere_with_item"       — characters: [id, ...], location: null, item: item_id (any location)
  "characters_anywhere_with_item_alone" — characters: [id, ...], location: null, item: item_id (no others present)

CHECKPOINT UNLOCK TREE — clues must use unlocked_by values consistent with this:
  cause_of_death  → unlocked_by: null (always available)
  true_location   → unlocked_by: "cause_of_death"
  time_of_death   → unlocked_by: null (always available, unlocks in parallel with cause_of_death)
  last_seen       → unlocked_by: "true_location" (available after any 2 of: true_location, time_of_death confirmed)
  victim_state    → unlocked_by: "true_location" (available after any 2 of: true_location, time_of_death confirmed)
  perpetrator     → unlocked_by: "victim_state"
  motive          → unlocked_by: "perpetrator"
  hidden_truth    → unlocked_by: "motive" (hard difficulty only)`

// ─────────────────────────────────────────────
// Generator function
// ─────────────────────────────────────────────

export interface GeneratorOptions {
  difficulty: Difficulty
  apiKey: string
  maxRetries?: number
}

export async function generateScenario(options: GeneratorOptions): Promise<Scenario> {
  const { difficulty, apiKey, maxRetries = 3 } = options

  const userMessage = `Generate a complete Tidebound murder mystery scenario.
Difficulty: ${difficulty.toUpperCase()}

Clue counts per checkpoint (strictly enforced):
${CLUE_COUNTS[difficulty]}

Return a JSON object matching this schema exactly:

${SCHEMA}`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Generation attempt ${attempt}/${maxRetries}...`)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const rawText = data.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')

    let parsed: Scenario
    try {
      parsed = JSON.parse(rawText)
    } catch {
      console.warn(`Attempt ${attempt}: JSON parse failed. Retrying...`)
      continue
    }

    const errors = validateScenario(parsed)
    if (errors.length === 0) {
      console.log(`✓ Scenario generated and validated on attempt ${attempt}`)
      return parsed
    }

    console.warn(`Attempt ${attempt}: Validation failed with ${errors.length} error(s):`)
    errors.forEach(e => console.warn(`  [${e.rule}] ${e.message}`))

    if (attempt === maxRetries) {
      throw new Error(`Scenario generation failed after ${maxRetries} attempts. Last errors:\n${errors.map(e => e.message).join('\n')}`)
    }
  }

  throw new Error('Generation failed')
}

// ─────────────────────────────────────────────
// Scenario storage helpers
// ─────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'tidebound_scenarios_'
const PLAYED_KEY = 'tidebound_played'

export function saveScenario(scenario: Scenario, difficulty: Difficulty): string {
  const key = `${STORAGE_KEY_PREFIX}${difficulty}`
  const existing = loadScenarios(difficulty)
  const id = `${scenario.village.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
  existing.push({ id, scenario })
  localStorage.setItem(key, JSON.stringify(existing))
  return id
}

export function loadScenarios(difficulty: Difficulty): Array<{ id: string; scenario: Scenario }> {
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${difficulty}`)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function getPlayedIds(): string[] {
  const raw = localStorage.getItem(PLAYED_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export function markPlayed(id: string): void {
  const played = getPlayedIds()
  if (!played.includes(id)) {
    localStorage.setItem(PLAYED_KEY, JSON.stringify([...played, id]))
  }
}

export function getUnplayedScenario(difficulty: Difficulty): { id: string; scenario: Scenario } | null {
  const all = loadScenarios(difficulty)
  const played = new Set(getPlayedIds())
  return all.find(s => !played.has(s.id)) ?? null
}
