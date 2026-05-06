/**
 * Smoke: postClaraStatePatchRequest + readClaraState op tijdelijke CLARA_STATE-map.
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { postClaraStatePatchRequest, readClaraState } from './clara-state-repo-api.mjs'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'clara-api-'))
const stateDir = path.join(tmp, 'CLARA_STATE')
await fs.mkdir(stateDir, { recursive: true })
const seed = {
  version: 'smoke',
  updated_at: 'x',
  agenda_items: [
    {
      id: 'a1',
      title: 'A',
      start: '2026-05-06T09:00:00',
      end: '2026-05-06T10:00:00',
      project: 'clara',
      status: 'planned',
      kind: 'focus',
    },
  ],
  tasks: [],
  attention: [],
}
await fs.writeFile(path.join(stateDir, 'core.json'), JSON.stringify(seed, null, 2), 'utf8')

const r1 = await postClaraStatePatchRequest(tmp, {
  patch: { type: 'agenda_item.update', id: 'a1', changes: { title: 'B' } },
  source: 'smoke',
})
assert(r1.ok === true, 'patch ok')
assert(r1.state.agenda_items[0].title === 'B', 'title updated')

const disk = await readClaraState(tmp)
assert(disk.agenda_items[0].title === 'B', 'persisted to disk')

const r2 = await postClaraStatePatchRequest(tmp, {
  patches: [
    { type: 'task.create', task: { id: 't1', title: 'Taak', status: 'open' } },
    { type: 'attention.create', item: { id: 'n1', text: 'Let op' } },
  ],
  source: 'smoke',
})
assert(r2.ok && r2.applied.length === 2, 'multi patch')

console.log('api-smoke: OK')
