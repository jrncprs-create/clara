/**
 * POST /api/clara-state/patch — past patch(es) toe en schrijft CLARA_STATE/core.json.
 */
import {
  defaultRepoRoot,
  postClaraStatePatchRequest,
  readJsonBodyFromNodeRequest,
} from '../../scripts/clara-state-repo-api.mjs'

const repoRoot = defaultRepoRoot()

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  try {
    const body = await readJsonBodyFromNodeRequest(req)
    const result = await postClaraStatePatchRequest(repoRoot, body)
    if (result.ok) {
      return res.status(200).json(result)
    }
    return res.status(400).json({ ok: false, error: result.error })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(400).json({ ok: false, error: msg })
  }
}
