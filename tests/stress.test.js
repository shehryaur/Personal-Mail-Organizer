// End-to-end stress test of apps-script/Code.gs against an in-memory fake Gmail.
// The fake Gmail throws on every write (label, star, archive, move): the script must only read.
// Usage: node tests/stress.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const MODEL_CORE_SRC = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ModelCore.gs'), 'utf8');
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

// The script asks for read-only Gmail access; any write is a bug
function gmailWrite(env, op) {
  env.ops.push({ op });
  throw new Error('Gmail is read-only: the script tried to ' + op);
}
const gmailWrites = env => env.ops.length;

function labelObj(env, name) {
  return {
    getName: () => name,
    __name: name,
    getThreads: (start, max) => env.threads
      .filter(t => t.labels.has(name))
      .sort((a, b) => lastDate(b) - lastDate(a))
      .slice(start || 0, (start || 0) + (max || 500))
      .map(t => wrapThread(env, t)),
    deleteLabel: () => gmailWrite(env, 'deleteLabel'),
  };
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
    unstar: () => gmailWrite(env, 'unstar'),
    star: () => gmailWrite(env, 'star'),
  };
}

function wrapThread(env, t) {
  return {
    getId: () => t.id,
    getLastMessageDate: () => new Date(lastDate(t)),
    isInInbox: () => t.inInbox,
    getFirstMessageSubject: () => t.messages[0].subject,
    getMessages: () => t.messages.map(m => wrapMessage(env, t, m)),
    addLabel: () => gmailWrite(env, 'label'),
    getLabels: () => [...t.labels].map(name => labelObj(env, name)),
    removeLabel: () => gmailWrite(env, 'unlabel'),
    moveToInbox: () => gmailWrite(env, 'inbox'),
    moveToArchive: () => gmailWrite(env, 'archive'),
  };
}

// Stand-in for the AI model: reads the email in the request and answers like a
// good classifier would, quoting evidence from the email. (Test scaffolding only.)
function fakeClassify(email) {
  const pick = re => { const m = re.exec(email); return m ? m[0] : null; };
  let category = 'other', confidence = 0.6, action = false, deadline = null, evidence = email.split('\n').slice(-1)[0].slice(0, 60);
  let ev;
  if ((ev = pick(/Unfortunately[^.\n]{5,60}/))) { category = 'rejected'; confidence = 0.96; evidence = ev; }
  else if ((ev = pick(/please complete our HackerRank[^.\n]{0,40}/i))) { category = 'assessment'; confidence = 0.95; action = true; evidence = ev; deadline = pick(/within \d+ days/); }
  else if ((ev = pick(/invite you to interview[^.\n]{0,40}/i))) { category = 'interview'; confidence = 0.95; action = true; evidence = ev; }
  else if ((ev = pick(/are you still interested in the role\?/i))) { category = 'other'; confidence = 0.7; action = true; evidence = ev; }
  else if ((ev = pick(/We received your application[^.\n]{0,40}/i))) { category = 'applied'; confidence = 0.96; evidence = ev; }
  else if ((ev = pick(/Top stories for you[^.\n]{0,30}/i))) { category = 'not_job'; confidence = 0.97; evidence = ev; }
  else if ((ev = pick(/Subject: ([^\n]+)/))) { category = 'not_job'; confidence = 0.9; evidence = ev.slice(9); } // anything else in these tests isn't job mail
  const company = (/Subject: [^\n]*?(?:to|with) ([A-Z][a-z]+\w*)/.exec(email) || [])[1] || null;
  return { category, company, role: 'Product Designer', deadline_phrase: deadline, action_needed: action, evidence, confidence };
}

