/**
 * Clara State patchlaag (v0.15.1). Runtime: in-memory; bron blijft JSON-seed tot persistence.
 */

function nowUpdatedAt() {
  return Temporal.Now.zonedDateTimeISO('Europe/Amsterdam').toString()
}

function cloneState(state) {
  return structuredClone(state)
}

/**
 * Past één patch toe en retourneert een nieuwe state (immutable).
 * @param {object} state
 * @param {object} patch
 */
export function applyClaraStatePatch(state, patch) {
  const next = cloneState(state)
  next.updated_at = nowUpdatedAt()

  switch (patch.type) {
    case 'agenda_item.update': {
      const list = next.agenda_items ?? []
      const idx = list.findIndex((a) => String(a.id) === String(patch.id))
      if (idx === -1) {
        throw new Error(`agenda_item.update: onbekend id ${patch.id}`)
      }
      const cur = list[idx]
      list[idx] = { ...cur, ...(patch.changes ?? {}) }
      next.agenda_items = list
      break
    }
    case 'agenda_item.create': {
      if (!patch.item || patch.item.id == null) {
        throw new Error('agenda_item.create: item.id verplicht')
      }
      next.agenda_items = [...(next.agenda_items ?? []), { ...patch.item }]
      break
    }
    case 'agenda_item.delete': {
      next.agenda_items = (next.agenda_items ?? []).filter((a) => String(a.id) !== String(patch.id))
      break
    }
    case 'task.create': {
      if (!patch.task || patch.task.id == null) {
        throw new Error('task.create: task.id verplicht')
      }
      next.tasks = [...(next.tasks ?? []), { ...patch.task }]
      break
    }
    case 'attention.create': {
      if (!patch.item || patch.item.id == null) {
        throw new Error('attention.create: item.id verplicht')
      }
      next.attention = [...(next.attention ?? []), { ...patch.item }]
      break
    }
    default:
      throw new Error(`Onbekend patch-type: ${patch.type}`)
  }

  return next
}

/**
 * @param {object} state
 * @param {string|number} id
 * @param {object} changes
 */
export function updateAgendaItemById(state, id, changes) {
  return applyClaraStatePatch(state, { type: 'agenda_item.update', id, changes })
}

/**
 * Verschuif start/eind van een agenda-item met `minutes` (Europe/Amsterdam).
 * @param {object} state
 * @param {string|number} id
 * @param {number} minutes
 */
export function buildShiftAgendaItemMinutesPatch(state, id, minutes) {
  const list = state.agenda_items ?? []
  const item = list.find((a) => String(a.id) === String(id))
  if (!item) {
    throw new Error(`buildShiftAgendaItemMinutesPatch: onbekend id ${id}`)
  }
  const zone = 'Europe/Amsterdam'
  const startZ = Temporal.PlainDateTime.from(item.start).toZonedDateTime(zone).add({ minutes })
  const endZ = Temporal.PlainDateTime.from(item.end).toZonedDateTime(zone).add({ minutes })
  return {
    type: 'agenda_item.update',
    id: item.id,
    changes: {
      start: startZ.toPlainDateTime().toString(),
      end: endZ.toPlainDateTime().toString(),
    },
  }
}
