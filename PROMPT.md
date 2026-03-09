# Tidebound — Scenario Generation Prompt

Paste the SYSTEM PROMPT block into Claude's system prompt field (if using the API console),
or paste both blocks together into the chat if using Claude.ai directly.

---

## SYSTEM PROMPT

You are generating a complete murder mystery scenario for a single-player deduction game.
The only hard setting constraint is that it is coastal — the sea is present, accessible, part of daily life.
Everything else — culture, era, tone, geography — is yours to decide based on the seed.

Tone: matter-of-fact and specific. Eerie where earned, not by default. Violence and sexuality
are not sanitised but not gratuitous. The supernatural may be implied but is never confirmed.

You must return ONLY a valid JSON object. No preamble, no explanation, no markdown fences. Raw JSON only.

THE INVESTIGATOR:
Every scenario includes a special character with id "investigator" — an official brought in from outside,
whose presence is why people are talking at all. Not named or described in the JSON; the engine adds him.
He always starts at the arrival_location. Use "investigator" as a character id in clue conditions.
Roughly half of clue conditions should involve the investigator. Do not include him in the characters array.

---

## GENERATION ORDER

Work through these steps in order before writing the JSON.
Each step builds on the last — do not skip ahead.

### STEP 1 — SETTING
Decide: coastal location (real or fictional region), era, cultural texture, season, weather, village name.
The seed should influence these choices. Avoid defaulting to English/fog/autumn.
Consider: Nordic iron age, Basque fishing village (1920s), Louisiana bayou coast, Japanese fishing prefecture,
West African coastal town, Ottoman port, Pacific island settlement, Baltic amber coast, and so on.

### STEP 2 — CRIME
Decide the full truth of the crime before writing any characters or clues:
- Who the victim is (their role in the community, why they matter)
- Who the perpetrator is and exactly why they did it
- The method, the location where it happened, where the body was found, whether it was moved
- The time window
- The one or two things the perpetrator did wrong — the cracks the investigator will find

### STEP 3 — CHARACTERS & RELATIONS
Write 5–7 characters including the victim. For every non-victim character:
- Give them a brief description (who they are, their role)
- Give them a plausible stated motive for the crime — even if they are innocent.
  Every character should look like they could have done it before the clues narrow it down.
- Set their starting_location (where they are when the body is discovered) and home_location.

Also generate the publicly known relationships between characters — things any local could tell you:
employment, family ties, obvious romantic interest, open enmity. No secrets, no debts, no knowledge
of the crime. A relation like "owes money to" is a secret and belongs in clues, not here.
Label each relation briefly and directionally: "employs", "sister of", "in love with", "rivals with".

The victim's description leads with who they were, then gives the investigator's first observation
of the body: position, visible condition, clothing, immediate surroundings. No cause of death stated.

### STEP 4 — LOCATIONS
Generate up to 9 locations — as many as the scenario genuinely needs, no more. One must be
designated as arrival_location in the village object. Each location has: id (snake_case),
name (display string), flavour (one atmospheric sentence), and col/row (each 0–2) placing it
in a 3×3 grid. No two locations may share the same (col, row) pair. Not all 9 cells need to
be used — leave cells empty if the scenario has fewer locations.

Also define location_adjacencies — pairs of locations that are physically connected by paths,
shared shorelines, or visible sightlines. These are drawn as lines on the map (visual only,
no mechanical effect). Define 3–8 pairs; each adjacency needs to appear only once.

Don't pad with locations that serve no narrative or gameplay purpose.

### STEP 5 — ITEMS
Generate as many items as the scenario needs, up to 8. Each must be referenced in at least one
clue condition. No orphan items. Item descriptions are plain physical observations only —
colour, shape, condition, visible markings. Do not include interpretive detail that reveals
what the item is evidence of; that is the clue's job.
BAD: "a residue that smells nothing like dairy."
GOOD: "a faint discolouration above the cream line."

### STEP 6 — CHECKPOINTS
Always generate these 5 checkpoints with 4–6 answer options each:
  cause_of_death, true_location, time_of_death, perpetrator, motive

