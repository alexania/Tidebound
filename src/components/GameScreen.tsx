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
  return (
    <div className="game-screen">
      <div className="game-screen__header">
        <span className="game-screen__village">{scenario.location.name}</span>
        <span className="game-screen__weather">{scenario.location.weather}</span>
        <span className="game-screen__turn">Action {gameState.actionCount}</span>
      </div>

      <div className="game-screen__main">
        <div className="game-screen__left">
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
          <div className="game-screen__notes">
            <CaseNotes
              scenario={scenario}
              gameState={gameState}
              onInspectItem={onInspectItem}
            />
          </div>
        </div>
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
