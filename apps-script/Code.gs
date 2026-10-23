/**
 * Job Application Inbox Tracker - Google Apps Script Engine
 * "AI only reads. Code decides."
 * 
 * Submission for Palantir Product Design Show & Tell (Lens A)
 */

// Configuration Constants
const CONFIG = {
  ATS_DOMAINS: [
    'greenhouse.io',
    'greenhouse-mail.io',
    'lever.co',
    'ashbyhq.com',
    'myworkdayjobs.com',
    'myworkday.com',
    'smartrecruiters.com',
    'workable.com',
    'workablemail.com',
    'icims.com'
  ],
  // Platforms that relay mail for someone else: company comes from the subject/body
  RELAY_DOMAINS: ['linkedin.com', 'indeed.com', 'wellfound.com', 'google.com'],
  // Sender names that are the ATS itself, never the hiring company
  ATS_NAMES: /^(greenhouse|lever|ashby|workday|smartrecruiters|workable|icims)$/i,
  // Words recruiters append to the company in the From display name
  SENDER_NAME_NOISE: /\b(recruiting|recruitment|recruiter|talent acquisition|talent|careers?|hiring team|hiring|jobs|people team|people|hr|team|no-?reply|notifications?)\b/gi,
  // Only real booking links count as "this is an interview" evidence
  BOOKING_LINK: /calendly\.com\/|goodtime\.io\/|cal\.com\/|calendar\.app\.google\/|app\.greenhouse\.io\/(?:interviews|scheduling)|ashbyhq\.com\/.*schedul|lever\.co\/\S*schedul/i,
  // Video call links: someone already set up a meeting
  MEETING_LINK: /zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup/i,
  // Links that mean "go do something": booking pages, calls, test platforms, forms
  ACTION_LINK: /calendly\.com\/|goodtime\.io\/|cal\.com\/|calendar\.app\.google\/|zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup|hackerrank\.com\/|codesignal\.com\/|codility\.com\/|testgorilla\.com\/|hirevue\.com\/|coderpad\.io\/|forms\.gle\/|docs\.google\.com\/forms|typeform\.com\//i,
  // Receipts and rejections are short; long emails usually carry instructions
  ARCHIVE_MAX_BODY: 3000,
  // How much of the (cleaned) body the rules read
  RULE_WINDOW: 5000,
  // Search: normal runs look back 7 days, the first run (empty Sheet) 30 days
  SEARCH_DAYS: 7,
  FIRST_RUN_DAYS: 30,
  SEARCH_PAGE: 100,
  SEARCH_MAX_THREADS: 500,
  // Stop starting new emails after this long; the rest are picked up next run
  // (Apps Script kills a run at 6 minutes)
  TIME_BUDGET_MS: 4.5 * 60 * 1000,
  SHEET_HEADERS: [
    'Message ID', 'Thread ID', 'Date', 'Sender', 'Company', 'Role',
    'Stage', 'Deadline', 'Deadline Raw', 'Action Needed', 'Confidence', 'Source', 'Application ID'
  ],
  KEYWORDS: [
    'application',
    'interview',
    'assessment',
    'candidate',
    'thank you for applying',
    'challenge',
    'offer letter',
    'your candidacy',
    'next round',
    'take-home',
    'take home',
    'assignment',
    'portfolio review',
    'phone screen',
    'recruit',
    'hiring',
    'applied to',
    'next step', // singular: "as the next step, please …" (also an action request)
    'rescind',
    'references',
    // German, French, Spanish, Portuguese, Italian, Dutch
    'bewerbung', 'vorstellungsgespr', 'candidature', 'entretien', 'candidatura', 'entrevista',
    'postulación', 'processo seletivo', 'vaga', 'colloquio', 'sollicitatie'
  ],
  // Job vocabulary beyond the keywords above (word boundaries, so "role" ≠ "rollout").
  // Broad on purpose: a wrongly let-in email only gets a Review label, never a star.
  JOB_WORDS: /\b(?:role|position|opening|vacanc(?:y|ies)|recruit(?:er|ing|ment)?|hiring|resume|cv|portfolio|homework|design exercise|onsite|hiring (?:manager|mgr)|ap+l(?:i|y)?cation)\b/i,
  LABELS: {
    APPLIED: 'Jobs/Applied',
    ASSESSMENT: 'Jobs/Assessment',
    INTERVIEW: 'Jobs/Interview',
    REJECTED: 'Jobs/Rejected',
    OFFER: 'Jobs/Offer',
    REVIEW: 'Jobs/Review'
  },
  RULES: {
    REJECTED: [
      /\bunfortunately\b/i,
      /\bnot moving forward\b/i,
      /\bother candidates\b/i,
      /\bdecided to pursue\b/i,
      /\bnot been selected\b/i,
      /\bposition has been filled\b/i,
      /\bfilled the (?:role|position)\b/i,
      /\bwon'?t be (?:proceeding|moving forward)\b/i,
      /\bnot (?:be )?proceeding\b/i,
      /\bnot a (?:fit|match)\b/i,
      /\bregret to inform\b/i,
      /\bwill not be moving\b/i,
      /\blamentablemente\b|\bno continuar\b/i, // es
      /\bmalheureusement\b/i, // fr
      /\bleider\b/i, // de
      /\binfelizmente\b|\bseguir com outros\b/i, // pt
      /\bpurtroppo\b/i, // it
      /\bnot (?:the )?right fit\b/i,
      /\bdecided not to (?:move forward|proceed|continue|pursue)\b/i,
      /\bmov(?:e|ing) (?:ahead|forward) with (?:other|another|candidates? (?:whose|who|that))\b/i,
      /\bpursue other (?:applicants|candidates)\b|\belected to pursue\b/i,
      /\bunable to offer\b/i,
      /\b(?:won'?t|will not|not) be moving\b/i,
      /\b(?:position|role) has (?:now )?been (?:filled|closed)\b|\bno longer hiring\b/i,
      /\boffer(?:ed)? the (?:role|position) to (?:another|someone else|a different)\b/i,
      /\brescind(?:ed)?\b[^.\n]{0,40}\boffer\b|\boffer\b[^.\n]{0,40}\brescind/i
    ],
    ASSESSMENT: [
      /\bhackerrank\b/i,
      /\bcodesignal\b/i,
      /\btake-home\b/i,
      // "Product Design Show & Tell Challenge", "design challenge"; not "job hunting is a
      // challenge" or "we challenge the status quo"
      /\b(?:our|the|this|your|design|coding|technical|take[- ]home|product|tell)\s+challenge\b/i,
      /\bChallenge\b/,
      /\bchallenge (?:brief|instructions|details|prompt|link)\b/i,
      /\bonline assessment\b/i,
      /\btechnical assessment\b/i,
      /\bcase study\b/i,
      /\bsubmission instructions\b/i,
      /\bsend (?:us )?your submission\b/i,
      /\bsubmit your (?:work|solution|response|portfolio|video|project)\b/i,
      /\bhirevue\b/i,
      /\bcodility\b/i,
      /\b(?:design|coding|technical|take[- ]home) (?:exercise|assignment|test)\b/i,
      /\bwork sample\b/i,
      /\bcomplete (?:your|the|this|our) (?:[\w-]+ )?(?:assessment|assignment|exercise|test|challenge)\b/i,
      /\b(?:the|your|this) assignment\b/i,
      /\bhomework\b|\b(?:design|coding|technical|product) (?:problem|brief|task)\b/i,
      /\brecord (?:a |your )?(?:short |brief )?video\b|\bvideo (?:submission|response)\b/i
    ],
    INTERVIEW: [
      /\bschedule an? interview\b/i,
      /\bcalendly\.com\b/i,
      /\byour availability\b/i,
      /\binvite you to interview\b/i,
      /\bnext steps?.*interview\b/i,
      /\bphone screen\b/i,
      /\breschedul(?:e|ing)\b/i,
      /\bsuperday\b/i,
      /\bpanel interview\b/i,
      /\bfinal[- ]round interview\b/i,
      /\binterview invitation\b|\binvitation to interview\b/i,
      /\bpick a time\b|\bnew time\b/i,
      /\binterview(?:er|s)?\b[^.\n]{0,40}\bcancel/i,
      /^(?:(?:re|fwd?):\s*)*interview\b/i, // subject starts with "Interview"
      /\b(?:can|could) (?:you|u|we) (?:do|make|meet|join|hop on|move)\b/i,
      /\bdoes (?:mon|tues|wednes|thurs|fri)day\b[^.?\n]{0,30}\bwork\b/i,
      /\bwould love to chat\b|\bquick chat\b|\bhop on a (?:quick )?call\b/i,
      /\bmeet (?:with )?the team\b|\b(?:a few |some )?times that work\b|\bwhat times work\b/i,
      /\bon-?site\b|\bfinal round\b/i,
      /\bare (?:you|u) (?:free|available)\b/i,
      /\b(?:quick|short|intro|phone|video|first-stage) (?:call|chat)\b/i,
      /\b(?:move|moving|push|shift|reschedule) (?:your |our |the )?interview\b/i,
      /\b(?:booked|confirm(?:ed)?|scheduled) (?:your )?interview\b|\binterview (?:slot|time)\b/i,
      /\bcolloquio\b|\bentrevista\b/i,
      /\bvorstellungsgespr(?:ä|ae)ch\b|\bentretien\b|\bentrevista\b/i // de, fr, es
    ],
    // Checked first. Each match is ignored if a negation sits just before it
    // ("unable to extend an offer").
    OFFER: [
      /\bpleased to offer\b/i,
      /\boffer letter\b/i,
      /\boffer of employment\b/i,
      /\bextend (?:you )?an offer\b/i,
      /\bverbal offer\b/i,
      /\b(?:thrilled|delighted|happy|excited|glad) to (?:offer|extend)\b/i
    ],
    // Weakest signal: almost every recruiter email opens with one of these,
    // including invitations to the next round. Only used when nothing else matches.
    APPLIED: [
      /\breceived your application\b/i,
      /\bthank you for applying\b/i,
      /\bthanks? (?:you )?for (?:applying|your application)\b/i,
      /\bapplication submitted\b/i,
      /\bapplication (?:has been |was )?(?:successfully )?(?:submitted|received|sent)\b/i,
      /\bwe (?:got|have received|'ve received) your application\b/i,
      /\b(?:under|in) review\b/i,
      /\bstill reviewing\b/i,
      /\bviewed your (?:profile|application)\b|\bwas viewed by\b/i,
      /\bconfirm receipt\b|\backnowledge receipt\b/i
    ]
  },
  // The email asks you to do something. Any of these (or a detected deadline)
  // means the email can never be labelled "applied" or archived.
  // "next step" is singular on purpose: receipts say "next steps: we'll review…".
  ACTION_REQUEST: [
    /\bnext step\b/i,
    /\bplease (?:send|submit|complete|upload|record|return|fill out|finish)\b/i,
    /\binvite you to (?:participate|complete|take|join)\b/i,
    /\bdeadline\b/i,
    /\bdue (?:by|on|date)\b/i,
    /\baction required\b/i,
    /\b(?:could|can|would) you (?:please )?(?:send|share|confirm|provide)\b/i,
    /\bwould like you to\b/i,
    /\bare you (?:still )?(?:interested|available|free|open)\b/i,
    /\bplease (?:confirm|reply|respond|call)\b/i
  ],
  // Good news or a next round. Rejection words next to any of these ("decided to
  // pursue your candidacy", "unlike other candidates… superday") don't count as a
  // rejection, and "thank you for applying" doesn't count as a receipt.
  // Ignored when negated just before ("not move forward with your application").
  POSITIVE: [
    /\byour candidacy\b/i,
    /\bmov(?:e|ing) you forward\b/i,
    /\bmov(?:e|ing) forward with your (?:application|candidacy)\b/i,
    /\bnext (?:round|stage)\b/i,
    /\bsuperday\b/i,
    /\bon-?site\b/i,
    /\bfinal round\b/i,
    /\bcongratulations\b/i,
    /\b(?:pleased|thrilled|delighted|happy|excited|glad) to (?:offer|invite|extend|inform you that you)\b/i,
    /\boffer letter\b/i,
    /\boffer of employment\b/i,
    /\bextend (?:you )?an offer\b/i,
    /\b(?:would|we'd|i'd) (?:like|love) to (?:invite|interview|schedule|move|speak|meet|chat|talk|set up)\b/i,
    /\bset up (?:a |some )?(?:call|time|chat)\b/i
  ],
  // Clearly not about a job application, even though it says "application",
  // "interview", "candidate" or "challenge". Only used when STRONG_JOB doesn't match.
  NOT_JOB: /\b(?:new episode|webinar|register now|chip in|donate|campaign|app store|ready for sale|transcript|tuition|job alerts?|new jobs for|jobs you may|easy apply|badge|application performance|performance monitoring)\b/i,
  // The topic itself is not a job, whatever else the email says (bank, housing,
  // school, grants, dating, media). Only an ATS sender overrides this.
  NOT_JOB_TOPIC: /\b(?:credit card|card application|loan application|mortgage|rental application|leasing|tenant|admissions|mba program|scholarship|grant application|principal investigator|uscis|travel document|immigration case|release candidate|new match|liked your profile|podcast|guest on the show)\b/i,
  STRONG_JOB: /\bthank you for applying\b|\byour application (?:to|with|at)\b|\byour application for (?:the )?[\w ,-]{0,40}\b(?:role|position|job)\b|\bhiring manager\b|\b(?:recruiter|recruiting team|talent team)\b|\bphone screen\b|\btake-home\b|\boffer letter\b|\byour candidacy\b/i,
  // Negative words: a "thanks for applying" email containing any of these isn't a receipt
  RECEIPT_BLOCKER: /\bunfortunately\b|\bregret\b|\bsorry\b|\bunable\b|\bdecided not\b|\bwon'?t\b|\bnot (?:be |been )?(?:selected|moving|proceeding|able|the right|a fit|a match)\b|\binfelizmente\b|\bpurtroppo\b|\bleider\b|\bmalheureusement\b|\blamentablemente\b/i,
  // Out-of-office / automatic replies: never an action, never a deadline
  AUTO_REPLY: /^(?:automatic reply|auto(?:matic)?[- ]?reply|out of (?:the )?office)\b|\bout of (?:the )?office until\b|\bi am (?:currently )?out of (?:the )?office\b/i,
  // Text in an email aimed at the AI ("ignore previous instructions"). Such emails
  // never go to the AI; they land in Jobs/Review.
  INJECTION: /ignore (?:all |any )?(?:previous|prior|above) instructions|note to (?:the )?ai\b|you are (?:an? )?(?:ai|language model)|system prompt/i,
  NEGATION_BEFORE: /(?:\bnot\b|n't\b|\bunable\b|\bcannot\b|\bno longer\b|\bdecided against\b|\bif\b)[^.!?\n]{0,40}$/i,
  NIM_ENDPOINT: 'https://integrate.api.nvidia.com/v1/chat/completions',
  NIM_MODEL: 'meta/llama-3.1-8b-instruct',
  STAGES: ['applied', 'assessment', 'interview', 'rejected', 'offer', 'other'],
  CONFIDENCE_THRESHOLD: 0.85,
  GHOSTING_DAYS_THRESHOLD: 60 // applied, then no reply for this many days = ghosted
};

/**
 * Run once from the editor: installs the 10-minute trigger for processInbox.
 * Safe to re-run; it removes any existing processInbox trigger first.
 */
function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(10).create();
  Logger.log('Installed: processInbox every 10 minutes.');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processInbox')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Main Trigger Function: Run periodically (e.g. Every 10 minutes)
 */
function processInbox() {
  const started = Date.now();
  // The Sheet is the record of what's been processed: a message is done once its
  // row is written. (Gmail labels attach to whole threads, so a "seen" label would
  // hide the next email in the same thread; a list in Script Properties hits the
  // 9 KB limit after ~480 IDs.) No Sheet = stop loudly before touching anything.
  const ledger = openLedger();
  const myAddress = currentUserEmail();
  const days = ledger.processed.size === 0 ? CONFIG.FIRST_RUN_DAYS : CONFIG.SEARCH_DAYS;
  const threads = searchAllThreads('newer_than:' + days + 'd -in:chats -in:drafts');

  let done = 0, failed = 0, skippedForTime = false;
  for (const thread of threads) {
    if (Date.now() - started > CONFIG.TIME_BUDGET_MS) { skippedForTime = true; break; }
    for (const message of thread.getMessages()) {
      const msgId = message.getId();
      if (ledger.processed.has(msgId)) continue;
      try {
        if (handleMessage(thread, message, myAddress, ledger)) done++;
      } catch (err) {
        // One bad email must not stop the rest. It isn't written to the Sheet,
        // so the next run tries it again.
        failed++;
        Logger.log('[error] message ' + msgId + ': ' + err);
      }
    }
  }

  Logger.log('Run finished: ' + done + ' recorded, ' + failed + ' failed, ' + threads.length +
    ' threads searched (' + days + 'd)' + (skippedForTime ? ', stopped early for time' : ''));
}

/**
 * One message: filter, classify, act, then record. Returns true if a row was written.
 */
function handleMessage(thread, message, myAddress, ledger) {
  const from = message.getFrom();
  // My own replies in a recruiter thread are not job emails
  if (myAddress && from.toLowerCase().indexOf(myAddress) !== -1) return false;

  const subject = message.getSubject();
  const body = message.getPlainBody();
  const date = message.getDate();

  // Not job-related: nothing to record; re-checking it next run costs no AI call
  if (!matchesPreFilter(from, subject, body, ledger.isKnown(thread.getId(), from))) return false;

  const analysis = analyzeEmail(from, subject, body, date);
  executeActions(thread, message, analysis, ledger.openThreads);

  // The AI call failed: keep it visible (done above) but don't record it,
  // so the next run gets another chance
  if (analysis.source === 'error_fallback') return false;

  ledger.append([
    message.getId(), thread.getId(), date.toISOString(), from, analysis.company, analysis.role,
    analysis.stage, analysis.deadline, analysis.deadline_raw, analysis.action_needed,
    analysis.confidence, analysis.source, generateApplicationId(analysis.company, analysis.role)
  ]);
  ledger.processed.add(message.getId());
  ledger.remember(thread.getId(), from);
  return true;
}

/** Search with paging, newest first, up to SEARCH_MAX_THREADS */
function searchAllThreads(query) {
  const all = [];
  for (let start = 0; start < CONFIG.SEARCH_MAX_THREADS; start += CONFIG.SEARCH_PAGE) {
    const page = GmailApp.search(query, start, CONFIG.SEARCH_PAGE);
    all.push.apply(all, page);
    if (page.length < CONFIG.SEARCH_PAGE) break;
  }
  return all;
}

function currentUserEmail() {
  try {
    return (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  } catch (err) {
    return '';
  }
}

/**
 * Step 1: Deterministic Pre-filter
 */
function matchesPreFilter(from, subject, body, known) {
  const fromLower = from.toLowerCase();
  const cleaned = cleanBody(body);
  const text = (subject + ' ' + cleaned.slice(0, CONFIG.RULE_WINDOW)).toLowerCase();

  const isATS = CONFIG.ATS_DOMAINS.some(domain => fromLower.includes(domain));
  if (isATS) return true;
  // Already tracking this thread or this company: every new email in it counts,
  // whatever words it uses ("are you free Thu?")
  if (known) return true;
  if (CONFIG.NOT_JOB_TOPIC.test(text)) return false;
  if (CONFIG.NOT_JOB.test(text) && !CONFIG.STRONG_JOB.test(text)) return false;
  // A scheduling or test-platform link is job mail on its own
  if (CONFIG.ACTION_LINK.test(cleaned) || CONFIG.BOOKING_LINK.test(cleaned)) return true;

  return CONFIG.KEYWORDS.some(kw => text.includes(kw)) || CONFIG.JOB_WORDS.test(text);
}

/**
 * Step 2: Analyze Email (Rules First -> NVIDIA NIM Fallback)
 */
function analyzeEmail(from, subject, rawBody, emailDate) {
  // HTML entities decoded, tags and quoted replies removed: an old "unfortunately"
  // further down a reply chain must not decide a new email
  const body = cleanBody(rawBody);
  const positive = hasSignal(subject + '\n' + body.slice(0, CONFIG.RULE_WINDOW), CONFIG.POSITIVE);
  if (CONFIG.AUTO_REPLY.test(subject) || CONFIG.AUTO_REPLY.test(body.slice(0, 300))) {
    // An out-of-office reply: no action, no deadline (its return date isn't mine)
    const auto = {
      company: extractCompanyFromSender(from, subject, body) || 'Unknown Company',
      role: extractRole(subject) || 'Applicant',
      stage: 'other', deadline: null, deadline_raw: null, action_needed: false,
      confidence: 0.5, source: 'auto_reply', archive: false, keep_reason: 'automatic reply'
    };
    Logger.log('[auto_reply] ' + subject);
    return auto;
  }
  const ruleResult = classifyByRules(subject, body);
  const company = extractCompanyFromSender(from, subject, body);
  const relativeDeadline = resolveRelativeDeadline(subject + '\n' + body, emailDate);

  let result;
  if (ruleResult) {
    result = {
      company: company || 'Unknown Company',
      role: extractRole(subject) || 'Applicant',
      stage: ruleResult.stage,
      deadline: relativeDeadline.date,
      deadline_raw: relativeDeadline.raw,
      action_needed: ['assessment', 'interview', 'offer'].indexOf(ruleResult.stage) !== -1,
      confidence: ruleResult.confidence,
      source: 'rule'
    };
  } else if (CONFIG.INJECTION.test(subject + '\n' + body)) {
    // Someone is trying to instruct the AI: don't ask it, keep the email visible
    result = {
      company: company || 'Unknown Company',
      role: extractRole(subject) || 'Applicant',
      stage: 'other',
      deadline: relativeDeadline.date,
      deadline_raw: relativeDeadline.raw,
      action_needed: false,
      confidence: 0.3,
      source: 'injection_guard'
    };
  } else {
    // NIM Fallback if rules cannot categorize
    result = callNIMFallback(from, subject, body, emailDate);
  }

  // Guardrail: a real booking link means someone wants to meet. Never let a
  // "rejected" verdict (rule or AI) archive it.
  if (result.stage === 'rejected' && CONFIG.BOOKING_LINK.test(body)) {
    result.stage = 'interview';
    result.action_needed = true;
    result.source = 'guardrail_override';
  }

  // Action guard: a deadline, a request to send/submit/complete something, or
  // next-round/offer words mean the email needs me. It can't be "applied" (or, with
  // good-news words, "rejected") and can't be archived, whoever decided.
  if (positive && result.stage === 'rejected') {
    result.stage = 'other';
    result.confidence = Math.min(result.confidence, 0.6);
    result.source = 'action_guard';
    result.action_needed = true;
  }
  if (result.stage !== 'rejected' && (relativeDeadline.date || asksForAction(subject, body) || positive)) {
    if (result.stage === 'applied') {
      result.stage = 'other'; // lands in Jobs/Review, starred, in the inbox
      result.confidence = Math.min(result.confidence, 0.6);
      result.source = 'action_guard';
    }
    result.action_needed = true;
    if (!result.deadline && relativeDeadline.date) {
      result.deadline = relativeDeadline.date;
      result.deadline_raw = relativeDeadline.raw;
    }
  }

  const archive = archiveCheck(result, from, body, positive);
  result.archive = archive.ok;
  result.keep_reason = archive.reason;

  Logger.log('[' + result.source + '] ' + result.stage + ' (' + result.confidence + ') ' +
    result.company + ' | ' + subject + (archive.ok ? ' -> archive' : ' -> keep: ' + archive.reason));
  return result;
}

/**
 * Archiving hides an email, so every check must pass. The first failing check is
 * returned as the reason it stays in the inbox (logged, so it shows in the video).
 */
function archiveCheck(result, from, body, positive) {
  const fail = reason => ({ ok: false, reason: reason });
  if (result.stage !== 'applied' && result.stage !== 'rejected') return fail('stage is ' + result.stage);
  if (positive) return fail('mentions a next round or an offer');
  if (result.source !== 'rule') return fail('not decided by a rule (' + result.source + ')');
  if (result.confidence < 0.95) return fail('confidence ' + result.confidence);
  if (result.action_needed) return fail('asks for action');
  if (result.deadline) return fail('has a deadline');
  if (CONFIG.ACTION_LINK.test(body)) return fail('contains a link to act on');
  const mainText = body.split(/\n[-_\s]*\n?\s*(?:Equal (?:Employment )?Opportunity|EEO\b|Privacy notice)/i)[0];
  if (mainText.length > CONFIG.ARCHIVE_MAX_BODY) return fail('long email (' + mainText.length + ' chars)');

  const domain = ((from.match(/@([a-zA-Z0-9.-]+)/) || [])[1] || '').toLowerCase();
  const isATS = CONFIG.ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  const isPersonal = /^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton|protonmail)\./.test(domain);
  if (!domain || isPersonal) return fail('sent from a personal address');
  if (!isATS && !/(no-?reply|do-?not-?reply|notifications?|careers|jobs|recruiting|talent|hiring|people@|hr@)/i.test(from)) {
    return fail('a person wrote it, not an automated sender');
  }
  return { ok: true, reason: null };
}

/**
 * Deterministic rules. Returns {stage, confidence} or null when nothing matched.
 * Rejection is checked first so "Unfortunately, after reviewing your assessment"
 * isn't starred as an assessment. If a rejection phrase appears next to interview
 * signals ("Unfortunately our interviewer is sick, please reschedule"), the rules
 * disagree, so the email stays visible in Jobs/Review instead of being archived.
 */
function classifyByRules(subject, body) {
  const content = subject + '\n' + body.slice(0, CONFIG.RULE_WINDOW);
  const matches = rules => rules.some(r => r.test(content));

  if (hasSignal(content, CONFIG.RULES.OFFER)) return { stage: 'offer', confidence: 0.95 };

  const isRejected = matches(CONFIG.RULES.REJECTED);
  const isInterview = matches(CONFIG.RULES.INTERVIEW) || CONFIG.BOOKING_LINK.test(body) || CONFIG.MEETING_LINK.test(body);
  const positive = hasSignal(content, CONFIG.POSITIVE);

  // Rejection words next to interview or good-news signals: the rules disagree.
  // Keep the interview stage if there is one, but at low confidence (Jobs/Review).
  if (isRejected && isInterview) return { stage: 'interview', confidence: 0.6 };
  if (isRejected && positive) return { stage: 'other', confidence: 0.6 };
  if (isRejected) return { stage: 'rejected', confidence: 0.95 };
  if (matches(CONFIG.RULES.ASSESSMENT)) return { stage: 'assessment', confidence: 0.95 };
  if (isInterview) return { stage: 'interview', confidence: 0.95 };
  // "Thank you for applying" only counts when the email asks for nothing.
  // Otherwise let the AI read it; the action guard in analyzeEmail keeps it visible.
  if (matches(CONFIG.RULES.APPLIED) && !asksForAction(subject, body) && !positive && !CONFIG.RECEIPT_BLOCKER.test(content)) {
    return { stage: 'applied', confidence: 0.95 };
  }
  return null;
}

function asksForAction(subject, body) {
  const content = subject + '\n' + body.slice(0, CONFIG.RULE_WINDOW);
  return CONFIG.ACTION_REQUEST.some(r => r.test(content));
}

/** True if any pattern matches somewhere it isn't negated just before ("not … your candidacy") */
function hasSignal(text, patterns) {
  return patterns.some(p => {
    const re = new RegExp(p.source, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 60), m.index);
      if (!CONFIG.NEGATION_BEFORE.test(before)) return true;
      if (m[0].length === 0) re.lastIndex++;
    }
    return false;
  });
}

/**
 * Plain text the rules can trust: HTML entities decoded, tags dropped, and quoted
 * earlier messages in a reply removed ("On … wrote:", "> …", "Original Message").
 * Forwarded messages are kept: there the forwarded part is the content.
 */
function cleanBody(body) {
  let text = String(body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  const cut = text.search(/\n[^\n]*\bOn [^\n]{4,200}wrote:\s*(?:\n|$)|\n-{2,}\s*Original Message\s*-{2,}/i);
  if (cut !== -1) text = text.slice(0, cut);
  return text
    .split('\n')
    .filter(line => !/^\s*>/.test(line))
    .join('\n');
}

/**
 * NVIDIA NIM Fallback Caller
 */
function callNIMFallback(from, subject, body, emailDate) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('NIM_KEY');
  if (!apiKey) {
    Logger.log('NIM_KEY not found in Script Properties. Defaulting to review.');
    return {
      company: extractCompanyFromSender(from, subject) || 'Unknown Company',
      role: 'Applicant',
      stage: 'other',
      deadline: null,
      deadline_raw: null,
      action_needed: false, // uncertain: Jobs/Review label, no star (guards may still raise it)
      confidence: 0.5,
      source: 'fallback'
    };
  }

  const prompt = `You are a strict data extraction parser. Extract the structured fields from this job-related email.
Respond ONLY in valid JSON matching this schema:
{
  "company": "string",
  "role": "string",
  "stage": "applied" | "assessment" | "interview" | "rejected" | "offer" | "other",
  "deadline_raw": "string or null",
  "action_needed": boolean,
  "confidence": number between 0.0 and 1.0
}

Sender: ${from}
Subject: ${subject}
Body Snippet:
${body.slice(0, 500)}`;

  try {
    const response = UrlFetchApp.fetch(CONFIG.NIM_ENDPOINT, {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        model: CONFIG.NIM_MODEL,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      const rawText = data.choices[0].message.content;
      const parsed = validateNimOutput(rawText);
      if (parsed) {
        let resolved = resolveRelativeDeadline(subject + '\n' + body, emailDate);
        if (!resolved.date && parsed.deadline_raw) resolved = resolveRelativeDeadline(parsed.deadline_raw, emailDate);
        return {
          company: extractCompanyFromSender(from, subject, body) || parsed.company || 'Unknown',
          role: parsed.role || 'Applicant',
          stage: parsed.stage,
          deadline: resolved.date,
          deadline_raw: resolved.raw,
          action_needed: parsed.action_needed,
          confidence: parsed.confidence,
          source: 'ai'
        };
      }
      Logger.log('NIM returned unusable output, sending to review: ' + rawText);
    } else {
      Logger.log('NIM HTTP ' + response.getResponseCode() + ': ' + response.getContentText().slice(0, 200));
    }
  } catch (err) {
    Logger.log('NIM Call Error: ' + err.toString());
  }

  return {
    company: extractCompanyFromSender(from, subject) || 'Unknown',
    role: 'Applicant',
    stage: 'other',
    deadline: null,
    deadline_raw: null,
    action_needed: false, // uncertain: Jobs/Review label, no star (guards may still raise it)
    confidence: 0.4,
    source: 'error_fallback'
  };
}

/**
 * Validate the model's reply. Returns a clean object, or null if it can't be
 * trusted (no JSON, unknown stage). The model never gets the benefit of the doubt:
 * a missing or garbage confidence becomes 0, which lands the email in Jobs/Review.
 */
function validateNimOutput(rawText) {
  if (typeof rawText !== 'string') return null;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const stage = String(parsed.stage || '').trim().toLowerCase();
  if (CONFIG.STAGES.indexOf(stage) === -1) return null;

  let confidence = Number(parsed.confidence);
  if (!isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence));

  const cleanString = (v, max) =>
    typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, max) : null;

  return {
    company: cleanString(parsed.company, 80),
    role: cleanString(parsed.role, 80),
    stage: stage,
    deadline_raw: cleanString(parsed.deadline_raw, 120),
    // Code decides: anything that isn't a closed/receipt stage needs a human
    action_needed: parsed.action_needed === true || ['assessment', 'interview', 'offer'].indexOf(stage) !== -1,
    confidence: confidence
  };
}

