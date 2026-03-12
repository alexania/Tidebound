import type { GameState } from '../types/gameState'
import './ActionBar.css'

interface Props {
  gameState: GameState
  scenario: unknown
  onToggleBoard: () => void
  showBoard: boolean
}

export function ActionBar({ gameState, scenario, onToggleBoard, showBoard }: Props) {
  return (
    <div className="action-bar">
      <span className="action-bar__label">Action {gameState.actionCount}</span>

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
    </div>
  )
}
