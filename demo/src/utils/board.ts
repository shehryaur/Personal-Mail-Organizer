// What the Job Tracker dashboard shows, worked out from applications and their
// emails: counts per stage, the to-do list, weekly counts and the stage board.
// Counts only: no rates or averages (deliberate: the dashboard replaces reading
// the emails, it isn't an analytics page).
import type { Application } from '../types';
import { GHOSTED_AFTER_DAYS } from './ghosting';
import { asksForAction } from './todo';

export type Lane = 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected' | 'review';

export interface Unsure { emailId: string; company: string; subject: string; date: string }
export type ChipKind = 'due' | 'info' | 'warn' | 'closed' | 'wait';

export const LANES: { key: Lane; name: string }[] = [
  { key: 'applied', name: 'Applied' },
  { key: 'assessment', name: 'Assessment' },
  { key: 'interview', name: 'Interview' },
  { key: 'offer', name: 'Offer' },
  { key: 'rejected', name: 'Rejected' },
];

export interface Card {
  app: Application;
  lane: Lane;
  reached: Set<Lane>;
  chip: { kind: ChipKind; text: string };
  lastEmail: string; // "Oct 24"
  openEmailId: string; // the email to open when the card is clicked
  deadline: string | null;
  ghostedDays: number | null;
}

export interface Task {
  card: Card;
  when: string;
  tone: 'hot' | 'plain' | 'warn';
  what: string;
  detail: string;
}

export interface Board {
  cards: Card[];
  lanes: { key: Lane; name: string; cards: Card[] }[];
  counts: { key: Lane; label: string; count: number; note: string }[];
  // emails the classifier wasn't sure about: listed apart, never in To do or on the board
  unsure: Unsure[];
  tasks: Task[];
  weekly: { weeks: string[]; applied: number[]; assessment: number[]; interview: number[] };
}

