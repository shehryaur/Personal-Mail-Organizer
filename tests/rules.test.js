// Runs apps-script/Code.gs against sample emails with Google services stubbed out.
// Usage: node tests/rules.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

let nimReply = null; // what the fake AI answers; null = "no usable answer"
const ctx = {
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'NIM_KEY' ? 'test' : null) }) },
  UrlFetchApp: {
    fetch: () => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ choices: [{ message: { content: nimReply } }] }),
    }),
  },
};
vm.createContext(ctx);
vm.runInContext(
  src +
    '\nthis.analyzeEmail=analyzeEmail;this.validateNimOutput=validateNimOutput;this.extractCompanyFromSender=extractCompanyFromSender;',
  ctx
);

let failed = 0;
const check = (name, got, want) => {
  const ok = Object.entries(want).every(([k, v]) => got && got[k] === v);
  if (!ok) failed++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n     got ' + JSON.stringify(got)));
};
const received = new Date('2026-10-20T11:15:00Z');
const run = (from, subject, body, reply) => {
  nimReply = reply || null;
  return ctx.analyzeEmail(from, subject, body, received);
};

// --- The email that started this: "thank you for applying" + a challenge with a relative deadline
const PALANTIR_SUBJECT = 'Next steps: Palantir Product Design Show & Tell Challenge';
const PALANTIR_BODY = `Hi Shehryar,

Thank you for applying to Palantir! We enjoyed learning about you in your application.

As the next step, we would like to invite you to participate in our Product Design Show & Tell Challenge. All details and submission instructions are attached to this email.

Please send your submission to [designchallenge@palantir.com] within 7 days of receiving this email.`;
check(
  'Palantir challenge is an assessment with a deadline, kept in inbox',
  run('Shaun <designchallenge@palantir.com>', PALANTIR_SUBJECT, PALANTIR_BODY),
  { stage: 'assessment', action_needed: true, deadline: '2026-10-27', source: 'rule' }
);

// --- "Thank you for applying" is the weakest signal
check(
  'plain receipt is applied and can be archived',
  run('Acme <no-reply@acme.com>', 'Thanks for applying', 'Thank you for applying to Acme. Our team will review your application.'),
  { stage: 'applied', action_needed: false }
);
check(
  'receipt saying "next steps: we will review" stays applied',
  run('Acme <no-reply@acme.com>', 'Application received', 'We received your application. Next steps: our team will review it.'),
  { stage: 'applied', action_needed: false }
);
check(
  'thanks-for-applying + "please complete" never becomes applied, even if the AI says so',
  run(
    'Acme <no-reply@acme.com>',
    'Your application',
    'Thank you for applying! Please complete the short questionnaire linked below.',
    '{"company":"Acme","role":"PD","stage":"applied","deadline_raw":null,"action_needed":false,"confidence":0.95}'
  ),
  { stage: 'other', action_needed: true, source: 'action_guard' }
);
check(
  'thanks-for-applying + deadline but no task word: AI says applied, guard keeps it visible',
  run(
    'Acme <no-reply@acme.com>',
    'Your application',
    'Thank you for applying. Kindly reply within 3 days with your earliest start date.',
    '{"company":"Acme","role":"PD","stage":"applied","deadline_raw":null,"action_needed":false,"confidence":0.95}'
  ),
  { stage: 'other', action_needed: true, deadline: '2026-10-23' }
);
check(
  'thanks-for-applying + HackerRank is an assessment',
  run('Acme <no-reply@greenhouse.io>', 'Next round', 'Thank you for applying. As a next step please complete this HackerRank.'),
  { stage: 'assessment', action_needed: true }
);
check(
  'next step that is an interview stays an interview',
  run('Jane <jane@stripe.com>', 'Next round', 'As a next step, we would like to schedule an interview. Please share your availability.'),
  { stage: 'interview', action_needed: true }
);

