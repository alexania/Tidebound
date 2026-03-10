import type { Scenario } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { parseTaggedText, buildLocationNames } from '../utils/parseTags'
import { INVESTIGATOR_ID } from '../engine/gameEngine'
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
        <div className="info-panel__empty">Click a character, item, or location for details.</div>
      </div>
    )
  }

  const colonIdx = selected.indexOf(':')
  const type = selected.slice(0, colonIdx)
  const id = selected.slice(colonIdx + 1)

  if (type === 'char' && id === INVESTIGATOR_ID) {
    const loc = gameState.board.characterLocations[INVESTIGATOR_ID]
    return (
      <div className="info-panel" onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
        <div className="info-panel__col">
          <div className="info-panel__name">Investigator</div>
          <div className="info-panel__meta">you · at {loc ? (locationNames[loc] ?? loc) : ''}</div>
          <div className="info-panel__desc">Move to locations to surface clues. Your presence satisfies conditions just as any other character's would.</div>
        </div>
      </div>
    )
  }

  if (type === 'char') {
    const char = scenario.characters.find(c => c.id === id)
    if (!char) return null
    const loc = gameState.board.characterLocations[char.id]
    return (
      <div className="info-panel" onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
        <div className="info-panel__col">
          <div className="info-panel__name">{char.name}</div>
          <div className="info-panel__meta">
            {char.isVictim ? 'victim · ' : ''}{char.local ? 'local' : 'outsider'} · at {loc ? (locationNames[loc] ?? loc) : ''}
          </div>
          <div className="info-panel__desc">{parseTaggedText(char.description, locationNames)}</div>
        </div>
      </div>
    )
  }

  if (type === 'item') {
    const item = scenario.items.find(i => i.id === id)
    if (!item) return null
    const loc = gameState.board.itemLocations[item.id]
    const found = gameState.foundItemIds.includes(item.id)
    return (
      <div className="info-panel" onClick={() => onSelect(null)} style={{ cursor: 'pointer' }}>
        <div className="info-panel__col">
          <div className="info-panel__name">{item.name}</div>
          <div className="info-panel__meta">
            {found ? `at ${locationNames[loc] ?? loc}` : 'not yet found'}
          </div>
          <div className="info-panel__desc">{parseTaggedText(item.description, locationNames)}</div>
        </div>
      </div>
    )
  }

  if (type === 'loc') {
    const loc = scenario.locations.find(l => l.id === id)
    if (!loc) return null
    const chars = scenario.characters.filter(
      c => gameState.board.characterLocations[c.id] === id
    )
    const items = scenario.items.filter(
      i => gameState.foundItemIds.includes(i.id) && gameState.board.itemLocations[i.id] === id
    )
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
