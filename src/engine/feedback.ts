// ─────────────────────────────────────────────
// TIDEBOUND — Feedback Strings
// Shown when an action yields no new clues.
// ─────────────────────────────────────────────

export type FeedbackKey =
  | 'inspect_location_empty'
  | 'inspect_location_missing'
  | 'talk_empty'
  | 'ask_empty'
  | 'inspect_item_empty'
  | 'inspect_item_missing'

export const FEEDBACK: Record<FeedbackKey, string> = {
  inspect_location_empty:   'There is nothing more to find here.',
  inspect_location_missing: 'Something feels incomplete. Perhaps there is more with the right evidence.',
  talk_empty:               '{name} has nothing more to tell you.',
  ask_empty:                '{name} looks at it, but says nothing useful.',
  inspect_item_empty:       'The item reveals nothing new for now.',
  inspect_item_missing:     'This may be significant somewhere else.',
}

export function formatFeedback(template: string, vars: { name?: string } = {}): string {
  return template.replace('{name}', vars.name ?? 'They')
}
