// End-to-end stress test of apps-script/Code.gs against an in-memory fake Gmail.
// Usage: node tests/stress.test.js   (always exits 0; it is a report)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const PROP_VALUE_LIMIT = 9 * 1024; // Apps Script: 9 KB per property value
const BASE_NOW = Date.parse('2026-10-23T12:00:00Z');

// ---------------------------------------------------------------- fakes
function makeEnv(opts = {}) {
  const env = {
    now: opts.now || BASE_NOW,
    threads: [],
    labels: new Map(),
    props: new Map(Object.entries(opts.props || {})),
    propWrites: [],
    sheets: new Map(),
    logs: [],
    fetches: [],
    triggers: [],
    ops: [],
    enforcePropLimit: opts.enforcePropLimit !== false,
    ai: opts.ai || defaultAi,
    nextId: 0x18a1b2c3d4e50000n,
    triggerSeq: 0,
  };
  if (opts.sheet !== false) {
    env.sheets.set('SHEET1', { rows: opts.sheetRows ? opts.sheetRows.map(r => r.slice()) : [] });
    if (!env.props.has('SPREADSHEET_ID')) env.props.set('SPREADSHEET_ID', 'SHEET1');
  }
  if (opts.nimKey !== false && !env.props.has('NIM_KEY')) env.props.set('NIM_KEY', 'nvapi-test');
  return env;
}

function newId(env) {
  const id = env.nextId.toString(16).padStart(16, '0');
  env.nextId += 0x1d3n; // keep 16 hex chars, monotonically increasing like Gmail ids
  return id;
}

function addThread(env, msgs, meta = {}) {
  const t = { id: null, messages: [], labels: new Set(), inInbox: true, meta };
  env.threads.push(t);
  msgs.forEach(m => addMessage(env, t, m));
  return t;
}

function addMessage(env, t, m) {
  const msg = Object.assign({ starred: false, sent: false }, m, { id: newId(env), date: new Date(m.date) });
  if (!t.id) t.id = msg.id; // Gmail thread id = id of first message
  t.messages.push(msg);
  t.messages.sort((a, b) => a.date - b.date);
  if (!msg.sent) t.inInbox = true; // a new incoming reply brings an archived thread back
  return msg;
}

function lastDate(t) {
  return Math.max(...t.messages.map(m => m.date.getTime()));
}

function labelObj(env, name) {
  return { getName: () => name, __name: name };
}

function wrapMessage(env, t, m) {
  return {
    getId: () => m.id,
    getFrom: () => m.from,
    getSubject: () => m.subject,
    getPlainBody: () => {
      if (m.throwOnBody) throw new Error('Exception: Service error: Gmail (simulated getPlainBody failure)');
      return m.body;
    },
    getDate: () => new Date(m.date.getTime()),
    isStarred: () => m.starred,
    star: function () {
      m.starred = true;
      env.ops.push({ op: 'star', thread: t.id, msg: m.id });
      return this;
    },
  };
}

function wrapThread(env, t) {
  return {
    getId: () => t.id,
    getMessages: () => t.messages.map(m => wrapMessage(env, t, m)),
    addLabel: function (label) {
      t.labels.add(label.__name);
      env.ops.push({ op: 'label', thread: t.id, label: label.__name });
      return this;
    },
    getLabels: () => [...t.labels].map(name => labelObj(env, name)),
    removeLabel: function (label) {
      t.labels.delete(label.__name);
      env.ops.push({ op: 'unlabel', thread: t.id, label: label.__name });
      return this;
    },
    moveToInbox: function () {
      t.inInbox = true;
      env.ops.push({ op: 'inbox', thread: t.id });
      return this;
    },
    moveToArchive: function () {
      t.inInbox = false;
      env.ops.push({ op: 'archive', thread: t.id });
      return this;
    },
  };
}

function defaultAi() {
  return {
    code: 200,
    text: JSON.stringify({
      choices: [{ message: { content: '{"company":"Acme","role":"Designer","stage":"other","deadline_raw":null,"action_needed":true,"confidence":0.7}' } }],
    }),
  };
}

