import { useRef, useState } from 'react'
import type { Scenario, CheckpointId, LocationId } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { VillageMap } from './VillageMap'
import { CaseNotes } from './CaseNotes'
import { ActionLog } from './ActionLog'
import { ActionBar } from './ActionBar'
import { EvidenceBoard } from './EvidenceBoard'
import './GameScreen.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onMove: (locationId: LocationId) => void
  onInspectLocation: () => void
  onInspectItem: (itemId: string) => void
  onTalk: (charId: string) => void
  onAsk: (charId: string, itemId: string) => void
  onSubmitCheckpoint: (cpId: CheckpointId, answer: string, citedClueIds: string[]) => void
  onPinCard: (clueId: string) => void
  onUpdateImplied: (cardId: string, answer: string) => void
  onAssignLane: (cardId: string, checkpointId: CheckpointId | null) => void
  onUnpinCard: (cardId: string) => void
  showBoard: boolean
  onToggleBoard: () => void
  collapsedCards: Set<string>
  onToggleCardCollapsed: (cardId: string) => void
}

export function GameScreen({
  scenario, gameState,
  onMove, onInspectLocation, onInspectItem, onTalk, onAsk,
  onSubmitCheckpoint,
  onPinCard, onUpdateImplied, onAssignLane, onUnpinCard,
  showBoard, onToggleBoard,
  collapsedCards, onToggleCardCollapsed,
}: Props) {
  const [leftPct, setLeftPct] = useState(60)
  const [notesHeight, setNotesHeight] = useState(330)
  const mainRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)

  const startVerticalResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftRef.current!.offsetWidth

    const onMove = (ev: MouseEvent) => {
      const mainWidth = mainRef.current!.offsetWidth
      const newWidth = Math.max(200, Math.min(mainWidth - 200, startWidth + ev.clientX - startX))
      setLeftPct(newWidth / mainWidth * 100)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const startHorizontalResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = notesHeight

    const onMove = (ev: MouseEvent) => {
      setNotesHeight(Math.max(80, Math.min(600, startHeight + startY - ev.clientY)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="game-screen">
      <div className="game-screen__header">
        <span className="game-screen__village">{scenario.location.name}</span>
        <span className="game-screen__weather">{scenario.location.weather}</span>
        <span className="game-screen__turn">Action {gameState.actionCount}</span>
      </div>

      <div className="game-screen__main" ref={mainRef}>
        <div className="game-screen__left" ref={leftRef} style={{ width: `${leftPct}%` }}>
          <div className="game-screen__map">
            <VillageMap
              scenario={scenario}
              gameState={gameState}
              onMove={onMove}
              onInspectLocation={onInspectLocation}
              onInspectItem={onInspectItem}
              onTalk={onTalk}
              onAsk={onAsk}
            />
          </div>
          <div className="gs-resizer gs-resizer--h" onMouseDown={startHorizontalResize} />
          <div className="game-screen__notes" style={{ height: notesHeight }}>
            <CaseNotes
              scenario={scenario}
              gameState={gameState}
              onInspectItem={onInspectItem}
            />
          </div>
        </div>

        <div className="gs-resizer gs-resizer--v" onMouseDown={startVerticalResize} />

        <div className="game-screen__log">
          <ActionLog
            log={gameState.log}
            pinnedCards={gameState.pinnedCards}
            onPinCard={onPinCard}
          />
        </div>

        <EvidenceBoard
          scenario={scenario}
          gameState={gameState}
          onUpdateImplied={onUpdateImplied}
          onAssignLane={onAssignLane}
          onUnpinCard={onUnpinCard}
          onSubmitCheckpoint={onSubmitCheckpoint}
          onClose={onToggleBoard}
          collapsedCards={collapsedCards}
          onToggleCardCollapsed={onToggleCardCollapsed}
          hidden={!showBoard}
        />
      </div>

      <ActionBar
        gameState={gameState}
        scenario={scenario}
        onToggleBoard={onToggleBoard}
        showBoard={showBoard}
      />
    </div>
  )
}
