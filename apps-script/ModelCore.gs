/**
 * The trained email classifier: turns an email into word features and scores
 * them with the weights in Model.gs (made by trainer/train.js from your own,
 * labelled emails). Plain JavaScript with no Google services, so the trainer
 * runs this exact file in Node: training and Gmail use the same features.
 *
 * Model.gs defines: const MODEL = { classes, bias, features: { token: [idf, w per class] }, thresholds, ... }
 */
const MODEL_CORE = {
  BODY_CHARS: 1500,
  ATS: ['greenhouse.io', 'greenhouse-mail.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com', 'myworkday.com',
    'smartrecruiters.com', 'workable.com', 'workablemail.com', 'icims.com', 'goodtime.io', 'hirevue.com'],
  STOP: new Set(('the a an and or of to in on for at by with from as is are was were be been it this that these those ' +
    'you your we our us i me my he she they them their his her its if so but not no do does did have has had will would ' +
    'can could should may might there here what which who whom when where how all any each about into over than then ' +
    'just also very more most such only own same too up out off again once').split(' '))
};

/** Second-level domain of an address or URL host: mail.stripe.com → stripe.com */
function modelDomain(host) {
  const parts = String(host || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (parts.length >= 3 && /^(co|com|ac|org|net|gov|edu)$/.test(parts[parts.length - 2])) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

function modelWords(text) {
  return (String(text || '').toLowerCase().match(/[a-z][a-z']+/g) || [])
    .map(w => w.replace(/'s$|'/g, ''))
    .filter(w => w.length > 1 && !MODEL_CORE.STOP.has(w));
}

/** Token counts for one email: sender, subject, body (first BODY_CHARS), links, and your labels */
function emailTokens(email) {
  const counts = new Map();
  const add = t => counts.set(t, (counts.get(t) || 0) + 1);
  const addText = (words, prefix) => {
    words.forEach((w, i) => {
      add(prefix + w);
      if (i > 0) add(prefix + words[i - 1] + '_' + w);
    });
  };

  const from = String(email.from || '');
  const addr = /([^<>\s@"]+)@([a-z0-9.-]+)/i.exec(from);
  if (addr) {
    const dom = modelDomain(addr[2]);
    add('dom:' + dom);
    if (MODEL_CORE.ATS.some(d => dom === d || addr[2].toLowerCase().endsWith('.' + d))) add('from:ats');
    if (/no-?reply|do-?not-?reply|notifications?|mailer/i.test(addr[1])) add('from:noreply');
    if (/^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton|protonmail)\./i.test(addr[2])) add('from:personal');
  }
  modelWords(from.replace(/<[^>]*>/g, ' ')).forEach(w => add('fn:' + w));

  addText(modelWords(email.subject), 's:');

  const body = String(email.body || '').slice(0, MODEL_CORE.BODY_CHARS);
  (body.match(/https?:\/\/[^\s/<>"')]+/gi) || []).forEach(u => add('url:' + modelDomain(u.replace(/^https?:\/\//i, ''))));
  addText(modelWords(body.replace(/https?:\/\/\S+/gi, ' ')), '');

  // Your own labels; Jobs/* came from the old classifier's mistakes, so they're ignored
  (email.labels || []).map(l => String(l).toLowerCase().trim())
    .filter(l => l && l !== 'jobs' && l.indexOf('jobs/') !== 0)
    .forEach(l => add('lbl:' + l));
  return counts;
}

/**
 * Feature vector as [index, value] pairs: (1 + log count) × idf, scaled to unit
 * length. index(token) → feature number or undefined; idf(index) → its idf.
 */
function featureVector(counts, index, idf) {
  const out = [];
  let norm = 0;
  counts.forEach((c, token) => {
    const i = index(token);
    if (i === undefined) return;
    const v = (1 + Math.log(c)) * idf(i);
    out.push([i, v]);
    norm += v * v;
  });
  norm = Math.sqrt(norm) || 1;
  out.forEach(p => { p[1] /= norm; });
  return out;
}

function softmax(scores) {
  const max = Math.max.apply(null, scores);
  const e = scores.map(s => Math.exp(s - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / sum);
}

// token → position and the weight rows, built once per model per run
const MODEL_LOOKUP = new WeakMap();

/** → { category, confidence, probs: { class: p } } */
function predictEmail(model, email) {
  if (!MODEL_LOOKUP.has(model)) {
    const tokens = Object.keys(model.features);
    MODEL_LOOKUP.set(model, { index: new Map(tokens.map((t, i) => [t, i])), rows: tokens.map(t => model.features[t]) });
  }
  const lookup = MODEL_LOOKUP.get(model);
  const x = featureVector(emailTokens(email), t => lookup.index.get(t), i => lookup.rows[i][0]);
  const scores = model.bias.slice();
  x.forEach(([i, v]) => {
    const row = lookup.rows[i];
    for (let k = 0; k < scores.length; k++) scores[k] += v * row[k + 1];
  });
  const p = softmax(scores);
  let best = 0;
  for (let k = 1; k < p.length; k++) if (p[k] > p[best]) best = k;
  const probs = {};
  model.classes.forEach((c, k) => { probs[c] = p[k]; });
  return { category: model.classes[best], confidence: p[best], probs: probs };
}
