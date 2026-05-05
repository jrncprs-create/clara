/**
 * Connect-middleware voor Vite dev: GET /api/clara-state, POST /api/clara-state/patch
 */
import {
  postClaraStatePatchRequest,
  readClaraState,
  readJsonBodyFromNodeRequest,
} from './clara-state-repo-api.mjs'

/**
 * @param {string} repoRoot
 */
export function createClaraStateApiMiddleware(repoRoot) {
  return async function claraStateApiMiddleware(req, res, next) {
    const url = (req.url ?? '').split('?')[0]

    if (url === '/api/clara-state' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      try {
        const state = await readClaraState(repoRoot)
        res.statusCode = 200
        res.end(JSON.stringify(state))
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
      }
      return
    }

    if (url === '/api/clara-state/patch' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      try {
        const body = await readJsonBodyFromNodeRequest(req)
        const result = await postClaraStatePatchRequest(repoRoot, body)
        if (result.ok) {
          res.statusCode = 200
          res.end(JSON.stringify(result))
        } else {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: result.error }))
        }
      } catch (e) {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
      }
      return
    }

    next()
  }
}
