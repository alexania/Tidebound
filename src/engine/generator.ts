// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Generator
// ─────────────────────────────────────────────

import type { Scenario, Difficulty } from '../types/scenario'
import { validateScenario } from './validator'

const SYSTEM_PROMPT = `You are generating a complete murder mystery scenario for a single-player deduction game.
The only hard setting constraint is that it is coastal.
The culture is provided as a constraint — use it as the primary lens for setting, naming, social structure, and atmosphere. Era, tone, and geography follow from the culture.

THE INVESTIGATOR:
Every scenario includes a special character with id "investigator" — an official brought in from outside, whose presence is why people are talking at all. Not named or described in the JSON; the engine adds him. He always starts at the arrival_location. All clue conditions involve the investigator — every condition type begins with "investigator_". Do not include him in the characters array.

═══════════════════════════════════════════════════════
PHASE 1 — STORY BIBLE
Write everything inside <story></story> tags. Complete all steps before writing any JSON.
═══════════════════════════════════════════════════════

STEP 1 — SETTING
Build the setting from the culture. Decide: coastal location, season, weather, location name. Use the seed for atmospheric texture.

STEP 2 — CRIME
Decide the full truth before writing characters or clues: who the victim is, who the perpetrator is and exactly why, method, murder location, body found location, whether moved, time window.
Then identify the one or two things the perpetrator could not avoid — traces that require inference, not observation. The perpetrator should have a plausible innocent explanation for being connected to at least one piece of evidence; the investigator must disprove it, not merely observe it. Avoid evidence that is personally identified (monogrammed, signed, initialled).

STEP 3 — CHARACTERS & RELATIONS
5–7 characters including the victim. Every non-victim character must have a plausible stated motive — even the innocent ones. Set their location — fixed for the whole game. Place them where it makes narrative sense and creates interesting investigator routes.
No more than 2 characters should share any location. Concentrating characters in one place floods a single turn with clues and removes the need to plan routes. Spread characters so the player has genuine decisions about where to go.
For each non-perpetrator character: note what they know, what they suspect, and what they are concealing — and why.
Publicly known relationships: employment, family, open romantic interest, open enmity. No secrets, no debts, nothing crime-related. Label each directionally: "employs", "sister of", "rivals with".

STEP 4 — CLUE PLAN
Plan the full clue structure before writing any JSON. This is the most critical step.

For each of the 5 checkpoints (cause_of_death, true_location, time_of_death, perpetrator, motive):

CORRECT CLUES — plan 2, obtainable from different locations. For each:
- What is the condition? (investigator where, with whom, with what item)
- What raw observation does the clue text contain? No interpretations — only what was seen, heard, touched, or said.
- DISCOVERABILITY: What specific information already visible to the player — character descriptions, item descriptions at their starting locations, relations, leads, or text from an already-collectable clue — would cause them to attempt this exact condition? Name it explicitly. If you cannot, the condition is wrong: move a character, relocate an item, or add a lead until a clear path exists.
  For conditions of type investigator_with_character_and_item or investigator_at_location_with_item: if the item's starting_location differs from the condition's location (or the character's fixed location), a prior clue text, lead, or description visible at game start must explicitly name both the item and the relevant character or location together — giving the player a concrete reason to bring that item to that specific person or place. Logical inference ("an auditor would care about a ledger") is not sufficient; the pairing must be stated in the text. If the item already starts at the condition location, no additional signposting is required.

RED HERRING CLUES — plan 3, each pointing at a DIFFERENT wrong answer_option. For each: which wrong answer does it target, and what makes the evidence misleading?

STORY DETAIL → PLAYER VISIBILITY:
Every key fact from the story bible that a player needs to solve a checkpoint must be visible somewhere in the JSON — in a clue text, character description, item description, or location flavour. If it exists only in the story bible, it does not exist for the player. Before finalising, check each checkpoint: could a player who has read every piece of visible JSON text reach the correct answer? Pay particular attention to motive — the specific reason the perpetrator killed must be reconstructable from clue texts alone, not just implied by the story.

STEP 5 — CONSISTENCY & VISIBILITY CHECK
- VISIBILITY: The player sees only clue texts, character descriptions, item descriptions, and relations. For each checkpoint, trace what a player would conclude from those fields alone. Is it sufficient to reach the correct answer? If no, rewrite the relevant clues.
- AMBIGUITY: For each correct clue, could a player reasonably cite the same observation as evidence for a wrong answer? If yes, add specificity.
- COVERAGE: Do all 3 red herrings per checkpoint point at different wrong options? Two pointing at the same wrong answer means the player cannot eliminate it.
- TIMING ELIMINATION: For time_of_death specifically, each wrong answer_option must be made logically impossible by at least one correct clue — not merely less supported, but contradicted. For each wrong option, name the correct clue that rules it out and how. If any wrong option survives both correct clues intact, rewrite until it cannot.
- CONTRADICTIONS: Resolve everything before writing JSON.

═══════════════════════════════════════════════════════
PHASE 2 — JSON
After </story>, write the JSON object and nothing else. No markdown fences.
═══════════════════════════════════════════════════════

LOCATIONS: Up to 9 — as many as the scenario genuinely needs. One must be the arrival_location. Each has id (snake_case), name, flavour (one atmospheric sentence), col (0–2) and row (0–2) in a 3×3 grid. No two locations share the same (col, row). Define 3–8 location_adjacencies. Don't invent locations to fill a grid.

ITEMS: As many as the scenario needs, up to 8. Each must be referenced in at least one clue condition — no orphan items. Item descriptions are plain physical observations only: colour, shape, condition, visible markings. Do not include interpretive detail that reveals what the item is evidence of; that is the clue's job.

CHECKPOINTS: Exactly these 5: cause_of_death, true_location, time_of_death, perpetrator, motive — each with 4–6 answer options, correct answer present but not marked.

CLUES: Follow the plan from Phase 1. Per checkpoint: exactly 2 "correct" + 3 "red_herring". Investigative clues (cause_of_death, true_location, time_of_death) fire freely. Perpetrator and motive clues only fire after all three investigative checkpoints have been confirmed — design them assuming the player has already established the basic facts of the crime.

LEADS: Exactly 3. At least 2 pointing toward early-game clue conditions. Each lead must give the player a concrete reason to visit a location or seek out a character — not just name them.

CLUE-WRITING RULES:
- No clue text may state or imply the answer to any checkpoint. No deductions, no interpretations, no phrases like "consistent with", "suggesting", "indicating", "which means", "pointing to", or "ruling out." Present only raw observations: what was seen, heard, touched, or said. The player connects the dots.
- A correct clue must be specific enough that it cannot be equally cited as evidence for a wrong answer option. Before finalising, ask: could a player reasonably use this same observation to argue for another option? If yes, add physical or testimonial specificity.
- Perpetrator correct clues must not be individually conclusive. Each should be suspicious but deniable alone; only the combination of both should be conclusive.
- Clue text must be self-contained. Do not reference what another character "said" unless that character is in this clue's own condition.
- All clue conditions involve the investigator. Use only the 5 condition types defined in the schema.
- If a clue condition does not include a character, do not name any character in the clue text — unless that character's fixed location matches the condition location.
- When the condition includes a character, write direct testimony: "[char:Name] tells the investigator...", "Asked directly, [char:Name] admits...", "Overhearing [char:Name]..."
- Each clue should address one checkpoint only — avoid observations that simultaneously imply answers to multiple checkpoints.

GENERAL RULES:
- Characters have a single location field — they do not move. Any character described as greeting the investigator on arrival must have location set to arrival_location.
- The opening_narrative describes only the events leading to the investigator being summoned. No body description, no evidence.
- Wrap character names in [char:Name], location names in [loc:location_id], and time references in [time:phrase] tags throughout all prose.
- Every character id in any condition must exist in characters (except "investigator"). Every item id must exist in items. Every location id must exist in locations.
- Red herring clues must point at a wrong answer_option and must have a red_herring_explanation.
- Exactly one character must have isVictim: true.
- Do not include multiple character conditions unless those characters share the same location.

═══════════════════════════════════════════════════════
PHASE 3 — JSON AUDIT
After writing the JSON, trace the discovery path for every correct clue before finishing.
═══════════════════════════════════════════════════════

For each correct clue, write the complete chain: what does the player see at the start of the game that leads them to eventually attempt that condition? Trace every step. If any step requires the player to guess or try conditions at random, the clue is unreachable — fix the condition, move an item, add a lead, or surface the missing information in a prior clue's text.

For each checkpoint, confirm: could a player who collected both correct clues reach the correct answer from the clue texts alone, without author knowledge? If no, rewrite.`


