import { useState, useRef, useEffect } from 'react'
import type { Scenario, LocationId, LocationAdjacency } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { parseTaggedText } from '../utils/parseTags'
import './VillageMap.css'

function getAdjacentLocs(
  fromLocId: LocationId,
  locations: Scenario['locations'],
  adjacencies: LocationAdjacency[]
): Set<LocationId> {
  if (adjacencies.length > 0) {
    const result = new Set<LocationId>()
    for (const adj of adjacencies) {
      if (adj.from === fromLocId) result.add(adj.to)
      if (adj.to === fromLocId) result.add(adj.from)
    }
    return result
  }
  // Fallback: orthogonal grid adjacency
  const locIndex = locations.findIndex(l => l.id === fromLocId)
  if (locIndex === -1) return new Set()
  const loc = locations[locIndex]
  const fromCol = loc.col ?? (locIndex % 3)
  const fromRow = loc.row ?? Math.floor(locIndex / 3)
  const result = new Set<LocationId>()
  for (let i = 0; i < locations.length; i++) {
    const other = locations[i]
    const otherCol = other.col ?? (i % 3)
    const otherRow = other.row ?? Math.floor(i / 3)
    if (Math.abs(otherCol - fromCol) + Math.abs(otherRow - fromRow) === 1) {
      result.add(other.id)
    }
  }
  return result
}

// 3×3 grid — positions for left/top in percent
const COL_X = [2, 30, 58]
const ROW_Y = [4, 36, 68]

const CELL_CX = 112
const CELL_CY = 60

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

type OpenMenu =
  | { type: 'location' }
  | { type: 'npc', charId: string }
  | null

interface Props {
  scenario: Scenario
  gameState: GameState
  onMove: (locationId: LocationId) => void
  onInspectLocation: () => void
  onInspectItem: (itemId: string) => void
  onTalk: (charId: string) => void
  onAsk: (charId: string, itemId: string) => void
}

export function VillageMap({
  scenario, gameState,
  onMove, onInspectLocation, onInspectItem, onTalk, onAsk,
}: Props) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>({ type: 'location' })

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

  // Reset to location menu on move
  useEffect(() => {
    setOpenMenu({ type: 'location' })
  }, [gameState.investigatorLocation])

  // Click outside NPC menu reverts to location menu
  useEffect(() => {
    const revert = (e: MouseEvent) => {
      const target = e.target as Element
      if (!target.closest('.map-context-menu') && !target.closest('.map-token--character')) {
        setOpenMenu({ type: 'location' })
      }
    }
    document.addEventListener('mousedown', revert)
    return () => document.removeEventListener('mousedown', revert)
  }, [])

  const currentLoc = gameState.investigatorLocation
  const adjacencies = scenario.location_adjacencies ?? []
  const adjacentLocs = getAdjacentLocs(currentLoc, scenario.locations, adjacencies)

  // Characters at each location (discovered)
  const charsByLocation = new Map<LocationId, typeof scenario.characters>()
  for (const char of scenario.characters) {
    if (!gameState.foundCharacterIds.includes(char.id)) continue
    if (!charsByLocation.has(char.location)) charsByLocation.set(char.location, [])
    charsByLocation.get(char.location)!.push(char)
  }

  // Visible items at a location: starting_location matches and location has been inspected
  function visibleItemsAt(locId: LocationId) {
    if (!gameState.inspectedLocationIds.includes(locId)) return []
    return scenario.items.filter(
      i => i.starting_location === locId && !gameState.inventory.includes(i.id)
    )
  }

  // Compute pixel center for adjacency SVG lines
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

  const inventoryItems = scenario.items.filter(i => gameState.inventory.includes(i.id))

  return (
    <div className="village-map" ref={mapRef}>
      {/* SVG adjacency lines */}
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
        const visible = visibleItemsAt(locId)
        const isCurrent = locId === currentLoc
        const isAdjacent = adjacentLocs.has(locId)
        const hasContextOpen = openMenu !== null && isCurrent

        const classes = [
          'map-location',
          isCurrent ? 'map-location--current' : '',
          isAdjacent ? 'map-location--adjacent' : '',
          hasContextOpen ? 'map-location--menu-open' : '',
        ].filter(Boolean).join(' ')

        return (
          <div
            key={locId}
            className={classes}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => {
              if (isCurrent) {
                setOpenMenu({ type: 'location' })
              } else if (isAdjacent) {
                setOpenMenu(null)
                onMove(locId)
              }
            }}
          >
            <div className="map-location__name">{label}</div>
            {annotation && <div className="map-location__annotation">{annotation}</div>}

            <div className="map-location__tokens">
              {isCurrent && (
                <div className="map-token map-token--investigator">
                  Investigator
                </div>
              )}
              {chars.map(char => (
                <div
                  key={char.id}
                  className={`map-token ${char.isVictim ? 'map-token--victim' : 'map-token--character'}`}
                  onClick={e => {
                    e.stopPropagation()
                    if (isCurrent && !char.isVictim) {
                      setOpenMenu(prev =>
                        prev?.type === 'npc' && prev.charId === char.id
                          ? { type: 'location' }
                          : { type: 'npc', charId: char.id }
                      )
                    }
                  }}
                >
                  {char.name.split(' ')[0]}
                </div>
              ))}
            </div>

            {/* Location context menu */}
            {isCurrent && openMenu?.type === 'location' && (
              <div className="map-context-menu" onClick={e => e.stopPropagation()}>
                <button onClick={() => { onInspectLocation(); setOpenMenu({ type: 'location' }) }}>
                  {gameState.inspectedLocationIds.includes(locId) ? 'Reinspect' : 'Inspect'}
                  {gameState.lockedActionKeys.includes(`inspect:${locId}`) && (
                    <span className="map-menu-locked">more later</span>
                  )}
                </button>
                {visible.map(item => (
                  <button key={item.id} onClick={() => { onInspectItem(item.id); setOpenMenu({ type: 'location' }) }}>
                    Take {parseTaggedText(`[item:${item.name}]`)}
                  </button>
                ))}
              </div>
            )}

            {/* NPC context menu */}
            {isCurrent && openMenu?.type === 'npc' && (() => {
              const char = scenario.characters.find(c => c.id === openMenu.charId)
              if (!char) return null
              return (
                <div className="map-context-menu" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { onTalk(char.id); setOpenMenu({ type: 'location' }) }}>
                    Talk to {char.name.split(' ')[0]}
                    {gameState.lockedActionKeys.includes(`talk:${char.id}`) && (
                      <span className="map-menu-locked">more later</span>
                    )}
                  </button>
                  {inventoryItems.map(item => (
                    <button key={item.id} onClick={() => { onAsk(char.id, item.id); setOpenMenu({ type: 'location' }) }}>
                      Ask about {parseTaggedText(`[item:${item.name}]`)}
                      {gameState.lockedActionKeys.includes(`ask:${char.id}:${item.id}`) && (
                        <span className="map-menu-locked">more later</span>
                      )}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
