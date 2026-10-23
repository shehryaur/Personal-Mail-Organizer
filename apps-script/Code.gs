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
    'icims.com'
  ],
  // Sender names that are the ATS itself, never the hiring company
  ATS_NAMES: /^(greenhouse|lever|ashby|workday|smartrecruiters|workable|icims)$/i,
  // Words recruiters append to the company in the From display name
  SENDER_NAME_NOISE: /\b(recruiting|recruitment|recruiter|talent acquisition|talent|careers?|hiring team|hiring|jobs|people team|people|hr|team|no-?reply|notifications?)\b/gi,
  // Only real booking links count as "this is an interview" evidence
  BOOKING_LINK: /calendly\.com\/|goodtime\.io\/|cal\.com\/|calendar\.app\.google\/|app\.greenhouse\.io\/(?:interviews|scheduling)|ashbyhq\.com\/.*schedul/i,
  KEYWORDS: [
    'application',
    'interview',
    'assessment',
    'candidate',
    'thank you for applying',
    'challenge',
    'invitation'
  ],
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
      /\bposition has been filled\b/i
    ],
    ASSESSMENT: [
      /\bhackerrank\b/i,
      /\bcodesignal\b/i,
      /\btake-home\b/i,
      /\bdesign challenge\b/i,
      /\bcoding challenge\b/i,
      /\bonline assessment\b/i,
      /\btechnical assessment\b/i
    ],
    INTERVIEW: [
      /\bschedule an? interview\b/i,
      /\bcalendly\.com\b/i,
      /\byour availability\b/i,
      /\binvite you to interview\b/i,
      /\bnext steps?.*interview\b/i,
      /\bphone screen\b/i,
      /\breschedul(?:e|ing)\b/i
    ],
    APPLIED: [
      /\breceived your application\b/i,
      /\bthank you for applying\b/i,
      /\bapplication submitted\b/i,
      /\bconfirm receipt\b/i
    ]
  },
  NIM_ENDPOINT: 'https://integrate.api.nvidia.com/v1/chat/completions',
  NIM_MODEL: 'meta/llama-3.1-8b-instruct',
  STAGES: ['applied', 'assessment', 'interview', 'rejected', 'offer', 'other'],
  CONFIDENCE_THRESHOLD: 0.85,
  GHOSTING_DAYS_THRESHOLD: 21
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
  const props = PropertiesService.getScriptProperties();
  const processedIdsJson = props.getProperty('PROCESSED_MESSAGE_IDS') || '[]';
  const processedIds = new Set(JSON.parse(processedIdsJson));

  // Search candidate emails from the last 7 days
  const query = 'newer_than:7d';
  const threads = GmailApp.search(query, 0, 50);

  const newRecords = [];

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      const msgId = message.getId();
      if (processedIds.has(msgId)) continue;

      const from = message.getFrom();
      const subject = message.getSubject();
      const body = message.getPlainBody();
      const date = message.getDate();

      // Step 1: Pre-filter (No AI)
      if (!matchesPreFilter(from, subject, body)) {
        processedIds.add(msgId);
        continue;
      }

      // Step 2: Extract & Decide
      const analysis = analyzeEmail(from, subject, body, date);

      // Step 3: Apply deterministic actions
      executeActions(thread, message, analysis);

      // Record result
      newRecords.push({
        message_id: msgId,
        thread_id: thread.getId(),
        date: date.toISOString(),
        sender: from,
        company: analysis.company,
        role: analysis.role,
        stage: analysis.stage,
        deadline: analysis.deadline,
        deadline_raw: analysis.deadline_raw,
        action_needed: analysis.action_needed,
        confidence: analysis.confidence,
        source: analysis.source,
        application_id: generateApplicationId(analysis.company, analysis.role)
      });

      processedIds.add(msgId);
    }
  }

  // Update processed cache (keep last 500 IDs)
  const updatedIds = Array.from(processedIds).slice(-500);
  props.setProperty('PROCESSED_MESSAGE_IDS', JSON.stringify(updatedIds));

  // Append records to Google Sheet if configured
  if (newRecords.length > 0) {
    saveToSheet(newRecords);
  }
}

/**
 * Step 1: Deterministic Pre-filter
 */
function matchesPreFilter(from, subject, body) {
  const fromLower = from.toLowerCase();
  const text = (subject + ' ' + body.slice(0, 1000)).toLowerCase();

  const isATS = CONFIG.ATS_DOMAINS.some(domain => fromLower.includes(domain));
  if (isATS) return true;

  const hasKeyword = CONFIG.KEYWORDS.some(kw => text.includes(kw));
  return hasKeyword;
}

/**
 * Step 2: Analyze Email (Rules First -> NVIDIA NIM Fallback)
 */