const SCHEMA = `{
  "location": {
    "name": string,
    "season": "spring" | "summer" | "autumn" | "winter",
    "weather": string (one short evocative phrase),
    "arrival_location": location_id (where the investigator arrives — must match a location id in locations)
  },

  "crime": {
    "cause_of_death": string,
    "murder_location": location_id,
    "body_found_location": location_id,
    "body_was_moved": boolean,
    "time_of_death": string (human-readable window),
    "perpetrator_ids": [char_id],
    "motive": string
  },

  "characters": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "isVictim": boolean,
      "local": boolean,
      "location": location_id (fixed for the whole game — characters do not move),
      "description": string (2–3 sentences; victim: character sketch + investigator's first observation of the body, surface only, no cause of death; others: character sketch + investigator's first observation upon meeting)
    }
    // DO NOT include "investigator". Exactly 1 isVictim: true.
  ],

  "items": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "description": string (one sentence — direct observation only, no deductions),
      "starting_location": location_id
    }
  ],

  "locations": [
    { "id": location_id, "name": string, "flavour": string, "col": 0|1|2, "row": 0|1|2 }
    // 1–9. One id must match location.arrival_location. Include only locations the scenario uses.
    // col and row place each location in a 3×3 grid. No two locations may share the same (col, row).
    // Not all 9 cells need to be used — leave cells empty if the scenario has fewer locations.
  ],

  "location_adjacencies": [
    { "from": location_id, "to": location_id }
    // Pairs of locations that are adjacent in the world — paths, shared shorelines, visible from each other.
    // These govern investigator movement: the investigator can only move to an adjacent location each turn.
    // Define 3–8 pairs. Each adjacency need only appear once (treated as bidirectional).
  ],

  "checkpoints": [
    {
      "id": "cause_of_death" | "true_location" | "time_of_death" | "perpetrator" | "motive",
      "label": string,
      "answer_options": [string] (4–6 options, correct one included but not marked)
    }
    // Exactly these 5, no more: cause_of_death, true_location, time_of_death, perpetrator, motive.
  ],

  "clues": [
    {
      "id": string (unique),
      "checkpoint": checkpoint_id,
      "answer": string (must exactly match an entry in that checkpoint's answer_options),
      "weight": "correct" | "red_herring",
      "condition": {
        "type": one of the 5 investigator condition types,
        "characters": [char_id] (for investigator_with_character types; empty array otherwise),
        "location": location_id | null (for investigator_at_location types; null otherwise),
        "item": item_id | null (for investigator_with_item types; null otherwise)
      },
      "text": string (1–3 sentences, [char:Name], [loc:location_id] and [time:phrase] tags, answers something AND implies next step),
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
      "text": string (1–2 sentences, [char:Name], [loc:location_id] and [time:phrase] tags, observation not instruction),
      "character_id": char_id | null,
      "location_id": location_id | null
    }
    // Exactly 3. At least 2 point toward early clue conditions.
  ],

  "opening_narrative": string (2–3 paragraphs, [char:Name], [loc:location_id] and [time:phrase] tags, events up to summoning only),

  "epilogue": string (2–3 paragraphs revealed after the case is solved. Its primary purpose is to surface the story bible details the player never needed to solve the crime: the victim's full history and secrets, what the perpetrator was truly concealing beyond the immediate crime, relationships and events the investigator never directly uncovered, the texture of the world before it broke. Written in past tense. May briefly note what became of key characters, but only where it illuminates something about the story — not as an accounting of outcomes. Uses [char:Name], [loc:location_id] and [time:phrase] tags. No new plot twists — revelation only.)
}

CONDITION OBJECT — use exactly these 5 type strings:
  { "type": "investigator_at_location", "characters": [], "location": location_id, "item": null }
  { "type": "investigator_with_character", "characters": [char_id], "location": null, "item": null }
  { "type": "investigator_with_item", "characters": [], "location": null, "item": item_id }
  { "type": "investigator_at_location_with_item", "characters": [], "location": location_id, "item": item_id }
  { "type": "investigator_with_character_and_item", "characters": [char_id], "location": null, "item": item_id }`

