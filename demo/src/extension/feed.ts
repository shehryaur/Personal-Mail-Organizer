// Turns the Apps Script feed (one row per processed email) into the board's
// applications and emails. Shared by the board page and the content script.
import type { Application, Email, Stage } from '../types';
import { GHOSTED_AFTER_DAYS } from '../utils/ghosting';

export interface FeedItem {
  message_id: string;
  thread_id: string;
  date: string;
  sender: string;
  company: string;
  role: string;
  stage: 'applied' | 'assessment' | 'interview' | 'rejected' | 'offer' | 'other' | 'review' | 'not_job';
  deadline: string;
  deadline_raw: string;
  action_needed: boolean | string;
  confidence: number;
  source: string;
  application_id: string;
  subject?: string;
  snippet?: string;
}

export interface Feed {
  ok: boolean;
  error?: string;
  updated_at?: string;
  items?: FeedItem[];
}

const DAY_MS = 86400000;
const ATS_OR_PERSONAL =
  /(greenhouse|lever\.co|ashbyhq|myworkday|smartrecruiters|workable|icims|linkedin|indeed|wellfound|google\.com|gmail|googlemail|outlook|hotmail|yahoo|icloud|proton)/i;

const truthy = (v: boolean | string) => v === true || String(v).toLowerCase() === 'true';

// "2026-10-27" or an ISO timestamp -> ISO at the end of that day (local), or null
function deadlineIso(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 23, 59).toISOString();
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// An interview's date from a calendar-style subject, "@ Tue Nov 3, 2026 11:30am"
// (rows recorded before the script read event dates have none). Local time.
function interviewDate(subject: string, receivedIso: string): string | null {
  const m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i.exec(subject || '');
  if (!m) return null;
  const received = new Date(receivedIso);
  let hour = m[4] ? +m[4] % 12 + (/pm/i.test(m[6]) ? 12 : 0) : 23;
  const d = new Date(m[3] ? +m[3] : received.getFullYear(), MONTHS.indexOf(m[1].toLowerCase()), +m[2], hour, m[5] ? +m[5] : m[4] ? 0 : 59);
  return d.getTime() >= received.getTime() - 86400000 ? d.toISOString() : null;
}

function senderDomain(from: string): string {
  return ((from.match(/@([a-zA-Z0-9.-]+)/) || [])[1] || '').toLowerCase();
}

function toEmail(it: FeedItem, appId: string): Email {
  // not_job rows are filtered out before this; 'review' = the model wasn't sure
  const stage: Stage = it.stage === 'not_job' ? 'review' : it.stage;
  const action = truthy(it.action_needed);
  return {
    id: String(it.message_id),
    threadId: String(it.thread_id),
    from: it.sender,
    senderDomain: senderDomain(it.sender),
    subject: it.subject || '(no subject)',
    snippet: it.snippet || '',
    fullBody: it.snippet || '',
    receivedAt: new Date(it.date).toISOString(),
    company: it.company || 'Unknown',
    role: it.role || '',
    stage,
    deadlineRaw: it.deadline_raw || null,
    deadlineResolved: deadlineIso(it.deadline) || (stage === 'interview' ? interviewDate(it.subject || '', it.date) : null),
    actionNeeded: action,
    confidence: Number(it.confidence) || 0,
    decisionSource: /^ai|\+ai/.test(it.source) ? 'ai' : it.source === 'injection_guard' ? 'guardrail_override' : 'rule',
    ruleMatched: it.source,
    isStarred: action,
    isArchived: false,
    applicationId: appId,
  };
}

/**
 * One application per company. Section, in this order:
 *  closed       – the newest email is a rejection
 *  needs_action – an email in the last 30 days needs action, or a deadline is still ahead
 *  ghosted      – never got past "applied" and nothing for GHOSTED_AFTER_DAYS days
 *  in_progress  – everything else
 */
