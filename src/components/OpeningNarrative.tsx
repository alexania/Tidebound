import type { Scenario } from '../types/scenario'
import { parseTaggedText } from '../utils/parseTags'
import './OpeningNarrative.css'

interface Props {
  scenario: Scenario
  onContinue: () => void
}

export function OpeningNarrative({ scenario, onContinue }: Props) {
  return (
    <div className="opening">
      <div className="opening__inner">
        <div className="opening__village">{scenario.village.name}</div>
        <div className="opening__weather">{scenario.village.weather}</div>
        <div className="opening__text">
          {scenario.opening_narrative.split('\n\n').map((para, i) => (
            <p key={i}>{parseTaggedText(para)}</p>
          ))}
        </div>
        <button className="opening__continue" onClick={onContinue}>
          Begin Investigation
        </button>
      </div>
    </div>
  )
}
