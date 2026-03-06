import { useEffect, useRef } from 'react'
import type { LogEntry, PinnedCard } from '../types/gameState'
import './ActionLog.css'

interface Props {
  log: LogEntry[]
  pinnedCards: PinnedCard[]
  onPinCard: (clueId: string) => void
}

export function ActionLog({ log, pinnedCards, onPinCard }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinnedIds = new Set(pinnedCards.map(c => c.clueId))

  // Group log entries by turn
  const grouped = new Map<number, LogEntry[]>()
  for (const entry of log) {
    if (!grouped.has(entry.turn)) grouped.set(entry.turn, [])
    grouped.get(entry.turn)!.push(entry)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  if (log.length === 0) {
    return (
      <div className="action-log">
        <div className="action-log__entries">
          <div className="action-log__empty">
            Set up the board and end your turn to begin gathering clues.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="action-log">
      <div className="action-log__entries">
        {Array.from(grouped.entries()).map(([turn, entries]) => (
          <div key={turn} className="action-log__turn-group">
            <div className="action-log__turn-label">Turn {turn}</div>
            {entries.map(entry => (
              <div key={entry.id} className={`log-entry ${entry.isNew ? 'log-entry--new' : ''}`}>
                <div className="log-entry__location">{entry.locationId.replace('_', ' ')}</div>
                <div className="log-entry__body">
                  <div className="log-entry__text">{entry.text}</div>
                </div>
                {entry.clueId && (
                  <button
                    className={`log-entry__pin ${pinnedIds.has(entry.clueId) ? 'log-entry__pin--pinned' : ''}`}
                    onClick={() => entry.clueId && onPinCard(entry.clueId)}
                    disabled={pinnedIds.has(entry.clueId ?? '')}
                    title="Pin to evidence board"
                  >
                    {pinnedIds.has(entry.clueId) ? 'Pinned' : 'Pin'}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
