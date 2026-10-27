// Trains the Job Tracker's email classifier and writes it as an Apps Script file.
//
//   Your mail:   node trainer/train.js --export data/training-export.csv --labels data/labels.csv
//   Test data:   node trainer/train.js --synthetic        (writes tests/fixtures/model.fixture.js)
//
// Model: word features (apps-script/ModelCore.gs, the same code Apps Script runs)
// + softmax regression. Prints 5-fold cross-validated accuracy, the confusion
// matrix and "dangerous mistakes" (an assessment/interview/offer the model would
// call a receipt, rejection or not a job email, or any job email it would drop as
// not_job). Each category gets a confidence threshold below which the email goes
// to "review" instead, picked so there are 0 dangerous mistakes in cross-validation.
// No dependencies; nothing leaves your computer.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CLASSES = ['not_job', 'applied', 'assessment', 'interview', 'rejected', 'offer', 'other'];
const IMPORTANT = new Set(['assessment', 'interview', 'offer']);
const MAX_FEATURES = 6000;
const EPOCHS = 300;
const L2 = 1e-4;
const LR = 0.05;
const FOLDS = 5;
const MIN_THRESHOLD = 0.5;

// ---- ModelCore.gs, exactly as Apps Script runs it --------------------------
const core = {};
vm.createContext(core);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'ModelCore.gs'), 'utf8') +
  '\nthis.emailTokens=emailTokens;this.featureVector=featureVector;this.softmax=softmax;this.predictEmail=predictEmail;', core);

// ---- Arguments ---------------------------------------------------------------
const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const synthetic = args.includes('--synthetic');
const outPath = arg('--out') || (synthetic ? path.join(ROOT, 'tests', 'fixtures', 'model.fixture.js') : path.join(ROOT, 'apps-script', 'Model.gs'));

// ---- Data --------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim().toLowerCase());
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
}

function syntheticExamples() {
  const { cases: holdout } = require(path.join(ROOT, 'tests', 'holdout.test.js'));
  const { cases: adversarial } = require(path.join(ROOT, 'tests', 'adversarial.test.js'));
  const out = [];
  holdout.forEach(c => {
    const stage = c.exp && c.exp.stage ? [].concat(c.exp.stage)[0] : null;
    const label = { ACTION: stage, DEADLINE: stage || 'assessment', REJECT: 'rejected', RECEIPT: stage || 'applied', NONJOB: 'not_job' }[c.kind] || stage;
    if (CLASSES.includes(label)) out.push({ from: c.from, subject: c.subject, body: c.body, labels: [], label });
  });
  adversarial.forEach(c => {
    const e = c.expect || {};
    const label = e.stage || (e.prefilter === false ? 'not_job' : null);
    if (CLASSES.includes(label)) out.push({ from: c.from, subject: c.subject, body: c.body, labels: [], label });
  });
  return out;
}

// trainer/synthetic/*.js: more hand-written emails (other languages, odd wording,
// keywords pointing the wrong way). Training only; tests/edge-cases.js stays unseen.
function extraWrittenExamples() {
  const dir = path.join(ROOT, 'trainer', 'synthetic');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).flatMap(f =>
    require(path.join(dir, f)).emails.filter(e => CLASSES.includes(e.label))
      .map(e => ({ from: e.from, subject: e.subject, body: e.body, labels: [], label: e.label })));
}

