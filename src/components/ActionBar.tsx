import type { GameState } from '../types/gameState'
import './ActionBar.css'

interface Props {
  gameState: GameState
  onEndTurn: () => void
  onNextTurn: () => void
  onToggleBoard: () => void
  onToggleCheckpoints: () => void
  showBoard: boolean
  showCheckpoints: boolean
}

export function ActionBar({
  gameState,
  onEndTurn,
  onNextTurn,
  onToggleBoard,
  onToggleCheckpoints,
  showBoard,
  showCheckpoints,
}: Props) {
  const { phase, actionsRemaining, turn } = gameState

  return (
    <div className="action-bar">
      {phase === 'setup' && (
        <>
          <div className="action-bar__pips">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`action-bar__pip ${i < actionsRemaining ? 'action-bar__pip--full' : ''}`}
              />
            ))}
          </div>
          <span className="action-bar__label">actions</span>
        </>
      )}
      {phase === 'review' && (
        <span className="action-bar__phase">Review — Turn {turn}</span>
      )}

      <div className="action-bar__spacer" />

      <button onClick={onToggleCheckpoints} style={{ borderColor: showCheckpoints ? 'var(--color-accent)' : undefined }}>
        Checkpoints
      </button>
      <button onClick={onToggleBoard} style={{ borderColor: showBoard ? 'var(--color-accent)' : undefined }}>
        Evidence Board
      </button>

      {phase === 'setup' && (
        <button className="action-bar__primary" onClick={onEndTurn}>
          End Turn
        </button>
      )}
      {phase === 'review' && (
        <button className="action-bar__primary" onClick={onNextTurn} disabled={gameState.solved}>
          {gameState.solved ? 'Solved!' : 'Next Turn'}
        </button>
      )}
    </div>
  )
}