function makeGlobals(env) {
  const GmailApp = {
    search(query, start, max) {
      if (max > 500) throw new Error('Exception: Argument max cannot exceed 500');
      const m = /newer_than:(\d+)([dmy])/.exec(query);
      let threads = env.threads.filter(t => t.messages.some(x => !x.sent || true));
      if (m) {
        const unit = { d: DAY, m: 30 * DAY, y: 365 * DAY }[m[2]];
        const cutoff = env.now - Number(m[1]) * unit;
        threads = threads.filter(t => t.messages.some(x => x.date.getTime() > cutoff && x.date.getTime() <= env.now));
      }
      threads = threads.slice().sort((a, b) => lastDate(b) - lastDate(a));
      return threads.slice(start || 0, (start || 0) + (max || 500)).map(t => wrapThread(env, t));
    },
    getUserLabelByName(name) {
      return env.labels.has(name) ? labelObj(env, name) : null;
    },
    createLabel(name) {
      env.labels.set(name, true);
      env.ops.push({ op: 'createLabel', label: name });
      return labelObj(env, name);
    },
  };
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => (env.props.has(k) ? env.props.get(k) : null),
      setProperty(k, v) {
        v = String(v);
        const bytes = Buffer.byteLength(v, 'utf8');
        if (env.enforcePropLimit && bytes > PROP_VALUE_LIMIT) {
          throw new Error('Exception: Argument too large: value (' + bytes + ' bytes)');
        }
        env.props.set(k, v);
        env.propWrites.push({ key: k, bytes });
        return this;
      },
    }),
  };
  const SpreadsheetApp = {
    openById(id) {
      if (!env.sheets.has(id)) throw new Error('Exception: Unexpected error while getting the method or property openById on object SpreadsheetApp.');
      const s = env.sheets.get(id);
      const sheet = {
        getLastRow: () => s.rows.length,
        appendRow(row) {
          s.rows.push(row.map(v => (typeof v === 'string' ? v.replace(/^'/, '') : v)));
          return sheet;
        },
        getRange(r, c, nr, nc) {
          if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error('Exception: The starting row/column of the range is too small.');
          return {
            setValues(vals) {
              if (vals.length !== nr) throw new Error('Exception: The number of rows in the data does not match the number of rows in the range. The data has ' + vals.length + ' but the range has ' + nr + '.');
              vals.forEach((row, i) => {
                if (row.length !== nc) throw new Error('Exception: The number of columns in the data does not match the number of columns in the range.');
                while (s.rows.length < r - 1 + i) s.rows.push([]);
                s.rows[r - 1 + i] = row.map(v => (v === null || v === undefined ? '' : v)); // Sheets stores null as ''
              });
            },
          };
        },
        getDataRange: () => ({ getValues: () => (s.rows.length ? s.rows.map(r => r.slice()) : [['']]) }),
      };
      return { getActiveSheet: () => sheet };
    },
  };
  const UrlFetchApp = {
    fetch(url, params) {
      env.fetches.push({ url, params });
      const r = env.ai(params, env);
      if (r.throw) throw new Error(r.throw);
      if (!(params && params.muteHttpExceptions) && r.code >= 400) throw new Error('Exception: Request failed returned code ' + r.code);
      return { getResponseCode: () => r.code, getContentText: () => r.text };
    },
  };
  const ContentService = {
    MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
    createTextOutput(s) {
      const o = { content: s, mime: 'text/plain', setMimeType(m) { o.mime = m; return o; }, getContent: () => s, getMimeType: () => o.mime };
      return o;
    },
  };
  const ScriptApp = {
    newTrigger(fn) {
      const b = {
        timeBased: () => b,
        everyMinutes: n => { b.n = n; return b; },
        create: () => {
          const t = { id: ++env.triggerSeq, fn, every: b.n, getHandlerFunction: () => fn, getUniqueId: () => String(t.id) };
          env.triggers.push(t);
          return t;
        },
      };
      return b;
    },
    getProjectTriggers: () => env.triggers.slice(),
    deleteTrigger(t) {
      env.triggers = env.triggers.filter(x => x.id !== t.id);
    },
  };
  const Logger = { log: s => env.logs.push(String(s)) };
  // The account running the script (the fake user's own sent replies come from here)
  const Session = { getEffectiveUser: () => ({ getEmail: () => 'sam.lee@gmail.com' }) };
  return { GmailApp, PropertiesService, SpreadsheetApp, UrlFetchApp, ContentService, ScriptApp, Logger, Session, console };
}

function load(env) {
  const ctx = makeGlobals(env);
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'Code.gs' });
  return ctx;
}

function run(env, ctx) {
  try {
    ctx.processInbox();
    return null;
  } catch (e) {
    return e;
  }
}

// ---------------------------------------------------------------- email templates
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const NAMES = ['Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay', 'Wonka', 'Stark', 'Wayne', 'Cyberdyne', 'Soylent', 'Tyrell', 'Massive', 'Aperture', 'Gringotts', 'Monarch', 'Oscorp', 'Pied', 'Duff', 'Acme'];
const company = i => NAMES[i % NAMES.length] + (i >= NAMES.length ? String.fromCharCode(97 + Math.floor(i / NAMES.length)) : '');
const dom = co => co.toLowerCase() + '.com';

const T = {
  N: (co, date) => ({ kind: 'N', from: 'Medium Daily Digest <noreply@medium.com>', subject: "Today's highlights", body: 'Top stories for you: design systems, typography and more.', date }),
  R: (co, date) => ({ kind: 'R', from: `"${co} Recruiting" <no-reply@greenhouse-mail.io>`, subject: `Thank you for applying to ${co}`, body: `Hi Sam,\n\nThank you for applying to ${co}. We received your application for the Product Designer role and our team will review it shortly.\n\nBest,\n${co} Talent`, date }),
  X: (co, date) => ({ kind: 'X', from: `"${co} Recruiting" <no-reply@greenhouse-mail.io>`, subject: `Your application to ${co}`, body: `Hi Sam,\n\nThank you for your interest in ${co}. Unfortunately, we have decided to move forward with other candidates for the Product Designer role.\n\nBest,\n${co} Recruiting`, date }),
  A: (co, date) => ({ kind: 'A', from: `"${co} Recruiting" <no-reply@greenhouse-mail.io>`, subject: `${co} online assessment`, body: `Hi Sam,\n\nAs part of your application, please complete our HackerRank online assessment within 5 days: https://www.hackerrank.com/tests/abc123\n\nGood luck!`, date }),
  I: (co, date) => ({ kind: 'I', from: `"Jordan at ${co}" <jordan@${dom(co)}>`, subject: `Interview with ${co}`, body: `Hi Sam,\n\nWe'd love to invite you to interview for the Product Designer role. Please pick a time that works: https://calendly.com/${co.toLowerCase()}/30min\n\nThanks,\nJordan`, date }),
  Q: (co, date) => ({ kind: 'Q', from: `"Riley Chen" <riley@${dom(co)}>`, subject: 'Following up on your application', body: 'Hi Sam, are you still interested in the role? Let me know when you have a moment.', date }),
};
const STAGE_OF = { R: 'applied', X: 'rejected', A: 'assessment', I: 'interview', Q: 'other' };
const LABEL_OF = { R: 'Jobs/Applied', X: 'Jobs/Rejected', A: 'Jobs/Assessment', I: 'Jobs/Interview', Q: 'Jobs/Review' };
const IMPORTANT = new Set(['A', 'I', 'Q']);

function buildMixed(env) {
  const patterns = [].concat(
    Array(25).fill('N'), Array(25).fill('R'), Array(20).fill('RX'), Array(15).fill('RA'),
    Array(15).fill('RI'), Array(15).fill('Q'), Array(10).fill('RAI')
  );
  for (let i = patterns.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [patterns[i], patterns[j]] = [patterns[j], patterns[i]];
  }
  patterns.forEach((p, i) => {
    const co = company(i);
    const start = env.now - 6.5 * DAY + rnd() * 5 * DAY;
    const msgs = p.split('').map((k, j) => T[k](co, start + j * (2 + rnd() * 10) * HOUR));
    addThread(env, msgs, { pattern: p, co });
  });
}

// ---------------------------------------------------------------- reporting
const results = [];
let current = null;
function check(ok, label, details) {
  current.checks.push({ ok, label, details });
}
function note(text) {
  current.notes.push(text);
}
function scenario(name, fn) {
  current = { name, checks: [], notes: [] };
  results.push(current);
  try {
    fn();
  } catch (e) {
    check(false, 'scenario crashed the harness', e.stack.split('\n').slice(0, 3).join(' | '));
  }
}
function rows(env) {
  return env.sheets.get('SHEET1') ? env.sheets.get('SHEET1').rows : [];
}
function dataRows(env) {
  return rows(env).slice(1);
}
const jobsLabels = t => [...t.labels].filter(l => l.startsWith('Jobs/')).sort();
const allMsgs = env => env.threads.flatMap(t => t.messages.map(m => ({ t, m })));

// ================================================================= scenarios
let s1env;
scenario('1. ~200 mixed emails / 125 threads, one run', () => {
  seed = 42;
  const env = makeEnv();
  s1env = env;
  buildMixed(env);
  const ctx = load(env);
  const err = run(env, ctx);
  check(!err, 'processInbox completes', err && err.message);

  const all = allMsgs(env);
  const jobs = all.filter(x => x.m.kind !== 'N');
  const rowIds = dataRows(env).map(r => r[0]);
  const rowSet = new Set(rowIds);
  note(`mailbox: ${env.threads.length} threads, ${all.length} messages, ${jobs.length} job messages`);
  const processed = jobs.filter(x => rowSet.has(x.m.id));
  const missed = jobs.filter(x => !rowSet.has(x.m.id));
  const missedImportant = missed.filter(x => IMPORTANT.has(x.m.kind));
  check(missed.length === 0, 'every job email processed (sheet row exists)',
    `${processed.length}/${jobs.length} processed; ${missed.length} never processed, ${missedImportant.length} of them assessment/interview/review; threads touched by search: 50 of ${env.threads.length}`);
  check(rowIds.length === rowSet.size, 'no duplicate sheet rows', `${rowIds.length} rows, ${rowSet.size} unique ids`);
  const header = rows(env)[0] || [];
  check(header[0] === 'Message ID', 'header row written first', JSON.stringify(header));
  check(rowIds.length === processed.length, 'sheet rows == processed job emails', `${rowIds.length} rows vs ${processed.length}`);

  const stageWrong = [];
  const labelMissing = [];
  dataRows(env).forEach(r => {
    const x = all.find(y => y.m.id === r[0]);
    if (x && r[6] !== STAGE_OF[x.m.kind]) stageWrong.push(`${x.m.kind}->${r[6]}`);
    if (x && !x.t.labels.has(LABEL_OF[x.m.kind])) labelMissing.push(x.m.id);
  });
  check(stageWrong.length === 0, 'stage in sheet matches true stage', stageWrong.slice(0, 10).join(', '));
  // One Jobs/* label per thread (the newest email's; a receipt never replaces a more
  // informative label), so not every message's label is on its thread any more.
  const jobThreads = [...new Set(dataRows(env).map(r => (all.find(y => y.m.id === r[0]) || {}).t).filter(Boolean))];
  const notOne = jobThreads.filter(t => jobsLabels(t).length !== 1);
  check(notOne.length === 0, 'every job thread carries exactly one Jobs label', `${notOne.length} of ${jobThreads.length} threads; (${labelMissing.length} older message labels replaced, expected)`);

  const imp = processed.filter(x => IMPORTANT.has(x.m.kind));
  const notStarred = imp.filter(x => !x.m.starred);
  const hidden = imp.filter(x => !x.t.inInbox);
  check(notStarred.length === 0, 'important processed emails starred', `${notStarred.length}/${imp.length} not starred`);
  check(hidden.length === 0, 'important processed emails still in inbox', `${hidden.length}/${imp.length} archived: ` + hidden.slice(0, 5).map(x => x.t.meta.pattern).join(','));
  const newsTouched = env.threads.filter(t => t.meta.pattern === 'N' && (t.labels.size || !t.inInbox));
  check(newsTouched.length === 0, 'newsletters untouched', newsTouched.length + ' touched');

  // the unprocessed backlog: does it ever get picked up?
  for (let i = 0; i < 5; i++) run(env, ctx);
  const after = new Set(dataRows(env).map(r => r[0]));
  const stillMissed = jobs.filter(x => !after.has(x.m.id)).length;
  check(stillMissed === 0, 'backlog picked up by later runs (5 more runs, no new mail)', `${stillMissed} job emails still never processed`);
  note(`AI calls in first run: ${env.fetches.length}`);
  s1env.firstRunFetches = env.fetches.length;
});

scenario('2. processInbox twice in a row', () => {
  seed = 7;
  const env = makeEnv();
  buildMixed(env);
  const ctx = load(env);
  run(env, ctx);
  const rows1 = dataRows(env).length;
  const ops1 = env.ops.length;
  const fetch1 = env.fetches.length;
  const err = run(env, ctx);
  check(!err, 'second run completes', err && err.message);
  check(dataRows(env).length === rows1, 'no new sheet rows on second run', `${rows1} -> ${dataRows(env).length}`);
  const ops2 = env.ops.slice(ops1).filter(o => o.op !== 'createLabel');
  check(ops2.length === 0, 'no label/star/move side effects on second run', ops2.length + ' ops: ' + JSON.stringify(ops2.slice(0, 3)));
  check(env.fetches.length === fetch1, 'no repeat AI calls on second run', `${fetch1} -> ${env.fetches.length}`);
});

scenario('3. >50 threads in the 7-day window; ageing out', () => {
  const env = makeEnv();
  for (let i = 0; i < 80; i++) addThread(env, [T.A(company(i), env.now - 6 * DAY + i * HOUR)], { i });
  const ctx = load(env);
  run(env, ctx);
  run(env, ctx);
  let got = new Set(dataRows(env).map(r => r[0]));
  const missed = env.threads.filter(t => !got.has(t.messages[0].id));
  check(missed.length === 0, 'all 80 assessment emails processed after 2 runs', `${80 - missed.length}/80 processed; ${missed.length} skipped silently (oldest ${missed.length}); no log line mentions it: ${!env.logs.some(l => /50|limit|more/i.test(l))}`);
  // time passes, 10 new mails/day, the skipped ones age out of the window
  for (let d = 1; d <= 8; d++) {
    env.now += DAY;
    for (let k = 0; k < 10; k++) addThread(env, [T.N('x', env.now - k * MIN)]);
    for (let r = 0; r < 3; r++) run(env, ctx);
  }
  got = new Set(dataRows(env).map(r => r[0]));
  const ever = missed.filter(t => got.has(t.messages[0].id)).length;
  check(ever === missed.length, 'skipped emails processed before they leave the 7-day window', `${ever}/${missed.length} ever processed; the rest are now older than 7 days and can never be processed`);
  // Old email outside window: never processed even on first install
  const env2 = makeEnv();
  const old = addThread(env2, [T.I('Oldco', env2.now - 8 * DAY)]);
  const ctx2 = load(env2);
  run(env2, ctx2);
  check(dataRows(env2).length === 1, 'interview email 8 days old processed on first install', `${dataRows(env2).length} rows; starred=${old.messages[0].starred}`);
  // Old message inside a thread with a fresh reply IS processed (thread-level search)
  const env3 = makeEnv();
  const t3 = addThread(env3, [T.R('Mixco', env3.now - 30 * DAY), T.X('Mixco', env3.now - HOUR)]);
  run(env3, load(env3));
  note(`thread with 30-day-old receipt + fresh rejection: ${dataRows(env3).length} rows (old message pulled in via its thread)`);
});

scenario('4. processed-ID cache growth (>500 ids, 9 KB property limit)', () => {
  // 4a: real limit enforced
  const env = makeEnv();
  const ctx = load(env);
  let firstFail = null;
  let cacheLenBefore = 0;
  for (let b = 1; b <= 16 && !firstFail; b++) {
    for (let i = 0; i < 40; i++) {
      const k = i % 4 === 0 ? 'A' : i % 2 ? 'N' : 'R';
      addThread(env, [T[k](company(b * 40 + i), env.now - i * 10 * 1000)]);
    }
    cacheLenBefore = JSON.parse(env.props.get('PROCESSED_MESSAGE_IDS') || '[]').length;
    const rowsBefore = dataRows(env).length;
    const err = run(env, ctx);
    if (err) firstFail = { batch: b, err: err.message, cacheLenBefore, rowsBefore, rowsAfter: dataRows(env).length };
    env.now += 10 * MIN;
  }
  const lastGood = env.propWrites.filter(w => w.key === 'PROCESSED_MESSAGE_IDS').pop();
  check(!firstFail, 'cache write stays under 9 KB', firstFail
    ? `batch ${firstFail.batch} threw "${firstFail.err}"; cache held ${firstFail.cacheLenBefore} ids (last good write ${lastGood && lastGood.bytes} bytes); sheet rows ${firstFail.rowsBefore} -> ${firstFail.rowsAfter} (this batch's rows never written)`
    : 'no failure');
  note(`size math: 500 ids x 16 hex = ${JSON.stringify(Array(500).fill('0123456789abcdef')).length} bytes > ${PROP_VALUE_LIMIT}; limit is crossed at 486 ids`);
  if (firstFail) {
    const opsBefore = env.ops.length;
    const rowsBefore = dataRows(env).length;
    const errs = [];
    for (let r = 0; r < 3; r++) {
      const e = run(env, ctx);
      if (e) errs.push(e.message);
    }
    const repeated = env.ops.slice(opsBefore).filter(o => o.op !== 'createLabel').length;
    check(errs.length === 0, 'job recovers after the failure', `${errs.length}/3 later runs threw; rows ${rowsBefore} -> ${dataRows(env).length}; ${repeated} label/star/move ops re-applied to already-handled mail`);
    // new important mail after the stall
    addThread(env, [T.I('Afterco', env.now)]);
    run(env, ctx);
    const t = env.threads[env.threads.length - 1];
    note(`new interview after stall: starred=${t.messages[0].starred}, labelled=${jobsLabels(t)}, sheet row=${dataRows(env).some(r => r[0] === t.messages[0].id)}`);
  }

  // 4b: limit disabled, observe slice(-500) trimming re-processing
  const e2 = makeEnv({ enforcePropLimit: false });
  const c2 = load(e2);
  const news = [];
  for (let i = 0; i < 10; i++) news.push(addThread(e2, [T.N('n', e2.now - 2 * DAY)]));
  const Tt = addThread(e2, [T.R('Keepco', e2.now - 2 * DAY + HOUR)], { co: 'Keepco' });
  run(e2, c2);
  const receiptId = Tt.messages[0].id;
  // 60 newsletter ids, then the interview, then more newsletters
  e2.now += 10 * MIN;
  news.forEach(t => { for (let k = 0; k < 6; k++) addMessage(e2, t, T.N('n', e2.now - k * MIN)); });
  run(e2, c2);
  e2.now += 10 * MIN;
  const interview = addMessage(e2, Tt, T.I('Keepco', e2.now - MIN));
  run(e2, c2);
  check(Tt.inInbox && interview.starred, 'interview starred and in inbox', `inInbox=${Tt.inInbox} starred=${interview.starred}`);
  let archivedAt = null;
  let dupReceiptRows = 0;
  for (let b = 0; b < 12; b++) {
    e2.now += 10 * MIN;
    news.forEach(t => { for (let k = 0; k < 6; k++) addMessage(e2, t, T.N('n', e2.now - k * MIN)); });
    run(e2, c2);
    dupReceiptRows = dataRows(e2).filter(r => r[0] === receiptId).length;
    if (!Tt.inInbox && archivedAt === null) archivedAt = { batch: b, cache: JSON.parse(e2.props.get('PROCESSED_MESSAGE_IDS')).length };
  }
  check(dupReceiptRows <= 1, 'trimmed ids not re-processed (no duplicate rows)', `receipt ${receiptId} has ${dupReceiptRows} sheet rows; total rows ${dataRows(e2).length} for 2 job emails`);
  check(archivedAt === null, 're-processing never archives a thread with a pending interview', archivedAt ? `thread archived at batch ${archivedAt.batch} when re-processed receipt was handled (interview still starred=${interview.starred}); final inInbox=${Tt.inInbox}` : 'never archived');
});

scenario('5. multi-stage threads (most important)', () => {
  // 5a receipt -> assessment -> rejection, one run
  let env = makeEnv();
  let t = addThread(env, [T.R('Alpha', env.now - 3 * DAY), T.A('Alpha', env.now - 2 * DAY), T.X('Alpha', env.now - DAY)]);
  run(env, load(env));
  note(`5a receipt->assessment->rejection: labels=${jobsLabels(t)} inInbox=${t.inInbox} starred=[${t.messages.map(m => m.starred)}]`);

  // 5b assessment then a later receipt (same subject threading, e.g. second role) in one run
  env = makeEnv();
  t = addThread(env, [T.A('Beta', env.now - 2 * DAY), T.R('Beta', env.now - DAY)]);
  run(env, load(env));
  check(t.inInbox, '5b: assessment followed by a receipt stays in inbox (one run)', `labels=${jobsLabels(t)} inInbox=${t.inInbox} assessmentStarred=${t.messages[0].starred}`);

  // 5c cross-run: interview handled, later a plain receipt arrives in same thread
  env = makeEnv();
  let ctx = load(env);
  t = addThread(env, [T.I('Gamma', env.now - DAY)]);
  run(env, ctx);
  env.now += 10 * MIN;
  addMessage(env, t, T.R('Gamma', env.now - MIN));
  run(env, ctx);
  check(t.inInbox, '5c: unanswered interview not archived by a later receipt', `labels=${jobsLabels(t)} inInbox=${t.inInbox} interviewStarred=${t.messages[0].starred}`);

  // 5d cross-run: assessment for role A, then rejection for role B in the same ATS thread ("Your application to Delta")
  env = makeEnv();
  ctx = load(env);
  const a = T.A('Delta', env.now - DAY);
  a.subject = 'Your application to Delta';
  t = addThread(env, [a]);
  run(env, ctx);
  env.now += 10 * MIN;
  addMessage(env, t, T.X('Delta', env.now - MIN));
  run(env, ctx);
  check(t.inInbox, '5d: pending assessment not archived by a rejection for another role in the same thread', `labels=${jobsLabels(t)} inInbox=${t.inInbox} assessmentStarred=${t.messages[0].starred}; deadline row still says action_needed=${dataRows(env)[0][9]}`);

  // 5e: rejection arrives after interview — archiving is fine, but stars?
  env = makeEnv();
  t = addThread(env, [T.I('Eps', env.now - 2 * DAY), T.X('Eps', env.now - DAY)]);
  run(env, load(env));
  note(`5e interview->rejection: labels=${jobsLabels(t)} inInbox=${t.inInbox} interview still starred=${t.messages[0].starred} (leaves a stale star in Starred)`);

  // 5f same-run order: messages processed oldest-first, so the last message decides inbox state
  env = makeEnv();
  t = addThread(env, [T.A('Zeta', env.now - 3 * DAY), T.R('Zeta', env.now - 2 * DAY), T.R('Zeta', env.now - DAY)]);
  run(env, load(env));
  check(t.inInbox, '5f: assessment + two receipts stays in inbox', `labels=${jobsLabels(t)} inInbox=${t.inInbox}`);
});

scenario('6. per-message label applied to whole thread', () => {
  const env = s1env;
  const multi = env.threads.filter(t => jobsLabels(t).length > 1);
  const combos = {};
  multi.forEach(t => { const k = jobsLabels(t).join('+'); combos[k] = (combos[k] || 0) + 1; });
  check(multi.length === 0, 'no thread carries contradictory Jobs/* labels', `${multi.length} threads: ${JSON.stringify(combos)}`);
  const rejectedAndActive = multi.filter(t => t.labels.has('Jobs/Rejected') && (t.labels.has('Jobs/Assessment') || t.labels.has('Jobs/Interview')));
  note(`${rejectedAndActive.length} threads labelled both Rejected and Assessment/Interview`);
});

scenario('7. non-job emails enter the processed cache', () => {
  const env = makeEnv();
  for (let i = 0; i < 30; i++) addThread(env, [T.N('x', env.now - i * HOUR)]);
  addThread(env, [T.R('Solo', env.now - 40 * HOUR)]);
  run(env, load(env));
  check(!env.props.has('PROCESSED_MESSAGE_IDS') && dataRows(env).length === 1, 'no property cache; only the job email is recorded', `property cache=${env.props.has('PROCESSED_MESSAGE_IDS')} rows=${dataRows(env).length}`);
  // user's own sent reply in a job thread
  const env2 = makeEnv();
  const t = addThread(env2, [T.I('Theta', env2.now - 2 * DAY)]);
  addMessage(env2, t, { kind: 'S', sent: true, from: 'Sam Lee <sam.lee@gmail.com>', subject: 'Re: Interview with Theta', body: "Thanks Jordan! Tuesday 2pm works. Looking forward to the interview.", date: env2.now - DAY });
  run(env2, load(env2));
  const own = dataRows(env2).find(r => r[3].includes('sam.lee'));
  check(!own, "user's own sent reply is not treated as a job email", own ? `row: company="${own[4]}" stage=${own[6]} source=${own[11]}; AI calls=${env2.fetches.length}` : 'ok');
});

scenario('8. AI fallback under failure', () => {
  const ambig = co => T.Q(co, BASE_NOW - HOUR);
  const modes = {
    '429': () => ({ code: 429, text: '{"error":"Too Many Requests"}' }),
    '500': () => ({ code: 500, text: 'Internal Server Error' }),
    timeout: () => ({ throw: 'Exception: Timeout: https://integrate.api.nvidia.com/v1/chat/completions' }),
    'HTML 200': () => ({ code: 200, text: '<html><body>Gateway</body></html>' }),
    'empty choices': () => ({ code: 200, text: '{"choices":[]}' }),
    'null content': () => ({ code: 200, text: '{"choices":[{"message":{"content":null}}]}' }),
    'wrong types': () => ({ code: 200, text: JSON.stringify({ choices: [{ message: { content: '{"company":42,"role":["x"],"stage":"Rejected","deadline_raw":7,"action_needed":"no","confidence":"0.99"}' } }] }) }),
    'prose around json': () => ({ code: 200, text: JSON.stringify({ choices: [{ message: { content: 'Sure! {"stage":"interview","confidence":0.9} hope that helps {"x":1}' } }] }) }),
  };
  Object.entries(modes).forEach(([name, ai]) => {
    const env = makeEnv({ ai });
    const t = addThread(env, [ambig('Iota'), T.A('Iota2', BASE_NOW - 2 * HOUR)]);
    const t2 = addThread(env, [T.I('Kappa', BASE_NOW - 3 * HOUR)]);
    const err = run(env, load(env));
    const r = dataRows(env);
    const q = t.messages.find(m => m.kind === 'Q');
    const qRow = r.find(x => x[3].includes('riley'));
    // usable AI reply -> recorded; failed call -> not recorded so the next run retries
    const ok = !err && t.inInbox && r.length >= 2 && (qRow ? true : q.starred);
    check(ok, `NIM ${name}: batch completes, email visible`, `err=${err && err.message} rows=${r.length} labels=${jobsLabels(t)} inInbox=${t.inInbox} starred=${t.messages.find(m => m.kind === 'Q').starred} row stage=${(r.find(x => x[3].includes('riley')) || [])[6]} source=${(r.find(x => x[3].includes('riley')) || [])[11]}`);
  });
  // missing key
  const env = makeEnv({ nimKey: false });
  const t = addThread(env, [T.Q('Lam', BASE_NOW - HOUR)]);
  const err = run(env, load(env));
  check(!err && t.inInbox && env.fetches.length === 0, 'missing NIM_KEY: no fetch, email visible in Review', `err=${err && err.message} labels=${jobsLabels(t)} inInbox=${t.inInbox}`);
  // transient 429: is the email retried later?
  let calls = 0;
  const env2 = makeEnv({ ai: () => (++calls === 1 ? { code: 429, text: 'rate limited' } : defaultAi()) });
  addThread(env2, [T.Q('Mu', BASE_NOW - HOUR)]);
  const c2 = load(env2);
  run(env2, c2);
  run(env2, c2);
  check(env2.fetches.length > 1, 'transient 429 is retried on a later run', `${env2.fetches.length} AI call(s); email permanently cached with source=${dataRows(env2)[0][11]}, confidence=${dataRows(env2)[0][10]}`);
});

scenario('9. Sheet and doGet', () => {
  // no SPREADSHEET_ID
  let env = makeEnv({ sheet: false });
  addThread(env, [T.A('Nu', BASE_NOW - HOUR)]);
  let ctx = load(env);
  let err = run(env, ctx);
  env.sheets.set('LATER', { rows: [] });
  env.props.set('SPREADSHEET_ID', 'LATER');
  run(env, ctx);
  check(err && /SPREADSHEET_ID/.test(err.message) && env.sheets.get('LATER').rows.length > 1, 'missing SPREADSHEET_ID stops loudly; mail is processed once it is set', `err=${err && err.message}; sheet rows after setting id: ${env.sheets.get('LATER').rows.length}; nothing logged: ${!env.logs.some(l => /SPREADSHEET/i.test(l))}`);
  // bad SPREADSHEET_ID: cache saved before sheet write
  env = makeEnv({ sheet: false, props: { SPREADSHEET_ID: 'WRONG' } });
  addThread(env, [T.A('Xi', BASE_NOW - HOUR)]);
  ctx = load(env);
  err = run(env, ctx);
  env.sheets.set('WRONG', { rows: [] });
  run(env, ctx);
  check(env.sheets.get('WRONG').rows.length > 0, 'sheet write failure does not lose records', `first run threw "${err && err.message.slice(0, 60)}"; ids already cached, so after fixing the sheet rows=${env.sheets.get('WRONG').rows.length}`);
  // existing rows with header
  const HEADER = ['Message ID', 'Thread ID', 'Date', 'Sender', 'Company', 'Role', 'Stage', 'Deadline', 'Deadline Raw', 'Action Needed', 'Confidence', 'Source', 'Application ID'];
  env = makeEnv({ sheetRows: [HEADER, ['old1', 't', '', '', 'Old', '', 'applied', '', '', false, 0.95, 'rule', 'old-x']] });
  addThread(env, [T.R('Omi', BASE_NOW - HOUR)]);
  run(env, load(env));
  check(rows(env).length === 3 && rows(env)[0][0] === 'Message ID' && rows(env)[2][0] !== 'Message ID', 'appends after existing rows, no second header', JSON.stringify(rows(env).map(r => r[0])));
  // existing rows without header (user typed something)
  env = makeEnv({ sheetRows: [['my notes']] });
  addThread(env, [T.R('Pi', BASE_NOW - HOUR)]);
  ctx = load(env);
  const headerErr = run(env, ctx);
  const piThread = env.threads[env.threads.length - 1];
  check(headerErr && /header/i.test(headerErr.message) && piThread.labels.size === 0 && rows(env).length === 1,
    'sheet without the tracker header stops loudly, touches no mail', `err=${headerErr && headerErr.message}; labels=${piThread.labels.size}; rows=${rows(env).length}`);
  // doGet shape
  env = makeEnv();
  addThread(env, [T.A('Rho', BASE_NOW - HOUR)]);
  ctx = load(env);
  const empty = ctx.doGet({});
  check(empty.getContent() === '[]' && empty.getMimeType() === 'application/json', 'doGet on empty sheet returns [] JSON', empty.getContent());
  run(env, ctx);
  const items = JSON.parse(ctx.doGet({}).getContent());
  const want = ['message_id', 'thread_id', 'date', 'sender', 'company', 'role', 'stage', 'deadline', 'deadline_raw', 'action_needed', 'confidence', 'source', 'application_id'];
  check(Array.isArray(items) && items.length === 1 && want.every(k => k in items[0]), 'doGet item keys', JSON.stringify(Object.keys(items[0] || {})));
  note(`doGet item: ${JSON.stringify(items[0])}`);
  note('doGet has no archive/inbox/starred state, no ghosting fields, returns every row (duplicates included), no paging');
  const noId = makeEnv({ sheet: false });
  const r = JSON.parse(load(noId).doGet({}).getContent());
  note(`doGet without SPREADSHEET_ID returns ${JSON.stringify(r)} (object, not array; client must handle both shapes)`);
});

scenario('10. installTrigger twice', () => {
  const env = makeEnv();
  const ctx = load(env);
  ctx.installTrigger();
  ctx.installTrigger();
  const t = env.triggers.filter(x => x.fn === 'processInbox');
  check(t.length === 1 && t[0].every === 10, 'exactly one 10-minute processInbox trigger', `${t.length} trigger(s)`);
  ctx.removeTrigger();
  check(env.triggers.length === 0, 'removeTrigger removes it', `${env.triggers.length} left`);
});

scenario('11. exception mid-batch (getPlainBody throws on one message)', () => {
  const env = makeEnv();
  const ts = [];
  for (let i = 0; i < 10; i++) {
    const k = i % 2 ? 'I' : 'R';
    ts.push(addThread(env, [T[k](company(i), BASE_NOW - (10 - i) * HOUR)]));
  }
  // search returns newest first; poison the 4th newest
  ts[6].messages[0].throwOnBody = true;
  const ctx = load(env);
  const err = run(env, ctx);
  const touched = ts.filter(t => t.labels.size).length;
  check(!err, 'batch survives one bad message', err && err.message);
  check(dataRows(env).length === 9, 'other 9 emails recorded', `rows=${dataRows(env).length}; threads already labelled/starred/archived before the throw=${touched}; cache saved=${env.props.has('PROCESSED_MESSAGE_IDS')}`);
  const ops1 = env.ops.length;
  const errs = [0, 1, 2].map(() => run(env, ctx)).filter(Boolean).length;
  const after = ts.filter(t => !t.labels.size && !t.messages[0].throwOnBody).length;
  check(errs === 0, 'job recovers on later runs', `${errs}/3 later runs threw at the same message; ${env.ops.length - ops1} side-effect ops repeated; ${after} good threads never processed; rows still ${dataRows(env).length}`);
});

scenario('12. execution-time estimate', () => {
  const ai = s1env.firstRunFetches;
  const aiMsgs = allMsgs(s1env).filter(x => x.m.kind === 'Q').length;
  note(`200-email batch: ${ai} AI calls in one run (only ${aiMsgs} emails need AI, but only 50 threads are searched)`);
  // full backlog estimate: if every thread were visible
  const env = makeEnv();
  seed = 42;
  buildMixed(env);
  const ctx = load(env);
  const realSearch = ctx.GmailApp.search;
  ctx.GmailApp.search = (q, s, m) => realSearch(q, 0, 500);
  run(env, ctx);
  const gmailOps = env.ops.length;
  const est = env.fetches.length * 1.5 + gmailOps * 0.15 + allMsgs(env).length * 0.05;
  note(`if all 125 threads were searched: ${env.fetches.length} AI calls, ${gmailOps} Gmail write ops -> ~${est.toFixed(0)} s (1.5 s/AI call, 0.15 s/Gmail write, 0.05 s/message read)`);
  const worstAi = 50 * 1.5 * 1; // 50 threads x 1 ambiguous msg
  note(`worst plausible single run: 50 threads all needing AI = ${worstAi} s; 6-min limit would need ~240 AI calls in one run`);
  check(est < 360, 'realistic batch fits 6-minute limit', `~${est.toFixed(0)} s`);
  check(/TIME_BUDGET_MS/.test(SRC), 'time-budget guard stops a run before the 6-minute limit', 'Code.gs has no time check');
});

// ---------------------------------------------------------------- print
let pass = 0;
let fail = 0;
results.forEach(s => {
  console.log('\n=== ' + s.name);
  s.checks.forEach(c => {
    if (c.ok) pass++; else fail++;
    console.log((c.ok ? 'PASS ' : 'FAIL ') + c.label + (c.details ? '\n       ' + c.details : ''));
  });
  s.notes.forEach(n => console.log('  note: ' + n));
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = 0;
