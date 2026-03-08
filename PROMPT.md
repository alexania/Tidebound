# Tidebound — Manual Scenario Generation Prompt

Paste the SYSTEM PROMPT block into Claude's system prompt field (if using the API console),
or paste both blocks together into the chat if using Claude.ai directly.

---

## SYSTEM PROMPT

You are generating a complete murder mystery scenario for a single-player deduction game set in a remote coastal village with folk horror undertones. The game world has three permanent background elements that should flavour all generated content:

1. An old religion — pre-Christian, pre-memory. The founding families either brought it with them or found it waiting. It is not discussed openly but it shapes behaviour.
2. A founding event — something happened here long ago that the village was built on top of. It is not forgotten. It surfaces in how people speak and what they avoid.
3. The lighthouse — it stands on the headland and its keeper has seen things. What it signals toward has never been named.

Tone: matter-of-fact, restrained, eerie without being explicit. Folk horror. Violence and sexuality are not sanitised but not gratuitous. The supernatural is real but never confirmed — it lives in implication and in the corners of mundane descriptions.

You must return ONLY a valid JSON object. No preamble, no explanation, no markdown fences. Raw JSON only.

THE INVESTIGATOR:
Every scenario includes a special character with id "investigator" who is an official investigator brought in from outside — his presence is why people are talking at all. He is not named and not described in the scenario JSON; the engine adds him automatically. He always starts at the harbour. You may and should use "investigator" as a character id in clue conditions. Roughly half of all clue conditions should involve the investigator — these represent him actively examining evidence, inspecting items, or being present when someone reveals something. The other half involve specific village characters, for clues that surface through relationships, confessions, or behaviour the investigator merely observes. Do not include the investigator in the characters array.

AVOIDING DEFAULTS — READ CAREFULLY:
Before generating anything, identify what the most predictable version of this scenario would look like — the obvious discovery location, the obvious weather, the obvious person who finds the body, the obvious opening image. Then do something else.

HARD RULES:
- No clue text may directly name the perpetrator or directly state the cause of death. Clues imply, witness, contradict, and suggest.
- The opening_narrative describes only the events leading to the investigator being summoned — who found the body, where, and that they fetched the investigator. It must not describe the state of the body, the crime scene, or any evidence. The investigation has not started yet.
- Wrap character names in [char:Name] and location names in [loc:location_id] tags throughout all generated prose including clue text, leads, and opening_narrative. Example: "[char:Maren Coll] was found at the [loc:harbour]".
- Every character id referenced in any condition must exist in the characters array, with the exception of "investigator" which is always valid. Every item id must exist in items. Every location id must exist in locations.
- The correct answer for each checkpoint must appear in answer_options but must not be marked or flagged.
- Red herring clues must point at a wrong answer_option and must have a red_herring_explanation.
- Exactly one character must have isVictim: true. All others have isVictim: false.
- All nine location ids must be present: harbour, tavern, lighthouse, chapel, doctors_house, manor, cottage_row, cliffs, forest_edge.
- Every item must be referenced in at least one clue condition. No orphan items.
- A character's starting_location is where they are when the body is discovered — this may differ from their home_location where they live.
- Clue text should do double duty: answer something AND imply where to look next. Give the player momentum.
- Item descriptions are shown to the player when they first discover an item — treat the description as the investigator's initial inspection. It should contain only what can be directly observed: appearance, condition, smell, markings. Clues that involve an item go further: they require an additional condition (another character present, a specific location) and reveal what the item implies — who handled it, what it connects to, what it contradicts.
- Do NOT include an "unlocked_by" field on clues. All clues are available from turn 1.
- No two clues may share identical condition fields. Every clue must fire in a genuinely distinct situation.
- If a clue involves a character saying, telling, reporting, or being overheard, the condition must include at least 2 characters — either the investigator plus an NPC (direct conversation or testimony), or two NPCs (rumour mill: one overheard by or reported to the other).
- If the investigator is not in the condition, the clue text must make clear how this information reached the investigation: "Word reached the investigator that...", "[char:X] was heard telling [char:Y]...", or similar — not floating omniscient narration.
- When a clue condition includes another character alongside the investigator, the clue text must read as direct witness: "[char:Pell Drach] tells the investigator...", "Asked directly, [char:Elen Voss] admits...", "Overhearing [char:X]..." — not omniscient narration.

---

## USER MESSAGE

Scenario seed: bitter-lantern-tide-347
Use this seed as a creative starting point — let it influence the atmosphere, setting details, and narrative texture of what you generate.

Generate a complete Tidebound murder mystery scenario.
Difficulty: EASY

Clue counts per checkpoint (strictly enforced):
1 hard clue + 2 soft clues + 1 red herring per checkpoint

Return a JSON object matching this schema exactly:

