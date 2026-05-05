/**
 * Minimale OpenAI-json route (alleen als OPENAI_API_KEY gezet is).
 */
import { sanitizeAnalyzePatches } from './clara-analyze-validate.mjs'

const SYSTEM = `Je bent Clara analyze. Je zet vrije tekst om naar VOORGESTELDE patches voor Clara State.
Regels:
- Output ALLEEN strikt JSON met keys: summary (string), patches (array), questions (array van strings), warnings (array van strings).
- patches zijn objecten met het veld "type" en de velden die bij dat type horen (zelfde shape als applyClaraStatePatch).
- Clara State is de waarheid. Maak GEEN agenda_item.create tenzij de gebruiker expliciete datums/tijden in ISO vorm geeft (YYYY-MM-DDTHH:mm of met :ss) voor start EN eind, en een titel.
- Bij twijfel: zet een vraag in "questions" en/of attention.create — geen harde agenda.
- Toegestane patch-types: task.create, attention.create, note.create, agenda_item.create (alleen expliciet), agenda_item.update (alleen als id duidelijk in de tekst voorkomt en bij state past — liever weglaten als onzeker).
- Geen andere patch-types.`

/**
 * @param {string} input
 * @param {object} [state]
 */
export async function analyzeWithOpenAI(input, state) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('OPENAI_API_KEY ontbreekt')
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const userPayload = {
    input: String(input ?? ''),
    state_summary: state
      ? {
          agenda_ids: (state.agenda_items ?? []).map((a) => a.id),
          n_tasks: (state.tasks ?? []).length,
        }
      : null,
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${raw.slice(0, 400)}`)
  }
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('OpenAI: ongeldige JSON')
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI: lege content')
  }
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI: content is geen JSON')
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Analyse zonder samenvatting.'
  const questions = Array.isArray(parsed.questions) ? parsed.questions.filter((q) => typeof q === 'string') : []
  const warnOpen = Array.isArray(parsed.warnings) ? parsed.warnings.filter((w) => typeof w === 'string') : []
  const { patches, warnings: wSan } = sanitizeAnalyzePatches(parsed.patches, state)
  const warnings = [...warnOpen, ...wSan]

  return {
    ok: true,
    summary,
    patches,
    questions,
    warnings,
    engine: 'openai',
    model,
  }
}