/**
 * Step 3: Execute Actions ("Code Decides")
 */
function executeActions(thread, message, analysis, openThreads) {
  openThreads = openThreads || new Set();
  // 1. Ensure Label Exists
  let labelName = CONFIG.LABELS.REVIEW;
  if (analysis.confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
    switch (analysis.stage) {
      case 'applied': labelName = CONFIG.LABELS.APPLIED; break;
      case 'assessment': labelName = CONFIG.LABELS.ASSESSMENT; break;
      case 'interview': labelName = CONFIG.LABELS.INTERVIEW; break;
      case 'rejected': labelName = CONFIG.LABELS.REJECTED; break;
      case 'offer': labelName = CONFIG.LABELS.OFFER; break;
      default: labelName = CONFIG.LABELS.REVIEW;
    }
  }

  setThreadLabel(thread, labelName);

  // 2. Action Needed -> Keep in inbox + Star
  if (analysis.action_needed || labelName === CONFIG.LABELS.ASSESSMENT || labelName === CONFIG.LABELS.INTERVIEW) {
    message.star();
    thread.moveToInbox();
    openThreads.add(thread.getId());
  } else if (analysis.archive) {
    // 3. Archiving moves the whole thread, so this email passing archiveCheck()
    // isn't enough: no other email in the thread may still need me.
    const blocker = threadBlocker(thread, openThreads);
    if (blocker) {
      Logger.log('  keep thread: ' + blocker);
    } else {
      thread.moveToArchive();
    }
  }
}

