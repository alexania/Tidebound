import React from 'react'

function formatLocationId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function buildLocationNames(locations: { id: string; name?: string }[]): Record<string, string> {
  return Object.fromEntries(locations.map(l => [l.id, l.name ?? formatLocationId(l.id)]))
}

// Parses [char:Name], [loc:location_id], [item:Name], [time:...] → styled spans
// Returns an array of strings and React elements.
export function parseTaggedText(text: string, locationNames?: Record<string, string>): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\[(char|loc|item|time):([^\]]+)\]/g
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
    } else if (type === 'time') {
      parts.push(<span key={key++} className="tag-time">{value}</span>)
    } else {
      const label = locationNames?.[value] ?? formatLocationId(value)
      parts.push(<span key={key++} className="tag-loc">{label}</span>)
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}
