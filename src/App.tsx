import { useState } from 'react'
import type { Scenario, Difficulty, CheckpointId, LocationId } from './types/scenario'
import type { GameState } from './types/gameState'
import {
  initGameState, filterOptionsToDifficulty,
  moveToLocation, inspectLocation, inspectItem, talkToCharacter, askCharacterAboutItem,
  assignProof,
  pinClue, updateCardImplied, assignCardToLane, unpinCard,
} from './engine/gameEngine'
import {
  generateScenario, generatePromptForClipboard, saveScenario,
  getUnplayedScenario, markPlayed, getPlayedIds,
  CULTURES, GENRES, CAUSES_OF_DEATH, MOTIVES,
} from './engine/generator'
import type { PromptOverrides } from './engine/generator'
import { getBundledScenarios } from './scenarios/index'
import { OpeningNarrative } from './components/OpeningNarrative'
import { parseTaggedText, buildLocationNames } from './utils/parseTags'
import { GameScreen } from './components/GameScreen'
import './App.css'

type Screen = 'menu' | 'api-key' | 'generating' | 'narrative' | 'game' | 'solved'

interface ActiveScenario {
  id: string
  scenario: Scenario
}

function downloadScenario(scenario: Scenario, difficulty: Difficulty) {
  const name = scenario.location.name.toLowerCase().replace(/\s+/g, '_')
  const filename = `${name}_${difficulty}_${Date.now()}.json`
  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [showBoard, setShowBoard] = useState(false)
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set())
  const [activeFilteredScenario, setActiveFilteredScenario] = useState<Scenario | null>(null)

  const handleToggleCardCollapsed = (cardId: string) => {
    setCollapsedCards(prev => {
      const next = new Set(prev)
      next.has(cardId) ? next.delete(cardId) : next.add(cardId)
      return next
    })
  }
  const [apiKey, setApiKey] = useState('')
  const [genError, setGenError] = useState('')
  const [clipboardMsg, setClipboardMsg] = useState('')
  const [promptOverrides, setPromptOverrides] = useState<PromptOverrides>({})

  // ── Scenario loading ──────────────────────────────────────────

  const loadForDifficulty = (diff: Difficulty) => {
    setDifficulty(diff)
    const played = new Set(getPlayedIds())

    // 1. Bundled
    const unplayedBundled = getBundledScenarios().find(s => !played.has(s.id))
    if (unplayedBundled) {
      setActiveScenario(unplayedBundled)
      setScreen('narrative')
      return
    }

    // 2. localStorage
    const fromStorage = getUnplayedScenario(diff)
    if (fromStorage) {
      setActiveScenario(fromStorage)
      setScreen('narrative')
      return
    }

    // 3. Need to generate
    setScreen('api-key')
  }

  const handleGenerate = async () => {
    if (!apiKey.trim()) { setGenError('Enter an API key.'); return }
    setGenError('')
    setScreen('generating')
    try {
      const scenario = await generateScenario({ difficulty, apiKey: apiKey.trim() })
      const id = saveScenario(scenario, difficulty)
      downloadScenario(scenario, difficulty)
      setActiveScenario({ id, scenario })
      setScreen('narrative')
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err))
      setScreen('api-key')
    }
  }

  const handleStartGame = () => {
    if (!activeScenario) return
    const scenario = filterOptionsToDifficulty(activeScenario.scenario, difficulty)
    setActiveFilteredScenario(scenario)
    setGameState(initGameState(scenario, difficulty))
    setShowBoard(false)
    setScreen('game')
  }

  // ── Game actions ──────────────────────────────────────────────

  const gs = gameState
  const sc = activeFilteredScenario

  const handleMove = (location: LocationId) => {
    if (!gs || !sc) return
    setGameState(moveToLocation(gs, sc, location))
  }

  const handleInspectLocation = () => {
    if (!gs || !sc) return
    setGameState(inspectLocation(gs, sc))
  }

  const handleInspectItem = (itemId: string) => {
    if (!gs || !sc) return
    setGameState(inspectItem(gs, sc, itemId))
  }

  const handleTalk = (charId: string) => {
    if (!gs || !sc) return
    setGameState(talkToCharacter(gs, sc, charId))
  }

  const handleAsk = (charId: string, itemId: string) => {
    if (!gs || !sc) return
    setGameState(askCharacterAboutItem(gs, sc, charId, itemId))
  }

  const handleAssignProof = (cpId: CheckpointId, wrongAnswer: string, clueId: string) => {
    if (!gs || !sc) return
    const next = assignProof(gs, sc, cpId, wrongAnswer, clueId)
    setGameState(next)
    if (next.solved && activeScenario) {
      markPlayed(activeScenario.id)
      setTimeout(() => setScreen('solved'), 800)
    }
  }

  // ── Evidence board actions ────────────────────────────────────

  const handlePinCard = (clueId: string) => {
    if (!gs) return
    const entry = gs.log.find(e => e.clueId === clueId)
    if (!entry) return
    setGameState(pinClue(gs, clueId, entry.text))
  }

  const handleUpdateImplied = (cardId: string, impliedAnswer: string) => {
    if (!gs) return
    setGameState(updateCardImplied(gs, cardId, impliedAnswer))
  }

  const handleAssignLane = (cardId: string, checkpointId: CheckpointId | null) => {
    if (!gs) return
    setGameState(assignCardToLane(gs, cardId, checkpointId))
  }

  const handleUnpinCard = (cardId: string) => {
    if (!gs) return
    setGameState(unpinCard(gs, cardId))
  }

  // ── Render ────────────────────────────────────────────────────

  const handleCopyPrompt = async () => {
    const prompt = generatePromptForClipboard(promptOverrides)
    await navigator.clipboard.writeText(prompt)
    setClipboardMsg('Copied!')
    setTimeout(() => setClipboardMsg(''), 2000)
  }

  const setOverride = (key: keyof PromptOverrides, value: string) => {
    setPromptOverrides(prev => {
      if (value === '') {
        const next = { ...prev }
        delete next[key]
        return next
      }
      if (key === 'bodyMoved') return { ...prev, bodyMoved: value === 'true' }
      return { ...prev, [key]: value }
    })
  }

  if (screen === 'menu') {
    return (
      <div className="menu">
        <h1 className="menu__title">Tidebound</h1>
        <p className="menu__subtitle">A murder mystery</p>
        <div className="menu__difficulties">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button key={d} onClick={() => loadForDifficulty(d)}>
              {d}
            </button>
          ))}
        </div>
        <div className="menu__manual-gen">
          <div className="menu__prompt-overrides">
            {([
              ['culture',      'Culture',       CULTURES],
              ['genre',        'Genre',         GENRES],
              ['causeOfDeath', 'Cause of death', CAUSES_OF_DEATH],
              ['motive',       'Motive',        MOTIVES],
            ] as [keyof PromptOverrides, string, string[]][]).map(([key, label, options]) => (
              <label key={key} className="menu__override-field">
                <span>{label}</span>
                <select
                  value={(promptOverrides[key] as string | undefined) ?? ''}
                  onChange={e => setOverride(key, e.target.value)}
                >
                  <option value="">Random</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            ))}
            <label className="menu__override-field">
              <span>Body moved</span>
              <select
                value={promptOverrides.bodyMoved === undefined ? '' : String(promptOverrides.bodyMoved)}
                onChange={e => setOverride('bodyMoved', e.target.value)}
              >
                <option value="">Random</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
          <button className="menu__copy-prompt" onClick={handleCopyPrompt}>
            {clipboardMsg || 'Copy prompt for claude.ai'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'api-key') {
    return (
      <div className="api-key-screen">
        <h2>Generate a New Mystery</h2>
        <p>
          No unplayed {difficulty} scenarios found. Enter your Anthropic API key to generate one.
          The scenario will download as a JSON file — save it to{' '}
          <code>src/scenarios/{difficulty}/</code> for future use.
        </p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
        />
        {genError && <div className="error">{genError}</div>}
        <div className="btn-row">
          <button onClick={() => setScreen('menu')}>Back</button>
          <button onClick={handleGenerate}>Generate</button>
        </div>
      </div>
    )
  }

  if (screen === 'generating') {
    return (
      <div className="generating">
        <h2>Generating Mystery</h2>
        <p>The village is taking shape. This may take a moment.</p>
      </div>
    )
  }

  if (screen === 'narrative' && activeScenario) {
    return <OpeningNarrative scenario={activeScenario.scenario} onContinue={handleStartGame} />
  }

  if (screen === 'game' && gs && sc) {
    return (
      <GameScreen
        scenario={sc}
        gameState={gs}
        onMove={handleMove}
        onInspectLocation={handleInspectLocation}
        onInspectItem={handleInspectItem}
        onTalk={handleTalk}
        onAsk={handleAsk}
        onAssignProof={handleAssignProof}
        onPinCard={handlePinCard}
        onUpdateImplied={handleUpdateImplied}
        onAssignLane={handleAssignLane}
        onUnpinCard={handleUnpinCard}
        showBoard={showBoard}
        onToggleBoard={() => setShowBoard(b => !b)}
        collapsedCards={collapsedCards}
        onToggleCardCollapsed={handleToggleCardCollapsed}
      />
    )
  }

  if (screen === 'solved' && gs && activeScenario) {
    const sc = activeScenario.scenario
    const locationNames = buildLocationNames(sc.locations)
    const epilogueParagraphs = sc.epilogue
      ? sc.epilogue.split(/\n\n+/).filter(Boolean)
      : []
    return (
      <div className="solved-screen">
        <h2>Case Closed</h2>
        <div className="score">{gs.finalScore}</div>
        <p className="solved-screen__meta">points — {gs.difficulty} difficulty — {gs.actionCount} actions</p>
        {epilogueParagraphs.length > 0 && (
          <div className="solved-screen__epilogue">
            <h3>Epilogue</h3>
            {epilogueParagraphs.map((para, i) => (
              <p key={i}>{parseTaggedText(para, locationNames)}</p>
            ))}
          </div>
        )}
        <button onClick={() => setScreen('menu')}>Play Again</button>
      </div>
    )
  }

  return null
}