/**
 * A thread carries one Jobs/* label: the newest email's. A plain receipt never
 * replaces a more informative label (Assessment, Interview, …) already there.
 */
function setThreadLabel(thread, labelName) {
  const current = typeof thread.getLabels === 'function'
    ? thread.getLabels().filter(l => /^Jobs\//.test(l.getName()))
    : [];
  if (labelName === CONFIG.LABELS.APPLIED && current.some(l => l.getName() !== labelName)) return;
  current.forEach(l => { if (l.getName() !== labelName) thread.removeLabel(l); });
  thread.addLabel(getOrCreateLabel(labelName));
}

/** Why this thread must stay in the inbox, or null if it can be archived */
function threadBlocker(thread, openThreads) {
  if (openThreads.has(thread.getId())) return 'an earlier email in this thread needs action';
  const starred = thread.getMessages().some(m => typeof m.isStarred === 'function' && m.isStarred());
  if (starred) return 'a starred email in this thread';
  return null;
}

/**
 * Deadline from the subject + body, as YYYY-MM-DD (UTC), counted from when the
 * email arrived. Handles "within 7 days of receiving this email", "in the next 48
 * hours", "48 hrs", "in 3 business days", "within a week / two weeks", "by EOD
 * Friday", "by end of week", "by Oct 30", "no later than November 2, 2026",
 * "10/30/2026", "bis zum 30.10.2026". An explicit date wins over a weekday or a
 * relative one. Promises from the company ("you'll hear from us within 14 days")
 * are not deadlines.
 */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, 'twenty-four': 24, 'forty-eight': 48, 'seventy-two': 72
};
const WEEKDAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_MS = 24 * 60 * 60 * 1000;
// Words just before a date that make it a deadline
const DEADLINE_CUE = /\b(?:by|before|due|until|no later than|deadline|expires?|bis(?: zum)?|avant le|antes del?)\b[^.\n]{0,25}$/i;
// "we'll get back to you within 5 days": the company's promise, not my deadline
const COMPANY_PROMISE = /(?:hear (?:back )?from us|get back to you|(?:respond|reply) to you|\b(?:share|send|provide|give you) (?:an? )?(?:update|decision|answer)\b[^.\n]{0,15}|\b(?:we|we'll|we will|our team will|team will|you'll hear|you will hear)\b[^.\n]{0,30}\b(?:respond|reply|review|contact|reach out|be in touch|update|hear))[^.\n]{0,40}$/i;

