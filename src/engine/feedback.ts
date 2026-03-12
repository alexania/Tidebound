// ─────────────────────────────────────────────
// TIDEBOUND — Feedback Strings
// Shown when an action yields no new clues.
// ─────────────────────────────────────────────

export type FeedbackKey =
  | 'inspect_location_empty'
  | 'inspect_location_locked'
  | 'inspect_location_missing'
  | 'talk_empty'
  | 'talk_locked'
  | 'ask_empty'
  | 'ask_locked'
  | 'inspect_item_empty'
  | 'inspect_item_locked'
  | 'inspect_item_missing'

export const FEEDBACK: Record<FeedbackKey, string> = {
  inspect_location_empty:   'There is nothing more to find here.',
  inspect_location_locked:  "Your instinct says there is more here — let's focus on the crime scene first.",
  inspect_location_missing: 'Something feels incomplete. Perhaps there is more with the right evidence.',
  talk_empty:               '{name} has nothing more to tell you.',
  talk_locked:              "{name} hesitates, then looks away. Perhaps after we've established the crime scene.",
  ask_empty:                '{name} looks at it, but says nothing useful.',
  ask_locked:               "{name} glances at it and falls quiet. We should come back after resolving the crime scene.",
  inspect_item_empty:       'The item reveals nothing new for now.',
  inspect_item_locked:      "There may be more to this — but first, the crime scene.",
  inspect_item_missing:     'This may be significant somewhere else.',
}

export function formatFeedback(template: string, vars: { name?: string } = {}): string {
  return template.replace('{name}', vars.name ?? 'They')
}
