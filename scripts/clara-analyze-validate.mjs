/**
 * Valideert en filtert analyze-patches tegen Clara State (veilig, geen vage agenda).
 */

const EXPLICIT_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

function hasAgendaId(state, id) {
  return (state?.agenda_items ?? []).some((a) => String(a.id) === String(id))
}

/**
 * @param {object[]} patches
 * @param {object} [state]
 * @returns {{ patches: object[], warnings: string[] }}
 */
export function sanitizeAnalyzePatches(patches, state) {
  const out = []
  const warnings = []
  if (!Array.isArray(patches)) {
    warnings.push('patches was geen array — genegeerd')
    return { patches: out, warnings }
  }

  for (const raw of patches) {
    if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') {
      warnings.push('Ongeldig patchelement overgeslagen')
      continue
    }
    const type = raw.type

    if (type === 'task.create') {
      if (!raw.task?.id || raw.task.title == null) {
        warnings.push('task.create zonder id/title overgeslagen')
        continue
      }
      out.push({ type: 'task.create', task: { ...raw.task } })
      continue
    }

    if (type === 'attention.create') {
      if (!raw.item?.id || raw.item.text == null) {
        warnings.push('attention.create zonder id/text overgeslagen')
        continue
      }
      out.push({ type: 'attention.create', item: { ...raw.item } })
      continue
    }

    if (type === 'note.create') {
      if (!raw.note?.id || raw.note.text == null) {
        warnings.push('note.create zonder id/text overgeslagen')
        continue
      }
      out.push({ type: 'note.create', note: { ...raw.note } })
      continue
    }

    if (type === 'agenda_item.update') {
      if (raw.id == null || !hasAgendaId(state, raw.id)) {
        warnings.push(`agenda_item.update voor onbekend id "${raw?.id}" overgeslagen`)
        continue
      }
      if (!raw.changes || typeof raw.changes !== 'object') {
        warnings.push('agenda_item.update zonder changes overgeslagen')
        continue
      }
      out.push({ type: 'agenda_item.update', id: raw.id, changes: { ...raw.changes } })
      continue
    }

    if (type === 'agenda_item.create') {
      const item = raw.item
      if (!item?.id || !item.title || !item.start || !item.end) {
        warnings.push('agenda_item.create onvolledig overgeslagen')
        continue
      }
      if (!EXPLICIT_DT.test(String(item.start)) || !EXPLICIT_DT.test(String(item.end))) {
        warnings.push(`agenda_item.create zonder expliciete datum/tijd (${item.id}) overgeslagen`)
        continue
      }
      out.push({ type: 'agenda_item.create', item: { ...item } })
      continue
    }

    warnings.push(`Patch-type "${type}" niet toegestaan — overgeslagen`)
  }

  return { patches: out, warnings }
}
