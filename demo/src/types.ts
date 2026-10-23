export type Stage = 'applied' | 'assessment' | 'interview' | 'rejected' | 'offer' | 'review';

export type DecisionSource = 'rule' | 'ai' | 'guardrail_override';

export interface Email {
  id: string;
  threadId: string;
  from: string;
  senderDomain: string;
  subject: string;
  snippet: string;
  fullBody: string;
  receivedAt: string; // ISO date
  company: string;
  role: string;
  stage: Stage;
  deadlineRaw: string | null;
  deadlineResolved: string | null; // ISO date
  actionNeeded: boolean;
  confidence: number; // 0 to 1
  decisionSource: DecisionSource;
  ruleMatched: string | null;
  guardrailNote?: string;
  isStarred: boolean;
  isArchived: boolean;
  applicationId: string;
  hasScheduleLink?: boolean;
}

export interface Application {
  id: string;
  company: string;
  domain: string; // for the logo
  role: string;
  stage: 'needs_action' | 'in_progress' | 'ghosted' | 'closed';
  currentStatus: string;
  deadline: string | null;
  deadlineRaw: string | null;
  lastActivity: string;
  daysSinceLastActivity: number;
  emails: Email[];
  confidence: number;
  tags: string[];
}

export interface DeterministicRule {
  id: string;
  name: string;
  type: 'ats_domain' | 'keyword' | 'guardrail_override';
  pattern: string;
  targetStage: Stage;
  action: 'archive' | 'star_inbox' | 'review';
  matchesCount: number;
  createdFromCorrection: boolean;
}