{
  "village": {
    "name": string,
    "history": string (one paragraph — weaves in old religion, founding event, lighthouse without explaining them),
    "season": "spring" | "summer" | "autumn" | "winter",
    "weather": string (one short evocative phrase)
  },

  "crime": {
    "cause_of_death": string (one of: "drowning", "poisoning — plant-based", "poisoning — compound", "blunt trauma", "strangulation", "exposure", "arson", "ritual act", "stabbing", "shooting", "decapitation", "torture", "throat cut"),
    "murder_location": location_id,
    "body_found_location": location_id,
    "body_was_moved": boolean,
    "time_of_death": string (human-readable window, e.g. "between ten and midnight"),
    "perpetrator_ids": [char_id],
    "motive": string (one of: "inheritance", "jealousy", "self-preservation", "revenge", "protection", "belief", "debt", "obsession"),
    "hidden_truth": null
  },

  "characters": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "isVictim": boolean (true for exactly one character — the murder victim; false for all others),
      "local": boolean,
      "home_location": location_id (where this character lives),
      "starting_location": location_id (where this character IS when the body is discovered),
      "description": string (2-3 sentences; for the victim, lead with a brief character description — who this person was — then add the investigator's first inspection of the body: surface observations only, position, visible injuries, clothing, immediate surroundings, no cause of death stated; for all other characters, a brief character description only)
    }
    // DO NOT include an "investigator" entry — the engine adds this automatically.
    // Exactly 1 character must have isVictim: true. Do NOT include an "investigator" entry — the engine adds this automatically.
  ],

  "items": [
    {
      "id": string (unique, snake_case),
      "name": string,
      "description": string (one atmospheric sentence),
      "starting_location": location_id
    }
  ],

  "locations": [
    { "id": location_id, "flavour": string }
    // All nine ids must be present: harbour, tavern, lighthouse, chapel, doctors_house, manor, cottage_row, cliffs, forest_edge
  ],

  "checkpoints": [
    {
      "id": "cause_of_death" | "true_location" | "time_of_death" | "last_seen" | "victim_state" | "perpetrator" | "motive",
      "label": string,
      "answer_options": [string] (4-6 options, correct one included but not marked)
    }
    // Include all 7. Do NOT include "hidden_truth" for easy difficulty.
  ],

  "clues": [
    {
      "id": string (unique),
      "checkpoint": checkpoint_id,
      "answer": string (must exactly match an entry in that checkpoint's answer_options),
      "weight": "hard" | "soft" | "red_herring" | "contradiction",
      "condition": {
        "type": one of the 8 condition types below,
        "characters": [char_id] (use "investigator" for ~50% of clue conditions — these fire when the investigator is present),
        "location": location_id | null,
        "item": item_id | null
      },
      "text": string (1-3 sentences, use [char:Name] and [loc:location_id] tags, answers something AND implies where to look next),
      "red_herring_explanation": string | null
    }
    // DO NOT include an "unlocked_by" field. All clues available from turn 1.
    // Per checkpoint: 1 hard + 2 soft + 1 red_herring
  ],

  "leads": [
    {
      "id": string,
      "text": string (1-2 sentences, use [char:Name] and [loc:location_id] tags — written as an observation, not an instruction),
      "character_id": char_id | null,
      "location_id": location_id | null
    }
    // Generate exactly 3 leads. At least 2 should point toward conditions that involve the investigator
    // visiting a specific location. Each lead should correspond to a real clue condition that can fire
    // early in the game.
  ],

  "opening_narrative": string (2-3 paragraphs, use [char:Name] and [loc:location_id] tags)
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

CHECKPOINT STRUCTURE:
  The five investigative checkpoints (cause_of_death, true_location, time_of_death, last_seen, victim_state)
  are ALL available from turn 1. The accusation checkpoints (perpetrator, motive) are locked
  until all five investigative checkpoints are confirmed. DO NOT include unlocked_by on clues.

---

## What to check in the output

Before loading this into the game, scan the generated JSON for these:

1. **Investigator in conditions** — roughly half of all `"condition"` objects should have `"investigator"` in the `characters` array. If it's fewer than a third, the mechanic won't have enough pull.
2. **Leads match real conditions** — each lead should correspond to a clue condition that can actually fire in the first few turns. If a lead points at a location but no clue has a condition for the investigator at that location, the lead is misleading.
3. **No auto-fire on turn 1** — check if any clue conditions are satisfied by the opening board state (characters at their starting_locations, investigator at harbour). These would fire without the player doing anything. A few is fine; many is a problem.
4. **Clue counts** — each of the 7 checkpoints should have exactly 4 clues (1 hard + 2 soft + 1 red_herring).
5. **Answer cross-check** — pick one checkpoint and verify the `answer` on each clue matches a string in that checkpoint's `answer_options`.
