// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Generator
// ─────────────────────────────────────────────

import type { Scenario, Difficulty } from '../types/scenario'
import { validateScenario } from './validator'

const SYSTEM_PROMPT = `You are generating a complete murder mystery scenario for a single-player deduction game.
The only hard setting constraint is that it is coastal — the sea is present, accessible, part of daily life.
Everything else — culture, era, tone, geography — is yours to decide based on the seed.

Tone: matter-of-fact and specific. Eerie where earned, not by default. Violence and sexuality are not sanitised but not gratuitous. The supernatural may be implied but is never confirmed.

You must return ONLY a valid JSON object. No preamble, no explanation, no markdown fences. Raw JSON only.

THE INVESTIGATOR:
Every scenario includes a special character with id "investigator" — an official brought in from outside, whose presence is why people are talking at all. Not named or described in the JSON; the engine adds him. He always starts at the arrival_location. Use "investigator" as a character id in clue conditions. Roughly half of clue conditions should involve the investigator. Do not include him in the characters array.

GENERATION ORDER — work through these steps before writing JSON:

STEP 1 — SETTING: Decide coastal location (real or fictional region), era, cultural texture, season, weather, village name. Let the seed influence these. Avoid defaulting to English/fog/autumn. Consider Nordic, Basque, Louisiana bayou, Japanese fishing prefecture, West African coastal town, Ottoman port, Pacific island, Baltic amber coast, and so on.

STEP 2 — CRIME: Decide the full truth before writing characters or clues. Who the victim is. Who the perpetrator is and exactly why. Method, murder location, body found location, whether moved, time window. The one or two things the perpetrator did wrong that the investigator will find.

STEP 3 — CHARACTERS & RELATIONS: 5–7 characters including the victim. Every non-victim character must have a plausible stated motive — even the innocent ones. Also generate publicly known relationships between characters: employment, family, open romantic interest, open enmity. No secrets, no debts, nothing crime-related. Label each relation briefly and directionally: "employs", "sister of", "in love with", "rivals with".

STEP 4 — LOCATIONS: Up to 9 locations — as many as the scenario genuinely needs, no more. One must be the arrival_location. Each has id (snake_case), name (display string), flavour (one atmospheric sentence), and a col (0–2) and row (0–2) placing it in a 3×3 grid. No two locations may share the same (col, row). Also define location_adjacencies — pairs of locations connected by paths, shorelines, or sightlines (3–8 pairs, visual only). Don't invent locations just to fill a grid.

STEP 5 — ITEMS: As many items as the scenario needs, up to 8. Each must be referenced in at least one clue condition. No orphan items. Item descriptions are plain physical observations only — colour, shape, condition, visible markings. Do not include interpretive detail that reveals what the item is evidence of; that is the clue's job. BAD: "a residue that smells nothing like dairy." GOOD: "a faint discolouration above the cream line."

STEP 6 — CHECKPOINTS: All 6, with 4–6 answer options each. Correct answer present but not marked.

STEP 7 — CLUES: Per checkpoint: exactly 2 "correct" clues + 3 "red_herring" clues, each pointing at a DIFFERENT wrong answer. If two red herrings point at the same answer, the player has no logical way to eliminate it — the puzzle breaks.
Before finalising each clue condition, ask: what information already visible to the player — character descriptions, starting locations, item starting locations, relations, leads, or text from a simpler already-fireable clue — would cause them to try this exact combination? If no clear answer exists, the condition is wrong. Simplify it, move a character or item to a more natural location, or add a lead that supplies the missing motivation. Every condition must be reachable through logical inference, not trial and error.

STEP 8 — LEADS: Exactly 3 leads, at least 2 pointing toward early-game clue conditions.

HARD RULES:
- No clue text may state or imply the answer to any checkpoint. This means no deductions, no interpretations, no phrases like "consistent with", "suggesting", "indicating", "which means", "pointing to", or "ruling out." Present only raw observations: what was seen, heard, touched, or said. The player connects the dots; the clue never connects them.
  BAD (deduction): "The watch stopped at eleven-eighteen — consistent with the moment of a struggle at that location."
  BAD (reasoning chain): "The tide table confirms the body could not have arrived earlier without tidal interference."
  BAD (conclusion): "The wound pattern rules out a fall."
  GOOD (raw observation): "The watch face is cracked, its hands stopped at eleven-eighteen. The tide table on the wall shows the rock shelf is submerged from two hours before midnight until dawn."
  GOOD (raw observation): "The wound is a single oval depression at the back of the skull. The face and front of the clothing show no injury."
- Clue text must be self-contained. Never reference information the player may not yet have — do not mention what another character "said", "mentioned", or "told you" unless that character is in this clue's own condition. Each clue must read as a fresh observation with no assumed prior knowledge.
- If a clue condition does not include a character, do not name that character in the clue text or connect physical evidence to them by name. BAD: "The initials D.F. on the watch place Domingos Ferreira at the scene." GOOD: "The watch case is engraved with the initials D.F."
- The opening_narrative describes only the events leading to the investigator being summoned. No body description, no evidence.
- Wrap character names in [char:Name] and location names in [loc:location_id] tags throughout all prose. Wrap time references in [time:phrase] tags.
- Every character id in any condition must exist in characters (except "investigator"). Every item id must exist in items. Every location id must exist in locations.
- Red herring clues must point at a wrong answer_option and must have a red_herring_explanation.
- Exactly one character must have isVictim: true.
- Do NOT include "unlocked_by" on clues.
- No two clues may share identical condition fields.
- Any character described as meeting or greeting the investigator on arrival must have starting_location set to arrival_location.
- If a clue involves a character saying or being overheard, the condition must include at least 2 characters.
- If the investigator is NOT in the condition, the clue text must explain how the information reached the investigation.
- If the investigator IS in the condition alongside another character, write direct witness: "[char:Name] tells the investigator...", "Asked directly...", "Overhearing..."`