function analyzeEmail(from, subject, body, emailDate) {
  const ruleResult = classifyByRules(subject, body);
  const company = extractCompanyFromSender(from, subject);
  const relativeDeadline = resolveRelativeDeadline(body, emailDate);

  let result;
  if (ruleResult) {
    result = {
      company: company || 'Unknown Company',
      role: extractRole(subject) || 'Applicant',
      stage: ruleResult.stage,
      deadline: relativeDeadline.date,
      deadline_raw: relativeDeadline.raw,
      action_needed: ruleResult.stage !== 'rejected' && ruleResult.stage !== 'applied',
      confidence: ruleResult.confidence,
      source: 'rule'
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

  Logger.log('[' + result.source + '] ' + result.stage + ' (' + result.confidence + ') ' +
    result.company + ' | ' + subject);
  return result;
}

/**
 * Deterministic rules. Returns {stage, confidence} or null when nothing matched.
 * Rejection is checked first so "Unfortunately, after reviewing your assessment"
 * isn't starred as an assessment. If a rejection phrase appears next to interview
 * signals ("Unfortunately our interviewer is sick, please reschedule"), the rules
 * disagree, so the email stays visible in Jobs/Review instead of being archived.
 */
function classifyByRules(subject, body) {
  const content = subject + '\n' + body.slice(0, 800);
  const matches = rules => rules.some(r => r.test(content));

  const isRejected = matches(CONFIG.RULES.REJECTED);
  const isInterview = matches(CONFIG.RULES.INTERVIEW) || CONFIG.BOOKING_LINK.test(body);

  if (isRejected && isInterview) return { stage: 'other', confidence: 0.6 };
  if (isRejected) return { stage: 'rejected', confidence: 0.95 };
  if (matches(CONFIG.RULES.ASSESSMENT)) return { stage: 'assessment', confidence: 0.95 };
  if (isInterview) return { stage: 'interview', confidence: 0.95 };
  if (matches(CONFIG.RULES.APPLIED)) return { stage: 'applied', confidence: 0.95 };
  return null;
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
      action_needed: true,
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
        const resolved = resolveRelativeDeadline(parsed.deadline_raw || body, emailDate);
        return {
          company: parsed.company || extractCompanyFromSender(from, subject) || 'Unknown',
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
    action_needed: true,
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
    action_needed: parsed.action_needed === true || ['assessment', 'interview', 'offer', 'other'].indexOf(stage) !== -1,
    confidence: confidence
  };
}

/**
 * Step 3: Execute Actions ("Code Decides")
 */
function executeActions(thread, message, analysis) {
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

  const label = getOrCreateLabel(labelName);
  thread.addLabel(label);

  // 2. Action Needed -> Keep in inbox + Star
  if (analysis.action_needed || labelName === CONFIG.LABELS.ASSESSMENT || labelName === CONFIG.LABELS.INTERVIEW) {
    message.star();
    thread.moveToInbox();
  } else if (
    (analysis.stage === 'rejected' || analysis.stage === 'applied') &&
    analysis.confidence >= CONFIG.CONFIDENCE_THRESHOLD
  ) {
    // 3. High-confidence applied/rejected -> Auto-archive to reduce cognitive clutter
    thread.moveToArchive();
  }
}

/**
 * Relative Deadline Parser (e.g., "within 7 days of receiving this email")
 */
function resolveRelativeDeadline(text, emailDate) {
  if (!text) return { date: null, raw: null };

  const baseDate = new Date(emailDate);

  // Pattern 1: "within X days"
  const daysMatch = text.match(/within\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const target = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    return { date: target.toISOString().split('T')[0], raw: daysMatch[0] };
  }

  // Pattern 2: "in the next X hours" / "within X hours"
  const hoursMatch = text.match(/(?:within|next)\s+(\d+)\s+hours?/i);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    const target = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
    return { date: target.toISOString(), raw: hoursMatch[0] };
  }

  // Pattern 3: "by end of week"
  if (/by end of week|by friday/i.test(text)) {
    const day = baseDate.getDay();
    const diff = 5 - day; // 5 is Friday
    const target = new Date(baseDate.getTime() + (diff > 0 ? diff : 7 + diff) * 24 * 60 * 60 * 1000);
    return { date: target.toISOString().split('T')[0], raw: 'by end of week' };
  }

  return { date: null, raw: null };
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
function extractCompanyFromSender(from, subject) {
  const addrMatch = from.match(/<?([^<>\s@]+)@([a-zA-Z0-9.-]+)>?\s*$/);
  if (!addrMatch) return extractCompanyFromSubject(subject);

  const localPart = addrMatch[1].toLowerCase();
  const domain = addrMatch[2].toLowerCase();
  const isATS = CONFIG.ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));

  if (!isATS) {
    if (/^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton|protonmail)\./.test(domain)) {
      return companyFromDisplayName(from) || extractCompanyFromSubject(subject);
    }
    return titleCase(registrableName(domain));
  }

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
  if (!name || CONFIG.ATS_NAMES.test(name)) return null;
  return name;
}

function extractCompanyFromSubject(subject) {
  const match = (subject || '').match(
    /\b(?:applying|application|applied|interest)\s+(?:to|at|with|in)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/
  ) || (subject || '').match(/\bat\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/);
  return match ? match[1].replace(/[.!]+$/, '').trim() : null;
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
function saveToSheet(records) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SPREADSHEET_ID');
  if (!sheetId) return;

  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Message ID', 'Thread ID', 'Date', 'Sender', 'Company', 'Role',
      'Stage', 'Deadline', 'Deadline Raw', 'Action Needed', 'Confidence', 'Source', 'Application ID'
    ]);
  }

  const rows = records.map(r => [
    r.message_id, r.thread_id, r.date, r.sender, r.company, r.role,
    r.stage, r.deadline, r.deadline_raw, r.action_needed, r.confidence, r.source, r.application_id
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
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
      obj[h.toLowerCase().replace(/\s+/g, '_')] = row[i];
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(items))
    .setMimeType(ContentService.MimeType.JSON);
}