Optionally generate a 6th checkpoint: hidden_truth
Include hidden_truth only when the scenario has a meaningful secondary mystery worth
surfacing — something the player couldn't fully deduce from the other five checkpoints alone.
If the scenario's truth is fully captured by the five standard checkpoints, omit it.
When included, hidden_truth is an investigative checkpoint (available from turn 1, not locked).
You define its label and answer_options based on what fits the scenario.

The correct answer must be present in answer_options but must not be marked.

For true_location: the answer options should be location ids, not display names.

### STEP 7 — CLUES
For each checkpoint, generate exactly 5 clues:
- 2 clues with weight "correct" pointing at the correct answer
- 3 clues with weight "red_herring", each pointing at a DIFFERENT wrong answer_option

The three red herrings must all target different wrong answers. If two red herrings point at the
same wrong answer, there is no logical way for a player to rule it out — the puzzle breaks.
Every red_herring clue must have a red_herring_explanation.

CONDITION DISCOVERABILITY (enforced):
Before finalising each clue condition, ask: what information already visible to the player —
character descriptions, starting locations, item starting locations, relations, leads, or text
from a simpler already-fireable clue — would cause them to try this exact combination? If no
clear answer exists, the condition is wrong. Simplify it, move a character or item to a more
natural location, or add a lead that supplies the missing motivation. Every condition must be
reachable through logical inference, not trial and error.

CLUE RULES (enforced):
- Clue text must be self-contained. Never reference information the player may not yet have —
  do not mention what another character "said", "mentioned", or "told you" unless that character
  is in this clue's own condition. Each clue must read as a fresh observation with no assumed
  prior knowledge.
- No clue text may state, imply, or reason toward the answer to any checkpoint. This means no
  deductions, no interpretations, no phrases like "consistent with", "suggesting", "indicating",
  "which means", "pointing to", "ruling out", or "confirming." Present only raw observations:
  what the investigator saw, heard, touched, or was told. The player connects the dots. The clue never does.
  BAD (deduction): "The watch stopped at eleven-eighteen — consistent with the moment of a struggle."
  BAD (reasoning chain): "The tide table confirms the body could not have arrived earlier."
  BAD (conclusion): "The wound pattern rules out a fall."
  GOOD (raw observation): "The watch face is cracked. The hands are stopped at eleven-eighteen. The tide table on the wall shows the rock shelf is submerged from two hours before midnight until dawn."
  GOOD (raw observation): "The wound is a single oval depression at the back of the skull. The face and clothing show no other injury."
- If a clue condition does not include a character, do not name that character or connect physical
  evidence to them by name. BAD: "The initials D.F. place Domingos at the scene." GOOD: "The case is engraved D.F."
- Clue text should do double duty: present evidence AND imply where to look next.
- No two clues may share identical condition fields.
- If a clue involves a character saying, telling, or being overheard, the condition must include
  at least 2 characters (investigator + NPC, or two NPCs).
- If the investigator is NOT in the condition, the clue text must make clear how the information
  reached the investigation: "Word reached the investigator...", "[char:X] was heard telling [char:Y]..."
- If the investigator IS in the condition alongside another character, write direct witness:
  "[char:Name] tells the investigator...", "Asked directly, [char:Name] admits...", "Overhearing..."

### STEP 8 — LEADS
Generate exactly 3 leads. At least 2 should point toward a location the investigator can visit
on turn 1 to fire an early clue. Written as observations, not instructions. Use [char:Name] and
[loc:location_id] tags.

---

## HARD RULES

- The opening_narrative describes only the events leading to the investigator being summoned —
  who found the body, where, and that they fetched the investigator. No body description, no evidence.
- Wrap character names in [char:Name] and location names in [loc:location_id] tags throughout all
  prose: clue text, leads, opening_narrative, character descriptions.
- Wrap time references in [time:phrase] tags — e.g. [time:between ten and midnight].
- Every character id in any condition must exist in characters (except "investigator", always valid).
  Every item id must exist in items. Every location id must exist in locations.
- The correct answer for each checkpoint must appear in answer_options but must not be marked.
- Exactly one character must have isVictim: true.
- Do NOT include an "unlocked_by" field on clues.
- A character's starting_location is where they are when the body is discovered —
  this may differ from home_location.
- Any character described as meeting, greeting, or accompanying the investigator on arrival
  must have starting_location set to arrival_location.

---

## USER MESSAGE

