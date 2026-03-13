// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Generator
// ─────────────────────────────────────────────

import type { Scenario, Difficulty } from '../types/scenario'
import { validateScenario } from './validator'

const SYSTEM_PROMPT = `You are generating a complete murder mystery scenario for a single-player deduction game.
The culture is provided as a constraint — use it as the primary lens for setting, naming, social structure, and atmosphere. Era, tone, and geography follow from the culture.
The genre is provided as a tonal lens — let it shape atmosphere, narrative voice, character motivations, and the emotional register of clue texts. The scenario is always a murder mystery; the genre determines how that mystery feels.

THE INVESTIGATOR:
Every scenario includes a special character with id "investigator" — an official brought in from outside, whose presence is why people are talking at all. Not named or described in the JSON; the engine adds him. He always starts at the arrival_location. All clue conditions involve the investigator — every condition type begins with "investigator_". Do not include him in the characters array.

THE ELIMINATION MODEL:
This game uses pure elimination. All clues are true observations. The correct answer for each checkpoint is the one not contradicted by any clue. Players must prove each wrong answer impossible before the correct answer is accepted.
Each clue has a "contradicts" array listing which (checkpoint, answer) pairs it makes logically impossible. No weights, no red herrings — every clue is a genuine fact.

═══════════════════════════════════════════════════════
PHASE 1 — STORY BIBLE
Write everything inside <story></story> tags. Complete all steps before writing any JSON.
═══════════════════════════════════════════════════════

STEP 1 — SETTING
Build the setting from the culture. Decide: location, season, weather, location name. Use the seed for atmospheric texture.

STEP 2 — CRIME
Decide the full truth before writing characters or clues: who the victim is, who the perpetrator is and exactly why, method, murder location, body found location, whether moved, time window.
Then identify the one or two things the perpetrator could not avoid — traces that require inference, not observation. The perpetrator should have a plausible innocent explanation for being connected to at least one piece of evidence; the investigator must disprove it, not merely observe it. Avoid evidence that is personally identified (monogrammed, signed, initialled).

STEP 3 — CHARACTERS & RELATIONS
5–7 characters including the victim. Every non-victim character must have a plausible stated motive — even the innocent ones. Set their location — fixed for the whole game. Place them where it makes narrative sense and creates interesting investigator routes.
No more than 2 characters should share any location. Concentrating characters in one place floods a single turn with clues and removes the need to plan routes. Spread characters so the player has genuine decisions about where to go.
Include one character who functions as a medical authority — ranging from a trained physician to a midwife, barber-surgeon, or herbalist. They were present at or summoned to the body before the investigation began. Their testimony may be correct, misleading, or limited by their competence — that is a story choice.
For each non-perpetrator character: note what they know, what they suspect, and what they are concealing — and why.

STEP 4 — CLUE PLAN
Plan the full clue structure before writing any JSON. This is the most critical step.

First, list every wrong answer option for every checkpoint. The correct answers come from the crime block — every other option is a wrong answer that must be eliminated.

For each wrong answer, plan at least one clue that makes it logically impossible. A clue may contradict wrong answers across multiple checkpoints, but no single clue should appear in more than 3 contradicts entries — if a clue seems to eliminate everything, it is too vague; make it more specific.

For each planned clue:
- What is the condition? (investigator where, with whom, with what item)
- What raw observation does the clue text contain? No interpretations — only what was seen, heard, touched, or said.
- Which wrong answers does it contradict, and why is the contradiction logically valid from the clue text alone?
- DISCOVERABILITY: What specific information already visible to the player — character descriptions, item descriptions, relations, leads, or text from an already-collectable clue — would cause them to attempt this exact condition? Name it explicitly.
  For conditions of type ask_character_about_item or inspect_item_in_location: if the item's starting_location differs from the condition's location (or the character's fixed location) a prior clue text, lead, or description must explicitly name both the item and the relevant character or location together. Logical inference is not sufficient; the pairing must be stated in text.

Aim for 20–28 clues total.

STORY DETAIL → PLAYER VISIBILITY:
Every key fact that a player needs to eliminate a wrong answer must be visible in a clue text. If it exists only in the story bible, it does not exist for the player. Before finalising, check each wrong answer: is there a clue whose text, taken alone, makes this wrong answer logically impossible? Pay particular attention to motive — the specific reason the perpetrator killed must be reconstructable from clue texts alone.

STEP 5 — COVERAGE TABLE & CONSISTENCY CHECK
Build a coverage table: checkpoint × wrong answer → which clue(s) contradict it.
Every cell must be filled. If any wrong answer has no contradicting clue, write one.
Check that no clue has more than 3 contradicts entries — if so, split it or make it more specific.
Check that no clue could be construed to contradict a correct answer.
- TIMING ELIMINATION: For time_of_death specifically, each wrong answer_option must be made logically impossible by at least one clue — not merely less supported, but contradicted. For each wrong option, name which clue rules it out and how.
- ROUTING: Clues that contradict perpetrator and motive wrong answers should require deliberate routing (item-chains, specific character visits) so they are naturally discovered after the investigative facts are established. Do not gate them — they fire freely — but design their conditions to require effort.
- CONTRADICTIONS: Resolve everything before writing JSON.

═══════════════════════════════════════════════════════
PHASE 2 — JSON
After </story>, write the JSON object and nothing else. No markdown fences.
═══════════════════════════════════════════════════════

LOCATIONS: Up to 9 — as many as the scenario genuinely needs. One must be the arrival_location. Each has id (snake_case), name, flavour (one atmospheric sentence), col (0–2) and row (0–2) in a 3×3 grid. No two locations share the same (col, row). Define 3–8 location_adjacencies. Don't invent locations to fill a grid.

ITEMS: As many as the scenario needs, up to 8. Each must be referenced in at least one clue condition — no orphan items. Item descriptions are plain physical observations only: colour, shape, condition, visible markings. Do not include interpretive detail that reveals what the item is evidence of; that is the clue's job. No ledgers unless the motive is finance related.

CHECKPOINTS: Exactly these 5: cause_of_death, true_location, time_of_death, perpetrator, motive — each with 5–6 answer options. The correct answer must exactly match the corresponding value in the crime block:
- cause_of_death: exact string from crime.cause_of_death
- true_location: the name field of the location whose id matches crime.murder_location
- time_of_death: exact string from crime.time_of_death
- perpetrator: exact name of the character whose id is in crime.perpetrator_ids[0]
- motive: exact string from crime.motive
Wrong answers must be plausible given the setting — not obviously wrong from the opening narrative alone.

CLUES: Follow the plan from Phase 1. 20–28 clues total. All clues are true observations. No weights, no red_herring_explanation. Each clue has a "contradicts" array. Clues for perpetrator and motive fire freely — design their conditions to require deliberate routing (item-chains, specific character visits) so they are naturally discovered after investigative facts are established.

LEADS: Exactly 3. At least 2 pointing toward early-game clue conditions. Each lead must give the player a concrete reason to visit a location or seek out a character — not just name them.

CLUE-WRITING RULES:
- All clue texts are true observations. No clue text may state or imply which answer is correct — only what was seen, heard, touched, or said. The player deduces which wrong answers the clue rules out.
- A clue that contradicts a wrong answer must do so with logical necessity from the clue text alone. "No puncture wound found" validly contradicts "stabbing." "Witness seemed nervous" contradicts nothing specific. Flag weak contradictions and rewrite them.
- A clue that contradicts a perpetrator wrong answer must be suspicious but deniable on its own — only in combination with other clues should the perpetrator be obvious.
- Clue text must be self-contained. Do not reference what another character "said" unless that character is in this clue's own condition.
- All clue conditions involve the investigator. Use only the 5 condition types defined in the schema.
- If a clue condition does not include a character, do not name any character in the clue text — unless that character's fixed location matches the condition location.
- When the condition includes a character, write direct testimony: "[char:Name] tells the investigator...", "Asked directly, [char:Name] admits...", "Overhearing [char:Name]..."
- For time clues, use standard and precise time descriptions. "Before dawn" is useless. "After one bell" is useless. Use clock-style references ("between 10 and 11 at night", "two hours before the tide turned at midnight") that definitively rule out specific time windows.

GENERAL RULES:
- Do not use salt as a commodity, trade good, or setting element. No salt warehouses, salt merchants, salt flats, salt trades, or salt-related anything. It has been overused to the point of parody.
- Characters have a single location field — they do not move. Any character described as greeting the investigator on arrival must have location set to arrival_location.
- The opening_narrative describes only the events leading to the investigator being summoned. No body description, no evidence.
- Wrap character names in [char:Name], location names in [loc:location_id], and time references in [time:phrase] tags throughout all prose.
- Every character id in any condition must exist in characters (except "investigator"). Every item id must exist in items. Every location id must exist in locations.
- Exactly one character must have isVictim: true.
- Do not include multiple character conditions unless those characters share the same location.

═══════════════════════════════════════════════════════
PHASE 3 — JSON AUDIT
After writing the JSON, complete these checks before finishing.
═══════════════════════════════════════════════════════

DISCOVERY CHECK: For each clue, write the complete chain: what does the player see at the start of the game that leads them to eventually attempt that condition? Trace every step. If any step requires the player to guess or try conditions at random, the clue is unreachable — fix the condition, move an item, add a lead, or surface the missing information in a prior clue's text.

COVERAGE CHECK: For every checkpoint, for every wrong answer, confirm at least one clue's contradicts array covers it. Build the full table. Any uncovered wrong answer is a structural failure.

CLARITY CHECK: For each clue, confirm the clue text does NOT appear to contradict the correct answer for any checkpoint. A clue that seems to rule out the correct answer will mislead the player.

ANTI-CLUSTERING CHECK: Confirm no clue has more than 3 contradicts entries. If one does, split it into more specific clues.`


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
      "location_discovery_text": string (one sentence, present tense, physical only — what the investigator notices when scanning the location before picking it up. Wrap the item name in an [item:Name] tag. e.g. "[item:Brass Flask] rests on its side near the door."),
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
      "answer_options": [string] (5–6 options, correct answer included, must exactly match crime block values — see CHECKPOINTS section)
    }
    // Exactly these 5, no more: cause_of_death, true_location, time_of_death, perpetrator, motive.
  ],

  "clues": [
    {
      "id": string (unique),
      "condition": {
        "type": one of the 5 investigator condition types,
        "characters": [char_id] (for talk_to_character types; empty array otherwise),
        "location": location_id | null (for inspect_location types; null otherwise),
        "item": item_id | null (for inspect_item types; null otherwise)
      },
      "text": string (1–3 sentences, [char:Name], [loc:location_id] and [time:phrase] tags, raw observation only — no interpretations),
      "contradicts": [
        { "checkpoint": checkpoint_id, "answer": string }
        // answer must exactly match an entry in that checkpoint's answer_options
        // answer must NOT be the correct answer for that checkpoint
        // max 3 entries per clue
      ]
    }
    // 20–28 clues total. All clues are true observations.
    // Every wrong answer for every checkpoint must be covered by at least one clue's contradicts array.
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

  "epilogue": string (2–3 paragraphs revealed after the case is solved. Summarise the story from beginning to end, don't be too flowery. Uses [char:Name], [loc:location_id] and [time:phrase] tags.)
}

INTERACTION MODEL:
The player takes discrete actions. Each action fires relevant clues immediately:
- Move to a location: reveals NPCs present, fires no clues
- Inspect location: fires inspect_location clues; also fires inspect_item_in_location for items in inventory; reveals items via location_discovery_text
- Inspect item (picks it up): fires inspect_item clues; also fires inspect_item_in_location for current location
- Talk to character: fires talk_to_character clues
- Ask character about item (must be holding it): fires ask_character_about_item clues

This means ask_character_about_item clues represent the investigator showing the item to the character. The clue text should read as the character's reaction to being shown that specific item — testimony, recognition, or denial.

CONDITION OBJECT — use exactly these 5 type strings:
  { "type": "inspect_location", "characters": [], "location": location_id, "item": null }
  { "type": "talk_to_character", "characters": [char_id], "location": null, "item": null }
  { "type": "inspect_item", "characters": [], "location": null, "item": item_id }
  { "type": "inspect_item_in_location", "characters": [], "location": location_id, "item": item_id }
  { "type": "ask_character_about_item", "characters": [char_id], "location": null, "item": item_id }`

const GENRES = [
  'romance',
  'horror',
  'comedy',
  'tragedy',
  'science fiction',
  'satirical parody',
  'soap opera',
  'political drama',
  'family drama',
  'fantasy',
  'farce',
  'reincarnation second chance',
  'espionage',
  'revenge tragedy',
  'fairytale',
  'ghost story',
  'heist',
  'xianxia',
  'psychological thriller',
  'dark comedy',
  'vampires'
]

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
  'shot',
  'genre appropriate'
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
  'genre appropriate'
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
    'anchor', 'marrow', 'peat', 'candle', 'flint', 'wren', 'tern',
    'brine', 'mast', 'dusk', 'frost', 'spire', 'vault', 'thorn', 'ash',
    'ember', 'copper', 'grain', 'loom', 'bell', 'forge', 'bone', 'smoke',
    'shard', 'drum', 'ring', 'thread', 'amber', 'hook', 'blade', 'resin',
    'hearth', 'ink', 'mirror', 'coin', 'blood', 'gate', 'lamp', 'seal',
  ]
  const adjectives = [
    'hollow', 'bitter', 'pale', 'narrow', 'crooked', 'quiet', 'sodden',
    'sunken', 'grey', 'cold', 'worn', 'bleak', 'steep', 'still',
    'sharp', 'bright', 'deep', 'heavy', 'raw', 'low', 'dark', 'thick',
    'lean', 'swift', 'loose', 'coarse', 'dry', 'warm', 'faded', 'broken',
    'lost', 'gilt', 'burnt', 'scarred', 'mute', 'proud', 'old', 'blind',
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
  const genre = GENRES[hashSeed(seed, 4) % GENRES.length]

  return `Scenario seed: ${seed}
Culture: ${culture}
Genre: ${genre}
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
