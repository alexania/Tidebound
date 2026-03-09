import { useState } from 'react'
import type { Scenario, CheckpointId } from '../types/scenario'
import type { GameState, PinnedCard, CheckpointState } from '../types/gameState'
import { parseTaggedText, buildLocationNames } from '../utils/parseTags'
import './EvidenceBoard.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onUpdateImplied: (cardId: string, answer: string) => void
  onAssignLane: (cardId: string, checkpointId: CheckpointId | null) => void
  onUnpinCard: (cardId: string) => void
  onSubmitCheckpoint: (cpId: CheckpointId, answer: string, citedClueIds: string[]) => void
  onClose: () => void
  collapsedCards: Set<string>
  onToggleCardCollapsed: (cardId: string) => void
}

export function EvidenceBoard({
  scenario, gameState,
  onUpdateImplied, onAssignLane, onUnpinCard, onSubmitCheckpoint, onClose,
  collapsedCards, onToggleCardCollapsed,
}: Props) {
  const [showNarrative, setShowNarrative] = useState(false)
  const [showCheckpointTags, setShowCheckpointTags] = useState(true)
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [insufficientIds, setIncorrectIds] = useState<Set<string>>(new Set())
  const locationNames = buildLocationNames(scenario.locations)

  const clueCheckpointLabels: Record<string, string> = {}
  const clueAnswerOptions: Record<string, string[]> = {}
  for (const clue of scenario.clues) {
    clueCheckpointLabels[clue.id] = clue.checkpoint
    const cp = scenario.checkpoints.find(c => c.id === clue.checkpoint)
    if (cp) clueAnswerOptions[clue.id] = cp.answer_options
  }

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('cardId', cardId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, laneId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverLane(laneId)
  }

  const handleDrop = (e: React.DragEvent, checkpointId: CheckpointId | null) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData('cardId')
    if (cardId) onAssignLane(cardId, checkpointId)
    setDragOverLane(null)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverLane(null)
    }
  }

  const handleSubmit = (cpId: CheckpointId, cards: PinnedCard[]) => {
    const answer = selectedAnswers[cpId]
    if (!answer) return
    const citedClueIds = cards.map(c => c.clueId).filter((id): id is string => id !== null)

    const correctCount = citedClueIds.filter(id => {
      const clue = scenario.clues.find(c => c.id === id)
      return clue?.weight === 'correct' && clue.checkpoint === cpId
    }).length

    if (correctCount < 2) {
      setIncorrectIds(prev => new Set(prev).add(cpId))
      return
    }

    setIncorrectIds(prev => { const next = new Set(prev); next.delete(cpId); return next })
    onSubmitCheckpoint(cpId, answer, citedClueIds)
  }

  const uncategorised = gameState.pinnedCards.filter(c => c.checkpointId === null)

  const activeLanes = scenario.checkpoints

  return (
    <div className="evidence-board">
      <div className="evidence-board__toolbar">
        <span className="evidence-board__title">Evidence Board</span>
        <button onClick={() => setShowNarrative(v => !v)}>
          {showNarrative ? 'Hide opening' : 'Read opening'}
        </button>
        <button onClick={() => setShowCheckpointTags(v => !v)}>
          {showCheckpointTags ? 'Hide tags' : 'Show tags'}
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

      <div className="evidence-board__lanes">
        {/* Uncategorised lane */}
        <Lane
          laneId="uncategorised"
          label="Uncategorised"
          cards={uncategorised}
          cpState={null}
          answerOptions={[]}
          selectedAnswer=""
          insufficient={false}
          dragOver={dragOverLane === 'uncategorised'}
          collapsedCards={collapsedCards}
          locationNames={locationNames}
          clueCheckpointLabels={clueCheckpointLabels}
          showCheckpointTags={showCheckpointTags}
          onDragOver={e => handleDragOver(e, 'uncategorised')}
          onDrop={e => handleDrop(e, null)}
          onDragLeave={handleDragLeave}
          onDragStart={handleDragStart}
          clueAnswerOptions={clueAnswerOptions}
          onUpdateImplied={onUpdateImplied}
          onUnpinCard={onUnpinCard}
          onToggleCard={onToggleCardCollapsed}
          onSelectAnswer={() => {}}
          onSubmit={() => {}}
        />

        {activeLanes.map(scp => {
          const cpState = gameState.checkpoints[scp.id]
          const cards = gameState.pinnedCards.filter(c => c.checkpointId === scp.id)
          return (
            <Lane
              key={scp.id}
              laneId={scp.id}
              label={scp.label}
              cards={cards}
              cpState={cpState}
              answerOptions={scp.answer_options}
              selectedAnswer={selectedAnswers[scp.id] ?? ''}
              insufficient={insufficientIds.has(scp.id)}
              dragOver={dragOverLane === scp.id}
              collapsedCards={collapsedCards}
              locationNames={locationNames}
              clueCheckpointLabels={clueCheckpointLabels}
              showCheckpointTags={showCheckpointTags}
              onDragOver={e => handleDragOver(e, scp.id)}
              onDrop={e => handleDrop(e, scp.id)}
              onDragLeave={handleDragLeave}
              onDragStart={handleDragStart}
              clueAnswerOptions={clueAnswerOptions}
          onUpdateImplied={onUpdateImplied}
              onUnpinCard={onUnpinCard}
              onToggleCard={onToggleCardCollapsed}
              onSelectAnswer={answer => {
                setSelectedAnswers(prev => ({ ...prev, [scp.id]: answer }))
                setIncorrectIds(prev => { const next = new Set(prev); next.delete(scp.id); return next })
              }}
              onSubmit={() => handleSubmit(scp.id, cards)}
            />
          )
        })}
      </div>
    </div>
  )
}