function defaultAi(params) {
  const body = JSON.parse(params.payload);
  const email = body.messages[body.messages.length - 1].content;
  return { code: 200, text: JSON.stringify({ choices: [{ message: { content: JSON.stringify(fakeClassify(email)) } }] }) };
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
      const after = /after:(\d+)/.exec(query); // Gmail: epoch seconds
      if (after) {
        const cutoff = Number(after[1]) * 1000;
        threads = threads.filter(t => t.messages.some(x => x.date.getTime() > cutoff && x.date.getTime() <= env.now));
      }
      threads = threads.slice().sort((a, b) => lastDate(b) - lastDate(a));
      return threads.slice(start || 0, (start || 0) + (max || 500)).map(t => wrapThread(env, t));
    },
    getMessageById(id) {
      for (const t of env.threads) {
        const m = t.messages.find(x => x.id === id);
        if (m) return wrapMessage(env, t, m);
      }
      return null;
    },
    getUserLabelByName(name) {
      return env.labels.has(name) ? labelObj(env, name) : null;
    },
    createLabel: () => gmailWrite(env, 'createLabel'),
  };
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => (env.props.has(k) ? env.props.get(k) : null),
      deleteProperty(k) {
        env.props.delete(k);
        return this;
      },
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
    create(name) {
      const id = 'CREATED_' + (env.sheets.size + 1);
      env.sheets.set(id, { rows: [], name });
      const ss = SpreadsheetApp.openById(id);
      return { getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id, getActiveSheet: ss.getActiveSheet };
    },
    openById(id) {
      if (!env.sheets.has(id)) throw new Error('Exception: Unexpected error while getting the method or property openById on object SpreadsheetApp.');
      const store = env.sheets.get(id);
      store.tabs = store.tabs || {};
      const tab = s => {
      const sheet = {
        getLastRow: () => s.rows.length,
        deleteRows(start, n) {
          s.rows.splice(start - 1, n);
        },
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
                s.rows[r - 1 + i] = row.map(v => (v === null || v === undefined ? '' : typeof v === 'string' ? v.replace(/^'/, '') : v)); // Sheets stores null as '', and a leading ' just means "text"
              });
            },
          };
        },
        getDataRange: () => ({ getValues: () => (s.rows.length ? s.rows.map(r => r.slice()) : [['']]) }),
      };
      return sheet;
      };
      return {
        getActiveSheet: () => tab(store),
        getSheets: () => [tab(store)].concat(Object.keys(store.tabs).map(n => tab(store.tabs[n]))),
        getSheetByName: name => (store.tabs[name] ? tab(store.tabs[name]) : null),
        insertSheet: name => { store.tabs[name] = store.tabs[name] || { rows: [] }; return tab(store.tabs[name]); },
      };
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
    // Real Apps Script sends these in parallel; we count each call as one round trip
    fetchAll(requests) {
      env.fetchRounds = (env.fetchRounds || 0) + 1;
      env.fetchedInRounds = (env.fetchedInRounds || 0) + requests.length;
      return requests.map(r => {
        try {
          return UrlFetchApp.fetch(r.url, r);
        } catch (e) {
          if (requests.length === 1) throw e;
          return { getResponseCode: () => 599, getContentText: () => String(e) };
        }
      });
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
  // One script-wide lock; env.lockHeld simulates another run holding it
  const LockService = {
    getScriptLock: () => ({
      tryLock: () => {
        if (env.lockHeld) return false;
        env.lockHeld = true;
        return true;
      },
      releaseLock: () => { env.lockHeld = false; },
    }),
  };
  let uuid = 0;
  const Utilities = { getUuid: () => '00000000-0000-4000-8000-' + String(++uuid).padStart(12, '0') };
  // The script's clock is the fake mailbox's clock (env.now), not the machine's
  class FakeDate extends Date {
    constructor(...args) {
      if (args.length) super(...args);
      else super(env.now);
    }
    static now() {
      return env.now;
    }
  }
  return { GmailApp, PropertiesService, SpreadsheetApp, UrlFetchApp, ContentService, ScriptApp, Logger, Session, LockService, Utilities, Date: FakeDate, console };
}

