#!/usr/bin/env npx tsx
// Tidebound CLI — agent-first game interface
// Usage: npx tsx scripts/play.ts <scenario> [difficulty]
//   scenario  — filename without .json (e.g. scenario_01, easy/haulwick_easy_01)
//   difficulty — easy | medium | hard  (default: easy)

import { createInterface } from 'readline'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { resolve, join, basename } from 'path'
import type { Scenario, LocationId, LocationAdjacency } from '../src/types/scenario'
import type { GameState } from '../src/types/gameState'
import {
  initGameState,
  moveInvestigator,
  moveItem,
  resolveTurn,
  submitCheckpoint,
  filterCluesToDifficulty,
  INVESTIGATOR_ID,
} from '../src/engine/gameEngine'

// ── Minimal ANSI (errors, success, clues only) ────────────────────────────────
const gr = (s: string) => `\x1b[32m${s}\x1b[0m`
const rd = (s: string) => `\x1b[31m${s}\x1b[0m`
const yw = (s: string) => `\x1b[33m${s}\x1b[0m`

// ── Utilities ─────────────────────────────────────────────────────────────────
const stripTags = (t: string) => t.replace(/\[(?:char|loc|item|time):([^\]]+)\]/g, '$1')

// ── State persistence ─────────────────────────────────────────────────────────
const stateDir = resolve(process.cwd(), 'scripts/.state')

function stateFile(scenarioPath: string, difficulty: string): string {
  return join(stateDir, `${basename(scenarioPath, '.json')}_${difficulty}.json`)
}
function saveState(scenarioPath: string, difficulty: string, state: GameState): void {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(stateFile(scenarioPath, difficulty), JSON.stringify({ scenarioPath, difficulty, state }, null, 2))
}
function loadState(scenarioPath: string, difficulty: string): GameState | null {
  const f = stateFile(scenarioPath, difficulty)
  if (!existsSync(f)) return null
  try { return (JSON.parse(readFileSync(f, 'utf8')) as any).state as GameState }
  catch { return null }
}
function clearState(scenarioPath: string, difficulty: string): void {
  const f = stateFile(scenarioPath, difficulty)
  if (existsSync(f)) unlinkSync(f)
}

// ── Adjacency ─────────────────────────────────────────────────────────────────
function getAdjacentLocs(fromId: string, scenario: Scenario): Set<string> {
  const adjs: LocationAdjacency[] = scenario.location_adjacencies ?? []
  if (adjs.length > 0) {
    const r = new Set<string>()
    for (const a of adjs) {
      if (a.from === fromId) r.add(a.to)
      if (a.to   === fromId) r.add(a.from)
    }
    return r
  }
  const idx = scenario.locations.findIndex(l => l.id === fromId)
  if (idx === -1) return new Set()
  const loc = scenario.locations[idx]
  const fc = loc.col ?? (idx % 3), fr = loc.row ?? Math.floor(idx / 3)
  const r = new Set<string>()
  for (let i = 0; i < scenario.locations.length; i++) {
    const o = scenario.locations[i]
    const oc = o.col ?? (i % 3), or_ = o.row ?? Math.floor(i / 3)
    if (Math.abs(oc - fc) + Math.abs(or_ - fr) === 1) r.add(o.id)
  }
  return r
}