interface LaneProps {
  laneId: string
  label: string
  cards: PinnedCard[]
  cpState: CheckpointState | null
  answerOptions: string[]
  selectedAnswer: string
  insufficient: boolean
  dragOver: boolean
  collapsedCards: Set<string>
  locationNames: Record<string, string>
  clueCheckpointLabels: Record<string, string>
  clueAnswerOptions: Record<string, string[]>
  showCheckpointTags: boolean
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDragStart: (e: React.DragEvent, cardId: string) => void
  onUpdateImplied: (cardId: string, answer: string) => void
  onUnpinCard: (cardId: string) => void
  onToggleCard: (cardId: string) => void
  onSelectAnswer: (answer: string) => void
  onSubmit: () => void
}

function Lane({
  label, cards, cpState, answerOptions, selectedAnswer, insufficient,
  dragOver, collapsedCards, locationNames, clueCheckpointLabels, clueAnswerOptions, showCheckpointTags,
  onDragOver, onDrop, onDragLeave,
  onDragStart, onUpdateImplied, onUnpinCard, onToggleCard,
  onSelectAnswer, onSubmit,
}: LaneProps) {
  const confirmed = cpState?.status === 'confirmed'
  const locked = cpState?.status === 'locked'
  const available = cpState?.status === 'available'

  return (
    <div
      className={[
        'eb-lane',
        confirmed ? 'eb-lane--confirmed' : '',
        locked ? 'eb-lane--locked' : '',
        dragOver ? 'eb-lane--drag-over' : '',
      ].join(' ').trim()}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      <div className="eb-lane__header">
        <span className="eb-lane__label">{label}</span>
        {confirmed && cpState?.confirmedAnswer && (
          <span className="eb-lane__answer">{cpState.confirmedAnswer}</span>
        )}
      </div>

      {available && answerOptions.length > 0 && (
        <div className="eb-lane__submit">
          <select
            className="eb-lane__select"
            value={selectedAnswer}
            onChange={e => onSelectAnswer(e.target.value)}
          >
            <option value="">— your answer —</option>
            {answerOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            className="eb-lane__submit-btn"
            onClick={onSubmit}
            disabled={!selectedAnswer}
          >
            Submit
          </button>
          {insufficient && <span className="eb-lane__insufficient">Insufficient Evidence</span>}
        </div>
      )}

      <div className="eb-lane__cards">
        {cards.length === 0 && (
          <div className="eb-lane__empty">Drop evidence here</div>
        )}
        {cards.map(card => (
          <EvidenceCard
            key={card.id}
            card={card}
            collapsed={collapsedCards.has(card.id)}
            locationNames={locationNames}
            checkpointTag={showCheckpointTags && card.clueId ? clueCheckpointLabels[card.clueId] : undefined}
            answerOptions={showCheckpointTags && card.clueId ? (clueAnswerOptions[card.clueId] ?? []) : []}
            onDragStart={onDragStart}
            onUpdateImplied={onUpdateImplied}
            onUnpin={onUnpinCard}
            onToggleCollapse={onToggleCard}
          />
        ))}
      </div>
    </div>
  )
}

interface CardProps {
  card: PinnedCard
  collapsed: boolean
  locationNames: Record<string, string>
  checkpointTag?: string
  answerOptions: string[]
  onDragStart: (e: React.DragEvent, cardId: string) => void
  onUpdateImplied: (cardId: string, answer: string) => void
  onUnpin: (cardId: string) => void
  onToggleCollapse: (cardId: string) => void
}

function stripTags(text: string): string {
  return text.replace(/\[[^\]]+:([^\]]+)\]/g, '$1')
}

function formatLocation(locationId: string): string {
  return locationId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function EvidenceCard({ card, collapsed, locationNames, checkpointTag, answerOptions, onDragStart, onUpdateImplied, onUnpin, onToggleCollapse }: CardProps) {
  const plain = stripTags(card.text)
  const preview = plain.slice(0, 120).trimEnd()
  const previewText = preview.length < plain.length ? preview + '…' : preview

  return (
    <div
      className={`pinned-card ${collapsed ? 'pinned-card--collapsed' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, card.id)}
    >
      <div className="pinned-card__header" onClick={() => onToggleCollapse(card.id)}>
        <div className="pinned-card__header-left">
          {checkpointTag && <span className="pinned-card__checkpoint-tag">{checkpointTag}</span>}
          <span className="pinned-card__turn">
            {collapsed
              ? (card.locationId ? formatLocation(card.locationId) : 'Unknown')
              : [
                  card.turn !== null ? `Turn ${card.turn}` : 'Auto',
                  card.locationId ? formatLocation(card.locationId) : null,
                ].filter(Boolean).join(' — ')
            }
          </span>
        </div>
        <div className="pinned-card__header-actions">
          <span className="pinned-card__collapse">{collapsed ? '▼' : '▲'}</span>
          <button
            className="pinned-card__unpin"
            onClick={e => { e.stopPropagation(); onUnpin(card.id) }}
            title="Remove from board"
          >×</button>
        </div>
      </div>
      {collapsed && (
        <div className="pinned-card__preview">{previewText}</div>
      )}
      {!collapsed && (
        <>
          <div className="pinned-card__text">
            {parseTaggedText(card.text, locationNames)}
          </div>
          {answerOptions.length > 0 && (
            <select
              className="pinned-card__implied"
              value={card.impliedAnswer}
              onChange={e => onUpdateImplied(card.id, e.target.value)}
              onClick={e => e.stopPropagation()}
            >
              <option value="">— implies —</option>
              {answerOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  )
}
