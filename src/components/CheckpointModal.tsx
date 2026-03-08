import { useState } from 'react'
import type { CheckpointId } from '../types/scenario'
import type { CheckpointState, PinnedCard } from '../types/gameState'
import { parseTaggedText } from '../utils/parseTags'
import './CheckpointModal.css'

interface Props {
  checkpointState: CheckpointState
  label: string
  answerOptions: string[]
  pinnedCards: PinnedCard[]
  onSubmit: (checkpointId: CheckpointId, answer: string, citedClueIds: string[]) => void
  onClose: () => void
}

export function CheckpointModal({ checkpointState, label, answerOptions, pinnedCards, onSubmit, onClose }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [citedIds, setCitedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const lastSubmission = checkpointState.submissions[checkpointState.submissions.length - 1]

  const toggleCite = (clueId: string) => {
    setCitedIds(prev => {
      const next = new Set(prev)
      next.has(clueId) ? next.delete(clueId) : next.add(clueId)
      return next
    })
  }

  const handleSubmit = () => {
    if (!selectedAnswer) { setError('Select an answer.'); return }
    if (citedIds.size === 0) { setError('Cite at least one pinned card as evidence.'); return }
    setError('')
    onSubmit(checkpointState.id, selectedAnswer, Array.from(citedIds))
  }

  const isConfirmed = checkpointState.status === 'confirmed'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <div>
            <div className="modal__title">Checkpoint</div>
            <div className="modal__question">{label}</div>
          </div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        {isConfirmed ? (
          <div className="modal__body">
            <div className="modal__result modal__result--correct">
              Confirmed: {checkpointState.confirmedAnswer}
            </div>
          </div>
        ) : (
          <>
            <div className="modal__body">
              <div>
                <div className="modal__section-label">Your answer</div>
                <select
                  className="modal__select"
                  value={selectedAnswer}
                  onChange={e => setSelectedAnswer(e.target.value)}
                >
                  <option value="">— select —</option>
                  {answerOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="modal__section-label">Evidence (cite at least one pinned card)</div>
                {pinnedCards.length === 0 ? (
                  <div className="modal__no-cards">No cards pinned to the evidence board yet.</div>
                ) : (
                  <div className="modal__evidence">
                    {pinnedCards.filter(c => c.clueId !== null).map(card => (
                      <div
                        key={card.id}
                        className={`modal__evidence-item ${citedIds.has(card.clueId!) ? 'modal__evidence-item--selected' : ''}`}
                        onClick={() => toggleCite(card.clueId!)}
                      >
                        <input
                          type="checkbox"
                          checked={citedIds.has(card.clueId!)}
                          onChange={() => toggleCite(card.clueId!)}
                          onClick={e => e.stopPropagation()}
                        />
                        <span>{parseTaggedText(card.text)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && <div className="modal__error">{error}</div>}

            {lastSubmission && lastSubmission.result === 'incorrect' && (
              <div className="modal__result modal__result--incorrect">
                Incorrect. Try again.
              </div>
            )}

            <div className="modal__footer">
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleSubmit}>Submit</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
