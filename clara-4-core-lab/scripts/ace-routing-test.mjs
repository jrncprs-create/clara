import assert from 'node:assert/strict';
import { __testables } from '../api/ace.js';

const cases = [
  {
    input: 'ACE test: LaLampe workshopflow simpeler maken.',
    project: 'lalampe',
    target_file: 'projectbrain/raw/lalampe.md'
  },
  {
    input: 'ACE production write werkt nu voor Clara Core Lab.',
    project: 'clara-core-lab',
    target_file: 'projectbrain/raw/clara-core-lab.md'
  },
  {
    input: 'Landjuweel en Amarte planning rond lichtbeeldenroute aanscherpen.',
    project: 'afk-landjuweel-amarte',
    target_file: 'projectbrain/raw/afk-landjuweel-amarte.md'
  }
];

for (const item of cases) {
  const result = __testables.classifyHeuristically({ input: item.input, project_hint: '' });
  assert.equal(result.route, 'project', item.input);
  assert.equal(result.project, item.project, item.input);
  assert.equal(__testables.resolveTargetFile(result.route, result.project), item.target_file, item.input);
  console.log(`${item.input} -> ${result.project} -> ${item.target_file}`);
}
