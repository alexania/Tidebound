import { useState, useRef } from 'react'
import type { Scenario, CheckpointId, Clue } from '../types/scenario'
import type { GameState, CheckpointState } from '../types/gameState'
import { parseTaggedText, buildLocationNames } from '../utils/parseTags'
import './EvidenceBoard.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onAssignProof: (cpId: CheckpointId, wrongAnswer: string, clueId: string) => void
  onClose: () => void
  hidden?: boolean
}

export function EvidenceBoard({ scenario, gameState, onAssignProof, onClose, hidden }: Props) {
  const [showNarrative, setShowNarrative] = useState(false)
  const [cluesPanelWidth, setCluesPanelWidth] = useState(300)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({})
  const locationNames = buildLocationNames(scenario.locations)

  // Map clueId → [{cpId, wrongAnswer}] showing where each clue is used as a proof
  const clueProofMap: Record<string, Array<{ cpId: string; wrongAnswer: string }>> = {}
  for (const [cpId, cpState] of Object.entries(gameState.checkpoints)) {
    for (const [wrongAnswer, clueId] of Object.entries((cpState as CheckpointState).proofs)) {
      if (!clueProofMap[clueId]) clueProofMap[clueId] = []
      clueProofMap[clueId].push({ cpId, wrongAnswer })
    }
  }

  const startPanelResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = cluesPanelWidth
    const onMove = (ev: MouseEvent) => {
      const workspaceWidth = workspaceRef.current?.offsetWidth ?? 800
      setCluesPanelWidth(Math.max(160, Math.min(workspaceWidth - 300, startWidth + ev.clientX - startX)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleDragStart = (e: React.DragEvent, clueId: string) => {
    e.dataTransfer.setData('clueId', clueId)
    e.dataTransfer.effectAllowed = 'link'
  }

  const handleSlotDragOver = (e: React.DragEvent, slotKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'link'
    setDragOverSlot(slotKey)
  }

  const handleSlotDrop = (e: React.DragEvent, cpId: string, wrongAnswer: string) => {
    e.preventDefault()
    setDragOverSlot(null)
    const clueId = e.dataTransfer.getData('clueId')
    if (!clueId) return

    const clue = scenario.clues.find(c => c.id === clueId)
    const valid = clue?.contradicts.some(c => c.checkpoint === cpId && c.answer === wrongAnswer)

    const slotKey = `${cpId}:${wrongAnswer}`
    if (!valid) {
      setSlotErrors(prev => ({ ...prev, [slotKey]: "This clue doesn't contradict that option" }))
      setTimeout(() => setSlotErrors(prev => {
        const next = { ...prev }
        delete next[slotKey]
        return next
      }), 2000)
      return
    }

    setSlotErrors(prev => { const next = { ...prev }; delete next[slotKey]; return next })
    onAssignProof(cpId as CheckpointId, wrongAnswer, clueId)
  }

  const handleSlotDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverSlot(null)
    }
  }

  const collectedClues: Clue[] = gameState.collectedClueIds
    .map(id => scenario.clues.find(c => c.id === id))
    .filter((c): c is Clue => !!c)

  return (
    <div className={`evidence-board${hidden ? ' evidence-board--hidden' : ''}`}>
      <div className="evidence-board__toolbar">
        <span className="evidence-board__title">Evidence Board</span>
        <button onClick={() => setShowNarrative(v => !v)}>
          {showNarrative ? 'Hide opening' : 'Read opening'}
        </button>
        <div className="evidence-board__spacer" />
        <button onClick={onClose}>Close Board</button>
      </div>

      {showNarrative && (
        <div className="evidence-board__narrative">
          {scenario.opening_narrative.split('\n\n').map((para, i) => (
            <p key={i}>{parseTaggedText(para, locationNames)}</p>
          ))}
        </div>
      )}

      <div className="evidence-board__workspace" ref={workspaceRef}>
        <div className="eb-clues" style={{ width: cluesPanelWidth }}>
          <div className="eb-clues__header">Evidence ({collectedClues.length})</div>
          <div className="eb-clues__list">
            {collectedClues.length === 0 && (
              <div className="eb-clues__empty">No clues collected yet.</div>
            )}
            {collectedClues.map(clue => {
              const assignedTo = clueProofMap[clue.id] ?? []
              return (
                <div
                  key={clue.id}
                  className={`eb-clue-card${assignedTo.length > 0 ? ' eb-clue-card--assigned' : ''}`}
                  draggable
                  onDragStart={e => handleDragStart(e, clue.id)}
                >
                  <div className="eb-clue-card__text">
                    {parseTaggedText(clue.text, locationNames)}
                  </div>
                  {assignedTo.length > 0 && (
                    <div className="eb-clue-card__assignments">
                      {assignedTo.map(({ cpId, wrongAnswer }) => (
                        <span key={`${cpId}:${wrongAnswer}`} className="eb-clue-card__tag">
                          Disproves: {wrongAnswer}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="gs-resizer gs-resizer--v" onMouseDown={startPanelResize} />
        <div className="eb-checkpoints">
          {scenario.checkpoints.map(scp => {
            const cpState = gameState.checkpoints[scp.id]
            return (
              <CheckpointPanel
                key={scp.id}
                checkpointId={scp.id}
                label={scp.label}
                answerOptions={scp.answer_options}
                cpState={cpState}
                dragOverSlot={dragOverSlot}
                slotErrors={slotErrors}
                locationNames={locationNames}
                onSlotDragOver={handleSlotDragOver}
                onSlotDrop={handleSlotDrop}
                onSlotDragLeave={handleSlotDragLeave}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface PanelProps {
  checkpointId: string
  label: string
  answerOptions: string[]
  cpState: CheckpointState
  dragOverSlot: string | null
  slotErrors: Record<string, string>
  locationNames: Record<string, string>
  onSlotDragOver: (e: React.DragEvent, slotKey: string) => void
  onSlotDrop: (e: React.DragEvent, cpId: string, wrongAnswer: string) => void
  onSlotDragLeave: (e: React.DragEvent) => void
}

function CheckpointPanel({
  checkpointId, label, answerOptions,
  cpState, dragOverSlot, slotErrors, locationNames,
  onSlotDragOver, onSlotDrop, onSlotDragLeave,
}: PanelProps) {
  const confirmed = cpState?.status === 'confirmed'
  const locked = cpState?.status === 'locked'

  return (
    <div className={[
      'eb-cp-panel',
      confirmed ? 'eb-cp-panel--confirmed' : '',
      locked ? 'eb-cp-panel--locked' : '',
    ].join(' ').trim()}>
      <div className="eb-cp-panel__header">
        <span className="eb-cp-panel__label">{label}</span>
        {confirmed && (
          <span className="eb-cp-panel__answer">{cpState.confirmedAnswer}</span>
        )}
        {!locked && !confirmed && (
          <span className="eb-cp-panel__hint">drop a clue to eliminate</span>
        )}
      </div>

      {locked && (
        <div className="eb-cp-panel__locked">
          Establish the facts of the crime first.
        </div>
      )}

      {confirmed && (
        <div className="eb-cp-panel__confirmed-msg">
          Confirmed: {cpState.confirmedAnswer}
        </div>
      )}

      {!locked && !confirmed && (
        <div className="eb-cp-panel__slots">
          {answerOptions.map(option => {
            const slotKey = `${checkpointId}:${option}`
            const assignedClueId = cpState?.proofs[option]
            const isDragOver = dragOverSlot === slotKey
            const error = slotErrors[slotKey]

            return (
              <div
                key={option}
                title={option}
                className={[
                  'eb-slot',
                  assignedClueId ? 'eb-slot--filled' : '',
                  isDragOver ? 'eb-slot--drag-over' : '',
                  error ? 'eb-slot--error' : '',
                ].join(' ').trim()}
                onDragOver={e => onSlotDragOver(e, slotKey)}
                onDrop={e => onSlotDrop(e, checkpointId, option)}
                onDragLeave={onSlotDragLeave}
              >
                <span className="eb-slot__label">{option}</span>
                {assignedClueId && (
                  <span className="eb-slot__clue-id">✓ eliminated</span>
                )}
                {error && (
                  <span className="eb-slot__error">{error}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