// opts.model: also load ModelCore.gs + the test fixture model (like adding Model.gs)
function load(env, opts = {}) {
  const ctx = makeGlobals(env);
  vm.createContext(ctx);
  const files = opts.model ? [MODEL_CORE_SRC, fs.readFileSync(path.join(__dirname, 'fixtures', 'model.fixture.js'), 'utf8')] : [];
  vm.runInContext(files.concat(SRC).join('\n') + '\nthis.readEmail=readEmail;', ctx, { filename: 'Code.gs' });
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
  return rows(env).slice(1).filter(r => r[6] !== 'not_job');
}
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
  const missed = jobs.filter(x => !rowSet.has(x.m.id));
  check(missed.length === 0, 'every job email recorded (sheet row exists)', `${jobs.length - missed.length}/${jobs.length} recorded`);
  check(rowIds.length === rowSet.size, 'no duplicate sheet rows', `${rowIds.length} rows, ${rowSet.size} unique ids`);
  check((rows(env)[0] || [])[0] === 'Message ID', 'header row written first', JSON.stringify(rows(env)[0]));

  const stageWrong = [];
  dataRows(env).forEach(r => {
    const x = all.find(y => y.m.id === r[0]);
    if (x && r[6] !== STAGE_OF[x.m.kind]) stageWrong.push(`${x.m.kind}->${r[6]}`);
  });
  check(stageWrong.length === 0, 'stage in sheet matches true stage', stageWrong.slice(0, 10).join(', '));
  const imp = dataRows(env).filter(r => { const x = all.find(y => y.m.id === r[0]); return x && IMPORTANT.has(x.m.kind); });
  const noAction = imp.filter(r => r[9] !== true);
  check(noAction.length === 0, 'assessments, interviews and questions are marked "needs action"', `${noAction.length}/${imp.length} not marked`);
  const newsRows = rows(env).slice(1).filter(r => { const x = all.find(y => y.m.id === r[0]); return x && x.m.kind === 'N'; });
  check(newsRows.every(r => r[6] === 'not_job' && r[4] === ''), 'newsletters recorded as not_job, with no company', `${newsRows.filter(r => r[6] !== 'not_job').length} not not_job`);
  check(gmailWrites(env) === 0, 'Gmail is never changed (no label, star, archive)', `${gmailWrites(env)} write attempts: ${JSON.stringify(env.ops.slice(0, 3))}`);
  note(`AI calls in first run: ${env.fetches.length}`);
  s1env.firstRunFetches = env.fetches.length;
});

scenario('2. processInbox twice in a row', () => {
  seed = 7;
  const env = makeEnv();
  buildMixed(env);
  const ctx = load(env);
  run(env, ctx);
  const rows1 = rows(env).length;
  const fetch1 = env.fetches.length;
  const err = run(env, ctx);
  check(!err, 'second run completes', err && err.message);
  check(rows(env).length === rows1, 'no new sheet rows on second run', `${rows1} -> ${rows(env).length}`);
  check(env.fetches.length === fetch1, 'no repeat AI calls on second run', `${fetch1} -> ${env.fetches.length}`);
});

scenario('3. >50 threads in the 7-day window; ageing out', () => {
  const env = makeEnv();
  for (let i = 0; i < 80; i++) addThread(env, [T.A(company(i), env.now - 6 * DAY + i * HOUR)], { i });
  const ctx = load(env);
  run(env, ctx);
  run(env, ctx);
  const got = new Set(dataRows(env).map(r => r[0]));
  const missed = env.threads.filter(t => !got.has(t.messages[0].id));
  check(missed.length === 0, 'all 80 assessment emails recorded after 2 runs', `${80 - missed.length}/80`);
  const env2 = makeEnv();
  addThread(env2, [T.I('Oldco', env2.now - 8 * DAY)]);
  run(env2, load(env2));
  check(dataRows(env2).length === 1, 'interview email 8 days old recorded on first install (first run looks back 30 days)', `${dataRows(env2).length} rows`);
});

