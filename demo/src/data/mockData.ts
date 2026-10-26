// Sample data for the reviewers' demo: fictional companies and people, shaped
// exactly like the Apps Script feed (one row per email), so the demo runs the
// same code as the Gmail extension. "Now" in the demo is Fri Oct 23, 2026.
import type { FeedItem } from '../extension/feed';

type Stage = FeedItem['stage'];
interface Sample {
  company: string;
  role: string;
  from: string;
  emails: { stage: Stage; date: string; subject: string; body: string; deadline?: string; deadlineRaw?: string; action?: boolean }[];
}

const SAMPLES: Sample[] = [
  {
    company: 'Lumen Analytics', role: 'Product Designer', from: 'Lumen Analytics Talent <talent@lumen-analytics.example>',
    emails: [
      { stage: 'applied', date: '2026-10-13T16:02:00Z', subject: 'We received your application: Product Designer', body: 'Hi Sam, thanks for applying to Lumen Analytics. Our team will review your application and get back to you.' },
      {
        stage: 'assessment', date: '2026-10-22T08:30:00Z', subject: 'Next step: video assessment for Product Designer', action: true,
        deadline: '2026-10-29', deadlineRaw: 'within 7 days of receiving this email',
        body: 'Hi Sam,\n\nThanks for applying to the Product Designer role at Lumen Analytics. We enjoyed your portfolio and would like to invite you to the next step.\n\nPlease record a short video (about 3 minutes) walking us through one project you are proud of. Complete it within 7 days of receiving this email.\n\nBest,\nThe Lumen Analytics Talent Team',
      },
    ],
  },
  {
    company: 'Kestrel AI', role: 'Design Engineer', from: 'Priya at Kestrel AI <priya@kestrel-ai.example>',
    emails: [
      { stage: 'applied', date: '2026-10-01T18:20:00Z', subject: 'Thanks for applying to Kestrel AI', body: 'We got your application for Design Engineer and will be in touch.' },
      { stage: 'assessment', date: '2026-10-08T15:00:00Z', subject: 'Kestrel AI design exercise', body: 'Please complete the short design exercise linked below by Monday.' },
      {
        stage: 'interview', date: '2026-10-21T23:12:00Z', subject: 'Interview with the design team, Thursday 2:00 PM', action: true,
        deadline: '2026-10-29', deadlineRaw: 'Thursday 2:00 PM',
        body: 'Hi Sam,\n\nGreat news: the team would love to meet you. I have booked a 45-minute video interview with our design team for Thursday at 2:00 PM. The calendar invite has the meeting link.\n\nThanks,\nPriya',
      },
    ],
  },
  {
    company: 'Cobalt Pay', role: 'Frontend Engineer', from: 'Cobalt Pay Careers <no-reply@greenhouse.example>',
    emails: [
      { stage: 'applied', date: '2026-10-14T12:40:00Z', subject: 'Thank you for applying to Cobalt Pay', body: 'We received your application for Frontend Engineer.' },
      {
        stage: 'assessment', date: '2026-10-21T17:05:00Z', subject: 'Your coding exercise for Frontend Engineer', action: true,
        deadline: '2026-10-29', deadlineRaw: 'by Thursday, October 29',
        body: 'Hello Sam,\n\nAs the next step for the Frontend Engineer position, please complete our take-home coding exercise by Thursday, October 29. It should take about 2 hours.\n\nCobalt Pay Recruiting',
      },
    ],
  },
  {
    company: 'Sable & Co', role: 'Product Designer', from: 'Jordan at Sable & Co <jordan@sable.example>',
    emails: [
      { stage: 'applied', date: '2026-10-12T09:30:00Z', subject: 'Application received: Product Designer', body: 'Thanks for your interest in Sable & Co.' },
      { stage: 'interview', date: '2026-10-22T20:15:00Z', subject: 'Let’s set up your first interview', action: true, body: 'Hi Sam,\n\nWe would like to set up a 30-minute intro call. Please pick a time that works for you using the booking link below.\n\nBest,\nJordan' },
    ],
  },
  {
    company: 'Atlas Robotics', role: 'UX Researcher', from: 'Atlas Robotics People Team <people@atlas-robotics.example>',
    emails: [
      { stage: 'applied', date: '2026-09-08T14:00:00Z', subject: 'Thanks for applying to Atlas Robotics', body: 'We received your application for UX Researcher.' },
      { stage: 'assessment', date: '2026-09-18T16:00:00Z', subject: 'Research case study', body: 'Please send us your research plan for the attached brief.' },
      { stage: 'interview', date: '2026-10-02T17:00:00Z', subject: 'Final interviews at Atlas Robotics', body: 'Your onsite is confirmed for next Tuesday.' },
      {
        stage: 'offer', date: '2026-10-20T22:30:00Z', subject: 'Your offer from Atlas Robotics', action: true, deadline: '2026-11-03', deadlineRaw: 'by November 3',
        body: 'Hi Sam,\n\nWe are thrilled to offer you the UX Researcher position at Atlas Robotics. Your offer letter is attached. Please let us know your decision by November 3.\n\nAtlas Robotics People Team',
      },
    ],
  },
  {
    company: 'Meridian Games', role: 'UI Designer', from: 'Meridian Games Recruiting <jobs@meridian.example>',
    emails: [
      { stage: 'applied', date: '2026-09-28T19:00:00Z', subject: 'Application received: UI Designer', body: 'Thanks for applying to Meridian Games.' },
      { stage: 'interview', date: '2026-10-16T18:00:00Z', subject: 'Thanks for interviewing with Meridian Games', body: 'Thank you for your time today. We will share an update after the team has met.' },
    ],
  },
  { company: 'Pinecone Studio', role: 'Product Designer', from: 'Pinecone Studio <careers@pinecone.example>', emails: [{ stage: 'applied', date: '2026-10-22T15:10:00Z', subject: 'Thanks for applying to Pinecone Studio', body: 'We have received your application and will review it soon.' }] },
  { company: 'Quill Health', role: 'Product Designer', from: 'Quill Health Talent <no-reply@lever.example>', emails: [{ stage: 'applied', date: '2026-10-19T13:00:00Z', subject: 'Your application to Quill Health', body: 'Thank you for applying. We will be in touch if your background matches.' }] },
  { company: 'Harbor Mobility', role: 'UX Designer', from: 'Harbor Mobility <jobs@harbor.example>', emails: [{ stage: 'applied', date: '2026-10-09T10:00:00Z', subject: 'Application received', body: 'Thanks for applying for the UX Designer role.' }] },
  { company: 'Fernhill Bank', role: 'Product Designer', from: 'Fernhill Bank Careers <careers@fernhill.example>', emails: [{ stage: 'applied', date: '2026-08-12T16:41:00Z', subject: 'We received your application: Product Designer', body: 'Dear Sam,\n\nThank you for your interest in Fernhill Bank. We have received your application and will review it carefully.' }] },
  { company: 'Orbital Systems', role: 'Interaction Designer', from: 'Orbital Systems <no-reply@workable.example>', emails: [{ stage: 'applied', date: '2026-08-20T11:00:00Z', subject: 'Thanks for your application', body: 'We received your application for Interaction Designer.' }] },
  {
    company: 'Northwind Labs', role: 'Product Analyst', from: 'Northwind Labs <jobs@northwind.example>',
    emails: [
      { stage: 'applied', date: '2026-09-30T12:00:00Z', subject: 'Application received', body: 'Thanks for applying to Northwind Labs.' },
      { stage: 'rejected', date: '2026-10-15T18:00:00Z', subject: 'Update on your application', body: 'Thank you for your time. After careful consideration, we have decided to move forward with other candidates.' },
    ],
  },
  {
    company: 'Brightpath', role: 'Design Systems Lead', from: 'Brightpath Talent <talent@brightpath.example>',
    emails: [
      { stage: 'applied', date: '2026-09-11T12:00:00Z', subject: 'Thanks for applying to Brightpath', body: 'We received your application.' },
      { stage: 'interview', date: '2026-09-29T12:00:00Z', subject: 'Interview with Brightpath', body: 'Looking forward to speaking on Thursday.' },
      { stage: 'rejected', date: '2026-10-10T12:00:00Z', subject: 'Your application to Brightpath', body: 'Unfortunately we will not be moving forward.' },
    ],
  },
  {
    company: 'Tidewater Health', role: 'Service Designer', from: 'Tidewater Health <no-reply@ashby.example>',
    emails: [
      { stage: 'applied', date: '2026-09-14T12:00:00Z', subject: 'Application received', body: 'Thanks for applying.' },
      { stage: 'assessment', date: '2026-09-22T12:00:00Z', subject: 'Service design exercise', body: 'Please complete the exercise this week.' },
      { stage: 'rejected', date: '2026-09-30T12:00:00Z', subject: 'Update from Tidewater Health', body: 'We have decided not to proceed with your application.' },
    ],
  },
  {
    company: 'Juniper Labs', role: '', from: 'Alex Moreno <alex.moreno@juniper.example>',
    emails: [{ stage: 'review', date: '2026-10-22T12:30:00Z', subject: 'Quick question', action: true, body: 'Hi Sam, are you still looking? I might have something for you. Free for a call next week?' }],
  },
];

