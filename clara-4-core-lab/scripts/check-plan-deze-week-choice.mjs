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
  'projectPlanOverlayPlanningChoice',
  'data-pp-plan-choice',
  "mode==='next_workday'",
  "mode==='week_spread'",
  "mode==='one_day'",
  "mode==='this_week_spread'",
  'Te weinig ruimte · kies in projectplan.',
];
for (const r of required) {
  if (!appJs.includes(r)) fail(`missing marker: ${r}`);
}

// Ensure we don’t emit only [Past niet] when nothing planned (choice should be in overlay, not chat)
if (!appJs.includes('if(!planned && (notFit||waiting))')) fail('missing planned==0 choice branch');
if (appJs.includes('addProjectPlanNoFitChoicePrompt')) fail('chat choice prompt should not exist');
if (appJs.includes('data-pp-plan-choice="week_spread"')) fail('week_spread should not be offered for overlay "deze week" (use this_week_spread)');

console.log('OK: plan-deze-week choice guard present');
if (process.exitCode) process.exit(process.exitCode);

