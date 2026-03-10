import type { GameState } from '../types/gameState'
import './ActionBar.css'

interface Props {
  gameState: GameState
  scenario: unknown
  onEndTurn: () => void
  onToggleBoard: () => void
  showBoard: boolean
}

export function ActionBar({ gameState, scenario, onEndTurn, onToggleBoard, showBoard }: Props) {
  const { actionsRemaining } = gameState

  return (
    <div className="action-bar">
      <div className="action-bar__pips">
        <div className={`action-bar__pip ${actionsRemaining > 0 ? 'action-bar__pip--full' : ''}`} />
      </div>
      <span className="action-bar__label">item move</span>

      <div className="action-bar__spacer" />

      <button
        title="Copy debug state to clipboard"
        onClick={() => navigator.clipboard.writeText(JSON.stringify({ gameState, scenario }, null, 2))}
      >
        Debug
      </button>

      <button onClick={onToggleBoard} style={{ borderColor: showBoard ? 'var(--color-accent)' : undefined }}>
        Evidence Board
      </button>

      <button className="action-bar__primary" onClick={onEndTurn}>
        End Turn
      </button>
    </div>
  )
}