function resolveRelativeDeadline(text, emailDate) {
  if (!text) return { date: null, raw: null };
  const base = new Date(emailDate);
  const ymd = d => d.toISOString().split('T')[0];
  const before = idx => text.slice(Math.max(0, idx - 60), idx);

  // 1. Explicit dates (need a cue like "by" / "due" / "no later than" just before)
  const absolute = [];
  const addAbs = (m, y, mo, d) => {
    if (!DEADLINE_CUE.test(before(m.index))) return;
    if (mo < 0 || mo > 11 || d < 1 || d > 31) return;
    let year = y || base.getUTCFullYear();
    let date = new Date(Date.UTC(year, mo, d));
    if (!y && date.getTime() < base.getTime() - DAY_MS) date = new Date(Date.UTC(year + 1, mo, d));
    absolute.push({ date: date, raw: m[0].trim(), index: m.index });
  };
  let m;
  const monthFirst = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi;
  while ((m = monthFirst.exec(text)) !== null) addAbs(m, m[3] && +m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  const dayFirst = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+(\d{4}))?\b/gi;
  while ((m = dayFirst.exec(text)) !== null) addAbs(m, m[3] && +m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  const usNumeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g; // 10/30/2026
  while ((m = usNumeric.exec(text)) !== null) addAbs(m, +m[3], +m[1] - 1, +m[2]);
  const euNumeric = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g; // 30.10.2026
  while ((m = euNumeric.exec(text)) !== null) addAbs(m, +m[3], +m[2] - 1, +m[1]);
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(text)) !== null) addAbs(m, +m[1], +m[2] - 1, +m[3]);
  if (absolute.length) {
    absolute.sort((a, b) => a.index - b.index);
    return { date: ymd(absolute[0].date), raw: absolute[0].raw };
  }

  // 2. Relative amounts and weekdays: take the earliest
  const found = [];
  const relative = /\b(?:within|in(?: the next)?|next|have)\s+(?:(\d+)\s*|(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|twenty-four|forty-eight|seventy-two)\s+)(business days?|working days?|days?|hours?|hrs?|h|weeks?)\b(?!\s+from\b)/gi;
  while ((m = relative.exec(text)) !== null) {
    if (COMPANY_PROMISE.test(before(m.index))) continue;
    const n = m[1] ? +m[1] : WORD_NUMBERS[m[2].toLowerCase()];
    const unit = m[3].toLowerCase();
    let date;
    if (/^(?:business|working)/.test(unit)) {
      date = new Date(base.getTime());
      for (let left = n; left > 0;) {
        date = new Date(date.getTime() + DAY_MS);
        if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left--;
      }
    } else if (/^(?:hours?|hrs?|h)$/.test(unit)) {
      date = new Date(base.getTime() + n * 60 * 60 * 1000);
    } else if (/^weeks?$/.test(unit)) {
      date = new Date(base.getTime() + n * 7 * DAY_MS);
    } else {
      date = new Date(base.getTime() + n * DAY_MS);
    }
    found.push({ date: date, raw: m[0] });
  }

  const nextWeekday = target => {
    const diff = (target - base.getUTCDay() + 7) % 7; // same day counts ("by Friday" on a Friday)
    return new Date(base.getTime() + diff * DAY_MS);
  };
  const weekday = /\b(?:by|before|until)\s+(?:(?:eod|cob|end of (?:the )?(?:business )?day)\s+(?:on\s+)?)?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/gi;
  while ((m = weekday.exec(text)) !== null) found.push({ date: nextWeekday(WEEKDAYS[m[1].toLowerCase()]), raw: m[0] });
  const endOfWeek = /\bby (?:the )?end of (?:the |this )?week\b/i.exec(text);
  if (endOfWeek) found.push({ date: nextWeekday(5), raw: endOfWeek[0] });
  const endOfNextWeek = /\b(?:by )?(?:the )?end of next week\b/i.exec(text);
  if (endOfNextWeek) found.push({ date: new Date(nextWeekday(5).getTime() + 7 * DAY_MS), raw: endOfNextWeek[0] });
  // "this Friday" (with or without "by")
  const thisDay = /\bthis (mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/gi;
  while ((m = thisDay.exec(text)) !== null) found.push({ date: nextWeekday(WEEKDAYS[m[1].toLowerCase()]), raw: m[0] });
  // "by tomorrow", "by today / tonight"
  const dayWord = /\b(?:by|before|until)\s+(?:end of (?:day )?)?(tomorrow|today|tonight)\b/i.exec(text);
  if (dayWord) found.push({ date: new Date(base.getTime() + (dayWord[1].toLowerCase() === 'tomorrow' ? DAY_MS : 0)), raw: dayWord[0] });
  // "a week from today", "3 days from now"
  const fromToday = /\b(\d+|a|an|one|two|three)\s+(days?|weeks?)\s+from (?:today|now)\b/i.exec(text);
  if (fromToday) {
    const n = /^\d+$/.test(fromToday[1]) ? +fromToday[1] : WORD_NUMBERS[fromToday[1].toLowerCase()];
    found.push({ date: new Date(base.getTime() + n * (/^week/i.test(fromToday[2]) ? 7 : 1) * DAY_MS), raw: fromToday[0] });
  }
  // "by the 31st": that day this month, or next month if it has passed
  const dayOfMonth = /\b(?:by|before|until|on) the (\d{1,2})(?:st|nd|rd|th)\b/i.exec(text);
  if (dayOfMonth) {
    const d = +dayOfMonth[1];
    let date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), d));
    if (date.getTime() < base.getTime() - DAY_MS) date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, d));
    found.push({ date: date, raw: dayOfMonth[0] });
  }
  const today = /\bby (?:eod|cob|end of (?:the )?(?:business )?day)\b(?!\s+(?:on\s+)?(?:mon|tue|wed|thu|fri|sat|sun))/i.exec(text);
  if (today) found.push({ date: base, raw: today[0] });

  if (!found.length) return { date: null, raw: null };
  found.sort((a, b) => a.date - b.date);
  return { date: ymd(found[0].date), raw: found[0].raw };
}

