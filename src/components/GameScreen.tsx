import type { Scenario, CheckpointId, LocationId } from '../types/scenario'
import type { GameState } from '../types/gameState'
import { VillageMap } from './VillageMap'
import { ActionLog } from './ActionLog'
import { ActionBar } from './ActionBar'
import { CheckpointPanel } from './CheckpointPanel'
import { EvidenceBoard } from './EvidenceBoard'
import './GameScreen.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onMoveCharacter: (charId: string, location: LocationId) => void
  onMoveItem: (itemId: string, location: LocationId) => void
  onEndTurn: () => void
  onNextTurn: () => void
  onSubmitCheckpoint: (cpId: CheckpointId, answer: string, citedClueIds: string[]) => void
  onPinCard: (clueId: string) => void
  onUpdateNote: (cardId: string, note: string) => void
  onMoveCard: (cardId: string, x: number, y: number) => void
  onAddConnection: (fromClueId: string, toClueId: string) => void
  onRemoveConnection: (connectionId: string) => void
  showBoard: boolean
  showCheckpoints: boolean
  onToggleBoard: () => void
  onToggleCheckpoints: () => void
}

export function GameScreen({
  scenario, gameState,
  onMoveCharacter, onMoveItem,
  onEndTurn, onNextTurn,
  onSubmitCheckpoint,
  onPinCard, onUpdateNote, onMoveCard, onAddConnection, onRemoveConnection,
  showBoard, showCheckpoints, onToggleBoard, onToggleCheckpoints,
}: Props) {
  return (
    <div className="game-screen">
      <div className="game-screen__header">
        <span className="game-screen__village">{scenario.village.name}</span>
        <span className="game-screen__weather">{scenario.village.weather}</span>
        <span className="game-screen__turn">Turn {gameState.turn}</span>
      </div>

      <div className="game-screen__main">
        <div className="game-screen__map">
          <VillageMap
            scenario={scenario}
            gameState={gameState}
            onMoveCharacter={onMoveCharacter}
            onMoveItem={onMoveItem}
          />
        </div>
        <div className="game-screen__log">
          <div className="game-screen__log-header">Action Log</div>
          <ActionLog
            log={gameState.log}
            pinnedCards={gameState.pinnedCards}
            onPinCard={onPinCard}
          />
        </div>

        {showCheckpoints && (
          <CheckpointPanel
            scenario={scenario}
            gameState={gameState}
            onSubmit={onSubmitCheckpoint}
            onClose={onToggleCheckpoints}
          />
        )}

        {showBoard && (
          <EvidenceBoard
            gameState={gameState}
            onUpdateNote={onUpdateNote}
            onMoveCard={onMoveCard}
            onAddConnection={onAddConnection}
            onRemoveConnection={onRemoveConnection}
            onClose={onToggleBoard}
          />
        )}
      </div>

      <ActionBar
        gameState={gameState}
        onEndTurn={onEndTurn}
        onNextTurn={onNextTurn}
        onToggleBoard={onToggleBoard}
        onToggleCheckpoints={onToggleCheckpoints}
        showBoard={showBoard}
        showCheckpoints={showCheckpoints}
      />
    </div>
  )
}