scenario('4. sheet as the processed-email record (no 9 KB property cache)', () => {
  const env = makeEnv();
  const ctx = load(env);
  let firstFail = null;
  for (let b = 1; b <= 16 && !firstFail; b++) {
    for (let i = 0; i < 40; i++) {
      const k = i % 4 === 0 ? 'A' : i % 2 ? 'N' : 'R';
      addThread(env, [T[k](company(b * 40 + i), env.now - i * 10 * 1000)]);
    }
    const err = run(env, ctx);
    if (err) firstFail = { batch: b, err: err.message };
    env.now += 10 * MIN;
  }
  check(!firstFail, '640 emails over 16 runs, no failure', firstFail && JSON.stringify(firstFail));
  const ids = rows(env).slice(1).map(r => r[0]);
  check(ids.length === new Set(ids).size && ids.length === 640, 'each email recorded exactly once', `${ids.length} rows, ${new Set(ids).size} unique`);
  check(!env.propWrites.some(w => w.bytes > 1024), 'no large Script Property written', JSON.stringify(env.propWrites.filter(w => w.bytes > 1024).slice(0, 2)));
});

scenario('5. multi-stage threads: one row per email, each with its own stage', () => {
  let env = makeEnv();
  let t = addThread(env, [T.R('Alpha', env.now - 3 * DAY), T.A('Alpha', env.now - 2 * DAY), T.X('Alpha', env.now - DAY)]);
  run(env, load(env));
  const stages = t.messages.map(m => (dataRows(env).find(r => r[0] === m.id) || [])[6]).join(',');
  check(stages === 'applied,assessment,rejected', '5a receipt -> assessment -> rejection: three rows, three stages', stages);
  check(new Set(dataRows(env).map(r => r[12])).size === 1, '5a all three share one application id', JSON.stringify(dataRows(env).map(r => r[12])));

  env = makeEnv();
  const ctx = load(env);
  t = addThread(env, [T.I('Gamma', env.now - DAY)]);
  run(env, ctx);
  env.now += 10 * MIN;
  addMessage(env, t, T.R('Gamma', env.now - MIN));
  run(env, ctx);
  const interviewRow = dataRows(env).find(r => r[0] === t.messages[0].id);
  check(interviewRow && interviewRow[9] === true && dataRows(env).length === 2, '5b a later receipt in the same thread does not change the interview\'s row', JSON.stringify(dataRows(env).map(r => [r[6], r[9]])));
});

scenario('7. non-job emails and your own replies', () => {
  const env = makeEnv();
  for (let i = 0; i < 30; i++) addThread(env, [T.N('x', env.now - i * HOUR)]);
  addThread(env, [T.R('Solo', env.now - 40 * HOUR)]);
  run(env, load(env));
  check(!env.props.has('PROCESSED_MESSAGE_IDS') && dataRows(env).length === 1, 'only the job email is a job row; no property cache', `rows=${dataRows(env).length}`);
  const env2 = makeEnv();
  const t = addThread(env2, [T.I('Theta', env2.now - 2 * DAY)]);
  addMessage(env2, t, { kind: 'S', sent: true, from: 'Sam Lee <sam.lee@gmail.com>', subject: 'Re: Interview with Theta', body: 'Thanks Jordan! Tuesday 2pm works.', date: env2.now - DAY });
  run(env2, load(env2));
  check(!rows(env2).some(r => String(r[3]).includes('sam.lee')), "your own sent reply is not recorded", JSON.stringify(rows(env2).map(r => r[3])));
});

