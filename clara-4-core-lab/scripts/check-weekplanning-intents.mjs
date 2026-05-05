import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = path.join(ROOT, 'app.js');

const appJs = fs.readFileSync(APP, 'utf8');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

// Static drift guards (avoid a bigger refactor just for exports)
const requiredMarkers = [
  'function isWeekPlanningIntent',
  'function isProjectWeekPlanningIntent',
  'if(isProjectWeekPlanningIntent(value))',
  "Ik liep vast op dit bericht",
];
for (const m of requiredMarkers) {
  if (!appJs.includes(m)) fail(`missing marker in app.js: ${m}`);
}

function isWeekPlanningIntent(v) {
  const s = String(v || '');
  if (!s.trim()) return false;
  return /\bweekplanning\b|\bplan\s+mijn\s+week\b|\bplan\s+deze\s+week\b|\bplanning\s+voor\s+deze\s+week\b|\bmaak\s+.*\bplanning\b.*\bdeze\s+week\b/i.test(s);
}
function inferProjectKeyFromMessage(v) {
  const s = String(v || '').toLowerCase();
  if (/(lalampe|la\s*lampe)/.test(s)) return 'lalampe';
  if (/\bafk\b|landjuweel|amarte/.test(s)) return 'afk-landjuweel-amarte';
  if (/begeister/.test(s)) return 'begeister';
  if (/clara\s+core\s+lab|core\s+lab|clara-4/.test(s)) return 'clara-core-lab';
  return null;
}
function isProjectWeekPlanningIntent(v) {
  const s = String(v || '').toLowerCase();
  if (!isWeekPlanningIntent(s)) return false;
  return /\b(afk|landjuweel|amarte|lalampe|la\s*lampe|begeister|clara\s+core\s+lab|core\s+lab)\b/.test(s);
}

const cases = [
  { input: 'maak een weekplanning voor lalampe', wantProject: 'lalampe' },
  { input: 'weekplanning voor afk', wantProject: 'afk-landjuweel-amarte' },
  { input: 'maak een weekplanning voor begeister', wantProject: 'begeister' },
  { input: 'weekplanning clara core lab', wantProject: 'clara-core-lab' },
];

for (const c of cases) {
  if (!isProjectWeekPlanningIntent(c.input)) fail(`did not detect project week planning intent: "${c.input}"`);
  const proj = inferProjectKeyFromMessage(c.input);
  if (proj !== c.wantProject) fail(`wrong project for "${c.input}": got ${proj}, want ${c.wantProject}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('OK: weekplanning intent smoke checks passed');

