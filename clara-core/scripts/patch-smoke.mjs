/**
 * Goedkope sanity-check voor applyClaraStatePatch (Node, geen browser).
 */
import 'temporal-polyfill/global'
import { applyClaraStatePatch, buildShiftAgendaItemMinutesPatch } from '../src/claraStatePatch.js'
import { eventTimeToClaraPlain, scheduleXEventToAgendaItemUpdatePatch } from '../src/scheduleXToClaraPatch.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const base = {
  version: '0.15.1',
  updated_at: 'x',
  agenda_items: [
    {
      id: 'a1',
      title: 'Test',
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

let s = applyClaraStatePatch(base, {
  type: 'agenda_item.update',
  id: 'a1',
  changes: { title: 'Updated' },
})
assert(s.agenda_items[0].title === 'Updated', 'update title')
assert(s.updated_at !== 'x', 'updated_at refreshed')

s = applyClaraStatePatch(s, {
  type: 'agenda_item.create',
  item: {
    id: 'a2',
    title: 'Nieuw',
    start: '2026-05-07T11:00:00',
    end: '2026-05-07T11:30:00',
    project: 'werk',
    status: 'pencil',
    kind: 'block',
  },
})
assert(s.agenda_items.length === 2, 'create lengthens list')

s = applyClaraStatePatch(s, { type: 'agenda_item.delete', id: 'a2' })
assert(s.agenda_items.length === 1, 'delete shortens list')

s = applyClaraStatePatch(s, { type: 'task.create', task: { id: 't1', title: 'Taak', status: 'open' } })
assert(s.tasks.length === 1, 'task.create')

s = applyClaraStatePatch(s, { type: 'attention.create', item: { id: 'att1', text: 'Let op' } })
assert(s.attention.length === 1, 'attention.create')

const shiftPatch = buildShiftAgendaItemMinutesPatch(s, 'a1', 30)
assert(shiftPatch.type === 'agenda_item.update', 'shift patch type')
s = applyClaraStatePatch(s, shiftPatch)
assert(s.agenda_items[0].start === '2026-05-06T09:30:00', `shift start got ${s.agenda_items[0].start}`)
assert(s.agenda_items[0].end === '2026-05-06T10:30:00', `shift end got ${s.agenda_items[0].end}`)

const plain = eventTimeToClaraPlain('2026-05-06 09:15')
assert(plain === '2026-05-06T09:15:00', `space string mapped to ${plain}`)

const sxPatch = scheduleXEventToAgendaItemUpdatePatch({
  id: 'a1',
  start: '2026-05-06 12:00',
  end: '2026-05-06 12:45',
  title: 'X',
})
assert(sxPatch.changes.start === '2026-05-06T12:00:00', 'sx patch start')

console.log('patch-smoke: OK')