scenario('8. AI under failure (no trained model yet)', () => {
  const modes = {
    '429': () => ({ code: 429, text: '{"error":"Too Many Requests"}' }),
    '500': () => ({ code: 500, text: 'Internal Server Error' }),
    timeout: () => ({ throw: 'Exception: Timeout: https://integrate.api.nvidia.com/v1/chat/completions' }),
    'HTML 200': () => ({ code: 200, text: '<html><body>Gateway</body></html>' }),
    'empty choices': () => ({ code: 200, text: '{"choices":[]}' }),
    'null content': () => ({ code: 200, text: '{"choices":[{"message":{"content":null}}]}' }),
  };
  Object.entries(modes).forEach(([name, ai]) => {
    const env = makeEnv({ ai });
    addThread(env, [T.Q('Iota', BASE_NOW - HOUR), T.A('Iota2', BASE_NOW - 2 * HOUR)]);
    addThread(env, [T.I('Kappa', BASE_NOW - 3 * HOUR)]);
    const err = run(env, load(env));
    check(!err && rows(env).length <= 1 && gmailWrites(env) === 0, `AI ${name}: run completes, nothing recorded (retried next run)`, `err=${err && err.message} rows=${rows(env).length - 1}`);
  });
  const env = makeEnv({ nimKey: false });
  addThread(env, [T.Q('Lam', BASE_NOW - HOUR)]);
  const err = run(env, load(env));
  check(!err && env.fetches.length === 0 && rows(env).length <= 1, 'no trained model and no AI key: no calls, nothing recorded yet', `err=${err && err.message} rows=${rows(env).length - 1}`);
  let calls = 0;
  const env2 = makeEnv({ ai: params => (++calls === 1 ? { code: 429, text: 'rate limited' } : defaultAi(params)) });
  addThread(env2, [T.Q('Mu', BASE_NOW - HOUR)]);
  const c2 = load(env2);
  run(env2, c2);
  run(env2, c2);
  check(dataRows(env2).length === 1, 'a transient 429 is retried on the next run', `${env2.fetches.length} AI calls, rows=${dataRows(env2).length}`);
});

