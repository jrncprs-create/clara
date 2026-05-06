/**
 * POST /api/clara-analyze — patchvoorstellen (niet automatisch toegepast).
 */
import { analyzeWithOpenAI } from './clara-analyze-openai.mjs'
import { analyzeWithRules } from './clara-analyze-fallback.mjs'

/**
 * @param {{ input?: string, state?: object, source?: string }} body
 */
export async function runClaraAnalyze(body) {
  const input = body?.input
  const state = body?.state
  const source = body?.source ?? 'clara-core'

  if (input == null || String(input).trim() === '') {
    return {
      ok: false,
      error: 'Veld "input" is verplicht',
      summary: '',
      patches: [],
      questions: [],
      warnings: [],
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const out = await analyzeWithOpenAI(input, state)
      return { ...out, source }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const fb = await analyzeWithRules(input, state)
      return {
        ...fb,
        warnings: [`OpenAI mislukt (${msg}); fallback gebruikt.`, ...fb.warnings],
        source,
      }
    }
  }

  const fb = await analyzeWithRules(input, state)
  return { ...fb, source }
}
