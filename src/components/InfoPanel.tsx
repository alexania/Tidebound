import type { Scenario } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { parseTaggedText, buildLocationNames } from '../utils/parseTags'
import './InfoPanel.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onSelect: (sel: string | null) => void
}

export function InfoPanel({ scenario, gameState, onSelect }: Props) {
  const { selected } = gameState
  const locationNames = buildLocationNames(scenario.locations)

  if (!selected) {
    return (
      <div className="info-panel">
        <div className="info-panel__empty">Click a character or location for details.</div>
      </div>
    )
  }

  const colonIdx = selected.indexOf(':')
  const type = selected.slice(0, colonIdx)
  const id = selected.slice(colonIdx + 1)

  if (type === 'char') {
    const char = scenario.characters.find(c => c.id === id)
    if (!char) return null
    const locName = locationNames[char.location] ?? char.location
    return (
      <div className="info-panel" onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
        <div className="info-panel__col">
          <div className="info-panel__name">{char.name}</div>
          <div className="info-panel__meta">
            {char.isVictim ? 'victim · ' : ''}{char.local ? 'local' : 'outsider'} · at {locName}
          </div>
          <div className="info-panel__desc">{parseTaggedText(char.description, locationNames)}</div>
        </div>
      </div>
    )
  }

  if (type === 'item') {
    const item = scenario.items.find(i => i.id === id)
    if (!item) return null
    const inInventory = gameState.inventory.includes(item.id)
    const locName = locationNames[item.starting_location] ?? item.starting_location
    return (
      <div className="info-panel" onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
        <div className="info-panel__col">
          <div className="info-panel__name">{item.name}</div>
          <div className="info-panel__meta">
            {inInventory ? 'carrying' : `at ${locName}`}
          </div>
          <div className="info-panel__desc">{parseTaggedText(item.description, locationNames)}</div>
        </div>
      </div>
    )
  }

  if (type === 'loc') {
    const loc = scenario.locations.find(l => l.id === id)
    if (!loc) return null
    const chars = scenario.characters.filter(c => gameState.foundCharacterIds.includes(c.id) && c.location === id)
    const items = scenario.items.filter(i => gameState.foundItemIds.includes(i.id) && i.starting_location === id)
    const occupants = [
      ...chars.map(c => c.name),
      ...items.map(i => i.name),
    ]
    return (
      <div className="info-panel" onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
        <div className="info-panel__col">
          <div className="info-panel__name">{locationNames[id] ?? id}</div>
          <div className="info-panel__meta">
            {occupants.length ? occupants.join(' · ') : 'empty'}
          </div>
          <div className="info-panel__desc">{parseTaggedText(loc.flavour, locationNames)}</div>
        </div>
      </div>
    )
  }

  return null
}