scenario('9. Sheet and doGet', () => {
  let env = makeEnv({ sheet: false });
  addThread(env, [T.A('Nu', BASE_NOW - HOUR)]);
  let ctx = load(env);
  let err = run(env, ctx);
  env.sheets.set('LATER', { rows: [] });
  env.props.set('SPREADSHEET_ID', 'LATER');
  run(env, ctx);
  check(err && /SPREADSHEET_ID/.test(err.message) && env.sheets.get('LATER').rows.length > 1, 'missing SPREADSHEET_ID stops loudly; mail is recorded once it is set', `err=${err && err.message}`);
  const HEADER = ['Message ID', 'Thread ID', 'Date', 'Sender', 'Company', 'Role', 'Stage', 'Deadline', 'Deadline Raw', 'Action Needed', 'Confidence', 'Source', 'Application ID'];
  env = makeEnv({ sheetRows: [HEADER, ['old1', 't', '', '', 'Old', '', 'applied', '', '', false, 0.95, 'model', 'old-x']] });
  addThread(env, [T.R('Omi', BASE_NOW - HOUR)]);
  run(env, load(env));
  check(rows(env).length === 3 && rows(env)[2][0] !== 'Message ID', 'appends after existing rows, no second header', JSON.stringify(rows(env).map(r => r[0])));
  env = makeEnv({ sheetRows: [['my notes']] });
  addThread(env, [T.R('Pi', BASE_NOW - HOUR)]);
  const headerErr = run(env, load(env));
  check(headerErr && /header/i.test(headerErr.message) && rows(env).length === 1, 'sheet without the tracker header stops loudly', `err=${headerErr && headerErr.message}`);

  env = makeEnv({ props: { FEED_TOKEN: 'secret-token' } });
  addThread(env, [T.A('Rho', BASE_NOW - HOUR)]);
  addThread(env, [T.N('x', BASE_NOW - 2 * HOUR)]);
  ctx = load(env);
  const empty = JSON.parse(ctx.doGet({ parameter: { token: 'secret-token' } }).getContent());
  check(empty.ok === true && Array.isArray(empty.items) && empty.items.length === 0, 'doGet on an empty sheet returns ok with no items', JSON.stringify(empty));
  run(env, ctx);
  const feed = JSON.parse(ctx.doGet({ parameter: { token: 'secret-token' } }).getContent());
  const want = ['message_id', 'thread_id', 'date', 'sender', 'company', 'role', 'stage', 'deadline', 'deadline_raw', 'action_needed', 'confidence', 'source', 'application_id', 'subject', 'snippet'];
  check(feed.ok && feed.items.length === 1 && want.every(k => k in feed.items[0]), 'feed has the job email only, with every field', JSON.stringify(Object.keys(feed.items[0] || {})));
  check(!('dry_run' in feed) && !/^'/.test(feed.items[0].message_id), 'feed ids are clean; no dry-run flag any more', JSON.stringify(feed).slice(0, 120));
  const badToken = JSON.parse(ctx.doGet({ parameter: { token: 'guess' } }).getContent());
  check(!badToken.ok && !('items' in badToken), 'feed refuses a wrong token', JSON.stringify(badToken));
});

scenario('10. installTrigger twice', () => {
  const env = makeEnv();
  const ctx = load(env);
  ctx.installTrigger();
  ctx.installTrigger();
  const t = env.triggers.filter(x => x.fn === 'processInbox');
  check(t.length === 1 && t[0].every === 5, 'exactly one 5-minute processInbox trigger', `${t.length} trigger(s)`);
  ctx.removeTrigger();
  check(env.triggers.length === 0, 'removeTrigger removes it', `${env.triggers.length} left`);
});

scenario('11. exception mid-batch (getPlainBody throws on one message)', () => {
  const env = makeEnv();
  const ts = [];
  for (let i = 0; i < 10; i++) ts.push(addThread(env, [T[i % 2 ? 'I' : 'R'](company(i), BASE_NOW - (10 - i) * HOUR)]));
  ts[6].messages[0].throwOnBody = true;
  const ctx = load(env);
  const err = run(env, ctx);
  check(!err && dataRows(env).length === 9, 'batch survives one bad message; the other 9 are recorded', `err=${err && err.message} rows=${dataRows(env).length}`);
  ts[6].messages[0].throwOnBody = false;
  env.now += MIN;
  run(env, ctx);
  check(dataRows(env).length === 10, 'the bad one is recorded once it can be read', `rows=${dataRows(env).length}`);
});

scenario('12. execution-time estimate', () => {
  note(`200-email batch: ${s1env.firstRunFetches} AI calls in one run (AI-only mode)`);
  const env = makeEnv();
  seed = 42;
  buildMixed(env);
  run(env, load(env));
  const singles = env.fetches.length - (env.fetchedInRounds || 0);
  const est = (env.fetchRounds || 0) * 2 + singles * 1.5 + allMsgs(env).length * 0.05 + rows(env).length * 0.1;
  note(`model requests: ${env.fetches.length} in ${env.fetchRounds || 0} parallel rounds + ${singles} single calls -> ~${est.toFixed(0)} s`);
  check(est < 360, 'a 200-email first run fits the 6-minute limit', `~${est.toFixed(0)} s`);
  check(/TIME_BUDGET_MS/.test(SRC), 'time-budget guard stops a run before the 6-minute limit', '');
});

scenario('13. live sync: setup, quick skip, refresh, lock', () => {
  const env0 = makeEnv({ sheet: false });
  const c0 = load(env0);
  c0.setup();
  const sheetId = env0.props.get('SPREADSHEET_ID');
  const token = env0.props.get('FEED_TOKEN');
  c0.setup();
  check(sheetId && env0.sheets.get(sheetId).rows[0][0] === 'Message ID' && token && token.length >= 32 &&
    env0.props.get('SPREADSHEET_ID') === sheetId && env0.props.get('FEED_TOKEN') === token,
    'setup() creates the sheet + token once, re-running keeps them', `sheet=${sheetId}`);
  check(!env0.props.has('DRY_RUN'), 'setup() no longer sets DRY_RUN', '');

  const env = makeEnv({ props: { FEED_TOKEN: 'tok' } });
  const ctx = load(env);
  addThread(env, [T.A('Sigma', env.now - HOUR)]);
  run(env, ctx);
  const rows1 = dataRows(env).length;
  const fetches1 = env.fetches.length;
  env.logs.length = 0;
  run(env, ctx);
  check(env.logs.some(l => /Nothing new/.test(l)) && dataRows(env).length === rows1 && env.fetches.length === fetches1, 'run with no new mail skips quickly', env.logs.join(' | '));
  env.now += 5 * MIN;
  addThread(env, [T.I('Tau', env.now - MIN)]);
  env.logs.length = 0;
  run(env, ctx);
  check(dataRows(env).length === rows1 + 1, 'new mail is picked up by the next timed run', `rows ${rows1} -> ${dataRows(env).length}`);
  check(env.logs.some(l => /threads searched \(after:\d+\)/.test(l)), 'later runs search only since the last run', env.logs.filter(l => /Run finished/.test(l)).join(' | '));
  env.now += MIN;
  addThread(env, [T.A('Upsilon', env.now - 10 * 1000)]);
  const res = JSON.parse(ctx.doGet({ parameter: { token: 'tok', action: 'refresh' } }).getContent());
  check(res.ok && res.refreshed && res.refreshed.recorded === 1 && res.items.length === rows1 + 2, 'refresh processes new mail now and returns it', JSON.stringify(res.refreshed));
  env.now += MIN;
  addThread(env, [T.I('Phi', env.now - 10 * 1000)]);
  env.lockHeld = true;
  const lockedErr = run(env, ctx);
  const rowsLocked = dataRows(env).length;
  env.lockHeld = false;
  run(env, ctx);
  check(!lockedErr && rowsLocked === rows1 + 2 && dataRows(env).length === rows1 + 3, 'overlapping run is skipped by the lock, next run catches up', `locked=${rowsLocked} after=${dataRows(env).length}`);
});

scenario('14. Gmail stays exactly as it is; your own labels are read, never changed', () => {
  const env = makeEnv();
  const ctx = load(env);
  env.labels.set('Applied', true);
  const yours = addThread(env, [T.R('Filterco', env.now - 3 * HOUR)]);
  yours.labels.add('Applied');
  yours.inInbox = false;
  const a = addThread(env, [T.A('Testco', env.now - HOUR)]);
  const x = addThread(env, [T.X('Rejco', env.now - 2 * HOUR)]);
  run(env, ctx);
  check(gmailWrites(env) === 0, 'no label, star, archive or move', JSON.stringify(env.ops));
  check(yours.labels.has('Applied') && !yours.inInbox && a.inInbox && x.inInbox && !a.messages[0].starred, 'every thread is where it was', '');
  const email = ctx.readEmail(ctx.GmailApp.getMessageById(yours.messages[0].id), ctx.GmailApp.search('', 0, 500).find(t => t.getId() === yours.id));
  check(email.labels.join() === 'Applied', 'your labels are passed to the classifier as a hint', JSON.stringify(email.labels));
  check(!/gmail\.modify/.test(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'appsscript.json'), 'utf8')), 'the script only asks for read-only Gmail access', '');
});

