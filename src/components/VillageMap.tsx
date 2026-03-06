import { useState } from 'react'
import type { Scenario, LocationId } from '../types/scenario'
import type { GameState } from '../types/gameState'
import './VillageMap.css'

// Percentage-based positions within the map container
const LOCATION_LAYOUT: Record<LocationId, { x: number; y: number }> = {
  lighthouse:    { x: 4,  y: 4  },
  cliffs:        { x: 37, y: 4  },
  manor:         { x: 70, y: 4  },
  chapel:        { x: 4,  y: 36 },
  tavern:        { x: 37, y: 36 },
  cottage_row:   { x: 70, y: 36 },
  harbour:       { x: 4,  y: 68 },
  doctors_house: { x: 37, y: 68 },
  forest_edge:   { x: 70, y: 68 },
}

const LOCATION_LABELS: Record<LocationId, string> = {
  lighthouse:    'Lighthouse',
  cliffs:        'Cliffs',
  manor:         'Manor',
  chapel:        'Chapel',
  tavern:        'Tavern',
  cottage_row:   'Cottage Row',
  harbour:       'Harbour',
  doctors_house: "Doctor's House",
  forest_edge:   'Forest Edge',
}

interface Props {
  scenario: Scenario
  gameState: GameState
  onMoveCharacter: (charId: string, location: LocationId) => void
  onMoveItem: (itemId: string, location: LocationId) => void
}

export function VillageMap({ scenario, gameState, onMoveCharacter, onMoveItem }: Props) {
  const [dragOver, setDragOver] = useState<LocationId | null>(null)
  const canAct = gameState.phase === 'setup' && gameState.actionsRemaining > 0

  const handleDragStart = (e: React.DragEvent, type: 'character' | 'item', id: string) => {
    if (!canAct) { e.preventDefault(); return }
    e.dataTransfer.setData('type', type)
    e.dataTransfer.setData('id', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, locationId: LocationId) => {
    if (!canAct) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(locationId)
  }

  const handleDrop = (e: React.DragEvent, locationId: LocationId) => {
    e.preventDefault()
    setDragOver(null)
    const type = e.dataTransfer.getData('type')
    const id = e.dataTransfer.getData('id')
    if (!id) return
    if (type === 'character') onMoveCharacter(id, locationId)
    else if (type === 'item') onMoveItem(id, locationId)
  }

  const handleDragLeave = () => setDragOver(null)

  // Build lookup: location -> characters there
  const charsByLocation = new Map<LocationId, typeof scenario.characters>()
  for (const char of scenario.characters) {
    const loc = gameState.board.characterLocations[char.id] as LocationId
    if (!charsByLocation.has(loc)) charsByLocation.set(loc, [])
    charsByLocation.get(loc)!.push(char)
  }

  // Build lookup: location -> discovered items there
  const itemsByLocation = new Map<LocationId, typeof scenario.items>()
  for (const item of scenario.items) {
    const loc = gameState.board.itemLocations[item.id] as LocationId
    if (!loc) continue
    if (!gameState.discoveredItemIds.includes(item.id)) continue
    if (!itemsByLocation.has(loc)) itemsByLocation.set(loc, [])
    itemsByLocation.get(loc)!.push(item)
  }

  const locationFlavour = new Map(scenario.locations.map(l => [l.id, l.flavour]))

  return (
    <div className="village-map">
      {(Object.keys(LOCATION_LAYOUT) as LocationId[]).map(locId => {
        const { x, y } = LOCATION_LAYOUT[locId]
        const chars = charsByLocation.get(locId) ?? []
        const items = itemsByLocation.get(locId) ?? []
        const isDragOver = dragOver === locId

        return (
          <div
            key={locId}
            className={`map-location ${isDragOver ? 'map-location--drag-over' : ''} ${!canAct ? 'map-location--disabled' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            onDragOver={e => handleDragOver(e, locId)}
            onDrop={e => handleDrop(e, locId)}
            onDragLeave={handleDragLeave}
          >
            <div className="map-location__name">{LOCATION_LABELS[locId]}</div>
            <div className="map-location__tokens">
              {chars.map(char => (
                <div
                  key={char.id}
                  className={`map-token ${char.role === 'victim' ? 'map-token--victim' : 'map-token--character'}`}
                  draggable={char.role !== 'victim' && canAct}
                  onDragStart={e => char.role !== 'victim' && handleDragStart(e, 'character', char.id)}
                  title={`${char.name} — ${char.description}`}
                >
                  {char.name.split(' ')[0]}
                </div>
              ))}
              {items.map(item => (
                <div
                  key={item.id}
                  className="map-token map-token--item"
                  draggable={canAct}
                  onDragStart={e => handleDragStart(e, 'item', item.id)}
                  title={item.description}
                >
                  {item.name}
                </div>
              ))}
            </div>
            <div className="map-location__flavour">{locationFlavour.get(locId)}</div>
          </div>
        )
      })}
    </div>
  )
}
