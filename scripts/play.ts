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
  filterOptionsToDifficulty,
  moveToLocation,
  inspectLocation,
  inspectItem,
  talkToCharacter,
  askCharacterAboutItem,
  assignProof,
  getCorrectAnswer,
} from '../src/engine/gameEngine'

// ── Minimal ANSI ──────────────────────────────────────────────────────────────
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
  const r = new Set<string>()
  for (const a of adjs) {
    if (a.from === fromId) r.add(a.to)
    if (a.to   === fromId) r.add(a.from)
  }
  return r
}

// ── Print new log entries ─────────────────────────────────────────────────────
function printNewEntries(state: GameState): void {
  for (const e of state.log) {
    if (!e.isNew) continue
    if (e.clueId) {
      console.log(yw(`[CLUE] ${stripTags(e.text)}`))
    } else if (e.isLead) {
      console.log(`[LEAD] ${stripTags(e.text)}`)
    } else {
      console.log(stripTags(e.text))
    }
  }
}

// ── Compact state block ───────────────────────────────────────────────────────
function renderState(scenario: Scenario, state: GameState): string {
  const loc = state.investigatorLocation
  const reachable = getAdjacentLocs(loc, scenario)
  const lines: string[] = []

  lines.push(`--- Action ${state.actionCount} | ${loc} ---`)

  const reachNames = [...reachable].map(id => {
    const l = scenario.locations.find(l => l.id === id)
    return l?.name ? `${id} (${l.name})` : id
  })
  lines.push(`Reachable: ${reachNames.join(', ') || 'none'}`)

  const charsHere = scenario.characters.filter(ch =>
    state.foundCharacterIds.includes(ch.id) && ch.location === loc
  )
  if (charsHere.length) {
    lines.push(`Here: ${charsHere.map(ch => `${ch.name} (${ch.id})${ch.isVictim ? ' [VICTIM]' : ''}`).join(', ')}`)
  }

  if (state.inventory.length) {
    const items = state.inventory.map(id => {
      const it = scenario.items.find(i => i.id === id)
      return it ? `${it.name} (${id})` : id
    })
    lines.push(`Inventory: ${items.join(', ')}`)
  }

  const cpOrder = ['true_location', 'perpetrator', 'motive']
  const fmt = (id: string) => {
    const cp = state.checkpoints[id as any]
    if (!cp) return null
    if (cp.status === 'confirmed') return `${id}[${gr('✓')}]`
    if (cp.status === 'locked')    return `${id}[locked]`
    const scenCp = scenario.checkpoints.find(c => c.id === id)!
    const correct = getCorrectAnswer(id as any, scenario)
    const wrong = scenCp.answer_options.filter(o => o !== correct)
    const proved = wrong.filter(w => cp.proofs[w]).length
    return `${id}[${proved}/${wrong.length}]`
  }
  lines.push(`Checkpoints: ${cpOrder.map(fmt).filter(Boolean).join(' | ')}`)
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
  move <loc_id>                      Move to an adjacent location.
  inspect                            Inspect current location — reveals items, fires clues.
  inspect <item_id>                  Pick up item and inspect it — fires clues.
  talk <char_id>                     Talk to a character at current location — fires clues.
  ask <char_id> <item_id>            Ask character about an inventory item — fires clues.
  prove <cp_id> "<wrong_answer>" with <clue_id>  Assign a clue to disprove a wrong answer.
  status                             Current state: location, reachable, inventory, checkpoints.
  locs                               All locations (* = you, > = reachable) with found characters.
  chars                              Found characters and their fixed locations.
  items                              Inventory items with IDs.
  clues                              All collected clues with their contradicts arrays.
  cp                                 Checkpoints with status and elimination progress.
  reset                              Restart this scenario from scratch.
  quit                               Exit.
`.trim()

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const isInteractive = process.stdin.isTTY
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: isInteractive })

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
      const normalised = (s: string) => s.replace(/\\/g, '/')
      const candidates = list.filter(s => normalised(s).endsWith(rawPath!.replace(/\\/g, '/')))
      // Prefer the shortest match (root-level over archived sub-paths)
      candidates.sort((a, b) => a.length - b.length)
      const match = candidates[0]
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

  scenario = filterOptionsToDifficulty(scenario, difficulty)

  // ── Load or init state ─────────────────────────────────────────────────────
  const savedState = loadState(rawPath, difficulty)
  const isNewGame  = !savedState
  let state = savedState ?? initGameState(scenario, difficulty)
  if (isNewGame) saveState(rawPath, difficulty, state)

  // Tracks failed prove attempts per "cpId:wrongAnswer" — in-memory only, not persisted.
  // Caps at 2 failed attempts per option so the reviewer can't brute-force by trying every clue.
  const PROVE_ATTEMPT_LIMIT = 2
  const proveFailCounts: Record<string, number> = {}

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
    const loc = state.investigatorLocation
    const reachable = getAdjacentLocs(loc, scenario)

    let raw: string
    try { raw = (await ask(`[A${state.actionCount} | ${loc}] > `)).trim() } catch { break }
    if (!raw) continue
    const [cmd, ...args] = raw.split(/\s+/)

    switch (cmd.toLowerCase()) {

      case 'quit':
      case 'exit':
        rl.close(); return

      case 'reset': {
        clearState(rawPath, difficulty)
        scenario = filterOptionsToDifficulty(JSON.parse(readFileSync(rawPath, 'utf8')) as Scenario, difficulty)
        state    = initGameState(scenario, difficulty)
        saveState(rawPath, difficulty, state)
        for (const k of Object.keys(proveFailCounts)) delete proveFailCounts[k]
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
        for (const l of scenario.locations) {
          const marker   = l.id === loc ? '*' : reachable.has(l.id) ? '>' : ' '
          const name     = l.name ? ` (${l.name})` : ''
          const inspected = state.inspectedLocationIds.includes(l.id) ? ' [inspected]' : ''
          const chars    = scenario.characters
            .filter(ch => state.foundCharacterIds.includes(ch.id) && ch.location === l.id)
            .map(ch => ch.name)
          console.log(`  ${marker} ${l.id}${name}${inspected}${chars.length ? '  — ' + chars.join(', ') : ''}`)
        }
        break
      }

      case 'chars': {
        if (!state.foundCharacterIds.length) { console.log('None found yet.'); break }
        for (const id of state.foundCharacterIds) {
          const ch = scenario.characters.find(c => c.id === id)!
          console.log(`  ${ch.name} (${id})${ch.isVictim ? ' [VICTIM]' : ''}  at: ${ch.location}`)
        }
        break
      }

      case 'items': {
        if (!state.inventory.length) { console.log('Inventory empty.'); break }
        for (const id of state.inventory) {
          const it = scenario.items.find(i => i.id === id)!
          console.log(`  ${it.name} (${id})`)
        }
        break
      }

      case 'move':
      case 'mv': {
        const target = args[0]
        if (!target) {
          const locs = [...reachable].map(id => {
            const l = scenario.locations.find(l => l.id === id)
            return l?.name ? `${id} (${l.name})` : id
          })
          console.log(`Reachable from ${loc}: ${locs.join(', ') || 'none'}`)
          break
        }
        if (!scenario.locations.find(l => l.id === target)) {
          console.log(rd(`Unknown location: ${target}. Use 'locs' to see valid IDs.`)); break
        }
        if (target === loc) { console.log('Already there.'); break }
        if (!reachable.has(target)) {
          console.log(rd(`${target} is not reachable from ${loc}.`))
          console.log(`Reachable: ${[...reachable].join(', ') || 'none'}`)
          break
        }
        state = moveToLocation(state, scenario, target as LocationId)
        saveState(rawPath, difficulty, state)
        printNewEntries(state)
        console.log(renderState(scenario, state))
        break
      }

      case 'inspect': {
        const itemId = args[0]
        if (itemId) {
          const prev = state.actionCount
          state = inspectItem(state, scenario, itemId)
          if (state.actionCount === prev) {
            const item = scenario.items.find(i => i.id === itemId)
            if (!item) {
              console.log(rd(`Unknown item: ${itemId}`))
            } else if (!state.inventory.includes(itemId) && !state.inspectedLocationIds.includes(loc)) {
              console.log(rd(`Inspect this location first before picking up items.`))
            } else if (!state.inventory.includes(itemId) && item.starting_location !== loc) {
              console.log(rd(`${itemId} is not at this location.`))
            } else {
              console.log(rd(`Cannot inspect item: ${itemId}`))
            }
            break
          }
        } else {
          state = inspectLocation(state, scenario)
        }
        saveState(rawPath, difficulty, state)
        printNewEntries(state)
        // After a location inspect, list visible-but-not-carried items with IDs
        if (!itemId) {
          const visibleHere = scenario.items.filter(i =>
            i.starting_location === state.investigatorLocation &&
            !state.inventory.includes(i.id)
          )
          if (visibleHere.length) {
            console.log(`Visible items: ${visibleHere.map(i => `${i.name} (${i.id})`).join(', ')}`)
          }
        }
        break
      }

      case 'talk': {
        const charId = args[0]
        if (!charId) { console.log(rd('Usage: talk <char_id>')); break }
        const char = scenario.characters.find(c => c.id === charId)
        if (!char) { console.log(rd(`Unknown character: ${charId}. Use 'chars' to see found characters.`)); break }
        if (!state.foundCharacterIds.includes(charId)) {
          console.log(rd(`Character not yet encountered: ${charId}. Move to their location first.`)); break
        }
        if (char.location !== loc) {
          console.log(rd(`${char.name} is not here (they are at ${char.location}).`)); break
        }
        state = talkToCharacter(state, scenario, charId)
        saveState(rawPath, difficulty, state)
        printNewEntries(state)
        break
      }

      case 'ask': {
        const [charId, itemId] = args
        if (!charId || !itemId) { console.log(rd('Usage: ask <char_id> <item_id>')); break }
        const char = scenario.characters.find(c => c.id === charId)
        if (!char) { console.log(rd(`Unknown character: ${charId}`)); break }
        if (!state.foundCharacterIds.includes(charId) || char.location !== loc) {
          console.log(rd(`${char?.name ?? charId} is not here.`)); break
        }
        if (!state.inventory.includes(itemId)) {
          console.log(rd(`${itemId} is not in inventory. Use 'items' to see what you're holding.`)); break
        }
        state = askCharacterAboutItem(state, scenario, charId, itemId)
        saveState(rawPath, difficulty, state)
        printNewEntries(state)
        break
      }

      case 'clues': {
        const entries = state.log.filter(e => e.clueId && !e.isLead)
        if (!entries.length) { console.log('No clues collected yet.'); break }
        console.log(`Clues (${entries.length}):`)
        for (const e of entries) {
          const clue = scenario.clues.find(c => c.id === e.clueId)
          console.log(`  [A${e.turn}] (${e.clueId}) ${stripTags(e.text)}`)
        }
        break
      }

      case 'cp':
      case 'checkpoints': {
        const GATE_MESSAGES: Record<string, string> = {
          perpetrator: 'Confirm true_location first',
          motive: 'Confirm perpetrator first',
        }
        const cpOrder = ['true_location', 'perpetrator', 'motive']
        for (const id of cpOrder) {
          const cp = state.checkpoints[id as any]
          if (!cp) continue
          const scenCp = scenario.checkpoints.find(c => c.id === id)!
          if (cp.status === 'confirmed') {
            console.log(`${id} [${gr('confirmed')}]  ${scenCp.label}  => ${cp.confirmedAnswer}`)
          } else if (cp.status === 'locked') {
            const gate = GATE_MESSAGES[id] ?? 'locked'
            console.log(`${id} [locked]  ${scenCp.label}  (${gate})`)
          } else {
            const correct = getCorrectAnswer(id as any, scenario)
            const wrong = scenCp.answer_options.filter(o => o !== correct)
            console.log(`${id} [available]  ${scenCp.label}`)
            console.log(`  ? ${correct}  (correct — will auto-confirm when all wrong answers are disproved)`)
            for (const w of wrong) {
              const clueId = cp.proofs[w]
              const status = clueId ? gr(`✓ disproved by ${clueId}`) : rd('✗ not yet disproved')
              console.log(`  - ${w}  ${status}`)
            }
          }
        }
        break
      }

      case 'prove': {
        // prove <cp_id> "<wrong_answer>" with <clue_id>
        // Parse: args[0] = cpId, args[1..n] = quoted wrong answer + "with" + clue_id
        const cpId = args[0]
        if (!cpId) { console.log(rd('Usage: prove <cp_id> "<wrong_answer>" with <clue_id>')); break }

        const rest = args.slice(1).join(' ')
        const withIdx = rest.lastIndexOf(' with ')
        if (withIdx === -1) { console.log(rd('Usage: prove <cp_id> "<wrong_answer>" with <clue_id>')); break }

        const wrongAnswer = rest.slice(0, withIdx).replace(/^"|"$/g, '')
        const clueId = rest.slice(withIdx + 6).trim()

        const cp = state.checkpoints[cpId as any]
        if (!cp) { console.log(rd(`Unknown checkpoint: ${cpId}`)); break }
        if (cp.status === 'locked') {
          const gateMsg = cpId === 'perpetrator' ? 'Confirm true_location first.' : cpId === 'motive' ? 'Confirm perpetrator first.' : 'Locked.'
          console.log(rd(`Locked — ${gateMsg}`)); break
        }
        if (cp.status === 'confirmed') { console.log(`Already confirmed: ${cp.confirmedAnswer}`); break }

        const scenCp = scenario.checkpoints.find(c => c.id === cpId)!
        const correct = getCorrectAnswer(cpId as any, scenario)
        if (wrongAnswer === correct) { console.log(rd(`"${wrongAnswer}" is the correct answer — you cannot disprove it.`)); break }
        if (!scenCp.answer_options.includes(wrongAnswer)) {
          console.log(rd(`"${wrongAnswer}" is not an answer option for ${cpId}.`))
          console.log(`Options: ${scenCp.answer_options.join(', ')}`)
          break
        }
        if (!state.collectedClueIds.includes(clueId)) {
          console.log(rd(`Clue ${clueId} not collected. Use 'clues' to see collected clue IDs.`)); break
        }

        const proveKey = `${cpId}:${wrongAnswer}`
        const failsSoFar = proveFailCounts[proveKey] ?? 0
        if (failsSoFar >= PROVE_ATTEMPT_LIMIT) {
          console.log(rd(`No more attempts for "${wrongAnswer}" on ${cpId} — used all ${PROVE_ATTEMPT_LIMIT}. This option cannot be disproved.`))
          break
        }

        const clue = scenario.clues.find(c => c.id === clueId)
        if (!clue?.contradicts.some(c => c.checkpoint === cpId && c.answer === wrongAnswer)) {
          proveFailCounts[proveKey] = failsSoFar + 1
          const remaining = PROVE_ATTEMPT_LIMIT - proveFailCounts[proveKey]
          console.log(rd(`Clue ${clueId} does not contradict "${wrongAnswer}" for checkpoint ${cpId}.`))
          console.log(remaining > 0 ? `${remaining} attempt(s) remaining for this option.` : rd(`No more attempts for this option.`))
          break
        }

        const prev = state
        state = assignProof(state, scenario, cpId as any, wrongAnswer, clueId)
        saveState(rawPath, difficulty, state)

        if (state.checkpoints[cpId as any].status === 'confirmed') {
          console.log(gr(`CONFIRMED: ${state.checkpoints[cpId as any].confirmedAnswer}`))
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
          console.log(gr(`Disproved "${wrongAnswer}" with ${clueId}.`))
          const newCp = state.checkpoints[cpId as any]
          const remaining = scenCp.answer_options.filter(o => o !== correct && !newCp.proofs[o])
          console.log(`Still to disprove: ${remaining.join(', ')}`)
        }
        break
      }

      default:
        console.log(rd(`Unknown command: ${cmd}. Type 'help'.`))
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
