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
    'lever.co',
    'ashbyhq.com',
    'myworkdayjobs.com',
    'smartrecruiters.com',
    'workable.com',
    'icims.com'
  ],
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
      /\bphone screen\b/i
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
  CONFIDENCE_THRESHOLD: 0.85,
  GHOSTING_DAYS_THRESHOLD: 21
};

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
  const content = subject + '\n' + body.slice(0, 800);

  // 1. Check Guardrail: Rescheduling/Interview override
  const hasScheduleLink = /calendly\.com|goodtime\.io|schedule|availability/i.test(body);

  // 2. Try Deterministic Rules
  let ruleStage = null;
  if (CONFIG.RULES.ASSESSMENT.some(r => r.test(content))) {
    ruleStage = 'assessment';
  } else if (CONFIG.RULES.INTERVIEW.some(r => r.test(content)) || hasScheduleLink) {
    ruleStage = 'interview';
  } else if (CONFIG.RULES.REJECTED.some(r => r.test(content)) && !hasScheduleLink) {
    ruleStage = 'rejected';
  } else if (CONFIG.RULES.APPLIED.some(r => r.test(content))) {
    ruleStage = 'applied';
  }

  const company = extractCompanyFromSender(from, subject);
  const relativeDeadline = resolveRelativeDeadline(body, emailDate);

  if (ruleStage) {
    return {
      company: company || 'Unknown Company',
      role: extractRole(subject) || 'Applicant',
      stage: ruleStage,
      deadline: relativeDeadline.date,
      deadline_raw: relativeDeadline.raw,
      action_needed: (ruleStage === 'assessment' || ruleStage === 'interview'),
      confidence: 0.95,
      source: 'rule'
    };
  }

  // 3. NIM Fallback if rules cannot confidently categorize
  return callNIMFallback(from, subject, body, emailDate);
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
      const rawText = data.choices[0].message.content.trim();
      const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);

      const resolved = resolveRelativeDeadline(parsed.deadline_raw || body, emailDate);
      return {
        company: parsed.company || extractCompanyFromSender(from, subject) || 'Unknown',
        role: parsed.role || 'Applicant',
        stage: parsed.stage || 'other',
        deadline: resolved.date,
        deadline_raw: resolved.raw,
        action_needed: Boolean(parsed.action_needed),
        confidence: Number(parsed.confidence) || 0.7,
        source: 'ai'
      };
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
function extractCompanyFromSender(from, subject) {
  // Extract domain or name before @
  const match = from.match(/@([a-zA-Z0-9.-]+)/);
  if (match) {
    let domain = match[1].toLowerCase();
    // Strip common ATS suffixes
    domain = domain.replace(/\.(greenhouse-mail|eu\.greenhouse-mail|workday|lever|ashbyhq)\.io/i, '');
    domain = domain.replace(/\.com|\.io|\.co|\.org|\.ai/i, '');
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return null;
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