let n = 0;
export const SAMPLE_FEED: FeedItem[] = SAMPLES.flatMap(s =>
  s.emails.map(e => {
    n++;
    const id = 'msg-' + String(n).padStart(3, '0');
    return {
      message_id: id,
      thread_id: 'thr-' + s.company.toLowerCase().replace(/[^a-z]/g, '') + '-' + e.stage,
      date: e.date,
      sender: s.from,
      company: s.company,
      role: s.role,
      stage: e.stage,
      deadline: e.deadline || '',
      deadline_raw: e.deadlineRaw || '',
      action_needed: !!e.action || ['assessment', 'interview', 'offer'].includes(e.stage) && !!e.deadline,
      confidence: e.stage === 'review' ? 0.55 : 0.93,
      source: 'model',
      application_id: s.company.toLowerCase().replace(/[^a-z]/g, ''),
      subject: e.subject,
      snippet: e.body,
    };
  })
);

// Everyday mail that isn't about a job: shown in the demo inbox only
export const OTHER_MAIL = [
  { id: 'other-1', from: 'Campus Library', subject: 'Your book is due Monday', snippet: 'Renew online to keep it longer.', date: '2026-10-23T07:10:00Z' },
  { id: 'other-2', from: 'Weekly Design Digest', subject: '10 interview tips for designers', snippet: 'How to prepare a portfolio walkthrough, what to ask, and more.', date: '2026-10-22T14:00:00Z' },
  { id: 'other-3', from: 'Mom', subject: 'Sunday dinner?', snippet: 'Are you coming on Sunday? Dad is making lasagna.', date: '2026-10-21T19:30:00Z' },
];