export function adaptFeed(items: FeedItem[], now: number): { applications: Application[]; emails: Email[] } {
  const byCompany = new Map<string, FeedItem[]>();
  for (const it of items) {
    if (!it.message_id || it.stage === 'not_job') continue;

    // Guardrail against school / work-study emails misclassified as job offers or applications:
    const haystack = (String(it.sender || '') + ' ' + String(it.subject || '') + ' ' + String(it.company || '')).toLowerCase();
    const isSchoolOrWorkStudy = /@(minerva\.edu|uni\.minerva\.edu)/i.test(it.sender) ||
      /\b(?:minerva forum|minerva community|studentpayroll|ws offer|work study|workstudy)\b/i.test(haystack) ||
      /\b(?:cs113|b110|b111|gl93|fe51|fa51|mc51|cx51)\b/i.test(haystack);
    const isCommercialOffer = /\b(?:competing offer|best offer|macbook)\b/i.test(haystack) && /\b(?:ebay|cart|coupon)\b/i.test(haystack);

    if (it.stage === 'offer' && (isSchoolOrWorkStudy || isCommercialOffer)) {
      continue;
    }
    if (isSchoolOrWorkStudy && (it.company === 'Hellosign' || (it.stage === 'interview' && /cs113/i.test(haystack)))) {
      continue;
    }

    const key = 'app-' + (String(it.company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown');
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(it);
  }

  // One company under two spellings ("Tylertech" from a recruiter's address,
  // "Tyler Technologies" from the careers mailbox): merge a key into a longer
  // key it starts. Shorter keys first, so each merges into its nearest match.
  const keys = [...byCompany.keys()].sort((a, b) => a.length - b.length);
  for (const short of keys) {
    const base = short.slice(4);
    if (base.length < 5) continue;
    const into = keys.find(k => k !== short && byCompany.has(k) && k.length > short.length && k.slice(4).startsWith(base));
    if (into) {
      byCompany.get(into)!.push(...byCompany.get(short)!);
      byCompany.delete(short);
    }
  }

  const emails: Email[] = [];
  const applications: Application[] = [];
  for (const [appId, group] of byCompany) {
    const appEmails = group.map(it => toEmail(it, appId)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    emails.push(...appEmails);
    const newest = appEmails[appEmails.length - 1];
    const lastActivity = newest.receivedAt;
    const days = Math.floor((now - new Date(lastActivity).getTime()) / DAY_MS);

    const upcoming = appEmails
      .filter(e => e.deadlineResolved && new Date(e.deadlineResolved).getTime() > now)
      .sort((a, b) => a.deadlineResolved!.localeCompare(b.deadlineResolved!));
    const nextDeadline = upcoming[0];
    const recentAction = appEmails.some(e => e.actionNeeded && now - new Date(e.receivedAt).getTime() < 30 * DAY_MS);
    const onlyApplied = appEmails.every(e => e.stage === 'applied');

    let stage: Application['stage'] = 'in_progress';
    if (newest.stage === 'rejected') stage = 'closed';
    else if (nextDeadline || recentAction) stage = 'needs_action';
    else if (onlyApplied && days >= GHOSTED_AFTER_DAYS) stage = 'ghosted';

    const roleEmail = [...appEmails].reverse().find(e => e.role && e.role !== 'Candidate' && e.role !== 'Applicant');
    const companyDomainEmail = appEmails.find(e => e.senderDomain && !ATS_OR_PERSONAL.test(e.senderDomain));
    // The most readable spelling: "Tyler Technologies" over "Tylertech"
    const company = [...new Set(appEmails.map(e => e.company))]
      .sort((a, b) => Number(/\s/.test(b)) - Number(/\s/.test(a)) || Number(/[a-z][A-Z]|^[A-Z][a-z]/.test(b)) - Number(/[a-z][A-Z]|^[A-Z][a-z]/.test(a)) || b.length - a.length)[0];
    applications.push({
      id: appId,
      company,
      domain: companyDomainEmail
        ? companyDomainEmail.senderDomain.split('.').slice(-2).join('.')
        : company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
      role: roleEmail ? roleEmail.role : '',
      stage,
      currentStatus: newest.subject,
      deadline: nextDeadline ? nextDeadline.deadlineResolved : null,
      deadlineRaw: nextDeadline ? nextDeadline.deadlineRaw : null,
      // the deadline lane counts down from the email that set the deadline
      lastActivity: nextDeadline ? nextDeadline.receivedAt : lastActivity,
      daysSinceLastActivity: days,
      emails: [...appEmails].reverse(),
      confidence: Math.min(...appEmails.map(e => e.confidence)),
      tags: [],
    });
  }
  return { applications, emails };
}