// --- Archiving is strict: every check must pass, otherwise it stays in the inbox
check(
  'archive: plain receipt from a no-reply sender is archived',
  run('Acme Careers <no-reply@acme.com>', 'Thanks for applying', 'Thank you for applying to Acme. Our team will review your application.'),
  { stage: 'applied', archive: true }
);
check(
  'archive: rejection from an ATS is archived',
  run('Acme <no-reply@greenhouse.io>', 'Your application', 'Unfortunately we have decided to pursue other candidates.'),
  { stage: 'rejected', archive: true }
);
check(
  'archive: Palantir challenge is never archived',
  run('Shaun <designchallenge@palantir.com>', PALANTIR_SUBJECT, PALANTIR_BODY),
  { archive: false, keep_reason: 'stage is assessment' }
);
check(
  'keep: rejection written by a recruiter (you may want to reply)',
  run('Jane Doe <jane@acme.com>', 'Re: our chat', 'Hi, unfortunately we are not moving forward with your application.'),
  { stage: 'rejected', archive: false, keep_reason: 'a person wrote it, not an automated sender' }
);
check(
  'keep: receipt from a personal address',
  run('Sam <sam.r@gmail.com>', 'Thanks', 'Thank you for applying, got your resume.'),
  { stage: 'applied', archive: false, keep_reason: 'sent from a personal address' }
);
check(
  'keep: receipt with a form link',
  run('Acme <no-reply@acme.com>', 'Thanks for applying', 'Thank you for applying. Tell us more here: https://forms.gle/abc123'),
  { stage: 'applied', archive: false, keep_reason: 'contains a link to act on' }
);
check(
  'keep: long receipt',
  run('Acme <no-reply@acme.com>', 'Thanks for applying', 'Thank you for applying. ' + 'More details about the role. '.repeat(120)),
  { stage: 'applied', archive: false }
);
check(
  'keep: AI alone says applied with high confidence',
  run(
    'Acme <no-reply@acme.com>',
    'Hello',
    'We got your materials and will be in touch.',
    '{"company":"Acme","role":"PD","stage":"applied","deadline_raw":null,"action_needed":false,"confidence":0.99}'
  ),
  { stage: 'applied', source: 'ai', archive: false, keep_reason: 'not decided by a rule (ai)' }
);

// --- Rejections still win
check(
  'rejection mentioning "schedule" stays rejected',
  run('Acme <no-reply@acme.com>', 'Your application', 'Unfortunately we are not moving forward. We wish you luck as you schedule your next steps.'),
  { stage: 'rejected', source: 'rule' }
);
check(
  'rejection after a challenge is rejected, not assessment',
  run('Acme <no-reply@acme.com>', 'Update', 'Unfortunately, after reviewing your design challenge we decided to pursue other candidates.'),
  { stage: 'rejected' }
);
check(
  'sick interviewer + Calendly -> still an interview, low confidence (Jobs/Review), not archived',
  run('Jane <jane@stripe.com>', 'Interview', 'Unfortunately our lead is sick today. Please rebook here: https://calendly.com/jane/30min'),
  { stage: 'interview', confidence: 0.6, action_needed: true, archive: false }
);
check(
  'booking link caught by rules before AI is asked',
  run(
    'Recruiter <r@foo.com>',
    'Quick update',
    'Hey, book a slot: https://cal.com/r/chat',
    '{"company":"Foo","role":"PD","stage":"rejected","deadline_raw":null,"action_needed":false,"confidence":0.92}'
  ),
  { stage: 'interview', source: 'rule', action_needed: true }
);
check(
  'AI rejected, no booking link -> AI result kept',
  run(
    'Recruiter <r@foo.com>',
    'Quick update',
    'We went another direction.',
    '{"company":"Foo","role":"PD","stage":"rejected","deadline_raw":null,"action_needed":false,"confidence":0.92}'
  ),
  { stage: 'rejected', source: 'ai', action_needed: false }
);

// --- AI output validation
const v = ctx.validateNimOutput;
check('garbage AI reply -> null', { r: v('Sure! here you go') }, { r: null });
check('unknown stage -> null', { r: v('{"stage":"maybe","confidence":0.9}') }, { r: null });
check('fenced JSON + clamped confidence', v('```json\n{"company":"X","stage":"Offer","confidence":7}\n```'), {
  stage: 'offer',
  confidence: 1,
  action_needed: true,
});
check('missing confidence -> 0', v('{"stage":"applied","company":"null"}'), { confidence: 0, company: null });
check(
  'unusable AI reply -> review fallback',
  run('X <x@weird.com>', 'Hello', 'something', 'I cannot help with that'),
  { stage: 'other', source: 'error_fallback' }
);

// --- Company extraction
const co = (from, subject, want) => check('company: ' + from, { r: ctx.extractCompanyFromSender(from, subject) }, { r: want });
co('"Stripe Recruiting" <no-reply@us.greenhouse-mail.io>', 'Thanks', 'Stripe');
co('Greenhouse <no-reply@greenhouse.io>', 'Thank you for applying to Palantir Technologies!', 'Palantir Technologies');
co('<no-reply@hire.lever.co>', 'Your application to Notion', 'Notion');
co('Jane Doe at Figma <jane@ashbyhq.com>', 'Hi', 'Figma');
co('Workday <stripe@myworkday.com>', 'Application received', 'Stripe');
co('Linear Hiring Team <jobs@ashbyhq.com>', 'x', 'Linear');
co('Jane <jane@mail.stripe.com>', 'x', 'Stripe');
co('Bob <bob@careers.acme.co.uk>', 'x', 'Acme');
co('Sam from Ramp <sam.r@gmail.com>', 'x', 'Ramp');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