// ── Compact state block (shown after end, on startup, via status) ─────────────
function renderState(scenario: Scenario, state: GameState): string {
  const invLoc  = state.board.characterLocations[INVESTIGATOR_ID]
  const reachable = getAdjacentLocs(invLoc, scenario)
  const lines: string[] = []

  lines.push(`--- Turn ${state.turn} | ${invLoc} | ${state.actionsRemaining} item action(s) ---`)

  const reachNames = [...reachable].map(id => {
    const loc = scenario.locations.find(l => l.id === id)
    return loc?.name ? `${id} (${loc.name})` : id
  })
  lines.push(`Reachable: ${reachNames.join(', ') || 'none'}`)

  const charsHere = scenario.characters.filter(ch =>
    state.board.characterLocations[ch.id] === invLoc && state.foundCharacterIds.includes(ch.id)
  )
  if (charsHere.length) {
    lines.push(`Here: ${charsHere.map(ch => `${ch.name} (${ch.id})${ch.isVictim ? ' [VICTIM]' : ''}`).join(', ')}`)
  }

  if (state.foundItemIds.length) {
    const itemList = state.foundItemIds.map(id => `${id} @ ${state.board.itemLocations[id]}`)
    lines.push(`Items: ${itemList.join(' | ')}`)
  }

  // Checkpoints: investigative first, then accusatory (locked until investigative confirmed)
  const investigative = ['cause_of_death', 'true_location', 'time_of_death']
  const accusatory    = ['perpetrator', 'motive', 'hidden_truth']
  const fmt = (id: string) => {
    const cp = state.checkpoints[id as any]
    if (!cp) return null
    if (cp.status === 'confirmed') return `${id}[${gr('✓')}]`
    if (cp.status === 'locked')    return `${id}[locked]`
    return `${id}[?]`
  }
  const invPart = investigative.map(fmt).filter(Boolean).join(' ')
  const accPart = accusatory.map(fmt).filter(Boolean).join(' ')
  lines.push(`Checkpoints: ${invPart}${accPart ? ' | ' + accPart : ''}`)
  lines.push(`Clues: ${state.collectedClueIds.length}/${scenario.clues.length}`)

  return lines.join('\n')
}

// ── Scenario finder ───────────────────────────────────────────────────────────
function findScenarios(root: string): string[] {
  const results: string[] = []
  function walk(dir: string, rel: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const r = join(rel, entry.name)
      if (entry.isDirectory()) walk(join(dir, entry.name), r)
      else if (entry.name.endsWith('.json')) results.push(r)
    }
  }
  walk(root, '')
  return results
}

