import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = path.join(ROOT, 'app.js');
const appJs = fs.readFileSync(APP, 'utf8');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

// Ensure central guard exists
if (!appJs.includes('function isForbiddenLaLampePlanText')) fail('missing isForbiddenLaLampePlanText in app.js');
if (!appJs.includes('function sanitizeOrReplaceLaLampeProjectPlan')) fail('missing sanitizeOrReplaceLaLampeProjectPlan in app.js');

// Forbidden terms must be present in the guard pattern (static drift check)
const mustMention = [
  'lampwezen',
  'nachtdiert',
  'landjuweel',
  'amarte',
  'voetconstructie',
  'servo',
  'sensor',
  'beeldenroute',
];
for (const s of mustMention) {
  if (!appJs.toLowerCase().includes(s)) fail(`guard does not mention "${s}" (or code drifted)`);
}

// Ensure the guard is applied on key routes
const routeMarkers = [
  'validateAiPlanAgainstMessage',
  'sanitizeOrReplaceLaLampeProjectPlan(plan)',
  'openProjectPlanOverlay',
  "getProjectVisual(proj).key==='lalampe'",
];
for (const m of routeMarkers) {
  if (!appJs.includes(m)) fail(`missing route marker: ${m}`);
}

console.log('OK: LaLampe anti-leak guards present');
if (process.exitCode) process.exit(process.exitCode);

