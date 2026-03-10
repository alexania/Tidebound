import type { Scenario, CheckpointId, LocationId } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { VillageMap } from './VillageMap'
import { RelationshipGraph } from './RelationshipGraph'
import { ActionLog } from './ActionLog'
import { ActionBar } from './ActionBar'
import { InfoPanel } from './InfoPanel'
import { EvidenceBoard } from './EvidenceBoard'
import './GameScreen.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onMoveCharacter: (charId: string, location: LocationId) => void
  onMoveItem: (itemId: string, location: LocationId) => void
  onEndTurn: () => void
  onSubmitCheckpoint: (cpId: CheckpointId, answer: string, citedClueIds: string[]) => void
  onPinCard: (clueId: string) => void
  onUpdateImplied: (cardId: string, answer: string) => void
  onAssignLane: (cardId: string, checkpointId: CheckpointId | null) => void
  onUnpinCard: (cardId: string) => void
  onSelect: (sel: string | null) => void
  showBoard: boolean
  onToggleBoard: () => void
  collapsedCards: Set<string>
  onToggleCardCollapsed: (cardId: string) => void
}

export function GameScreen({
  scenario, gameState,
  onMoveCharacter, onMoveItem,
  onEndTurn,
  onSubmitCheckpoint,
  onPinCard, onUpdateImplied, onAssignLane, onUnpinCard,
  onSelect,
  showBoard, onToggleBoard,
  collapsedCards, onToggleCardCollapsed,
}: Props) {
  return (
    <div className="game-screen">
      <div className="game-screen__header">
        <span className="game-screen__village">{scenario.location.name}</span>
        <span className="game-screen__weather">{scenario.location.weather}</span>
        <span className="game-screen__turn">Turn {gameState.turn}</span>
      </div>

      <div className="game-screen__main">
        <div className="game-screen__left">
          <div className="game-screen__map">
            <VillageMap
              scenario={scenario}
              gameState={gameState}
              onMoveCharacter={onMoveCharacter}
              onMoveItem={onMoveItem}
              onSelect={onSelect}
            />
          </div>
          <div className="game-screen__relations">
            <RelationshipGraph scenario={scenario} gameState={gameState} />
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

      <InfoPanel
        scenario={scenario}
        gameState={gameState}
        onSelect={onSelect}
      />

      <ActionBar
        gameState={gameState}
        scenario={scenario}
        onEndTurn={onEndTurn}
        onToggleBoard={onToggleBoard}
        showBoard={showBoard}
      />
    </div>
  )
}