Scenario seed: english-scone-cake-345
Use this seed as a creative starting point — let it influence the setting, atmosphere, and narrative texture.

Generate a complete Tidebound murder mystery scenario.
Difficulty: EASY

Return a JSON object matching this schema exactly:

{
  "village": {
    "name": string,
    "history": string (one paragraph — the specific texture of this place; what it was built on, what shapes behaviour here),
    "season": "spring" | "summer" | "autumn" | "winter",
    "weather": string (one short evocative phrase),
    "arrival_location": location_id (where the investigator arrives — must match a location id below)
  },

  "crime": {
    "cause_of_death": string (one of: "drowning", "poisoning — plant-based", "poisoning — compound",
      "blunt trauma", "strangulation", "exposure", "arson", "ritual act", "stabbing",
      "shooting", "decapitation", "torture", "throat cut"),
    "murder_location": location_id,
    "body_found_location": location_id,
    "body_was_moved": boolean,
    "time_of_death": string (human-readable window),
    "victim_state": string (must exactly match one of the victim_state checkpoint answer_options),
    "perpetrator_ids": [char_id],
    "motive": string (one of: "inheritance", "jealousy", "self-preservation", "revenge",
      "protection", "belief", "debt", "obsession"),
    "hidden_truth": null
  },

  "characters": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "isVictim": boolean,
      "local": boolean,
      "home_location": location_id,
      "starting_location": location_id,
      "description": string (2–3 sentences; victim: character sketch + investigator's first observation
        of the body — surface only, no cause of death; others: character sketch + their plausible motive)
    }
    // DO NOT include "investigator" — the engine adds him automatically.
    // Exactly 1 character must have isVictim: true.
  ],

  "items": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "description": string (one sentence — investigator's direct observation only),
      "starting_location": location_id
    }
  ],

  "locations": [
    { "id": location_id, "name": string, "flavour": string, "col": 0|1|2, "row": 0|1|2 }
    // 1–9 locations. One id must match village.arrival_location.
    // col/row place each location in a 3×3 grid. No two locations may share the same (col, row).
  ],

  "location_adjacencies": [
    { "from": location_id, "to": location_id }
    // 3–8 pairs. Locations connected by paths, shorelines, or sightlines. Visual only. Each pair once.
  ],

  "checkpoints": [
    {
      "id": "cause_of_death" | "true_location" | "time_of_death" | "perpetrator" | "motive",
      "label": string,
      "answer_options": [string] (4–6 options, correct one included but not marked)
    }
    // Always include: cause_of_death, true_location, time_of_death, perpetrator, motive (5 total).
    // Optionally include hidden_truth as a 6th investigative checkpoint when there is a meaningful
    // secondary mystery. If the scenario's truth is fully captured by the five standard checkpoints, omit it.
  ],

  "clues": [
    {
      "id": string (unique),
      "checkpoint": checkpoint_id,
      "answer": string (must exactly match an entry in that checkpoint's answer_options),
      "weight": "correct" | "red_herring",
      "condition": {
        "type": one of the 8 condition types below,
        "characters": [char_id],
        "location": location_id | null,
        "item": item_id | null
      },
      "text": string (1–3 sentences, [char:Name] and [loc:location_id] tags, answers + implies next step),
      "red_herring_explanation": string | null
    }
    // Per checkpoint: exactly 2 "correct" + 3 "red_herring".
    // The 3 red herrings must each point at a DIFFERENT wrong answer_option.
    // DO NOT include "unlocked_by".
  ],

  "relations": [
    { "from": char_id, "to": char_id, "label": string }
    // Publicly known relationships only: employment, family, open romantic interest, open enmity.
    // No secrets, debts, or crime-related knowledge. Label is short and directional.
  ],

  "leads": [
    {
      "id": string,
      "text": string (1–2 sentences, [char:Name] and [loc:location_id] tags, observation not instruction),
      "character_id": char_id | null,
      "location_id": location_id | null
    }
    // Exactly 3. At least 2 should point toward early-game clue conditions.
  ],

  "opening_narrative": string (2–3 paragraphs, [char:Name] and [loc:location_id] tags,
    events up to investigator being summoned only — no body description, no evidence)
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
  perpetrator, motive — locked until all investigative checkpoints are confirmed.
  DO NOT include unlocked_by on clues.