function realExamples() {
  const exportPath = arg('--export');
  const labelsPath = arg('--labels');
  if (!exportPath || !labelsPath) {
    console.log('Usage: node trainer/train.js --export data/training-export.csv --labels data/labels.csv\n' +
      '   or: node trainer/train.js --synthetic');
    process.exit(1);
  }
  const emails = new Map(parseCsv(fs.readFileSync(exportPath, 'utf8')).map(r => [String(r.message_id).replace(/^'/, ''), r]));
  const out = [];
  let unknown = 0;
  parseCsv(fs.readFileSync(labelsPath, 'utf8')).forEach(l => {
    const e = emails.get(String(l.message_id).replace(/^'/, ''));
    const label = String(l.category || '').trim().toLowerCase();
    if (!e || !CLASSES.includes(label)) { unknown++; return; }
    out.push({ from: e.from, subject: e.subject, body: e.body, labels: String(e.labels || '').split(';').map(s => s.trim()).filter(Boolean), label });
  });
  if (unknown) console.log(`(skipped ${unknown} label rows with no matching email or an unknown category)`);
  return out;
}

const examples = synthetic ? syntheticExamples() : realExamples();
// --with-synthetic: the hand-written test emails join every training set (never a
// test set), adding interview/assessment/offer examples that real mail has few of
const extra = !synthetic && args.includes('--with-synthetic') ? syntheticExamples().concat(extraWrittenExamples()) : [];
const K = CLASSES.length;
examples.concat(extra).forEach(e => { e.y = CLASSES.indexOf(e.label); e.tokens = core.emailTokens(e); });
if (extra.length) console.log(`+ ${extra.length} hand-written emails, used for training only`);
console.log(`${examples.length} labelled emails: ` + CLASSES.map(c => `${c} ${examples.filter(e => e.label === c).length}`).join(', '));

// ---- Training ------------------------------------------------------------------
function buildVocab(docs, keep) {
  const df = new Map();
  docs.forEach(d => d.tokens.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const minDf = docs.length < 500 ? 1 : 2;
  const tokens = [...df.keys()].filter(t => df.get(t) >= minDf && (!keep || keep.has(t))).sort();
  const index = new Map(tokens.map((t, i) => [t, i]));
  const idf = tokens.map(t => Math.log((1 + docs.length) / (1 + df.get(t))) + 1);
  return { tokens, index, idf };
}

function vectorize(doc, vocab) {
  return core.featureVector(doc.tokens, t => vocab.index.get(t), i => vocab.idf[i]);
}

function train(docs, vocab) {
  const V = vocab.tokens.length;
  const X = docs.map(d => vectorize(d, vocab));
  const counts = CLASSES.map((_, k) => docs.filter(d => d.y === k).length);
  // Rare categories (offers, assessments) weigh more, so they aren't drowned out
  const cw = counts.map(n => (n ? Math.min(10, docs.length / (K * n)) : 0));
  const W = new Float64Array(V * K), b = new Float64Array(K);
  const mW = new Float64Array(V * K), vW = new Float64Array(V * K), mb = new Float64Array(K), vb = new Float64Array(K);
  const gW = new Float64Array(V * K), gb = new Float64Array(K);
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let wsum = 0;
  docs.forEach(d => { wsum += cw[d.y]; });
  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    gW.fill(0); gb.fill(0);
    for (let n = 0; n < docs.length; n++) {
      const x = X[n];
      const s = Array.from(b);
      x.forEach(([i, v]) => { for (let k = 0; k < K; k++) s[k] += v * W[i * K + k]; });
      const p = core.softmax(s);
      const w = cw[docs[n].y] / wsum;
      for (let k = 0; k < K; k++) {
        const g = w * (p[k] - (k === docs[n].y ? 1 : 0));
        gb[k] += g;
        x.forEach(([i, v]) => { gW[i * K + k] += g * v; });
      }
    }
    const t1 = 1 - Math.pow(b1, epoch), t2 = 1 - Math.pow(b2, epoch);
    for (let j = 0; j < W.length; j++) {
      const g = gW[j] + L2 * W[j];
      mW[j] = b1 * mW[j] + (1 - b1) * g;
      vW[j] = b2 * vW[j] + (1 - b2) * g * g;
      W[j] -= LR * (mW[j] / t1) / (Math.sqrt(vW[j] / t2) + eps);
    }
    for (let k = 0; k < K; k++) {
      mb[k] = b1 * mb[k] + (1 - b1) * gb[k];
      vb[k] = b2 * vb[k] + (1 - b2) * gb[k] * gb[k];
      b[k] -= LR * (mb[k] / t1) / (Math.sqrt(vb[k] / t2) + eps);
    }
  }
  return { vocab, W, b };
}

function toModel(m, extra) {
  const features = {};
  m.vocab.tokens.forEach((t, i) => {
    const row = [round(m.vocab.idf[i], 4)];
    for (let k = 0; k < K; k++) row.push(round(m.W[i * K + k], 3));
    features[t] = row;
  });
  return Object.assign({ classes: CLASSES, bias: Array.from(m.b, v => round(v, 3)), features }, extra || {});
}
const round = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

/** Keep the features that matter most, so Model.gs stays small */
function topFeatures(m, max) {
  const scored = m.vocab.tokens.map((t, i) => {
    let s = 0;
    for (let k = 0; k < K; k++) s = Math.max(s, Math.abs(m.W[i * K + k]));
    return [t, s];
  }).sort((a, b) => b[1] - a[1]);
  return new Set(scored.slice(0, max).map(x => x[0]));
}

function fit(docs) {
  const full = train(docs, buildVocab(docs));
  if (full.vocab.tokens.length <= MAX_FEATURES) return full;
  // Retrain on the kept features so the scaling matches what Apps Script sees
  return train(docs, buildVocab(docs, topFeatures(full, MAX_FEATURES)));
}

// ---- Cross-validation ----------------------------------------------------------
const isDangerous = (truth, pred) => truth !== pred &&
  ((truth !== 'not_job' && pred === 'not_job') || (IMPORTANT.has(truth) && !IMPORTANT.has(pred)));

function crossValidate() {
  // Stratified folds: each category spread evenly
  const fold = new Array(examples.length);
  CLASSES.forEach((_, k) => {
    examples.map((e, i) => [e, i]).filter(([e]) => e.y === k).forEach(([, i], j) => { fold[i] = j % FOLDS; });
  });
  const preds = new Array(examples.length);
  for (let f = 0; f < FOLDS; f++) {
    const trainIdx = examples.map((_, i) => i).filter(i => fold[i] !== f);
    const testIdx = examples.map((_, i) => i).filter(i => fold[i] === f);
    if (!testIdx.length) continue;
    const model = toModel(fit(trainIdx.map(i => examples[i]).concat(extra)));
    testIdx.forEach(i => { preds[i] = core.predictEmail(model, examples[i]); });
    process.stdout.write(`  fold ${f + 1}/${FOLDS} done\n`);
  }
  return preds;
}

function pickThresholds(preds) {
  const thresholds = {};
  CLASSES.forEach(c => {
    let worst = 0;
    preds.forEach((p, i) => {
      if (p && p.category === c && isDangerous(examples[i].label, c)) worst = Math.max(worst, p.confidence);
    });
    thresholds[c] = round(Math.max(MIN_THRESHOLD, worst > 0 ? Math.min(1.01, worst + 0.005) : 0), 3);
  });
  return thresholds;
}

// The not_job threshold alone sends hundreds of newsletters to "review". Second
// rule: an email that leans not_job is also accepted as not_job when its combined
// chance of being an assessment, interview or offer is below this. Picked as the
// largest value at which no assessment, interview or offer in cross-validation
// would be filed as not_job.
const IMPORTANT_MAX_GRID = [0.3, 0.25, 0.2, 0.15, 0.1, 0.08, 0.05, 0.03, 0.02, 0.01, 0];
const importantSum = p => ['assessment', 'interview', 'offer'].reduce((s, c) => s + p.probs[c], 0);
function pickImportantMax(preds, thresholds) {
  return IMPORTANT_MAX_GRID.find(t => !preds.some((p, i) =>
    p.category === 'not_job' && p.confidence < thresholds.not_job && importantSum(p) < t && IMPORTANT.has(examples[i].label)));
}
const isSure = (p, thresholds, importantMax) =>
  p.confidence >= thresholds[p.category] || (p.category === 'not_job' && importantSum(p) < importantMax);

function report(preds, thresholds, importantMax) {
  const pad = (s, n) => String(s).padEnd(n);
  const conf = CLASSES.map(() => CLASSES.map(() => 0));
  preds.forEach((p, i) => { conf[examples[i].y][CLASSES.indexOf(p.category)]++; });
  const correct = preds.filter((p, i) => p.category === examples[i].label).length;
  console.log(`\nCross-validated (${FOLDS}-fold), before thresholds: ${correct}/${preds.length} correct (${Math.round(correct / preds.length * 100)}%)`);
  console.log('\nPer category        precision  recall');
  CLASSES.forEach((c, k) => {
    const tp = conf[k][k];
    const predicted = conf.reduce((s, row) => s + row[k], 0);
    const actual = conf[k].reduce((s, v) => s + v, 0);
    console.log(`  ${pad(c, 18)}${pad(predicted ? Math.round(tp / predicted * 100) + '%' : '-', 11)}${actual ? Math.round(tp / actual * 100) + '%' : '-'}  (${actual} emails)`);
  });
  console.log('\nConfusion (rows = true, columns = predicted)');
  console.log('  ' + pad('', 12) + CLASSES.map(c => pad(c.slice(0, 9), 10)).join(''));
  CLASSES.forEach((c, k) => console.log('  ' + pad(c, 12) + conf[k].map(v => pad(v, 10)).join('')));

  const before = preds.filter((p, i) => isDangerous(examples[i].label, p.category));
  let decided = 0, reviewed = 0, decidedRight = 0;
  const after = [];
  const lowValueDropped = [];
  preds.forEach((p, i) => {
    if (isSure(p, thresholds, importantMax)) {
      decided++;
      if (p.category === 'not_job' && examples[i].label !== 'not_job' && !IMPORTANT.has(examples[i].label)) lowValueDropped.push(i);
      if (p.category === examples[i].label) decidedRight++;
      if (isDangerous(examples[i].label, p.category)) after.push(i);
    } else reviewed++;
  });
  console.log(`\nDangerous mistakes before thresholds: ${before.length}`);
  before.slice(0, 15).forEach(p => {
    const i = preds.indexOf(p);
    console.log(`  true ${examples[i].label} → said ${p.category} (${p.confidence.toFixed(2)}): ${String(examples[i].subject).slice(0, 70)}`);
  });
  const toReview = {};
  preds.forEach(p => { if (!isSure(p, thresholds, importantMax)) toReview[p.category + '?'] = (toReview[p.category + '?'] || 0) + 1; });
  console.log('\nThresholds: ' + CLASSES.map(c => `${c} ${thresholds[c]}`).join(', ') +
    `; also not_job when assessment+interview+offer < ${importantMax}`);
  console.log('Sent to review, by what the model leaned towards: ' + JSON.stringify(toReview));
  console.log(`With thresholds: ${decided} decided automatically (${decided ? Math.round(decidedRight / decided * 100) : 0}% right), ` +
    `${reviewed} go to "review" for a look, assessments/interviews/offers lost: ${after.filter(i => IMPORTANT.has(examples[i].label)).length}`);
  console.log(`Other job emails filed as not_job (receipts, surveys, follow-ups): ${lowValueDropped.length}` +
    lowValueDropped.slice(0, 12).map(i => `\n  ${examples[i].label}: ${String(examples[i].subject).slice(0, 70)}`).join(''));
}

// ---- Run -------------------------------------------------------------------------
if (examples.length < FOLDS * 2) {
  console.log('Not enough labelled emails to train.');
  process.exit(1);
}
console.log('\nCross-validating…');
const preds = crossValidate();
if (arg('--dump')) fs.writeFileSync(arg('--dump'), JSON.stringify(preds.map((p, i) => ({ label: examples[i].label, probs: p.probs, subject: String(examples[i].subject).slice(0, 80) }))));
const thresholds = pickThresholds(preds);
const importantMax = pickImportantMax(preds, thresholds);
report(preds, thresholds, importantMax);

console.log('\nTraining the final model on all emails…');
const final = fit(examples.concat(extra));
const model = toModel(final, {
  trainedAt: new Date().toISOString().slice(0, 10),
  trainedOn: examples.length,
  thresholds,
  importantMax
});
const header = '// Made by trainer/train.js on ' + model.trainedAt + ' from ' + examples.length + ' labelled emails. Do not edit by hand.\n' +
  (synthetic ? '// Test fixture: trained on the synthetic emails in tests/, not on real mail.\n' : '// Contains words from your own emails: keep it out of git (it is in .gitignore).\n');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + 'const MODEL = ' + JSON.stringify(model) + ';\n');
console.log(`Wrote ${path.relative(ROOT, outPath)} (${Math.round(fs.statSync(outPath).size / 1024)} KB, ${Object.keys(model.features).length} features).`);
if (!synthetic) console.log('Next: in Apps Script, add a file named Model, paste this file\'s contents, save, and run processInbox.');
