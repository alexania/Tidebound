import type { Scenario } from '../types/scenario'
import type { GameState } from '../types/gameState'
import './CaseNotes.css'

interface Props {
  scenario: Scenario
  gameState: GameState
  onInspectItem: (itemId: string) => void
}

function firstSentence(text: string): string {
  const i = text.indexOf('. ')
  return i !== -1 ? text.slice(0, i) : text
}

function decodeReminder(key: string, scenario: Scenario): string {
  if (key.startsWith('talk:')) {
    const char = scenario.characters.find(c => c.id === key.slice(5))
    return `Come back to ${char?.name.split(' ')[0] ?? key}`
  }
  if (key.startsWith('ask:')) {
    const [, charId, itemId] = key.split(':')
    const char = scenario.characters.find(c => c.id === charId)
    const item = scenario.items.find(i => i.id === itemId)
    return `Ask ${char?.name.split(' ')[0] ?? charId} about ${item?.name ?? itemId}`
  }
  if (key.startsWith('inspect:')) {
    const loc = scenario.locations.find(l => l.id === key.slice(8))
    return `Revisit ${loc?.name ?? key.slice(8)}`
  }
  return key
}

export function CaseNotes({ scenario, gameState, onInspectItem }: Props) {
  const { inventory, foundCharacterIds, checkpoints, lockedActionKeys } = gameState

  const inventoryItems = scenario.items.filter(i => inventory.includes(i.id))
  const metChars = scenario.characters.filter(c => foundCharacterIds.includes(c.id))
  const confirmedCheckpoints = scenario.checkpoints.filter(
    cp => checkpoints[cp.id]?.status === 'confirmed'
  )

  return (
    <div className="case-notes">

      {inventoryItems.length > 0 && (
        <section className="case-notes__section">
          <div className="case-notes__heading">Carrying</div>
          <div className="case-notes__chips">
            {inventoryItems.map(item => (
              <button
                key={item.id}
                className="case-notes__item-chip"
                onClick={() => onInspectItem(item.id)}
                title={item.description}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {metChars.length > 0 && (
        <section className="case-notes__section">
          <div className="case-notes__heading">People</div>
          {metChars.map(char => (
            <div key={char.id} className="case-notes__person">
              <span className="case-notes__person-name">{char.name}</span>
              {char.isVictim && <span className="case-notes__tag case-notes__tag--victim">Victim</span>}
              <span className="case-notes__person-bio">{firstSentence(char.description)}</span>
            </div>
          ))}
        </section>
      )}

      {confirmedCheckpoints.length > 0 && (
        <section className="case-notes__section">
          <div className="case-notes__heading">Established</div>
          {confirmedCheckpoints.map(cp => (
            <div key={cp.id} className="case-notes__finding">
              <span className="case-notes__finding-label">{cp.label.replace(/\?$/, '')}</span>
              <span className="case-notes__finding-answer">{checkpoints[cp.id].confirmedAnswer}</span>
            </div>
          ))}
        </section>
      )}

      {lockedActionKeys.length > 0 && (
        <section className="case-notes__section">
          <div className="case-notes__heading">Return to</div>
          {lockedActionKeys.map(key => (
            <div key={key} className="case-notes__reminder">
              {decodeReminder(key, scenario)}
            </div>
          ))}
        </section>
      )}

    </div>
  )
}
