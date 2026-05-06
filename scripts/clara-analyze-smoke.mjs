import { runClaraAnalyze } from './clara-analyze.mjs'
import { sanitizeAnalyzePatches } from './clara-analyze-validate.mjs'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const state = {
  agenda_items: [{ id: 'a1', title: 'X', start: '2026-05-06T09:00:00', end: '2026-05-06T10:00:00' }],
}

const r1 = await runClaraAnalyze({ input: 'taak: koffie', state, source: 'smoke' })
assert(r1.ok === true, 'ok')
assert(r1.patches.some((p) => p.type === 'task.create'), 'task patch')

const fake = { type: 'agenda_item.update', id: 'nope', changes: { title: 'Y' } }
const san = sanitizeAnalyzePatches([fake], state)
assert(san.patches.length === 0, 'sanitize drops bad id')

const r3 = await runClaraAnalyze({
  input: 'meeting: standup 2026-05-10T10:00:00 2026-05-10T10:30:00',
  state,
  source: 'smoke',
})
assert(r3.patches.some((p) => p.type === 'agenda_item.create'), 'explicit agenda')

console.log('analyze-smoke: OK')
