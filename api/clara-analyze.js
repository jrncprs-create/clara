/**
 * POST /api/clara-analyze — voorstel-patches + summary (niet automatisch toegepast).
 */
import { readJsonBodyFromNodeRequest } from '../scripts/clara-state-repo-api.mjs'
import { runClaraAnalyze } from '../scripts/clara-analyze.mjs'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  try {
    const body = await readJsonBodyFromNodeRequest(req)
    const out = await runClaraAnalyze(body)
    if (out.ok === false) {
      return res.status(400).json(out)
    }
    return res.status(200).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({
      ok: false,
      error: msg,
      summary: '',
      patches: [],
      questions: [],
      warnings: [],
    })
  }
}
