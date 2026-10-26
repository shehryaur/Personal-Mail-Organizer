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
    deadlineResolved: deadlineIso(it.deadline),
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
    const key = 'app-' + (String(it.company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown');
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(it);
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
    const company = newest.company;
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
