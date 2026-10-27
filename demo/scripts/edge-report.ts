// Runs the real trained model (apps-script/Model.gs, or the test fixture if it's
// missing) and the dashboard's to-do rule over tests/edge-cases.js, and prints
// what it gets wrong. Exits 1 if any assessment/interview/offer is lost.
// Usage (from demo/): npx rolldown scripts/edge-report.ts -o ../data/edge-report.mjs --platform node && node ../data/edge-report.mjs
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { asksForAction } from '../src/utils/todo';
import type { Email, Stage } from '../src/types';

const root = join(process.cwd(), '..');
const require = createRequire(join(root, 'package.json'));
const { cases } = require(join(root, 'tests', 'edge-cases.js'));
const modelFile = existsSync(join(root, 'apps-script', 'Model.gs')) ? join(root, 'apps-script', 'Model.gs') : join(root, 'tests', 'fixtures', 'model.fixture.js');
const sandbox: Record<string, unknown> = { Logger: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } };
runInNewContext(readFileSync(join(root, 'apps-script', 'ModelCore.gs'), 'utf8') + '\n' + readFileSync(modelFile, 'utf8') + '\n' +
  readFileSync(join(root, 'apps-script', 'Code.gs'), 'utf8') + '\nthis.analyze = analyzeEmail;', sandbox);
const analyze = sandbox.analyze as (from: string, subject: string, body: string, date: Date, ctx: object) => { stage: string; confidence: number };

const IMPORTANT = new Set(['assessment', 'interview', 'offer']);
const received = new Date();
let right = 0, review = 0, lost = 0, todoRight = 0;
const wrong: string[] = [];
const conf: Record<string, number> = {};
for (const c of cases) {
  const r = analyze(c.from, c.subject, c.body, received, {});
  const stage = r.stage;
  if (stage === c.label) right++;
  else if (stage === 'review') review++;
  else {
    conf[`${c.label} -> ${stage}`] = (conf[`${c.label} -> ${stage}`] || 0) + 1;
    wrong.push(`  ${c.label} -> ${stage} (${r.confidence}): ${c.name}`);
  }
  if (IMPORTANT.has(c.label) && ['not_job', 'applied', 'rejected'].includes(stage)) lost++;
  // To-do decision on the true label (tests the rule itself, not the model)
  const email = { stage: (c.label === 'not_job' ? 'review' : c.label) as Stage, subject: c.subject, snippet: c.body.slice(0, 200) } as Email;
  const todo = c.label === 'not_job' ? false : asksForAction(email);
  if (todo === c.todo) todoRight++;
  else wrong.push(`  TODO ${c.todo ? 'missed' : 'false alarm'} [${c.label}]: ${c.name}`);
}
console.log(`Model file: ${modelFile.replace(root, '.')}`);
console.log(`Category: ${right}/${cases.length} exactly right, ${review} sent to review, ${cases.length - right - review} wrong`);
console.log(`Assessments/interviews/offers filed as not_job, applied or rejected: ${lost}`);
console.log(`To-do rule: ${todoRight}/${cases.length} right`);
console.log(Object.entries(conf).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}x ${k}`).join(', '));
console.log(wrong.join('\n'));
process.exitCode = lost ? 1 : 0;