// ── Help ──────────────────────────────────────────────────────────────────────
const HELP = `
Commands:
  move [loc_id]            Move to an adjacent location. No arg: show reachable.
  item <item_id> <loc_id>  Move a found item to any location (1 action/turn).
  end                      Resolve turn — fires clues, advances turn counter.
  status                   Current state: location, reachable, items, checkpoints.
  locs                     All locations (* = you, > = reachable) with contents.
  chars                    Found characters and their fixed locations.
  items                    Found items, their IDs, and current locations.
  clues                    All collected clues in turn order.
  cp                       Checkpoints with status and numbered answer options.
  submit <cp_id> <n>       Submit answer n for checkpoint (see 'cp' for options).
  reset                    Restart this scenario from scratch.
  quit                     Exit.
`.trim()

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const isInteractive = process.stdin.isTTY
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: isInteractive })

  // Buffer all lines ourselves — readline emits queued 'line' events in one burst
  // before rl.question can re-register a listener, so this avoids dropped commands.
  const lineQueue: string[] = []
  let waitingForLine: ((s: string) => void) | null = null
  let stdinDone = false

  rl.on('line', (line) => {
    if (waitingForLine) { const r = waitingForLine; waitingForLine = null; r(line) }
    else lineQueue.push(line)
  })
  rl.on('close', () => {
    stdinDone = true
    if (waitingForLine) { const r = waitingForLine; waitingForLine = null; r('') }
  })

  const ask = (q: string) => new Promise<string>((res, rej) => {
    if (isInteractive) process.stdout.write(q)
    if (lineQueue.length > 0) { res(lineQueue.shift()!); return }
    if (stdinDone) { rej(new Error('stdin closed')); return }
    waitingForLine = res
  })

  const scenarioRoot = resolve(process.cwd(), 'src/scenarios')

  // ── Load scenario ──────────────────────────────────────────────────────────
  let rawPath = process.argv[2]

  if (!rawPath) {
    const list = findScenarios(scenarioRoot)
    console.log('Scenarios:')
    list.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}  ${s}`))
    const choice = await ask('\nPick a number: ')
    const idx = parseInt(choice.trim()) - 1
    if (isNaN(idx) || idx < 0 || idx >= list.length) { console.log(rd('Invalid.')); rl.close(); return }
    rawPath = join(scenarioRoot, list[idx])
  } else {
    if (!rawPath.endsWith('.json')) rawPath += '.json'
    if (!rawPath.includes('/') && !rawPath.includes('\\')) {
      const list = findScenarios(scenarioRoot)
      const match = list.find(s => s.endsWith(rawPath!) || s.replace(/\\/g, '/').endsWith(rawPath!))
      rawPath = match ? join(scenarioRoot, match) : join(scenarioRoot, rawPath)
    }
  }

  let scenario: Scenario
  try {
    scenario = JSON.parse(readFileSync(rawPath, 'utf8')) as Scenario
  } catch {
    console.log(rd(`Cannot load: ${rawPath}`)); rl.close(); return
  }

  // ── Difficulty ─────────────────────────────────────────────────────────────
  let diffArg = process.argv[3]?.trim()
  if (!['easy', 'medium', 'hard'].includes(diffArg ?? '')) {
    diffArg = (await ask('Difficulty (easy/medium/hard) [easy]: ')).trim()
  }
  const difficulty = (['easy', 'medium', 'hard'].includes(diffArg) ? diffArg : 'easy') as 'easy' | 'medium' | 'hard'

  scenario = filterCluesToDifficulty(scenario, difficulty)

  // ── Load or init state ─────────────────────────────────────────────────────
  const savedState = loadState(rawPath, difficulty)
  const isNewGame  = !savedState
  let state = savedState ?? resolveTurn(initGameState(scenario, difficulty), scenario)
  if (isNewGame) saveState(rawPath, difficulty, state)

  // ── Opening ────────────────────────────────────────────────────────────────
  console.log(`\n=== ${scenario.location.name.toUpperCase()} | ${difficulty} | ${scenario.location.season} ===\n`)

  if (isNewGame) {
    console.log(stripTags(scenario.opening_narrative ?? ''))
    const leads = state.log.filter(e => e.isLead)
    if (leads.length) {
      console.log('\nLEADS:')
      for (const e of leads) console.log(`> ${stripTags(e.text)}`)
    }
    console.log()
  }

  console.log(renderState(scenario, state))
  console.log()

  // ── Command loop ───────────────────────────────────────────────────────────
  while (true) {
    const invLoc  = state.board.characterLocations[INVESTIGATOR_ID]
    const reachable = getAdjacentLocs(invLoc, scenario)

    let raw: string
    try { raw = (await ask(`[T${state.turn} | ${invLoc}] > `)).trim() } catch { break }
    if (!raw) continue
    const [cmd, ...args] = raw.split(/\s+/)

    switch (cmd.toLowerCase()) {

      case 'quit':
      case 'exit':
        rl.close(); return

      case 'reset': {
        clearState(rawPath, difficulty)
        scenario = filterCluesToDifficulty(JSON.parse(readFileSync(rawPath, 'utf8')) as Scenario, difficulty)
        state    = resolveTurn(initGameState(scenario, difficulty), scenario)
        saveState(rawPath, difficulty, state)
        console.log('Game reset.')
        console.log(renderState(scenario, state))
        break
      }

      case 'help':
      case '?':
        console.log(HELP)
        break

      case 'status':
        console.log(renderState(scenario, state))
        break

      case 'locs': {
        for (const loc of scenario.locations) {
          const marker = loc.id === invLoc ? '*' : reachable.has(loc.id) ? '>' : ' '
          const name   = loc.name ? ` (${loc.name})` : ''
          const chars  = scenario.characters
            .filter(ch => state.foundCharacterIds.includes(ch.id) && state.board.characterLocations[ch.id] === loc.id)
            .map(ch => ch.name)
          const items  = state.foundItemIds
            .filter(id => state.board.itemLocations[id] === loc.id)
            .map(id => scenario.items.find(i => i.id === id)!.name)
          const contents = [...chars, ...items].join(', ')
          console.log(`  ${marker} ${loc.id}${name}${contents ? '  — ' + contents : ''}`)
        }
        break
      }

      case 'chars': {
        if (!state.foundCharacterIds.length) { console.log('None found yet.'); break }
        for (const id of state.foundCharacterIds) {
          const ch  = scenario.characters.find(c => c.id === id)!
          const loc = state.board.characterLocations[id]
          console.log(`  ${ch.name} (${id})${ch.isVictim ? ' [VICTIM]' : ''}  at: ${loc}`)
        }
        break
      }

      case 'items': {
        if (!state.foundItemIds.length) { console.log('None found yet.'); break }
        for (const id of state.foundItemIds) {
          const it  = scenario.items.find(i => i.id === id)!
          const loc = state.board.itemLocations[id]
          console.log(`  ${it.name} (${id})  at: ${loc}`)
        }
        break
      }

      case 'move':
      case 'mv': {
        const target = args[0]
        if (!target) {
          const locs = [...reachable].map(id => {
            const loc = scenario.locations.find(l => l.id === id)
            return loc?.name ? `${id} (${loc.name})` : id
          })
          console.log(`Reachable from ${invLoc}: ${locs.join(', ') || 'none'}`)
          break
        }
        if (!scenario.locations.find(l => l.id === target)) {
          console.log(rd(`Unknown location: ${target}. Use 'locs' to see valid IDs.`)); break
        }
        if (target === invLoc) { console.log('Already there.'); break }
        if (!reachable.has(target)) {
          console.log(rd(`${target} is not reachable from ${invLoc}.`))
          console.log(`Reachable: ${[...reachable].join(', ') || 'none'}`)
          break
        }
        state = moveInvestigator(state, target as LocationId)
        saveState(rawPath, difficulty, state)
        const newReachable = getAdjacentLocs(target, scenario)
        console.log(`Moved to ${target}.  Reachable next: ${[...newReachable].join(', ')}`)
        break
      }

      case 'item': {
        const [itemId, targetLoc] = args
        if (!itemId || !targetLoc) { console.log(rd('Usage: item <item_id> <location_id>')); break }
        if (!state.foundItemIds.includes(itemId)) {
          console.log(rd(`Item not found: ${itemId}`))
          console.log(`Found item IDs: ${state.foundItemIds.join(', ') || 'none'}`)
          break
        }
        if (!scenario.locations.find(l => l.id === targetLoc)) {
          console.log(rd(`Unknown location: ${targetLoc}`)); break
        }
        if (state.actionsRemaining <= 0) {
          console.log(rd('No item actions remaining this turn. Use "end" to advance.')); break
        }
        const prevLoc = state.board.itemLocations[itemId]
        state = moveItem(state, itemId, targetLoc as LocationId)
        saveState(rawPath, difficulty, state)
        const it = scenario.items.find(i => i.id === itemId)!
        console.log(`Moved ${it.name} (${itemId}) from ${prevLoc} to ${targetLoc}.  ${state.actionsRemaining} item action(s) remaining.`)
        break
      }

      case 'end':
      case 'e': {
        const prevCount   = state.collectedClueIds.length
        const prevItemIds = [...state.foundItemIds]
        const prevCharIds = [...state.foundCharacterIds]
        const lastTurn    = state.turn
        state = resolveTurn(state, scenario)

        const newClues = state.collectedClueIds.length - prevCount
        const newItems = state.foundItemIds.filter(id => !prevItemIds.includes(id))
        const newChars = state.foundCharacterIds.filter(id => !prevCharIds.includes(id))
        const clueEntries = state.log.filter(e => e.turn === lastTurn && e.clueId && !e.isLead)

        console.log(`\n--- Turn ${lastTurn} | ${newClues} new clue(s) ---`)

        for (const e of clueEntries) {
          console.log(yw(`[CLUE] ${stripTags(e.text)}`))
        }
        for (const id of newChars) {
          const ch = scenario.characters.find(c => c.id === id)!
          console.log(`[FOUND CHAR] ${ch.name} (${id})${ch.isVictim ? ' [VICTIM]' : ''} at ${state.board.characterLocations[id]}`)
          console.log(`  ${ch.description}`)
        }
        for (const id of newItems) {
          const it = scenario.items.find(i => i.id === id)!
          console.log(`[FOUND ITEM] ${it.name} (${id}) at ${state.board.itemLocations[id]}`)
          console.log(`  ${it.description}`)
        }
        if (clueEntries.length === 0 && newItems.length === 0 && newChars.length === 0) {
          console.log('(nothing new — try a different position or move an item)')
        }

        saveState(rawPath, difficulty, state)
        console.log()
        console.log(renderState(scenario, state))

        if (state.solved) {
          clearState(rawPath, difficulty)
          console.log(gr(`\nCASE SOLVED — Score: ${state.finalScore}`))
          rl.close(); return
        }
        break
      }

      case 'clues': {
        const entries = state.log.filter(e => e.clueId && !e.isLead)
        if (!entries.length) { console.log('No clues collected yet.'); break }
        console.log(`Clues (${entries.length}):`)
        for (const e of entries) {
          console.log(`  [T${e.turn}] ${stripTags(e.text)}`)
        }
        break
      }

      case 'cp':
      case 'checkpoints': {
        for (const [id, cp] of Object.entries(state.checkpoints)) {
          const scenCp = scenario.checkpoints.find(c => c.id === id)!
          if (cp.status === 'confirmed') {
            console.log(`${id} [${gr('confirmed')}]  ${scenCp.label}  => ${cp.confirmedAnswer}`)
          } else if (cp.status === 'locked') {
            console.log(`${id} [locked]  ${scenCp.label}`)
          } else {
            console.log(`${id} [available]  ${scenCp.label}`)
            scenCp.answer_options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`))
            if (cp.submissions.length) {
              console.log(`  tried: ${cp.submissions.map(s => s.submittedAnswer).join(', ')}`)
            }
          }
        }
        break
      }

      case 'submit': {
        const cpId = args[0]
        const nArg = args[1]

        if (!cpId || !nArg) {
          console.log(rd('Usage: submit <checkpoint_id> <option_number>  — use "cp" to see options'))
          break
        }

        const cp = state.checkpoints[cpId as any]
        if (!cp) {
          console.log(rd(`Unknown checkpoint: ${cpId}`))
          console.log(`Valid IDs: ${Object.keys(state.checkpoints).join(', ')}`)
          break
        }
        if (cp.status === 'locked')    { console.log(rd('Locked — confirm all investigative checkpoints first.')); break }
        if (cp.status === 'confirmed') { console.log(`Already confirmed: ${cp.confirmedAnswer}`); break }

        const scenCp = scenario.checkpoints.find(c => c.id === cpId)!
        const idx    = parseInt(nArg) - 1
        if (isNaN(idx) || idx < 0 || idx >= scenCp.answer_options.length) {
          console.log(rd(`Invalid option. Use 1–${scenCp.answer_options.length}. Use "cp" to see options.`))
          break
        }

        const answer = scenCp.answer_options[idx]
        state = submitCheckpoint(state, scenario, cpId as any, answer, state.collectedClueIds)
        saveState(rawPath, difficulty, state)
        const result = state.checkpoints[cpId as any]

        if (result.status === 'confirmed') {
          console.log(gr(`CORRECT: ${answer}`))
          if (state.solved) {
            clearState(rawPath, difficulty)
            console.log(gr(`\nCASE SOLVED. Final score: ${state.finalScore}`))
            rl.close(); return
          }
          const unlocked = Object.entries(state.checkpoints)
            .filter(([, v]) => v.status === 'available' && !v.confirmedAnswer)
            .map(([id]) => id)
          if (unlocked.length) console.log(`Unlocked: ${unlocked.join(', ')}`)
        } else {
          console.log(rd(`WRONG: ${answer}`))
        }
        break
      }

      default:
        console.log(rd(`Unknown command: ${cmd}. Type 'help'.`))
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