const SCHEMA = `{
  "village": {
    "name": string,
    "history": string (one paragraph — specific texture of this place; what it was built on, what shapes behaviour here),
    "season": "spring" | "summer" | "autumn" | "winter",
    "weather": string (one short evocative phrase),
    "arrival_location": location_id (where the investigator arrives — must match a location id in locations)
  },

  "crime": {
    "cause_of_death": string (one of: "drowning", "poisoning — plant-based", "poisoning — compound", "blunt trauma", "strangulation", "exposure", "arson", "ritual act", "stabbing", "shooting", "decapitation", "torture", "throat cut"),
    "murder_location": location_id,
    "body_found_location": location_id,
    "body_was_moved": boolean,
    "time_of_death": string (human-readable window),
    "perpetrator_ids": [char_id],
    "motive": string (one of: "inheritance", "jealousy", "self-preservation", "revenge", "protection", "belief", "debt", "obsession"),
    "hidden_truth": string | null (the correct answer for the hidden_truth checkpoint, or null if not used)
  },

  "characters": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "isVictim": boolean,
      "local": boolean,
      "home_location": location_id,
      "starting_location": location_id,
      "description": string (2–3 sentences; victim: character sketch + investigator's first observation of the body, surface only, no cause of death; others: character sketch + their plausible motive for the crime)
    }
    // DO NOT include "investigator". Exactly 1 isVictim: true.
  ],

  "items": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "description": string (one sentence — direct observation only),
      "starting_location": location_id
    }
  ],

  "locations": [
    { "id": location_id, "name": string, "flavour": string, "col": 0|1|2, "row": 0|1|2 }
    // 1–9. One id must match village.arrival_location. Include only locations the scenario uses.
    // col and row place each location in a 3×3 grid. No two locations may share the same (col, row).
    // Not all 9 cells need to be used — leave cells empty if the scenario has fewer locations.
  ],

  "location_adjacencies": [
    { "from": location_id, "to": location_id }
    // Pairs of locations that are adjacent in the world — paths, shared shorelines, visible from each other.
    // Purely visual (drawn as lines on the map). Define 3–8 pairs. Each adjacency need only appear once.
  ],

  "checkpoints": [
    {
      "id": "cause_of_death" | "true_location" | "time_of_death" | "hidden_truth" | "perpetrator" | "motive",
      "label": string,
      "answer_options": [string] (4–6 options, correct one included but not marked)
    }
    // Always include: cause_of_death, true_location, time_of_death, perpetrator, motive (5 total).
    // Optionally include hidden_truth as a 6th investigative checkpoint when the scenario has a
    // meaningful secondary mystery worth surfacing — something the player couldn't deduce from the
    // other five checkpoints alone. If there is no compelling hidden truth, omit it entirely.
    // hidden_truth label and answer_options are yours to define based on the scenario.
    // hidden_truth is an investigative checkpoint — it unlocks with the others, not after perpetrator.
  ],

  "clues": [
    {
      "id": string (unique),
      "checkpoint": checkpoint_id,
      "answer": string (must exactly match an entry in that checkpoint's answer_options),
      "weight": "correct" | "red_herring",
      "condition": {
        "type": one of the 8 condition types,
        "characters": [char_id],
        "location": location_id | null,
        "item": item_id | null
      },
      "text": string (1–3 sentences, [char:Name] and [loc:location_id] tags, answers something AND implies next step),
      "red_herring_explanation": string | null
    }
    // Per checkpoint: exactly 2 "correct" + 3 "red_herring".
    // All 3 red herrings must point at different wrong answer_options.
  ],

  "relations": [
    { "from": char_id, "to": char_id, "label": string }
    // Publicly known only: employment, family, open romantic interest, open enmity. No secrets.
  ],

  "leads": [
    {
      "id": string,
      "text": string (1–2 sentences, [char:Name] and [loc:location_id] tags, observation not instruction),
      "character_id": char_id | null,
      "location_id": location_id | null
    }
    // Exactly 3. At least 2 point toward early clue conditions.
  ],

  "opening_narrative": string (2–3 paragraphs, [char:Name] and [loc:location_id] tags, events up to summoning only)
}

CONDITION OBJECT — use exactly these type strings:
  { "type": "character_in_location", "characters": [char_id], "location": location_id }
  { "type": "n_characters_in_location", "characters": [char_id, ...], "location": location_id }
  { "type": "n_characters_together", "characters": [char_id, ...], "location": null }
  { "type": "n_characters_together_alone", "characters": [char_id, ...], "location": null }
  { "type": "characters_in_location_with_item", "characters": [char_id, ...], "location": location_id, "item": item_id }
  { "type": "characters_alone_in_location_with_item", "characters": [char_id, ...], "location": location_id, "item": item_id }
  { "type": "characters_anywhere_with_item", "characters": [char_id, ...], "location": null, "item": item_id }
  { "type": "characters_anywhere_with_item_alone", "characters": [char_id, ...], "location": null, "item": item_id }

CHECKPOINT GATING:
  cause_of_death, true_location, time_of_death, hidden_truth (if present) — available from turn 1.
  perpetrator, motive — locked until all investigative checkpoints are confirmed.`