/**
 * Helpers
 */
/**
 * Company from a From header like `"Stripe Recruiting" <no-reply@us.greenhouse-mail.io>`.
 * ATS mail comes from the ATS's domain, so for those we read the display name,
 * then the Workday mailbox name (stripe@myworkday.com), then the subject.
 * Everyone else: the company is the sender's own domain.
 */
function extractCompanyFromSender(from, subject, body) {
  const addrMatch = from.match(/<?([^<>\s@]+)@([a-zA-Z0-9.-]+)>?\s*$/);
  if (!addrMatch) return extractCompanyFromSubject(subject);

  const localPart = addrMatch[1].toLowerCase();
  const domain = addrMatch[2].toLowerCase();
  const isATS = CONFIG.ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  const isRelay = CONFIG.RELAY_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));

  // Calendar invites: the organizer's company
  const organizer = /Organizer:\s*[^\s@]+@([a-zA-Z0-9.-]+)/i.exec(body || '');
  if (isRelay && organizer) return titleCase(registrableName(organizer[1].toLowerCase()));
  // LinkedIn, Indeed, …: the company is named in the subject, not the sender
  if (isRelay) return extractCompanyFromSubject(subject) || companyFromDisplayName(from);

  if (!isATS) {
    if (/^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton|protonmail)\./.test(domain)) {
      // A recruiter on a personal address: their own name is not the company
      return extractCompanyFromSubject(subject) || companyFromDisplayName(from);
    }
    return titleCase(registrableName(domain));
  }

  // ATS mail: the subject names the company more reliably than a recruiter's name
  const fromSubject = extractCompanyFromSubject(subject);
  if (fromSubject) return fromSubject;
  const fromName = companyFromDisplayName(from);
  if (fromName) return fromName;

  if (/myworkday(jobs)?\.com$/.test(domain) && !/^(no-?reply|do-?not-?reply|notifications?)$/.test(localPart)) {
    return titleCase(localPart);
  }

  return extractCompanyFromSubject(subject);
}

