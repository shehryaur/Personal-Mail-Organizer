// Tests for apps-script/ModelCore.gs with the fixture model that
// `node trainer/train.js --synthetic` writes to tests/fixtures/model.fixture.js.
// Usage: node tests/model.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fixture = path.join(__dirname, 'fixtures', 'model.fixture.js');
if (!fs.existsSync(fixture)) {
  console.log('No fixture model yet. Run: node trainer/train.js --synthetic');
  process.exit(1);
}

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : '\n     ' + detail));
};

// The same three files Apps Script loads, in one shared global scope
const gas = {
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
};
vm.createContext(gas);
vm.runInContext(read('apps-script/ModelCore.gs') + '\n' + fs.readFileSync(fixture, 'utf8') + '\n' + read('apps-script/Code.gs') +
  '\nthis.MODEL=MODEL;this.predictEmail=predictEmail;this.emailTokens=emailTokens;this.analyzeEmail=analyzeEmail;', gas);
const MODEL = gas.MODEL;

const email = { from: 'Lumen Talent <talent@lumen-analytics.com>', subject: 'Next step: video assessment',
  body: 'Please record a short video for our assessment within 7 days of receiving this email. https://app.hirevue.com/x', labels: ['Applied'] };

// Tokens
const t = gas.emailTokens(email);
check('tokens: sender domain', t.has('dom:lumen-analytics.com'));
check('tokens: subject words and pairs are prefixed', t.has('s:video') && t.has('s:video_assessment'));
check('tokens: body words and pairs', t.has('assessment') && t.has('short_video'));
check('tokens: link domains', t.has('url:hirevue.com'));
check('tokens: your own labels', t.has('lbl:applied'));
check('tokens: stop words dropped', !t.has('the') && !t.has('for'));

// The model file
check('fixture: one weight per class for every feature', Object.values(MODEL.features).every(row => row.length === MODEL.classes.length + 1));
check('fixture: a threshold for every class', MODEL.classes.every(c => typeof MODEL.thresholds[c] === 'number'));

// Prediction
const p = gas.predictEmail(MODEL, email);
const sum = Object.values(p.probs).reduce((a, b) => a + b, 0);
check('predict: probabilities add up to 1', Math.abs(sum - 1) < 1e-9, sum);
check('predict: the top class is the category', p.probs[p.category] === Math.max(...Object.values(p.probs)));
check('predict: an assessment invite is read as an assessment', p.category === 'assessment', JSON.stringify(p));
check('predict: deterministic', JSON.stringify(gas.predictEmail(MODEL, email)) === JSON.stringify(p));

// Node and Apps Script compute the same thing (the trainer runs ModelCore.gs on its own)
const node = {};
vm.createContext(node);
vm.runInContext(read('apps-script/ModelCore.gs') + '\nthis.predictEmail=predictEmail;', node);
const fresh = JSON.parse(JSON.stringify(MODEL));
check('trainer and Apps Script give identical probabilities', JSON.stringify(node.predictEmail(fresh, email).probs) === JSON.stringify(p.probs));

// Through the real pipeline with the fixture model
const r = gas.analyzeEmail(email.from, email.subject, email.body, new Date('2026-10-20T11:15:00Z'), { labels: email.labels });
check('pipeline: model-decided assessment with its deadline', r.source === 'model' && (r.stage === 'assessment' || r.stage === 'review') &&
  (r.stage !== 'assessment' || r.deadline === '2026-10-27'), JSON.stringify(r));

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
