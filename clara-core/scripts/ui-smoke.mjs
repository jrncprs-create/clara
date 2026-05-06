/**
 * Minimal DOM/structure smoke test (Node, no browser).
 * Confirms rail + chat drawer wiring essentials exist in index.html.
 */
import fs from 'node:fs'
import path from 'node:path'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const root = path.resolve(process.cwd(), 'clara-core')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

// Rail buttons exist
for (const mode of ['home', 'chat', 'tasks', 'notes']) {
  assert(html.includes(`data-drawer="${mode}"`), `missing rail button data-drawer="${mode}"`)
}

// Dev/state button exists
assert(html.includes('data-action="dev"'), 'missing dev/state rail action')

// Drawer scaffold exists
assert(html.includes('id="context-drawer"'), 'missing context drawer')
assert(html.includes('id="drawer-body"'), 'missing drawer body')

// Daypart toggle scaffold exists (visibility is runtime)
assert(html.includes('id="daypart-toggle"'), 'missing daypart toggle')

// No global composer in shell
assert(!html.includes('id="composer"'), 'global composer should not exist')

console.log('ui-smoke: OK')

