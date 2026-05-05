/**
 * Gedeelde Clara State API-logica (Node): lezen/schrijven CLARA_STATE/core.json + patches.
 * Gebruikt door Vercel serverless, Vite dev-middleware en smoke-tests.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import 'temporal-polyfill/global'
import { applyClaraStatePatch } from '../clara-core/src/claraStatePatch.js'

/** @param {string} repoRoot Absolute pad naar repo-root */
export function getClaraStatePath(repoRoot) {
  return path.join(repoRoot, 'CLARA_STATE', 'core.json')
}

/** @param {string} repoRoot */
export async function readClaraState(repoRoot) {
  const p = getClaraStatePath(repoRoot)
  const raw = await fs.readFile(p, 'utf8')
  return JSON.parse(raw)
}

/** @param {string} repoRoot @param {object} state */
export async function writeClaraState(repoRoot, state) {
  const p = getClaraStatePath(repoRoot)
  const text = `${JSON.stringify(state, null, 2)}\n`
  await fs.writeFile(p, text, 'utf8')
}

/**
 * @param {string} repoRoot
 * @param {object} body { patch?, patches?, source? }
 * @returns {{ ok: true, state: object, applied: object[] } | { ok: false, error: string }}
 */
export async function postClaraStatePatchRequest(repoRoot, body) {
  const patches = []
  if (Array.isArray(body?.patches)) {
    patches.push(...body.patches)
  } else if (body?.patch) {
    patches.push(body.patch)
  } else {
    return { ok: false, error: 'Verwacht "patch" of "patches"' }
  }

  let next
  try {
    next = await readClaraState(repoRoot)
  } catch (e) {
    return { ok: false, error: `Lezen mislukt: ${e instanceof Error ? e.message : String(e)}` }
  }

  const applied = []
  try {
    for (const p of patches) {
      next = applyClaraStatePatch(next, p)
      applied.push(p)
    }
    await writeClaraState(repoRoot, next)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return { ok: true, state: next, applied }
}

/** Standaard repo-root op Vercel / lokaal: `process.cwd()` (override met CLARA_REPO_ROOT). */
export function defaultRepoRoot() {
  return process.env.CLARA_REPO_ROOT || process.cwd()
}

/** @param {import('node:http').IncomingMessage} req */
export async function readJsonBodyFromNodeRequest(req) {
  const text = await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 2_000_000) {
        reject(new Error('Body te groot'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
  return JSON.parse(text || '{}')
}
