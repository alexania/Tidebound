import { useState } from 'react'
import type { Scenario, CheckpointId } from '../types/scenario'
import type { GameState, CheckpointState, PinnedCard } from '../types/gameState'
import { CheckpointModal } from './CheckpointModal'
import './CheckpointPanel.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onSubmit: (checkpointId: CheckpointId, answer: string, citedClueIds: string[]) => void
  onClose: () => void
}

export function CheckpointPanel({ scenario, gameState, onSubmit, onClose }: Props) {
  const [activeModal, setActiveModal] = useState<CheckpointId | null>(null)

  const handleSubmit = (checkpointId: CheckpointId, answer: string, citedClueIds: string[]) => {
    onSubmit(checkpointId, answer, citedClueIds)
    // Keep modal open so player sees result
  }

  const scenarioCp = new Map(scenario.checkpoints.map(cp => [cp.id, cp]))

  return (
    <div className="checkpoint-panel">
      <div className="checkpoint-panel__header">
        <span className="checkpoint-panel__title">Checkpoints</span>
        <button className="checkpoint-panel__close" onClick={onClose}>✕</button>
      </div>
      <div className="checkpoint-panel__list">
        {(Object.values(gameState.checkpoints) as CheckpointState[]).map(cpState => {
          const scp = scenarioCp.get(cpState.id)
          if (!scp) return null
          const statusClass = `checkpoint-item--${cpState.status}`

          return (
            <div key={cpState.id} className={`checkpoint-item ${statusClass}`}>
              <div className="checkpoint-item__label">{scp.label}</div>
              <div className="checkpoint-item__status">{cpState.status}</div>
              {cpState.confirmedAnswer && (
                <div className="checkpoint-item__answer">{cpState.confirmedAnswer}</div>
              )}
              {cpState.status === 'available' && (
                <button
                  className="checkpoint-item__submit"
                  onClick={() => setActiveModal(cpState.id)}
                  disabled={gameState.phase !== 'review'}
                  title={gameState.phase !== 'review' ? 'End the turn first' : undefined}
                >
                  Submit Answer
                </button>
              )}
              {cpState.status === 'confirmed' && (
                <button
                  className="checkpoint-item__submit"
                  onClick={() => setActiveModal(cpState.id)}
                >
                  View
                </button>
              )}
            </div>
          )
        })}
      </div>

      {activeModal && (() => {
        const cpState = gameState.checkpoints[activeModal]
        const scp = scenarioCp.get(activeModal)
        if (!cpState || !scp) return null
        return (
          <CheckpointModal
            checkpointState={cpState}
            label={scp.label}
            answerOptions={scp.answer_options}
            pinnedCards={gameState.pinnedCards}
            onSubmit={handleSubmit}
            onClose={() => setActiveModal(null)}
          />
        )
      })()}
    </div>
  )
}
