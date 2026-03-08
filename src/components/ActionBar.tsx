import type { GameState } from '../types/gameState'
import './ActionBar.css'

interface Props {
  gameState: GameState
  onEndTurn: () => void
  onToggleBoard: () => void
  onToggleCheckpoints: () => void
  showBoard: boolean
  showCheckpoints: boolean
}

export function ActionBar({
  gameState,
  onEndTurn,
  onToggleBoard,
  onToggleCheckpoints,
  showBoard,
  showCheckpoints,
}: Props) {
  const { actionsRemaining } = gameState

  return (
    <div className="action-bar">
      <div className="action-bar__pips">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`action-bar__pip ${i < actionsRemaining ? 'action-bar__pip--full' : ''}`}
          />
        ))}
      </div>
      <span className="action-bar__label">actions</span>

      <div className="action-bar__spacer" />

      <button onClick={onToggleCheckpoints} style={{ borderColor: showCheckpoints ? 'var(--color-accent)' : undefined }}>
        Checkpoints
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
