import type { Scenario } from '../types/scenario'
import './InventoryBar.css'

interface Props {
  scenario: Scenario
  inventory: string[]
  onInspectItem: (itemId: string) => void
}

export function InventoryBar({ scenario, inventory, onInspectItem }: Props) {
  if (inventory.length === 0) {
    return (
      <div className="inventory-bar inventory-bar--empty">
        <span className="inventory-bar__label">Carrying nothing</span>
      </div>
    )
  }

  return (
    <div className="inventory-bar">
      <span className="inventory-bar__label">Carrying:</span>
      {inventory.map(itemId => {
        const item = scenario.items.find(i => i.id === itemId)
        if (!item) return null
        return (
          <button
            key={itemId}
            className="inventory-chip"
            onClick={() => onInspectItem(itemId)}
            title={item.description}
          >
            {item.name}
          </button>
        )
      })}
    </div>
  )
}
