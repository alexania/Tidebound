// ─────────────────────────────────────────────
// TIDEBOUND — Scenario Generator
// ─────────────────────────────────────────────

import type { Scenario, Difficulty } from '../types/scenario'
import { validateScenario } from './validator'

const SYSTEM_PROMPT = `You are generating a complete murder mystery scenario for a single-player deduction game.
The culture is provided as a constraint — use it as the primary lens for setting, naming, social structure, and atmosphere. Era, tone, and geography follow from the culture.
The genre is provided as a tonal lens — it is mandatory, not optional. The scenario is always a murder mystery; the genre determines how that mystery feels, how it is told, and what kind of people inhabit it. Genre must be actively visible in every major text field. A scenario that could have been written without the genre label has failed.

GENRE INTEGRATION — required in every field:
- opening_narrative: The genre must be set in the first sentence.
- location flavours: Each must carry the genre's emotional register.
- character descriptions: Characters embody genre archetypes while remaining specific.
- clue texts: The narrative voice shifts by genre.
- epilogue: The resolution is genre-appropriate.

THE INVESTIGATOR:
Every scenario includes a special character with id "investigator" — an official brought in from outside, whose presence is why people are talking at all. Not named or described in the JSON; the engine adds him. He always starts at the arrival_location. All clue conditions involve the investigator — every condition type begins with "investigator_". Do not include him in the characters array.

THE ELIMINATION MODEL:
This game uses pure elimination. All clues are true observations. The correct answer for each checkpoint is the one not contradicted by any clue. Players must prove each wrong answer impossible before the correct answer is accepted.
Each clue has a "contradicts" array listing which (checkpoint, answer) pairs it makes logically impossible. No weights, no red herrings — every clue is a genuine fact.

GIVEN FACTS (not player-deduced):
Cause of death and time of death are not checkpoints — the player does not need to prove them. They are stated as established facts in the opening_narrative — the investigator is briefed before arrival. The medical authority character's clues are for elaboration and alibi only, not for delivering cause/time.

ELIMINATION DIRECTION RULE:
Every contradiction must pass: "if the wrong answer were true, this clue would be impossible" — without assuming any other checkpoint's answer. Evidence of what happened is not evidence of what didn't happen.

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
Include one character who functions as a medical authority — ranging from a trained physician to a midwife, barber-surgeon, or herbalist. They were present at or summoned to the body before the investigation began. Their clues may elaborate on cause of death or provide alibi information, but carry no primary contradiction responsibility.
For each non-perpetrator character: note what they know, what they suspect, and what they are concealing — and why.
Every non-victim character must have at least one talk_to_character clue in which they account for their own whereabouts during the murder window — where they were, from when to when. This is the investigator asking directly; the character answers. This clue must have an empty contradicts array: a character's self-reported alibi cannot eliminate them as a suspect. A separate third-party clue may corroborate their account — that is the clue that does the elimination work.

STEP 4 — CLUE PLAN
Plan the full clue structure before writing any JSON. This is the most critical step. Complete 4a entirely before starting 4b.

There are exactly 3 checkpoints: true_location, perpetrator, motive.

─── STEP 4a — ELIMINATION MECHANISMS (no clue text yet) ───────────────────
Before designing any clue, lock in the mechanism that makes each wrong answer impossible. One row per wrong answer. Do not write clue text yet — just name the mechanism.

Format for each row:
  [checkpoint] | [wrong answer] | [mechanism type] | [the specific fact that makes it impossible]

Mechanism types:
  - ALIBI: a named third-party witness places the suspect away from the murder location for the entire window. State: witness name, where they were, time coverage.
  - ALIBI-LOCATION: a named non-perpetrator character was demonstrably present at the wrong location during the window. State: character name, location, time coverage.
  - VICTIM-TRAJECTORY: a witness places the victim alive leaving the wrong location during the window.
  - INACCESSIBLE: the location was physically closed, locked, or blocked during the murder window. State: what made it inaccessible and what clue establishes this.
  - DOCUMENT: a specific physical document contains a fact that makes the theory impossible. State: document name, the specific field/entry that is absent or contradictory.
  - TESTIMONY: a specific character's direct statement makes the theory impossible. State: character, what they say, why it is impossible if the wrong answer were true.

Rules:
  - ALIBI alibis must come from a third-party witness — not the suspect. "Ferdo says he left" is not an alibi for Ferdo. "Matrona saw Ferdo on the bridge" is.
  - ALIBI time coverage must span the full murder window. "Seen at 10pm" does not cover a 9-11pm window.
  - Physical evidence at the correct location (blood stain, weapon, etc.) is NOT a valid mechanism for any wrong answer — it is positive evidence for the correct answer, not elimination of others.
  - Establishing the correct motive is NOT a mechanism for eliminating wrong motives — multiple motives could coexist unless a specific fact makes the wrong one impossible.

If you cannot find a valid mechanism for a wrong answer, redesign now — move a character, add a document, adjust the time window — before writing any clue text.

─── STEP 4b — CLUE DESIGN ───────────────────────────────────────────────────
Now design clues that surface the mechanisms from 4a. For each mechanism, identify:
- What condition makes the player encounter it? (inspect_location, talk_to_character, inspect_item, inspect_item_in_location, ask_character_about_item, ask_character_about_clue)
- What raw observation does the clue text contain? No interpretations — only what was seen, heard, touched, or said.
- DISCOVERABILITY: What specific information already visible to the player — character descriptions, item descriptions, leads, or prior clue text — causes them to attempt this condition? Name it explicitly.
  For ask_character_about_item or inspect_item_in_location: a prior clue text, lead, or description must explicitly name both the item and the relevant character or location together. Logical inference is not sufficient; the pairing must be stated in text.
  For ask_character_about_clue: the prerequisite clue must explicitly name or directly implicate the target character, giving the player a visible reason to confront them about it.

After designing elimination clues for every mechanism in 4a, add narrative clues to fill routing gaps and tell the story. These may have empty contradicts arrays. Consider adding ask_character_about_clue clues for natural dramatic follow-ups — a character named in a damning clue being confronted, an alibi witness being pressed. Mark these with dialog: true if they are reactions rather than new evidence.

Aim for at least 12 clues total. Every non-victim character must have at least one talk_to_character clue. Every wrong answer must be covered by at least one non-dialog clue — that is the structural requirement. Clues may have empty contradicts arrays; not every clue needs to eliminate anything.

STORY DETAIL → PLAYER VISIBILITY:
Every key fact that a player needs to eliminate a wrong answer must be visible in a clue text. If it exists only in the story bible, it does not exist for the player. Before finalising, check each wrong answer: is there a clue whose text, taken alone, makes this wrong answer logically impossible? Pay particular attention to motive — the specific reason the perpetrator killed must be reconstructable from clue texts alone.

STEP 5 — COVERAGE TABLE & CONSISTENCY CHECK
Build a coverage table: checkpoint × wrong answer → which clue(s) contradict it.
Every cell must be filled. If any wrong answer has no contradicting clue, write one.
Check that no clue has more than 3 contradicts entries — if so, split it or make it more specific.
Check that no clue could be construed to contradict a correct answer.
Apply the ELIMINATION DIRECTION TEST to every (clue → contradiction) pair.
- ROUTING: Clues that contradict perpetrator and motive wrong answers should require deliberate routing (item-chains, specific character visits) so they are naturally discovered after the investigative facts are established. Do not gate them — they fire freely — but design their conditions to require effort.
- CONTRADICTIONS: Resolve everything before writing JSON.

═══════════════════════════════════════════════════════
PHASE 2 — JSON
After </story>, write the JSON object and nothing else. No markdown fences.
═══════════════════════════════════════════════════════

LOCATIONS: Up to 9 — as many as the scenario genuinely needs. One must be the arrival_location. Each has id (snake_case), name, flavour (one atmospheric sentence), col (0–2) and row (0–2) in a 3×3 grid. No two locations share the same (col, row). Define 3–8 location_adjacencies. Don't invent locations to fill a grid.

ITEMS: As many as the scenario needs, up to 8. Each must be referenced in at least one clue condition — no orphan items. Item descriptions are plain physical observations only: colour, shape, condition, visible markings. Do not include interpretive detail that reveals what the item is evidence of; that is the clue's job. No ledgers unless the motive is finance related.

CHECKPOINTS: Exactly these 3: true_location, perpetrator, motive — each with 5–6 answer options. The correct answer must exactly match the corresponding value in the crime block:
- true_location: the name field of the location whose id matches crime.murder_location
- perpetrator: exact name of the character whose id is in crime.perpetrator_ids[0]
- motive: exact string from crime.motive (generate a specific, falsifiable motive — not a generic category. The motive input is a guide; produce a concrete version of it)
Wrong answers must be plausible given the setting — not obviously wrong from the opening narrative alone.
For motive: every wrong answer must be a specific falsifiable theory, not a generic label.

CLUES: Follow the plan from Phase 1. At least 12 clues. All clues are true observations. Each clue has a "contradicts" array. Clues for perpetrator and motive fire freely — design their conditions to require deliberate routing (item-chains, specific character visits) so they are naturally discovered after investigative facts are established. Dialog clues (dialog: true) appear in the log but are not pinned as evidence; they must have empty contradicts arrays.

LEADS: Exactly 3. At least 2 pointing toward early-game clue conditions. Each lead must give the player a concrete reason to visit a location or seek out a character — not just name them.

CLUE-WRITING RULES:
- All clue texts are true observations. No clue text may state or imply which answer is correct — only what was seen, heard, touched, or said. The player deduces which wrong answers the clue rules out.
- A clue that contradicts a wrong answer must do so with logical necessity from the clue text alone, passing the elimination direction test: "if wrong answer X were true, this clue would be impossible." The required reason field in each contradicts entry forces this test — write the reason before deciding whether to include the contradiction. If you cannot write a clear one-sentence reason that quotes the clue text and explains why the wrong answer makes it impossible, the contradiction is invalid and must be removed.
- For location wrong answers: the clue must show the location was inaccessible during the window, place a non-perpetrator character there as an alibi witness, or place the victim alive leaving there during the window. These are the ONLY valid methods. Finding physical evidence at the correct location does NOT eliminate wrong locations — "blood found at X" makes X look likely but does not make Y impossible. A player cannot logically conclude the murder didn't happen at Y just because they found evidence at X.
- For perpetrator wrong answers: the clue must place the wrong suspect elsewhere during the confirmed murder window at the confirmed location — alibi only. The alibi must (a) come from a third-party witness, not the suspect's own testimony, and (b) cover the full murder time window without gaps. A witness seeing someone at one point in the window is not sufficient — the alibi must make it impossible for the suspect to have been at the murder location at any point during the window.
- For motive wrong answers: the clue must contain a specific fact (testimony, document, relationship) that directly contradicts the theory. Evidence that establishes the correct motive does NOT eliminate wrong motives — "a letter exists about X" shows X is a motive but does not prove Y is impossible. Multiple motives could coexist. The clue must make the specific wrong theory impossible on its own.
- A character's talk clue in which they account for their own whereabouts must have an empty contradicts array. Self-reported alibis are not evidence. Only a separate clue in which a third party places that character elsewhere can contradict them as a suspect.
- A clue that contradicts a perpetrator wrong answer must be suspicious but deniable on its own — only in combination with other clues should the perpetrator be obvious.
- Clue text must be self-contained. Do not reference what another character "said" unless that character is in this clue's own condition.
- All clue conditions involve the investigator. Use only the 6 condition types defined in the schema.
- dialog: true marks a clue as flavour/reaction — it fires and appears in the log but is not pinned as evidence. Dialog clues must always have an empty contradicts array.
- If a clue condition does not include a character, do not name any character in the clue text — unless that character's fixed location matches the condition location.
- When the condition includes a character, write direct testimony: "[char:Name] tells the investigator...", "Asked directly, [char:Name] admits...", "Overhearing [char:Name]..."
- Time references in clue texts must be clock-style only: "eleven o'clock at night", "between midnight and two in the morning". No "bell of night" or "before dawn" constructions.

GENERAL RULES:
- Do not use salt as a commodity, trade good, or setting element. No salt warehouses, salt merchants, salt flats, salt trades, or salt-related anything. It has been overused to the point of parody.
- Characters have a single location field — they do not move. Any character described as greeting the investigator on arrival must have location set to arrival_location.
- The opening_narrative describes the events leading to the investigator being summoned. It must explicitly state the cause of death and the time window as established facts — the investigator is briefed before arrival. No other evidence or body description beyond cause and time.
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

ELIMINATION DIRECTION CHECK: For each (clue → wrong answer) pair, apply the test: "If [wrong answer] were true, this clue would be impossible — without assuming any other checkpoint's answer." If it fails, rewrite the clue or replace it.

CLARITY CHECK: For each clue, confirm the clue text does NOT appear to contradict the correct answer for any checkpoint. A clue that seems to rule out the correct answer will mislead the player.

ANTI-CLUSTERING CHECK: Confirm no clue has more than 3 contradicts entries. If one does, split it into more specific clues.

OPENING NARRATIVE CHECK: Confirm the opening_narrative explicitly states the cause of death and the time window as established facts, in plain terms. MEDICAL AUTHORITY CHECK: Confirm the medical authority character's clues serve elaboration and alibi only — not cause/time delivery. Confirm time references are clock-style only throughout.`


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
    "time_of_death": string (human-readable window, clock-style only),
    "perpetrator_ids": [char_id],
    "motive": string (specific and falsifiable — not a generic category)
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
      "id": "true_location" | "perpetrator" | "motive",
      "label": string,
      "answer_options": [string] (5–6 options, correct answer included, must exactly match crime block values — see CHECKPOINTS section)
    }
    // Exactly these 3, no more: true_location, perpetrator, motive.
    // cause_of_death and time_of_death are NOT checkpoints — they are given in the opening_narrative.
  ],

  "clues": [
    {
      "id": string (unique),
      "condition": {
        "type": one of the 6 investigator condition types,
        "characters": [char_id] (for talk_to_character and ask_ types; empty array otherwise),
        "location": location_id | null (for inspect_location types; null otherwise),
        "item": item_id | null (for inspect_item types; null otherwise),
        "clue": clue_id | null (for ask_character_about_clue only — the prerequisite clue that must already be collected; null otherwise)
      },
      "text": string (1–3 sentences, [char:Name], [loc:location_id] and [time:phrase] tags, raw observation only — no interpretations),
      "dialog": boolean (optional — if true, this clue fires and appears in the action log but is NOT pinned to the evidence board. Use for character reactions, casual exchanges, and atmospheric colour that don't constitute investigative evidence. Default: false / omit for evidence clues),
      "contradicts": [
        {
          "checkpoint": checkpoint_id,
          "answer": string,
          "reason": string  // required — one sentence: quote the specific part of the clue text that makes this answer impossible, then state why it is impossible if that answer were true. e.g. "The clue states X; if the answer were Y, X could not exist because Z."
        }
        // answer must exactly match an entry in that checkpoint's answer_options
        // answer must NOT be the correct answer for that checkpoint
        // max 3 entries per clue
        // empty array is valid — not every clue needs to eliminate a wrong answer
        // dialog clues must have an empty contradicts array
      ]
    }
    // 12+ clues total. All clues are true observations.
    // Every wrong answer for every checkpoint must be covered by at least one non-dialog clue's contradicts array.
    // Every non-victim character must have at least one talk_to_character clue (contradicts may be empty).
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

  "opening_narrative": string (2–3 paragraphs, [char:Name], [loc:location_id] and [time:phrase] tags, events up to summoning — must explicitly state cause of death and clock-style time window as established facts),

  "epilogue": string (2–3 paragraphs revealed after the case is solved. Summarise the story from beginning to end, don't be too flowery. Uses [char:Name], [loc:location_id] and [time:phrase] tags.)
}

INTERACTION MODEL:
The player takes discrete actions. Each action fires relevant clues immediately:
- Move to a location: reveals NPCs present, fires no clues
- Inspect location: fires inspect_location clues; also fires inspect_item_in_location for items in inventory; reveals items via location_discovery_text
- Inspect item (picks it up): fires inspect_item clues; also fires inspect_item_in_location for current location
- Talk to character: fires talk_to_character clues
- Ask character about item (must be holding it): fires ask_character_about_item clues
- Ask character about clue (must have collected the prerequisite clue): fires ask_character_about_clue clues — the UI shows "Follow up: [clue text]" buttons when the prerequisite clue is in the player's log

ask_character_about_item clues represent the investigator showing the item to the character. The clue text should read as the character's reaction to being shown that specific item.
ask_character_about_clue clues represent the investigator confronting a character named in a previously collected clue. The prerequisite clue must explicitly name or directly implicate the character — the player needs a visible reason to attempt the follow-up. Use for confrontations, clarifications, or reactions that only make sense once a specific fact is known. These are natural candidates for dialog: true if they are character reactions rather than new investigative facts.

CONDITION OBJECT — use exactly these 6 type strings:
  { "type": "inspect_location", "characters": [], "location": location_id, "item": null, "clue": null }
  { "type": "talk_to_character", "characters": [char_id], "location": null, "item": null, "clue": null }
  { "type": "inspect_item", "characters": [], "location": null, "item": item_id, "clue": null }
  { "type": "inspect_item_in_location", "characters": [], "location": location_id, "item": item_id, "clue": null }
  { "type": "ask_character_about_item", "characters": [char_id], "location": null, "item": item_id, "clue": null }
  { "type": "ask_character_about_clue", "characters": [char_id], "location": null, "item": null, "clue": prerequisite_clue_id }`

export const GENRES = [
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

export const CAUSES_OF_DEATH = [
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

export const MOTIVES = [
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

export const CULTURES = [
  'Norse highland clans of the 10th century',
  'Ottoman court households of the 16th century',
  'Andean highland communities of the late Inca period',
  'Edo-period Japanese mountain villages',
  'Caribbean free settlements of the 17th century',
  'Hanseatic trading city cultures of medieval Germany',
  'Mongolian steppe nomads of the 13th century',
  'Venetian Renaissance merchant families',
  'Victorian-era English country house society',
  'Ancient Greek city-state citizens of the classical period',
  'The Drenathi — a fictional theocratic mountain nation',
  'The Kauvari — a fictional matrilineal trade-route culture',
  'Ming dynasty imperial court households',
  'West African Ashanti court society of the 18th century',
  'The Orrish — a fictional cold-weather culture with strict ancestor veneration',
  'Colonial New England Puritan settlements',
  'Mughal court culture of the 17th century',
  'The Valdessi — a fictional Mediterranean city-state',
  'Meiji-era Japanese modernising provincial towns',
  'The Greymarch Confederacy — a fictional northern territory with a mercantile senate',
  'Cold War East Berlin — intelligence operatives and informants, 1970s',
  '1960s London — music industry and working-class neighbourhoods in flux',
  'Post-war Vienna — black market traders and reconstruction bureaucrats, late 1940s',
  'Soviet-era collective farm communities of the 1950s',
  'Contemporary Tokyo — white-collar corporate culture and office politics',
  '1980s Miami — new money, ambition, and dangerous neighbours',
  'Contemporary rural Iceland — tight-knit communities and long memories',
  'A near-future orbital station — corporate contractors and confined quarters',
  'A generation ship mid-voyage — rigid hierarchy and dwindling resources',
  'A near-future arcology megacity — stratified floors, surveillance, and black markets',
  'A post-collapse frontier settlement — scavenged technology and distrust of outsiders',
  'A terraforming colony on a hostile world — isolation, quotas, and company oversight',
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

export interface PromptOverrides {
  culture?: string
  genre?: string
  causeOfDeath?: string
  motive?: string
  bodyMoved?: boolean
}

function buildUserMessage(seed: string, overrides: PromptOverrides = {}): string {
  const causeOfDeath = overrides.causeOfDeath ?? CAUSES_OF_DEATH[hashSeed(seed, 0) % CAUSES_OF_DEATH.length]
  const motive = overrides.motive ?? MOTIVES[hashSeed(seed, 1) % MOTIVES.length]
  const bodyMoved = overrides.bodyMoved ?? BODY_MOVED[hashSeed(seed, 2) % BODY_MOVED.length]
  const culture = overrides.culture ?? CULTURES[hashSeed(seed, 3) % CULTURES.length]
  const genre = overrides.genre ?? GENRES[hashSeed(seed, 4) % GENRES.length]

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

export function generatePromptForClipboard(overrides: PromptOverrides = {}): string {
  const seed = generateSeed()
  return buildUserMessage(seed, overrides)
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
