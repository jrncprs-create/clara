/**
 * GET /api/clara-state — volledige Clara State (JSON-body = state object).
 * Vercel Node serverless; lokaal ook via `npm run dev` (Vite middleware).
 */
import { defaultRepoRoot, readClaraState } from '../scripts/clara-state-repo-api.mjs'

const repoRoot = defaultRepoRoot()

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  try {
    const state = await readClaraState(repoRoot)
    return res.status(200).json(state)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ ok: false, error: msg })
  }
}