const DAY = 86400000;
const PROGRESS: Lane[] = ['applied', 'assessment', 'interview', 'offer'];
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dayTime = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "3d 14h", "5h", or null if past */
export function countdown(iso: string, now: number): string | null {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${Math.max(1, h)}h`;
}

function cardFor(app: Application, now: number): Card {
  const emails = [...app.emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const newest = emails[emails.length - 1];
  const decided = emails.filter(e => e.stage !== 'review');
  const reached = new Set<Lane>(decided.map(e => e.stage as Lane));
  if (decided.length) reached.add('applied'); // an invite means I applied
  const newestDecided = decided[decided.length - 1];

  let lane: Lane = 'review';
  if (newestDecided && newestDecided.stage === 'rejected') lane = 'rejected';
  else if (decided.length) lane = [...PROGRESS].reverse().find(l => reached.has(l)) || 'applied';

  // Only deadlines of emails that ask me to do something count; a date mentioned
  // in an update or a rejection is not a deadline
  const upcoming = emails
    .filter(e => asksForAction(e) && e.deadlineResolved && new Date(e.deadlineResolved).getTime() > now)
    .sort((a, b) => a.deadlineResolved!.localeCompare(b.deadlineResolved!))[0];
  const daysQuiet = Math.floor((now - new Date(newest.receivedAt).getTime()) / DAY);
  const ghosted = lane === 'applied' && emails.every(e => e.stage === 'applied') && daysQuiet >= GHOSTED_AFTER_DAYS;
  const laneEmail = [...emails].reverse().find(e => e.stage === lane) || newest;

  let chip: Card['chip'];
  if (lane === 'rejected') chip = { kind: 'closed', text: reached.has('interview') ? 'Rejected after interview' : `Rejected ${day(laneEmail.receivedAt)}` };
  else if (upcoming) {
    const left = countdown(upcoming.deadlineResolved!, now);
    chip = lane === 'offer' ? { kind: 'due', text: `Decide by ${day(upcoming.deadlineResolved!)}` }
      : lane === 'interview' ? { kind: 'due', text: `Interview ${day(upcoming.deadlineResolved!)}` }
      : { kind: 'due', text: `Due in ${left}` };
  } else if (ghosted) chip = { kind: 'warn', text: `No reply in ${daysQuiet} days` };
  else if (lane === 'review') chip = { kind: 'info', text: 'Needs a look' };
  else if (laneEmail.actionNeeded && now - new Date(laneEmail.receivedAt).getTime() < 30 * DAY) {
    chip = lane === 'interview' ? { kind: 'info', text: 'Reply to schedule' }
      : lane === 'offer' ? { kind: 'due', text: 'Reply to your offer' }
      : { kind: 'info', text: 'To do' };
  } else chip = { kind: 'wait', text: lane === 'applied' ? `Applied ${day(laneEmail.receivedAt)}` : `Waiting since ${day(laneEmail.receivedAt)}` };

  return {
    app,
    lane,
    reached,
    chip,
    lastEmail: day(newest.receivedAt),
    openEmailId: (upcoming || laneEmail).id,
    deadline: upcoming ? upcoming.deadlineResolved : null,
    ghostedDays: ghosted ? daysQuiet : null,
  };
}

// A to-do is the company's latest email that asks me to do something, unless
// a later email closed it (a rejection, "thanks for completing", "thanks for
// interviewing"). With a date: until the date. Without one: for 14 days.
// Applications waiting for a reply are never to-dos (the board shows them).
const UNDATED_TODO_DAYS = 14;

function taskFor(card: Card, now: number): Task | null {
  if (card.lane === 'rejected' || (card.lane === 'review' && !card.deadline)) return null;
  const emails = [...card.app.emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const asks = emails.find(asksForAction);
  if (!asks) return null;
  const later = emails.filter(e => e.receivedAt > asks.receivedAt && e.stage !== 'review');
  if (later.some(e => e.stage === 'rejected' || (e.stage === asks.stage && !asksForAction(e)))) return null;

  const due = asks.deadlineResolved ? new Date(asks.deadlineResolved).getTime() : null;
  if (due !== null) {
    if (due <= now) return null; // the date has passed: done or missed either way
    return { card: { ...card, openEmailId: asks.id }, when: countdown(asks.deadlineResolved!, now) || 'Today',
      tone: due - now < 3 * DAY ? 'hot' : 'plain', what: asks.subject, detail: `Due ${dayTime(asks.deadlineResolved!)}` };
  }
  if (now - new Date(asks.receivedAt).getTime() > UNDATED_TODO_DAYS * DAY) return null;
  return { card: { ...card, openEmailId: asks.id }, when: 'No date', tone: 'plain', what: asks.subject, detail: `Received ${day(asks.receivedAt)}` };
}

export function buildBoard(applications: Application[], now: number): Board {
  const cards = applications.filter(a => a.emails.length).map(a => cardFor(a, now))
    .sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9') || b.app.lastActivity.localeCompare(a.app.lastActivity));
  const lanes = LANES.map(l => ({ ...l, cards: cards.filter(c => c.lane === l.key) }));
  const unsure: Unsure[] = applications
    .flatMap(a => a.emails.filter(e => e.stage === 'review').map(e => ({ emailId: e.id, company: a.company, subject: e.subject, date: e.receivedAt })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(u => ({ ...u, date: day(u.date) }));

  const reachedCount = (l: Lane) => cards.filter(c => c.reached.has(l)).length;
  const inLane = (l: Lane) => cards.filter(c => c.lane === l);
  const nextInterview = inLane('interview').filter(c => c.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
  const offer = inLane('offer')[0];
  const ghosted = cards.filter(c => c.ghostedDays !== null).length;
  const assessmentsOpen = inLane('assessment').filter(c => c.deadline || c.chip.kind === 'info').length;
  // Applications and rejections are counted per email (one per role: seven roles
  // at one company are seven applications); the rarer stages per company
  const emailsOf = (stage: Lane) => cards.reduce((n, c) => n + c.app.emails.filter(e => e.stage === stage).length, 0);
  const counts: Board['counts'] = [
    { key: 'applied', label: 'Applied', count: emailsOf('applied'), note: `${cards.length} companies, ${inLane('applied').length} waiting${ghosted ? `, ${ghosted} silent` : ''}` },
    { key: 'assessment', label: 'Assessments', count: reachedCount('assessment'), note: assessmentsOpen ? `${assessmentsOpen} to finish` : 'None open' },
    { key: 'interview', label: 'Interviews', count: reachedCount('interview'), note: nextInterview ? `Next: ${nextInterview.app.company}, ${day(nextInterview.deadline!)}` : `${inLane('interview').length} in progress` },
    { key: 'offer', label: 'Offers', count: reachedCount('offer'), note: offer ? (offer.deadline ? `Decide by ${day(offer.deadline)}` : offer.app.company) : 'None yet' },
    { key: 'rejected', label: 'Rejections', count: emailsOf('rejected'), note: `${inLane('rejected').length} companies closed` },
  ];

  const order = { hot: 0, plain: 1, warn: 2 };
  const tasks = cards.map(c => taskFor(c, now)).filter((t): t is Task => !!t)
    .sort((a, b) => (a.card.deadline || '9').localeCompare(b.card.deadline || '9') || order[a.tone] - order[b.tone]);

  // Per week, last 12 weeks: applications sent (every receipt), and when each
  // company first sent an assessment or interview
  const weekStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };
  const thisWeek = weekStart(now);
  const starts = Array.from({ length: 12 }, (_, i) => thisWeek - (11 - i) * 7 * DAY);
  const series = (stage: Lane) => {
    const out = starts.map(() => 0);
    cards.forEach(c => {
      const ofStage = [...c.app.emails].filter(e => e.stage === stage).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
      (stage === 'applied' ? ofStage : ofStage.slice(0, 1)).forEach(e => {
        const i = starts.indexOf(weekStart(new Date(e.receivedAt).getTime()));
        if (i !== -1) out[i]++;
      });
    });
    return out;
  };
  return {
    cards: cards.filter(c => c.lane !== 'review'),
    lanes,
    counts,
    unsure,
    tasks,
    weekly: { weeks: starts.map(s => day(new Date(s).toISOString())), applied: series('applied'), assessment: series('assessment'), interview: series('interview') },
  };
}
