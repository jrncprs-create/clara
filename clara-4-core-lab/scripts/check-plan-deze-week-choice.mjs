import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = path.join(ROOT, 'app.js');
const appJs = fs.readFileSync(APP, 'utf8');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

const required = [
  'function addProjectPlanNoFitChoicePrompt',
  'data-pp-plan-choice',
  "mode==='next_workday'",
  "mode==='week_spread'",
  "mode==='one_day'",
  'Te weinig ruimte · keuze nodig.',
];
for (const r of required) {
  if (!appJs.includes(r)) fail(`missing marker: ${r}`);
}

// Ensure we don’t emit only [Past niet] when nothing planned
if (!appJs.includes('if(!planned && (notFit||waiting))')) fail('missing planned==0 choice branch');

console.log('OK: plan-deze-week choice guard present');
if (process.exitCode) process.exit(process.exitCode);

