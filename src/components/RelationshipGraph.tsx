import { useMemo } from 'react'
import type { Scenario } from '../types/scenario'
import type { GameState } from '../types/gameState'
import './RelationshipGraph.css'

interface Props {
  scenario: Scenario
  gameState: GameState
}

const NODE_R = 16
const W = 800
const H = 260

function simulate(
  nodeIds: string[],
  edges: { from: string; to: string }[]
): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number; vx: number; vy: number }> = {}

  nodeIds.forEach((id, i) => {
    const angle = (i / nodeIds.length) * Math.PI * 2
    pos[id] = {
      x: W / 2 + Math.cos(angle) * W * 0.28,
      y: H / 2 + Math.sin(angle) * H * 0.28,
      vx: 0,
      vy: 0,
    }
  })

  const REPULSION = 8000
  const SPRING_REST = 180
  const SPRING_K = 0.04
  const CENTER_K = 0.008
  const DAMPING = 0.85

  for (let tick = 0; tick < 400; tick++) {
    for (const id of nodeIds) {
      pos[id].vx *= DAMPING
      pos[id].vy *= DAMPING
    }

    // Repulsion between all pairs
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = pos[nodeIds[i]]
        const b = pos[nodeIds[j]]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy || 1
        const d = Math.sqrt(d2)
        const f = REPULSION / d2
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx -= fx; a.vy -= fy
        b.vx += fx; b.vy += fy
      }
    }

    // Spring attraction along edges
    for (const e of edges) {
      const a = pos[e.from]
      const b = pos[e.to]
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = SPRING_K * (d - SPRING_REST)
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    // Centering
    for (const id of nodeIds) {
      pos[id].vx += (W / 2 - pos[id].x) * CENTER_K
      pos[id].vy += (H / 2 - pos[id].y) * CENTER_K
    }

    // Integrate + boundary
    for (const id of nodeIds) {
      pos[id].x = Math.max(NODE_R + 6, Math.min(W - NODE_R - 6, pos[id].x + pos[id].vx))
      pos[id].y = Math.max(NODE_R + 6, Math.min(H - NODE_R - 6, pos[id].y + pos[id].vy))
    }
  }

  return Object.fromEntries(nodeIds.map(id => [id, { x: pos[id].x, y: pos[id].y }]))
}

export function RelationshipGraph({ scenario, gameState }: Props) {
  const knownChars = scenario.characters.filter(c =>
    gameState.foundCharacterIds.includes(c.id)
  )

  if (knownChars.length === 0) return null

  const knownIds = new Set(knownChars.map(c => c.id))
  const visibleRelations = (scenario.relations ?? []).filter(
    r => knownIds.has(r.from) && knownIds.has(r.to)
  )

  // Re-run simulation whenever the set of known characters changes
  const positions = useMemo(
    () => simulate(knownChars.map(c => c.id), visibleRelations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [knownChars.map(c => c.id).join(',')]
  )

  // Count edges per canonical pair so we can offset parallel edges
  const pairCount: Record<string, number> = {}
  const pairIndex: number[] = visibleRelations.map(rel => {
    const key = [rel.from, rel.to].sort().join('|')
    pairCount[key] = (pairCount[key] ?? 0) + 1
    return pairCount[key] - 1
  })

  return (
    <div className="relationship-graph">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="relationship-graph__svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {visibleRelations.map((rel, i) => {
          const a = positions[rel.from]
          const b = positions[rel.to]
          if (!a || !b) return null

          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.sqrt(dx * dx + dy * dy) || 1

          // Perpendicular unit vector
          const px = -dy / len
          const py = dx / len

          // For parallel edges between the same pair, alternate the offset direction
          const idx = pairIndex[i]
          const offsetDir = idx % 2 === 0 ? 1 : -1
          const offsetAmt = idx === 0 ? 0 : 16 * offsetDir

          const mx = (a.x + b.x) / 2 + px * offsetAmt
          const my = (a.y + b.y) / 2 + py * offsetAmt

          // Curved path when offset, straight when not
          const path = offsetAmt !== 0
            ? `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
            : `M ${a.x} ${a.y} L ${b.x} ${b.y}`

          const labelX = mx + px * 14
          const labelY = my + py * 14

          return (
            <g key={i}>
              <path d={path} className="rg-edge" />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="rg-edge__label"
              >
                {rel.label}
              </text>
            </g>
          )
        })}

        {knownChars.map(char => {
          const p = positions[char.id]
          if (!p) return null
          const firstName = char.name.split(' ')[0]
          return (
            <g key={char.id}>
              <circle
                cx={p.x} cy={p.y} r={NODE_R}
                className={`rg-node ${char.isVictim ? 'rg-node--victim' : ''}`}
              />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="rg-node__name">
                {firstName}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
