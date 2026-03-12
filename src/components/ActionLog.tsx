import { useEffect, useRef } from 'react'
import type { LogEntry, PinnedCard } from '../types/gameState'
import { parseTaggedText } from '../utils/parseTags'
import './ActionLog.css'

interface Props {
  log: LogEntry[]
  pinnedCards: PinnedCard[]
  onPinCard: (clueId: string) => void
}

export function ActionLog({ log, pinnedCards, onPinCard }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const pinnedIds = new Set(pinnedCards.map(c => c.clueId))

  const leadEntries = log.filter(e => e.isLead)
  const turnEntries = log.filter(e => !e.isLead)

  // Group non-lead entries by turn
  const grouped = new Map<number, LogEntry[]>()
  for (const entry of turnEntries) {
    if (!grouped.has(entry.turn)) grouped.set(entry.turn, [])
    grouped.get(entry.turn)!.push(entry)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  return (
    <div className="action-log">
      <div className="action-log__entries">
        {leadEntries.length > 0 && (
          <div className="action-log__turn-group">
            <div className="action-log__turn-label action-log__turn-label--leads">Before the investigation</div>
            {leadEntries.map(entry => (
              <div key={entry.id} className="log-entry log-entry--lead">
                <div className="log-entry__text">{parseTaggedText(entry.text)}</div>
              </div>
            ))}
          </div>
        )}
        {Array.from(grouped.entries()).map(([turn, entries]) => (
          <div key={turn} className="action-log__turn-group">
            <div className="action-log__turn-label">Action {turn}</div>
            {entries.map(entry => (
              <div key={entry.id} className={[
                'log-entry',
                entry.isNew ? 'log-entry--new' : '',
                entry.isMilestone ? 'log-entry--milestone' : '',
                entry.clueId && pinnedIds.has(entry.clueId) ? 'log-entry--pinned' : '',
              ].join(' ').trim()}>
                <div className="log-entry__location">{entry.locationId.replace('_', ' ')}</div>
                <div className="log-entry__body">
                  <div className="log-entry__text">{parseTaggedText(entry.text)}</div>
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
