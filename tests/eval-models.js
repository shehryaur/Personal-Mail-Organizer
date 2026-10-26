// Measures the optional AI classifier (the actual Code.gs pipeline with no trained
// model: fast model, strong model for unsure cases) against a real provider.
// The trained model is measured by trainer/train.js instead.
//
//   PowerShell:
//     $env:AI_KEY = "nvapi-..."
//     node tests/eval-models.js --synthetic                  # 149 hand-written tricky emails with known answers
//     node tests/eval-models.js --csv "C:\path\export.csv"   # your real emails, checked against a teacher model
//
// Optional: $env:AI_FAST_MODEL, $env:AI_STRONG_MODEL, $env:AI_TEACHER_MODEL, $env:AI_BASE_URL
// Only the test emails / CSV rows are sent to the provider. The key stays in this terminal.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const KEY = process.env.AI_KEY || process.env.NIM_KEY;
if (!KEY) {
  console.log('Set your key first, e.g. in PowerShell:  $env:AI_KEY = "nvapi-..."');
  process.exit(1);
}
const args = process.argv.slice(2);
const mode = args.includes('--csv') ? 'csv' : args.includes('--synthetic') ? 'synthetic' : null;
if (!mode) {
  console.log('Usage: node tests/eval-models.js --synthetic   |   node tests/eval-models.js --csv <file.csv>');
  process.exit(1);
}
const TEACHER = process.env.AI_TEACHER_MODEL || 'deepseek-ai/deepseek-v4.1-flash'; // a different model family than the pipeline's
const BATCH = Number(process.env.EVAL_BATCH || 10);

// ---- real HTTP, done in a child process so UrlFetchApp can stay synchronous like Apps Script
function httpBatch(requests) {
  const out = execFileSync(process.execPath, ['-e', `
    let input = ''; process.stdin.on('data', d => (input += d)).on('end', async () => {
      const reqs = JSON.parse(input);
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const one = async r => {
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await fetch(r.url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, r.headers), body: r.payload });
            const text = await res.text();
            if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(2000 * Math.pow(2, attempt)); continue; }
            return { code: res.status, text };
          } catch (e) {
            if (attempt < 2) { await sleep(2000); continue; }
            return { code: 599, text: String(e) };
          }
        }
      };
      const results = new Array(reqs.length);
      let next = 0;
      const worker = async () => { while (next < reqs.length) { const i = next++; results[i] = await one(reqs[i]); } };
      await Promise.all(Array.from({ length: Math.min(5, reqs.length) }, worker)); // at most 5 at a time
      process.stdout.write(JSON.stringify(results));
    });`], { input: JSON.stringify(requests), env: process.env, timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.toString()).map(r => ({ getResponseCode: () => r.code, getContentText: () => r.text }));
}

let calls = 0;
const props = {
  AI_KEY: KEY,
  AI_BASE_URL: process.env.AI_BASE_URL || null,
  AI_FAST_MODEL: process.env.AI_FAST_MODEL || null,
  AI_STRONG_MODEL: process.env.AI_STRONG_MODEL || null,
};
const ctx = {
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null }) },
  UrlFetchApp: {
    fetch: (url, params) => { calls++; return httpBatch([Object.assign({ url }, params)])[0]; },
    fetchAll: reqs => { calls += reqs.length; return httpBatch(reqs); },
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8') +
  '\nthis.analyzeEmail=analyzeEmail;this.prefetchBatch=prefetchBatch;this.prefetchModel=prefetchModel;' +
  'this.modelCacheKey=modelCacheKey;this.cleanBody=cleanBody;this.aiSettings=aiSettings;this.MODEL_CACHE=MODEL_CACHE;', ctx);

const settings = ctx.aiSettings();
console.log(`Provider: ${settings.baseUrl}\nFast model: ${settings.fast}\nStrong model: ${settings.strong}` +
  (mode === 'csv' ? `\nTeacher model: ${TEACHER}` : '') + '\n');

/** Runs the real pipeline over emails [{from, subject, body, date}] in parallel batches */
function classifyAll(emails) {
  const out = [];
  const ai = { broken: false };
  const ledger = { isKnownThread: () => false };
  for (let i = 0; i < emails.length; i += BATCH) {
    const chunk = emails.slice(i, i + BATCH);
    ctx.prefetchBatch(chunk.map((e, j) => ({ thread: { getId: () => 't' + (i + j) }, email: e })), '', ledger, ai);
    chunk.forEach(e => out.push(ctx.analyzeEmail(e.from, e.subject, e.body, e.date, { knownThread: false, ai })));
    process.stdout.write(`\r  classified ${out.length}/${emails.length}`);
    if (ai.broken) {
      const fatal = Array.from(ctx.MODEL_CACHE.values()).find(r => r && r.fatal);
      console.log('\nStopped: ' + (fatal ? fatal.error : 'the model is unavailable or the key was refused.'));
      if (fatal && /refused/.test(fatal.error)) {
        console.log('Check the key: in PowerShell run   $env:AI_KEY = "<your real key, starting with nvapi->"   (not the placeholder text).');
      }
      process.exit(1);
    }
  }
  process.stdout.write('\n');
  return out;
}

const started = Date.now();

