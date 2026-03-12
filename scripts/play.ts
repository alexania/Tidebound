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
  filterCluesToDifficulty,
  moveToLocation,
  inspectLocation,
  inspectItem,
  talkToCharacter,
  askCharacterAboutItem,
  submitCheckpoint,
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

  const investigative = ['cause_of_death', 'true_location', 'time_of_death']
  const accusatory    = ['perpetrator', 'motive']
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
  move <loc_id>              Move to an adjacent location.
  inspect                    Inspect current location — reveals items, fires clues.
  inspect <item_id>          Pick up item and inspect it — fires clues.
  talk <char_id>             Talk to a character at current location — fires clues.
  ask <char_id> <item_id>    Ask character about an inventory item — fires clues.
  submit <cp_id> <n> <clue_id> [clue_id ...]  Submit answer n citing supporting clues.
  status                     Current state: location, reachable, inventory, checkpoints.
  locs                       All locations (* = you, > = reachable) with found characters.
  chars                      Found characters and their fixed locations.
  items                      Inventory items with IDs.
  clues                      All collected clues in action order.
  cp                         Checkpoints with status and numbered answer options.
  reset                      Restart this scenario from scratch.
  quit                       Exit.
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
  let state = savedState ?? initGameState(scenario, difficulty)
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
        scenario = filterCluesToDifficulty(JSON.parse(readFileSync(rawPath, 'utf8')) as Scenario, difficulty)
        state    = initGameState(scenario, difficulty)
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
          console.log(`  [A${e.turn}] ${stripTags(e.text)}`)
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
        const cpId    = args[0]
        const nArg    = args[1]
        const clueIds = args.slice(2)

        if (!cpId || !nArg || clueIds.length === 0) {
          console.log(rd('Usage: submit <checkpoint_id> <option_number> <clue_id> [clue_id ...]  — use "cp" for options, "clues" for IDs'))
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

        const invalidClues = clueIds.filter(id => !state.collectedClueIds.includes(id))
        if (invalidClues.length) {
          console.log(rd(`Clue(s) not collected: ${invalidClues.join(', ')}. Use "clues" to see collected clue IDs.`))
          break
        }

        const answer = scenCp.answer_options[idx]
        state = submitCheckpoint(state, scenario, cpId as any, answer, clueIds)
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