scenario('15. exportTrainingEmails: training data for the model', () => {
  const env = makeEnv();
  const ctx = load(env);
  for (let i = 0; i < 30; i++) addThread(env, [T[['R', 'X', 'A', 'I', 'N'][i % 5]](company(i), env.now - i * DAY)]);
  const t = addThread(env, [T.I('Mine', env.now - HOUR)]);
  addMessage(env, t, { kind: 'S', sent: true, from: 'Sam Lee <sam.lee@gmail.com>', subject: 'Re: Interview', body: 'Works for me.', date: env.now - MIN });
  addThread(env, [Object.assign(T.N('long', env.now - DAY), { body: 'x '.repeat(5000) })]);
  ctx.exportTrainingEmails();
  const tab = env.sheets.get('SHEET1').tabs['Training export'];
  const data = tab ? tab.rows.slice(1) : [];
  check(tab && tab.rows[0].join() === 'message_id,thread_id,date,from,subject,body,labels', 'a "Training export" tab with a header', tab && tab.rows[0].join());
  check(data.length === 32, 'every email from the last 6 months, except your own', `${data.length} rows`);
  check(!data.some(r => String(r[3]).includes('sam.lee')), 'your own sent mail is left out', '');
  check(data.every(r => String(r[5]).length <= 1500), 'bodies trimmed to 1,500 characters', `${Math.max(...data.map(r => String(r[5]).length))}`);
  ctx.exportTrainingEmails();
  check(tab.rows.length === 33, 'running it again adds nothing twice', `${tab.rows.length - 1} rows`);
  check(gmailWrites(env) === 0 && rows(env).length === 0, 'Gmail and the tracker rows are untouched', '');
});

