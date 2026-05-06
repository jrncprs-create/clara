/**
 * Rule-based analyze (dev / zonder OPENAI_API_KEY). Conservatief: weinig agenda, veel attention/questions.
 */
import { sanitizeAnalyzePatches } from './clara-analyze-validate.mjs'

function slugId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * @param {string} input
 * @param {object} [state]
 */
export async function analyzeWithRules(input, state) {
  const text = String(input ?? '').trim()
  const questions = []
  const warnings = []
  const rawPatches = []

  if (!text) {
    return {
      ok: true,
      summary: 'Lege invoer — geen patches.',
      patches: [],
      questions,
      warnings,
      engine: 'fallback',
    }
  }

  const times = [...text.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?/g)].map((m) => m[0])
  if (times.length >= 2) {
    const start = times[0].length === 16 ? `${times[0]}:00` : times[0]
    const end = times[1].length === 16 ? `${times[1]}:00` : times[1]
    const titleMatch = text.match(/(?:afspraak|meeting|blok)\s*[:\-]\s*(.+)/i)
    const title = titleMatch
      ? titleMatch[1].trim().slice(0, 120)
      : text.replace(times[0], '').replace(times[1], '').replace(/[\n\r]+/g, ' ').trim().slice(0, 120) ||
        'Gepland blok'
    if (start < end) {
      rawPatches.push({
        type: 'agenda_item.create',
        item: {
          id: slugId('agenda'),
          title: title || 'Gepland blok',
          start,
          end,
          project: 'clara',
          status: 'pencil',
          kind: 'block',
        },
      })
    } else {
      warnings.push('agenda: start niet strikt voor eind — niet gepland')
    }
  } else if (/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) && times.length < 2) {
    questions.push('Je noemt een tijdstip maar geen tweede eindtijd — geen agenda-item voorgesteld.')
  }

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    const taskMatch = line.match(/^(?:taak|task)\s*[:\-]\s*(.+)$/i)
    if (taskMatch) {
      rawPatches.push({
        type: 'task.create',
        task: { id: slugId('task'), title: taskMatch[1].slice(0, 200), status: 'open' },
      })
    }
    const noteMatch = line.match(/^(?:notitie|note)\s*[:\-]\s*(.+)$/i)
    if (noteMatch) {
      rawPatches.push({
        type: 'note.create',
        note: { id: slugId('note'), text: noteMatch[1].slice(0, 2000) },
      })
    }
  }

  if (/\?\s*$/.test(text) || /\btwijfel\b/i.test(text)) {
    rawPatches.push({
      type: 'attention.create',
      item: { id: slugId('att'), text: text.slice(0, 500) },
    })
    questions.push('Er zat twijfel in de tekst — toegevoegd als aandacht (geen harde agenda).')
  }

  const { patches, warnings: w2 } = sanitizeAnalyzePatches(rawPatches, state)
  warnings.push(...w2)

  const summary =
    patches.length > 0
      ? `Fallback-analyse: ${patches.length} voorstel(patches). Agenda alleen bij expliciete start/eind in dezelfde regel.`
      : 'Fallback-analyse: geen veilige patches afgeleid (gebruik regels taak: …, notitie: …, of expliciete ISO start/eind).'

  return {
    ok: true,
    summary,
    patches,
    questions,
    warnings,
    engine: 'fallback',
  }
}
