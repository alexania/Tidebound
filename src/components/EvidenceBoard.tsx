import { useRef, useState } from 'react'
import type { GameState, PinnedCard } from '../types/gameState'
import { parseTaggedText } from '../utils/parseTags'
import './EvidenceBoard.css'

interface Props {
  gameState: GameState
  onUpdateNote: (cardId: string, note: string) => void
  onMoveCard: (cardId: string, x: number, y: number) => void
  onAddConnection: (fromCardId: string, toCardId: string) => void
  onRemoveConnection: (connectionId: string) => void
  onClose: () => void
}

export function EvidenceBoard({ gameState, onUpdateNote, onMoveCard, onAddConnection, onRemoveConnection, onClose }: Props) {
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null) // card.id
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ cardId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const CARD_W = 220
  const CARD_H = 140

  const handleMouseDown = (e: React.MouseEvent, card: PinnedCard) => {
    if (connectMode) return
    e.preventDefault()
    dragRef.current = {
      cardId: card.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: card.x,
      origY: card.y,
    }

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragRef.current) return
      const dx = me.clientX - dragRef.current.startX
      const dy = me.clientY - dragRef.current.startY
      onMoveCard(dragRef.current.cardId, dragRef.current.origX + dx, dragRef.current.origY + dy)
    }

    const handleMouseUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleCardClick = (card: PinnedCard) => {
    if (!connectMode) return
    if (!connectFrom) {
      setConnectFrom(card.id)
      return
    }
    if (connectFrom === card.id) {
      setConnectFrom(null)
      return
    }
    onAddConnection(connectFrom, card.id)
    setConnectFrom(null)
    setConnectMode(false)
  }

  const cancelConnect = () => {
    setConnectMode(false)
    setConnectFrom(null)
  }

  const cardCenter = (card: PinnedCard) => ({
    x: card.x + CARD_W / 2,
    y: card.y + CARD_H / 2,
  })

  // Index cards by their id (not clueId) — connections use card.id
  const cardById = new Map(gameState.pinnedCards.map(c => [c.id, c]))

  return (
    <div className="evidence-board">
      <div className="evidence-board__toolbar">
        <span className="evidence-board__title">Evidence Board</span>

        {connectMode ? (
          <>
            <span style={{ fontSize: 11, color: 'var(--color-accent)' }}>
              {connectFrom ? 'Click second card' : 'Click first card'}
            </span>
            <button onClick={cancelConnect}>Cancel</button>
          </>
        ) : (
          <button
            onClick={() => setConnectMode(true)}
            disabled={gameState.pinnedCards.length < 2}
          >
            Draw Connection
          </button>
        )}

        <div className="evidence-board__spacer" />
        <button onClick={onClose}>Close Board</button>
      </div>

      <div className="evidence-board__canvas" ref={canvasRef}>
        {gameState.pinnedCards.length === 0 && (
          <div className="evidence-board__empty">
            Pin clue entries from the action log to place cards here.
          </div>
        )}

        <svg className="evidence-board__svg">
          {gameState.connections.map(conn => {
            const from = cardById.get(conn.fromCardId)
            const to = cardById.get(conn.toCardId)
            if (!from || !to) return null
            const fc = cardCenter(from)
            const tc = cardCenter(to)
            return (
              <line
                key={conn.id}
                x1={fc.x} y1={fc.y}
                x2={tc.x} y2={tc.y}
                onClick={() => onRemoveConnection(conn.id)}
              >
                <title>Click to remove</title>
              </line>
            )
          })}
        </svg>

        {gameState.pinnedCards.map(card => (
          <div
            key={card.id}
            className={[
              'pinned-card',
              card.type === 'opening' ? 'pinned-card--opening' : '',
              connectMode ? 'pinned-card--connect-mode' : '',
              connectFrom === card.id ? 'pinned-card--connect-from' : '',
            ].join(' ').trim()}
            style={{ left: card.x, top: card.y }}
            onMouseDown={e => handleMouseDown(e, card)}
            onClick={() => handleCardClick(card)}
          >
            <div className="pinned-card__header">
              {card.type === 'opening'
                ? <span className="pinned-card__turn">Opening</span>
                : <span className="pinned-card__turn">Turn {card.turn}</span>
              }
            </div>
            <div className="pinned-card__text">
              {card.type === 'opening'
                ? card.text.split('\n\n').map((para, i) => <p key={i}>{parseTaggedText(para)}</p>)
                : parseTaggedText(card.text)
              }
            </div>
            <textarea
              className="pinned-card__note"
              placeholder="Add a note..."
              value={card.note}
              onChange={e => onUpdateNote(card.id, e.target.value)}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
