import { useState, useRef, useEffect } from 'react'
import type { Scenario, LocationId } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { INVESTIGATOR_ID } from '../engine/gameEngine'
import './VillageMap.css'

// 3×3 grid — positions for left/top in percent
const COL_X = [4, 37, 70]
const ROW_Y = [4, 36, 68]

// Approximate cell center offsets (px) from top-left of cell
const CELL_CX = 75  // half of 150px width
const CELL_CY = 40  // approx midpoint of cell vertically

function formatLocationId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getLocationAnnotation(
  locId: string,
  scenario: Scenario,
  gameState: GameState
): string | null {
  const victim = scenario.characters.find(c => c.isVictim)
  const trueLocationConfirmed = gameState.checkpoints['true_location']?.status === 'confirmed'

  if (locId === scenario.crime.body_found_location) return 'Body found here'
  if (locId === scenario.crime.murder_location && trueLocationConfirmed) return 'Crime scene'
  if (victim && locId === victim.location) return "Victim's home"
  return null
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
  const inSetup = gameState.phase === 'setup'
  const canMoveItem = inSetup && gameState.actionsRemaining > 0

  const mapRef = useRef<HTMLDivElement>(null)
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setMapSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleDragStart = (e: React.DragEvent, type: 'character' | 'item', id: string) => {
    if (type === 'item' && !canMoveItem) { e.preventDefault(); return }
    if (type === 'character' && !inSetup) { e.preventDefault(); return }
    e.dataTransfer.setData('type', type)
    e.dataTransfer.setData('id', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, locationId: LocationId) => {
    if (!inSetup) return
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
    if (type === 'character' && id === INVESTIGATOR_ID) onMoveCharacter(id, locationId)
    else if (type === 'item' && canMoveItem) onMoveItem(id, locationId)
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

  // Compute pixel center for a location's grid cell
  const locationById = new Map(scenario.locations.map((l, i) => [l.id, { loc: l, index: i }]))
  function cellCenter(locId: string): { x: number, y: number } | null {
    const entry = locationById.get(locId)
    if (!entry || mapSize.w === 0) return null
    const col = entry.loc.col ?? (entry.index % 3)
    const row = entry.loc.row ?? Math.floor(entry.index / 3)
    return {
      x: mapSize.w * COL_X[col] / 100 + CELL_CX,
      y: mapSize.h * ROW_Y[row] / 100 + CELL_CY,
    }
  }

  const adjacencies = scenario.location_adjacencies ?? []

  return (
    <div className="village-map" ref={mapRef}>
      {/* SVG adjacency lines — rendered behind the location cards */}
      {mapSize.w > 0 && adjacencies.length > 0 && (
        <svg
          className="village-map__adjacency"
          width={mapSize.w}
          height={mapSize.h}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {adjacencies.map((adj, i) => {
            const a = cellCenter(adj.from)
            const b = cellCenter(adj.to)
            if (!a || !b) return null
            return (
              <line
                key={i}
                x1={a.x} y1={a.y}
                x2={b.x} y2={b.y}
                className="village-map__adj-line"
              />
            )
          })}
        </svg>
      )}

      {scenario.locations.map((loc, index) => {
        const col = loc.col ?? (index % 3)
        const row = loc.row ?? Math.floor(index / 3)
        const x = COL_X[col]
        const y = ROW_Y[row]
        const locId = loc.id
        const label = loc.name ?? formatLocationId(locId)
        const annotation = getLocationAnnotation(locId, scenario, gameState)
        const chars = charsByLocation.get(locId) ?? []
        const items = itemsByLocation.get(locId) ?? []
        const isDragOver = dragOver === locId

        return (
          <div
            key={locId}
            className={`map-location ${isDragOver ? 'map-location--drag-over' : ''} ${!inSetup ? 'map-location--disabled' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            onDragOver={e => handleDragOver(e, locId)}
            onDrop={e => handleDrop(e, locId)}
            onDragLeave={handleDragLeave}
            onClick={() => onSelect(`loc:${locId}`)}
          >
            <div className="map-location__name">{label}</div>
            {annotation && <div className="map-location__annotation">{annotation}</div>}
            <div className="map-location__tokens">
              {gameState.board.characterLocations[INVESTIGATOR_ID] === locId && (
                <div
                  className="map-token map-token--investigator"
                  draggable={inSetup}
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
                  draggable={false}
                  onClick={e => { e.stopPropagation(); onSelect(`char:${char.id}`) }}
                >
                  {char.name.split(' ')[0]}
                </div>
              ))}
              {items.map(item => (
                <div
                  key={item.id}
                  className="map-token map-token--item"
                  draggable={canMoveItem}
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
