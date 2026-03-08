import { useState } from 'react'
import type { Scenario, LocationId } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { INVESTIGATOR_ID } from '../engine/gameEngine'
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
  onSelect: (sel: string | null) => void
}

export function VillageMap({ scenario, gameState, onMoveCharacter, onMoveItem, onSelect }: Props) {
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

  // Build lookup: location -> found characters there
  const charsByLocation = new Map<LocationId, typeof scenario.characters>()
  for (const char of scenario.characters) {
    if (!gameState.foundCharacterIds.includes(char.id)) continue
    const loc = gameState.board.characterLocations[char.id] as LocationId
    if (!charsByLocation.has(loc)) charsByLocation.set(loc, [])
    charsByLocation.get(loc)!.push(char)
  }

  // Build lookup: location -> found items there
  const itemsByLocation = new Map<LocationId, typeof scenario.items>()
  for (const item of scenario.items) {
    if (!gameState.foundItemIds.includes(item.id)) continue
    const loc = gameState.board.itemLocations[item.id] as LocationId
    if (!itemsByLocation.has(loc)) itemsByLocation.set(loc, [])
    itemsByLocation.get(loc)!.push(item)
  }

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
            onClick={() => onSelect(`loc:${locId}`)}
          >
            <div className="map-location__name">{LOCATION_LABELS[locId]}</div>
            <div className="map-location__tokens">
              {gameState.board.characterLocations[INVESTIGATOR_ID] === locId && (
                <div
                  className="map-token map-token--investigator"
                  draggable={canAct}
                  onDragStart={e => handleDragStart(e, 'character', INVESTIGATOR_ID)}
                  onClick={e => { e.stopPropagation(); onSelect(`char:${INVESTIGATOR_ID}`) }}
                >
                  Investigator
                </div>
              )}
              {chars.map(char => (
                <div
                  key={char.id}
                  className={`map-token ${char.isVictim ? 'map-token--victim' : 'map-token--character'}`}
                  draggable={!char.isVictim && canAct}
                  onDragStart={e => !char.isVictim && handleDragStart(e, 'character', char.id)}
                  onClick={e => { e.stopPropagation(); onSelect(`char:${char.id}`) }}
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
                  onClick={e => { e.stopPropagation(); onSelect(`item:${item.id}`) }}
                >
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
