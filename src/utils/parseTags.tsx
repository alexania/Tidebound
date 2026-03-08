import React from 'react'

const LOCATION_NAMES: Record<string, string> = {
  harbour:      'Harbour',
  tavern:       'Tavern',
  lighthouse:   'Lighthouse',
  chapel:       'Chapel',
  doctors_house: "Doctor's House",
  manor:        'Manor',
  cottage_row:  'Cottage Row',
  cliffs:       'Cliffs',
  forest_edge:  'Forest Edge',
}

// Parses [char:Name], [loc:location_id], [item:Name] → styled spans
// Returns an array of strings and React elements.
export function parseTaggedText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\[(char|loc|item):([^\]]+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const [, type, value] = match
    if (type === 'char') {
      parts.push(<span key={key++} className="tag-char">{value}</span>)
    } else if (type === 'item') {
      parts.push(<span key={key++} className="tag-item">{value}</span>)
    } else {
      parts.push(<span key={key++} className="tag-loc">{LOCATION_NAMES[value] ?? value}</span>)
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}