if (mode === 'synthetic') {
  // ---- known answers from the two hand-written sets
  const sets = [];
  const { cases: holdout, RECEIVED } = require('./holdout.test.js');
  holdout.forEach(c => {
    let want = null;
    if (c.kind === 'NONJOB') want = ['not_job'];
    else if (c.kind === 'REJECT') want = ['rejected'];
    else if (c.kind === 'RECEIPT') want = c.exp.stage || ['applied'];
    else if (c.exp.stage) want = c.exp.stage;
    sets.push({ set: 'blind', name: c.name, email: { from: c.from, subject: c.subject, body: c.body, date: RECEIVED }, want,
      deadline: c.exp.deadline || null, mustStay: c.kind === 'ACTION' || c.kind === 'DEADLINE' || c.exp.visible === true });
  });
  const { cases: adversarial, TUE } = require('./adversarial.test.js');
  adversarial.forEach(c => {
    const e = c.expect || {};
    const want = e.prefilter === false ? ['not_job'] : e.stage ? [e.stage] : null;
    sets.push({ set: 'tricky', name: c.name, email: { from: c.from, subject: c.subject, body: c.body, date: c.date || TUE }, want,
      deadline: e.deadline || null, mustStay: e.archived === false || e.action_needed === true });
  });

  const results = classifyAll(sets.map(s => s.email));
  let scored = 0, right = 0, hidden = 0, dlScored = 0, dlRight = 0, review = 0;
  const wrong = [];
  sets.forEach((s, i) => {
    const r = results[i];
    if (r.stage === 'review') review++;
    if (s.want) {
      scored++;
      if (s.want.includes(r.stage)) right++;
      else wrong.push(`  [${s.set}] ${s.name}: expected ${s.want.join('/')}, got ${r.stage} (${r.confidence}, ${r.source})`);
    }
    if (s.mustStay && ['not_job', 'applied', 'rejected'].includes(r.stage)) { hidden++; wrong.push(`  !! [${s.set}] ${s.name}: needs action but was filed as ${r.stage}`); }
    if (s.deadline) {
      dlScored++;
      if (r.deadline === s.deadline) dlRight++;
      else wrong.push(`  [${s.set}] ${s.name}: deadline expected ${s.deadline}, got ${r.deadline}`);
    }
  });
  console.log(`\nCategory correct:      ${right}/${scored} (${Math.round((100 * right) / scored)}%)`);
  console.log(`Deadlines correct:     ${dlRight}/${dlScored}`);
  console.log(`Important emails lost (filed as not_job/applied/rejected): ${hidden}`);
  console.log(`Sent to "review" (unsure):                                ${review}`);
  console.log(`Model requests: ${calls}, time: ${Math.round((Date.now() - started) / 1000)} s\n`);
  if (wrong.length) console.log('Misses:\n' + wrong.join('\n'));
}

if (mode === 'csv') {
  // ---- your real emails: does the everyday pipeline agree with a much bigger teacher model?
  const file = args[args.indexOf('--csv') + 1];
  const parseCsv = text => {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') q = false;
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  };
  const table = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const head = table[0];
  const col = n => head.indexOf(n);
  const emails = table.slice(1).filter(r => r[col('Message ID')]).map(r => ({
    from: r[col('Sender')] || '',
    subject: r[col('Subject')] || '',
    body: r[col('Snippet')] || '', // the export only has a 200-character snippet
    date: new Date(r[col('Date')] || Date.now()),
  }));
  console.log(`${emails.length} emails from ${path.basename(file)} (sender, subject and the 200-character snippet only)\n`);

  console.log('Teacher model labels…');
  const items = emails.map(e => ({ from: e.from, subject: e.subject, body: ctx.cleanBody(e.body), context: { knownThread: false } }));
  for (let i = 0; i < items.length; i += BATCH) {
    ctx.prefetchModel(TEACHER, items.slice(i, i + BATCH));
    process.stdout.write(`\r  labelled ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }
  process.stdout.write('\n');
  const teacher = items.map(x => ctx.MODEL_CACHE.get(ctx.modelCacheKey(TEACHER, x)));
  const teacherFailed = teacher.filter(t => !t || !t.ok).length;
  if (teacherFailed === items.length) { console.log('The teacher model gave no usable answers (' + (teacher[0] && teacher[0].error) + ').'); process.exit(1); }

  console.log('Everyday pipeline…');
  const teacherCalls = calls;
  const results = classifyAll(emails);
  const pipelineCalls = calls - teacherCalls;

  let agree = 0, compared = 0, review = 0;
  const confusion = {};
  const disagreements = [];
  results.forEach((r, i) => {
    const t = teacher[i];
    if (!t || !t.ok) return;
    compared++;
    if (r.stage === 'review') review++;
    if (t.result.category === r.stage) agree++;
    else {
      const k = `${t.result.category} -> ${r.stage}`;
      confusion[k] = (confusion[k] || 0) + 1;
      disagreements.push(`  teacher ${t.result.category}, pipeline ${r.stage} (${r.confidence}): ${emails[i].subject.slice(0, 80)}`);
    }
  });
  console.log(`\nAgreement with the teacher: ${agree}/${compared} (${Math.round((100 * agree) / compared)}%)` +
    (teacherFailed ? `  [${teacherFailed} teacher answers unusable, skipped]` : ''));
  console.log(`Sent to "review" (unsure): ${review}`);
  console.log(`Model requests: pipeline ${pipelineCalls} for ${emails.length} emails (${(pipelineCalls / emails.length).toFixed(2)} per email), teacher ${teacherCalls}`);
  console.log(`Time: ${Math.round((Date.now() - started) / 1000)} s\n`);
  const pairs = Object.entries(confusion).sort((a, b) => b[1] - a[1]);
  if (pairs.length) console.log('Where they differ (teacher -> pipeline):\n' + pairs.map(([k, n]) => `  ${n}x ${k}`).join('\n') + '\n');
  if (disagreements.length) console.log('Examples:\n' + disagreements.slice(0, 40).join('\n'));
}