function companyFromDisplayName(from) {
  const nameMatch = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (!nameMatch) return null;
  let name = nameMatch[1].replace(/\s+via\s+.*$/i, '');
  // "Jane Doe at Stripe" / "Jane from Stripe" -> Stripe
  const atMatch = name.match(/\s(?:at|from|@)\s+(.+)$/i);
  if (atMatch) name = atMatch[1];
  name = name
    .replace(CONFIG.SENDER_NAME_NOISE, '')
    .replace(/[|,\-–]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  name = stripCompanySuffix(name);
  if (!name || CONFIG.ATS_NAMES.test(name)) return null;
  return name;
}

function extractCompanyFromSubject(subject) {
  const match = (subject || '').match(
    /\b(?:applying|application|applied|interest)\s+(?:to|at|with|in)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/
  ) || (subject || '').match(/\b(?:interview|chat|call|conversation)\s+with\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/i)
    || (subject || '').match(/\bat\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/);
  return match ? stripCompanySuffix(match[1].replace(/[.!]+$/, '').trim()) : null;
}

// "Ramp, Inc." / "Visa Inc." -> "Ramp" / "Visa"
function stripCompanySuffix(name) {
  return name.replace(/,?\s+(?:inc|llc|ltd|corp|corporation|co|gmbh)\.?$/i, '').trim();
}

// mail.stripe.com -> stripe, careers.acme.co.uk -> acme
function registrableName(domain) {
  const labels = domain.split('.');
  if (labels.length >= 3 && /^(co|com|ac|org|net)$/.test(labels[labels.length - 2])) {
    return labels[labels.length - 3];
  }
  return labels.length >= 2 ? labels[labels.length - 2] : labels[0];
}

function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function extractRole(subject) {
  const match = subject.match(/(?:for|role|position):\s*([a-zA-Z0-9\s-]+)/i) ||
                subject.match(/([a-zA-Z\s]+(?:Engineer|Designer|Manager|Analyst|Intern|Fellow))/i);
  return match ? match[1].trim() : 'Candidate';
}

function generateApplicationId(company, role) {
  const cleanComp = (company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanRole = (role || 'general').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  return `${cleanComp}-${cleanRole}`;
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

/**
 * Google Sheet Logging & Publishing
 */
/**
 * Opens the Sheet and reads which messages are already done and which threads
 * still need action. Throws (stopping the run before anything happens) if the
 * Sheet is missing or its first row isn't the tracker header.
 */
function openLedger() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!sheetId) throw new Error('SPREADSHEET_ID is not set in Script Properties. Nothing was processed.');
  const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();

  if (sheet.getLastRow() === 0) sheet.appendRow(CONFIG.SHEET_HEADERS);
  const data = sheet.getDataRange().getValues();
  if (String(data[0][0]) !== CONFIG.SHEET_HEADERS[0]) {
    throw new Error('The Sheet\'s first row must be the tracker header ("Message ID", ...). Use an empty sheet.');
  }

  const col = name => CONFIG.SHEET_HEADERS.indexOf(name);
  const processed = new Set();
  const openThreads = new Set(); // threads with an email that still needs me
  const knownThreads = new Set(); // threads already tracked
  const knownDomains = new Set(); // company domains already tracked (not ATS, not Gmail etc.)
  const companyDomain = from => {
    const d = ((String(from).match(/@([a-zA-Z0-9.-]+)/) || [])[1] || '').toLowerCase();
    if (!d || /^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton|protonmail)\./.test(d)) return null;
    if (CONFIG.ATS_DOMAINS.concat(CONFIG.RELAY_DOMAINS).some(a => d === a || d.endsWith('.' + a))) return null;
    return d;
  };
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    processed.add(cleanId(row[col('Message ID')]));
    knownThreads.add(cleanId(row[col('Thread ID')]));
    const domain = companyDomain(row[col('Sender')]);
    if (domain) knownDomains.add(domain);
    const needsAction = row[col('Action Needed')] === true || String(row[col('Action Needed')]).toLowerCase() === 'true';
    if (needsAction) openThreads.add(cleanId(row[col('Thread ID')]));
  }

  return {
    processed: processed,
    openThreads: openThreads,
    // A thread or company we already track: its new emails are job mail whatever they say
    isKnown: function (threadId, from) {
      const domain = companyDomain(from);
      return knownThreads.has(threadId) || (domain !== null && knownDomains.has(domain));
    },
    remember: function (threadId, from) {
      knownThreads.add(threadId);
      const domain = companyDomain(from);
      if (domain) knownDomains.add(domain);
    },
    // IDs are written with a leading ' so Sheets keeps them as text (an all-digit
    // ID would otherwise become a number and lose precision)
    append: function (row) {
      const out = row.slice();
      out[0] = "'" + out[0];
      out[1] = "'" + out[1];
      sheet.appendRow(out.map(v => (v === null || v === undefined ? '' : v)));
    }
  };
}

function cleanId(v) {
  return String(v).replace(/^'/, '');
}

/**
 * Web App Endpoint: Publishes JSON feed for Chrome Extension or Dashboard
 */
function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SPREADSHEET_ID');
  if (!sheetId) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'No SPREADSHEET_ID set' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }

  const headers = data[0];
  const items = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.toLowerCase().replace(/\s+/g, '_')] = typeof row[i] === 'string' ? cleanId(row[i]) : row[i];
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(items))
    .setMimeType(ContentService.MimeType.JSON);
}