function generateSeed(): string {
  const nouns = [
    'tide', 'kelp', 'rope', 'lantern', 'gull', 'chalk', 'slate', 'crab',
    'anchor', 'marrow', 'peat', 'candle', 'flint', 'salt', 'wren', 'tern',
    'brine', 'mast', 'dusk', 'frost', 'spire', 'vault', 'thorn', 'ash',
  ]
  const adjectives = [
    'hollow', 'bitter', 'pale', 'narrow', 'crooked', 'quiet', 'sodden',
    'sunken', 'grey', 'cold', 'salted', 'worn', 'bleak', 'steep', 'still',
  ]
  const n1 = nouns[Math.floor(Math.random() * nouns.length)]
  const n2 = nouns[Math.floor(Math.random() * nouns.length)]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${adj}-${n1}-${n2}-${num}`
}

export interface GeneratorOptions {
  difficulty: Difficulty
  apiKey: string
  maxRetries?: number
}

export async function generateScenario(options: GeneratorOptions): Promise<Scenario> {
  const { difficulty, apiKey, maxRetries = 3 } = options

  const seed = generateSeed()

  const userMessage = `Scenario seed: ${seed}
Use this seed as a creative starting point — let it influence the setting, atmosphere, and narrative texture.

Generate a complete Tidebound murder mystery scenario.

Return a JSON object matching this schema exactly:

${SCHEMA}`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Generation attempt ${attempt}/${maxRetries} (seed: ${seed})...`)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        temperature: 1.0,
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

    console.warn(`Attempt ${attempt}: ${errors.length} validation error(s):`)
    errors.forEach(e => console.warn(`  [${e.rule}] ${e.message}`))

    if (attempt === maxRetries) {
      throw new Error(`Generation failed after ${maxRetries} attempts.\n${errors.map(e => e.message).join('\n')}`)
    }
  }

  throw new Error('Generation failed')
}

// ─────────────────────────────────────────────
// Scenario storage (localStorage)
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
  try { return JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}${difficulty}`) ?? '[]') }
  catch { return [] }
}

export function getPlayedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '[]') }
  catch { return [] }
}

export function markPlayed(id: string): void {
  const played = getPlayedIds()
  if (!played.includes(id)) {
    localStorage.setItem(PLAYED_KEY, JSON.stringify([...played, id]))
  }
}

export function getUnplayedScenario(difficulty: Difficulty): { id: string; scenario: Scenario } | null {
  const played = new Set(getPlayedIds())
  return loadScenarios(difficulty).find(s => !played.has(s.id)) ?? null
}