const CAUSES_OF_DEATH = [
  'drowning',
  'poisoning by ingestion',
  'poisoning by contact or inhalation',
  'strangulation',
  'stabbing',
  'suffocation',
  'exposure and hypothermia',
  'a fall from height',
  'burning',
  'blunt force trauma',
  'exsanguination from a deep wound',
  'drowning in a confined space',
  'a blow to the base of the skull',
  'asphyxiation by smoke',
  'crushing by a heavy object',
  'overdose — forced or staged as accidental',
  'a thin blade between the ribs',
  'garrotting with a cord or wire',
  'head held underwater in a barrel or trough',
  'throat cut',
]

const MOTIVES = [
  'jealousy over a romantic rival',
  'silencing a witness to an old crime',
  'revenge for a past wrong, long nursed',
  'concealing an ongoing affair',
  'inheritance or property dispute',
  'blackmail gone wrong',
  'protecting a trade or professional secret',
  'a debt that could never be repaid',
  'ideological or religious conviction',
  'rivalry over land or livelihood',
  'preventing exposure of a false identity',
  'protecting a family member from ruin',
  'fury at perceived betrayal by a trusted friend',
  'greed over a discovered cache of valuables',
  'eliminating a rival claimant to a position or title',
  'covering up a previous accidental death',
  'fear of being disinherited',
  'resentment over years of public humiliation',
  'preventing a marriage the perpetrator opposed',
  'destroying evidence of wartime collaboration or desertion',
]