scenario('16. retired AI model: stop calling, record nothing, retry later', () => {
  const env = makeEnv({ ai: () => ({ code: 410, text: '{"status":410,"detail":"The model has reached its end of life"}' }) });
  const ctx = load(env);
  for (let i = 0; i < 6; i++) addThread(env, [T.A('Gone' + i, env.now - (i + 1) * HOUR)]);
  run(env, ctx);
  check(env.fetchRounds === 1 && env.fetches.length === 6, 'stops calling the model after it reports "retired"', `${env.fetches.length} calls in ${env.fetchRounds} rounds`);
  check(dataRows(env).length === 0, 'nothing is recorded', `rows=${dataRows(env).length}`);
  check(env.logs.some(l => /retired or unknown/.test(l) && /AI_FAST_MODEL/.test(l)), 'the log says which setting to change', '');
  env.ai = defaultAi;
  env.now += MIN;
  run(env, ctx);
  check(dataRows(env).length === 6, 'next run with a working model records all of them', `rows=${dataRows(env).length}`);
});

scenario('17. trained model (test fixture), no AI at all', () => {
  seed = 42;
  const env = makeEnv({ nimKey: false });
  buildMixed(env);
  const ctx = load(env, { model: true });
  const err = run(env, ctx);
  check(!err, 'processInbox completes', err && err.message);
  check(env.fetches.length === 0, 'no network calls: the model runs inside Apps Script', `${env.fetches.length} calls`);
  const all = allMsgs(env);
  const recorded = new Set(rows(env).slice(1).map(r => r[0]));
  check(all.filter(x => !x.m.sent).every(x => recorded.has(x.m.id)), 'every email gets a row', `${recorded.size}/${all.length}`);
  const imp = all.filter(x => IMPORTANT.has(x.m.kind) && x.m.kind !== 'Q');
  const lost = imp.filter(x => { const r = rows(env).find(y => y[0] === x.m.id); return !r || ['not_job', 'applied', 'rejected'].includes(r[6]); });
  check(lost.length === 0, 'no assessment or interview filed as not_job, applied or rejected', `${lost.length}/${imp.length}: ${lost.slice(0, 3).map(x => x.m.subject).join(' | ')}`);
  check(rows(env).slice(1).every(r => r[11] === 'model'), 'every row says the trained model decided it', '');
  const right = rows(env).slice(1).filter(r => { const x = all.find(y => y.m.id === r[0]); return x && (x.m.kind === 'N' ? r[6] === 'not_job' : r[6] === STAGE_OF[x.m.kind]); }).length;
  const review = rows(env).slice(1).filter(r => r[6] === 'review').length;
  note(`fixture model (trained on 129 synthetic emails): ${right}/${rows(env).length - 1} exactly right, ${review} sent to "review"`);
  check(gmailWrites(env) === 0, 'Gmail is never changed', '');
});

scenario('18. backfillHistory: months of history, resumable', () => {
  const env = makeEnv({ nimKey: false });
  for (let i = 0; i < 60; i++) addThread(env, [T[['R', 'X', 'A', 'I', 'N'][i % 5]](company(i), env.now - (i * 3 + 1) * DAY)]);
  const ctx = load(env, { model: true });
  run(env, ctx);
  const firstRun = rows(env).length - 1;
  check(firstRun < 60, 'the first normal run only looks back 30 days', `${firstRun} of 60 recorded`);
  ctx.backfillHistory();
  const ids = rows(env).slice(1).map(r => r[0]);
  check(ids.length === 60 && new Set(ids).size === 60, 'backfill records the rest of the last 6 months, once each', `${ids.length} rows, ${new Set(ids).size} unique`);
  check(!env.props.has('BACKFILL_CURSOR') && env.logs.some(l => /Backfill finished/.test(l)), 'it finishes and clears its bookmark', env.logs.filter(l => /Backfill/.test(l)).join(' | '));
  ctx.backfillHistory();
  check(rows(env).length - 1 === 60, 'running it again adds nothing twice', `${rows(env).length - 1} rows`);
  check(gmailWrites(env) === 0 && env.fetches.length === 0, 'no Gmail changes and no AI calls', '');
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
process.exitCode = fail ? 1 : 0;
