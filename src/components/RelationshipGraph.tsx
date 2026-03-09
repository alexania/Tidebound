import type { Scenario } from '../types/scenario'
import type { GameState } from '../types/gameState'
import './RelationshipGraph.css'

interface Props {
  scenario: Scenario
  gameState: GameState
}

const SVG_W = 600
const SVG_H = 140
const NODE_Y = 100
const NODE_R = 14
const PAD = 50

export function RelationshipGraph({ scenario, gameState }: Props) {
  const knownChars = scenario.characters.filter(c =>
    gameState.foundCharacterIds.includes(c.id)
  )

  if (knownChars.length === 0) return null

  const knownIds = new Set(knownChars.map(c => c.id))
  const visibleRelations = (scenario.relations ?? []).filter(
    r => knownIds.has(r.from) && knownIds.has(r.to)
  )

  const nodeX: Record<string, number> = {}
  knownChars.forEach((char, i) => {
    const spread = SVG_W - PAD * 2
    nodeX[char.id] = knownChars.length === 1
      ? SVG_W / 2
      : PAD + (i / (knownChars.length - 1)) * spread
  })

  return (
    <div className="relationship-graph">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="relationship-graph__svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {visibleRelations.map((rel, i) => {
          const x1 = nodeX[rel.from]
          const x2 = nodeX[rel.to]
          if (x1 === undefined || x2 === undefined) return null
          const mx = (x1 + x2) / 2
          const arcHeight = 30 + Math.abs(x2 - x1) * 0.12
          const cy = NODE_Y - arcHeight
          const path = `M ${x1} ${NODE_Y} Q ${mx} ${cy} ${x2} ${NODE_Y}`
          return (
            <g key={i}>
              <path d={path} className="rg-edge" />
              <text x={mx} y={Math.max(cy - 4, 8)} textAnchor="middle" className="rg-edge__label">
                {rel.label}
              </text>
            </g>
          )
        })}

        {knownChars.map(char => {
          const x = nodeX[char.id]
          const firstName = char.name.split(' ')[0]
          return (
            <g key={char.id}>
              <circle
                cx={x} cy={NODE_Y} r={NODE_R}
                className={`rg-node ${char.isVictim ? 'rg-node--victim' : ''}`}
              />
              <text x={x} y={NODE_Y + 4} textAnchor="middle" className="rg-node__name">
                {firstName}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