const BODY_MOVED = [true, false]

const CULTURES = [
  'Norse fishing communities of the 10th century',
  'Ottoman coastal traders of the 16th century',
  'Celtic-influenced Atlantic island clans',
  'Edo-period Japanese fishing villages',
  'Caribbean free settlements of the 17th century',
  'Hanseatic trading port cultures of medieval Germany',
  'Polynesian outrigger seafarers',
  'Venetian lagoon dwellers of the Renaissance',
  'Victorian-era Cornish wrecker communities',
  'Ancient Phoenician merchant colonies',
  'The Drenathi — a fictional theocratic archipelago nation',
  'The Kauvari — a fictional matrilineal salt-trading culture',
  'Ming dynasty pearl-diving communities',
  'West African Ijaw delta fishermen of the 18th century',
  'The Orrish — a fictional cold-water culture with strict ancestor veneration',
  'Colonial New England whalers',
  'Basque deep-sea fishing communities of the 16th century',
  'The Valdessi — a fictional Mediterranean city-state built on stilts',
  'Meiji-era Japanese modernising coastal towns',
  'The Greymarch Confederacy — a fictional northern archipelago with a mercantile senate',
]

function hashSeed(seed: string, offset: number): number {
  let h = offset
  for (const c of seed) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0
  return h
}

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

function buildUserMessage(seed: string): string {
  const causeOfDeath = CAUSES_OF_DEATH[hashSeed(seed, 0) % CAUSES_OF_DEATH.length]
  const motive = MOTIVES[hashSeed(seed, 1) % MOTIVES.length]
  const bodyMoved = BODY_MOVED[hashSeed(seed, 2) % BODY_MOVED.length]
  const culture = CULTURES[hashSeed(seed, 3) % CULTURES.length]

  return `Scenario seed: ${seed}
Culture: ${culture}
Cause of death: ${causeOfDeath}
Motive: ${motive}
Body moved: ${bodyMoved ? 'yes — the body was moved from the murder location before being found' : 'no — the body was found exactly where the murder occurred'}

Use the seed as a creative starting point for setting, atmosphere, and narrative texture. The cause of death, motive, and body moved flag are constraints — build the crime around them.

Generate a complete Tidebound murder mystery scenario.

Return a JSON object matching this schema exactly:

${SCHEMA}`
}

export function generatePromptForClipboard(): string {
  const seed = generateSeed()
  return buildUserMessage(seed)
}

export interface GeneratorOptions {
  difficulty: Difficulty
  apiKey: string
  maxRetries?: number
}

export async function generateScenario(options: GeneratorOptions): Promise<Scenario> {
  const { difficulty, apiKey, maxRetries = 3 } = options

  const seed = generateSeed()
  const userMessage = buildUserMessage(seed)

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
        max_tokens: 10000,
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

    // Strip the <story>...</story> bible before parsing JSON
    const storyEnd = rawText.indexOf('</story>')
    const jsonText = storyEnd !== -1 ? rawText.slice(storyEnd + '</story>'.length).trim() : rawText

    let parsed: Scenario
    try {
      parsed = JSON.parse(jsonText)
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

const MAX_STORED_SCENARIOS = 5

export function saveScenario(scenario: Scenario, difficulty: Difficulty): string {
  const key = `${STORAGE_KEY_PREFIX}${difficulty}`
  const played = new Set(getPlayedIds())
  const existing = loadScenarios(difficulty)
  const id = `${scenario.location.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
  const updated = [...existing, { id, scenario }]
    .filter(s => !played.has(s.id))
    .slice(-MAX_STORED_SCENARIOS)
  localStorage.setItem(key, JSON.stringify(updated))
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
