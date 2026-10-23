import type { Application, Email, DeterministicRule } from '../types';

export const INITIAL_RULES: DeterministicRule[] = [
  {
    id: 'rule-ats-domains',
    name: 'ATS Known Domains Ingestion',
    type: 'ats_domain',
    pattern: 'greenhouse.io | lever.co | ashbyhq.com | myworkdayjobs.com',
    targetStage: 'applied',
    action: 'archive',
    matchesCount: 42,
    createdFromCorrection: false,
  },
  {
    id: 'rule-assessment-keywords',
    name: 'Technical Assessment Detection',
    type: 'keyword',
    pattern: 'HackerRank | CodeSignal | design challenge | take-home',
    targetStage: 'assessment',
    action: 'star_inbox',
    matchesCount: 9,
    createdFromCorrection: false,
  },
  {
    id: 'rule-rejection-regex',
    name: 'Standard ATS Rejection Filter',
    type: 'keyword',
    pattern: 'unfortunately | not moving forward | other candidates | decided to pursue',
    targetStage: 'rejected',
    action: 'archive',
    matchesCount: 28,
    createdFromCorrection: false,
  },
  {
    id: 'rule-reschedule-override',
    name: 'Safety Guardrail: Reschedule Override',
    type: 'guardrail_override',
    pattern: 'calendly.com | goodtime.io | reschedule | availability',
    targetStage: 'interview',
    action: 'star_inbox',
    matchesCount: 3,
    createdFromCorrection: true,
  },
];

export const INITIAL_EMAILS: Email[] = [
  // --- PALANTIR (The Core Challenge Hook) ---
  {
    id: 'msg-palantir-challenge',
    threadId: 'th-palantir-1',
    from: 'Shaun <designchallenge@palantir.com>',
    senderDomain: 'palantir.com',
    subject: 'Next steps: Palantir Product Design Show & Tell Challenge',
    snippet: 'Please send your submission to [designchallenge@palantir.com] within 7 days of receiving this email...',
    fullBody: `Hi Shehryar,

Thank you for applying to Palantir! We enjoyed learning about you in your application.

As the next step, we would like to invite you to participate in our Product Design Show & Tell Challenge. All details and submission instructions are attached to this email.

Please send your submission to [designchallenge@palantir.com] within 7 days of receiving this email.

We're excited to see your work! Please let me know if you have any questions, and good luck!

Best,
Shaun
Palantir Recruiting`,
    receivedAt: '2026-10-20T11:15:00Z',
    company: 'Palantir',
    role: 'Product Designer',
    stage: 'assessment',
    deadlineRaw: 'within 7 days of receiving this email',
    deadlineResolved: '2026-10-27T11:15:00Z',
    actionNeeded: true,
    confidence: 0.98,
    decisionSource: 'rule',
    ruleMatched: 'Keyword "challenge" + ATS whitelist + Relative Date Parser',
    guardrailNote: 'Fuzzy duration "within 7 days" anchored to Email Date Header (+168 hours).',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-palantir',
  },
  {
    id: 'msg-palantir-applied',
    threadId: 'th-palantir-1',
    from: 'Palantir Careers <no-reply@greenhouse.io>',
    senderDomain: 'greenhouse.io',
    subject: 'Thank you for applying to Product Designer at Palantir',
    snippet: 'Your application for Product Designer has been received by our recruiting team...',
    fullBody: `Hello Shehryar,

Thank you for your interest in Palantir. We have received your application for the Product Designer role in New York / Washington D.C. Our hiring team will review your background and get in touch if there is a match.

You can check your application status on your candidate portal.

Regards,
Palantir Talent Operations`,
    receivedAt: '2026-10-04T15:20:00Z',
    company: 'Palantir',
    role: 'Product Designer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.99,
    decisionSource: 'rule',
    ruleMatched: 'ATS Domain greenhouse.io + "thank you for applying"',
    guardrailNote: 'Entity Resolution: Merged with recruiter Shaun via Company Canonical Name "Palantir".',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-palantir',
  },

  // --- STRIPE (AI Failure Mode & Guardrail Override) ---
  {
    id: 'msg-stripe-reschedule',
    threadId: 'th-stripe-1',
    from: 'Maya Chen <recruiting@stripe.com>',
    senderDomain: 'stripe.com',
    subject: 'Update regarding your Product Designer conversation at Stripe',
    snippet: 'Unfortunately, your interviewer Sarah is out sick today. Please choose another slot on my Calendly here...',
    fullBody: `Hi Shehryar,

Unfortunately, our design lead Sarah came down with flu and is out sick today. We will not be able to do our 2pm call today.

We are still very eager to speak with you! Please choose another slot on my Calendly link here:
https://calendly.com/maya-chen-stripe/reschedule-30min

Apologies for the last-minute adjustment.

Best,
Maya Chen
Stripe Design Recruiting`,
    receivedAt: '2026-10-22T17:40:00Z',
    company: 'Stripe',
    role: 'Product Designer',
    stage: 'interview',
    deadlineRaw: 'reschedule link (48h urgency)',
    deadlineResolved: '2026-10-24T17:40:00Z',
    actionNeeded: true,
    confidence: 0.96,
    decisionSource: 'guardrail_override',
    ruleMatched: 'Safety Guardrail: Booking link (calendly.com) detected.',
    guardrailNote: 'AI Failure Caught: NIM LLM classified as "rejected" due to starting token "Unfortunately". Deterministic guardrail overrode LLM, keeping in Inbox and starring.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-stripe',
    hasScheduleLink: true,
  },
  {
    id: 'msg-stripe-applied',
    threadId: 'th-stripe-1',
    from: 'Stripe Recruiting <jobs@stripe.com>',
    senderDomain: 'stripe.com',
    subject: 'Application received: Product Designer',
    snippet: 'Thanks for submitting your application to Stripe. We review every application personally...',
    fullBody: `Hi Shehryar,

We got your application for Product Designer. Stripe is growing and we appreciate your time. We will reach back out within 2 weeks.`,
    receivedAt: '2026-10-08T09:12:00Z',
    company: 'Stripe',
    role: 'Product Designer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.94,
    decisionSource: 'rule',
    ruleMatched: 'Keyword "Application received"',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-stripe',
  },

  // --- SCALE AI (Technical Assessment) ---
  {
    id: 'msg-scale-hackerrank',
    threadId: 'th-scale-1',
    from: 'Scale AI Recruiting <invitations@codesignal.com>',
    senderDomain: 'codesignal.com',
    subject: 'Scale AI Assessment Invitation: Product Design & Systems',
    snippet: 'You have been invited to complete a 75-minute technical design challenge. Please complete it within 48 hours...',
    fullBody: `Hello Shehryar,

As part of your application for Product Systems Designer at Scale AI, please complete the timed assessment on CodeSignal.

Link: https://app.codesignal.com/invite/scale-fe-design-9481
Time limit: 75 minutes.
Deadline: Please complete in the next 48 hours to ensure priority review.

Good luck!
The Scale AI Talent Team`,
    receivedAt: '2026-10-22T08:00:00Z',
    company: 'Scale AI',
    role: 'Product Systems Designer',
    stage: 'assessment',
    deadlineRaw: 'in the next 48 hours',
    deadlineResolved: '2026-10-24T08:00:00Z',
    actionNeeded: true,
    confidence: 0.97,
    decisionSource: 'rule',
    ruleMatched: 'ATS codesignal.com + "assessment"',
    guardrailNote: 'Extracted relative window "+48h" from receipt timestamp.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-scale',
  },

  // --- LINEAR (Interview) ---
  {
    id: 'msg-linear-interview',
    threadId: 'th-linear-1',
    from: 'Karri Saarinen <karri@linear.app>',
    senderDomain: 'linear.app',
    subject: 'Chatting about Linear Design',
    snippet: 'Enjoyed seeing your focus on dense UI architecture. Would love to hop on a 30-min call this Thursday...',
    fullBody: `Hey Shehryar,

I saw your portfolio breakdown on high-density operational work. Really appreciated how you approached guardrails and screen hierarchy.

Would love to hop on a 30-min call this Thursday around 3pm PST to chat through how we build product at Linear. Does that time work for you?

Best,
Karri`,
    receivedAt: '2026-10-22T21:10:00Z',
    company: 'Linear',
    role: 'Product Designer',
    stage: 'interview',
    deadlineRaw: 'this Thursday 3pm PST',
    deadlineResolved: '2026-10-29T22:00:00Z',
    actionNeeded: true,
    confidence: 0.92,
    decisionSource: 'ai',
    ruleMatched: 'NIM Fallback: Extracted founder direct outreach',
    guardrailNote: 'Direct founder outreach without ATS headers. NIM LLM extracted interview invitation.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-linear',
  },

  // --- DATADOG (Auto-Archived Rejection) ---
  {
    id: 'msg-datadog-rejection',
    threadId: 'th-datadog-1',
    from: 'Datadog Careers <no-reply@datadoghq.com>',
    senderDomain: 'datadoghq.com',
    subject: 'Your application to Datadog',
    snippet: 'Thank you for your interest in Datadog. After careful consideration, we have decided not to move forward...',
    fullBody: `Hi Shehryar,

Thank you for taking the time to speak with our team and apply for the Senior Product Designer role.

After careful review of your background and our current organizational needs, we have decided to pursue other candidates whose experience more closely aligns with this particular role.

We wish you the very best in your search.

Sincerely,
The Datadog Recruiting Team`,
    receivedAt: '2026-10-21T14:30:00Z',
    company: 'Datadog',
    role: 'Senior Product Designer',
    stage: 'rejected',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.99,
    decisionSource: 'rule',
    ruleMatched: 'ATS Rejection Regex ("decided to pursue other candidates")',
    guardrailNote: 'High confidence rejection (0.99) -> Code decided: Auto-archived immediately to reduce inbox clutter.',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-datadog',
  },

  // --- FIGMA (Ghosted - 74 days, no reply after applying) ---
  {
    id: 'msg-figma-applied',
    threadId: 'th-figma-1',
    from: 'Figma Recruiting <no-reply@ashbyhq.com>',
    senderDomain: 'ashbyhq.com',
    subject: 'We received your application for Product Designer, Systems',
    snippet: 'Thank you for applying to Figma! We are excited to review your work...',
    fullBody: `Hey Shehryar,

Thanks for your application to Figma. Our team is currently reviewing portfolios for the Product Designer, Systems position. If your background matches what we're looking for, we'll reach out directly.

Best,
Figma Talent Team`,
    receivedAt: '2026-08-10T18:00:00Z',
    company: 'Figma',
    role: 'Product Designer, Systems',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.95,
    decisionSource: 'rule',
    ruleMatched: 'Ashby ATS Domain + "application received"',
    guardrailNote: '74 days without a reply after applying. Flagged as ghosted (60-day rule).',
    isStarred: false,
    isArchived: false,
    applicationId: 'app-figma',
  },

  // --- OPENAI (Applied) ---
  {
    id: 'msg-openai-applied',
    threadId: 'th-openai-1',
    from: 'OpenAI Careers <careers@openai.com>',
    senderDomain: 'openai.com',
    subject: 'Thank you for applying to OpenAI: Design Engineer',
    snippet: 'We have received your application for Design Engineer. Our team will review your work...',
    fullBody: `Hello Shehryar,

Thank you for your application to OpenAI. We are reviewing portfolios for the Design Engineer position on a rolling basis.`,
    receivedAt: '2026-10-18T16:45:00Z',
    company: 'OpenAI',
    role: 'Design Engineer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.98,
    decisionSource: 'rule',
    ruleMatched: 'Keyword "Thank you for applying to OpenAI"',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-openai',
  },

  // --- ANDURIL (Assessment) ---
  {
    id: 'msg-anduril-takehome',
    threadId: 'th-anduril-1',
    from: 'Anduril Talent <recruiting@anduril.com>',
    senderDomain: 'anduril.com',
    subject: 'Anduril Industries: Lattice Interface Design Prompt',
    snippet: 'Next stage: Please find the design prompt enclosed. Submissions are due by end of week...',
    fullBody: `Hi Shehryar,

Great speaking with you earlier this week. As discussed, please find attached the Lattice Mission Control UI exercise.

Deadline: Please submit your Figma link by Friday 5:00 PM PST.

Best regards,
Anduril Talent`,
    receivedAt: '2026-10-21T11:00:00Z',
    company: 'Anduril',
    role: 'Mission Software Designer',
    stage: 'assessment',
    deadlineRaw: 'by Friday 5:00 PM PST',
    deadlineResolved: '2026-10-24T00:00:00Z',
    actionNeeded: true,
    confidence: 0.94,
    decisionSource: 'rule',
    ruleMatched: 'Keyword "Design Prompt" + "Deadline by Friday"',
    guardrailNote: 'Parsed "by Friday 5:00 PM PST" relative to email arrival timestamp.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-anduril',
  },

  // --- AIRBNB (Ghosted - 87 days, no reply after applying) ---
  {
    id: 'msg-airbnb-applied',
    threadId: 'th-airbnb-1',
    from: 'Airbnb Careers <no-reply@myworkdayjobs.com>',
    senderDomain: 'myworkdayjobs.com',
    subject: 'Airbnb Candidate Confirmation - Experience Designer',
    snippet: 'Your application has been successfully submitted to Airbnb...',
    fullBody: `Thank you for your application to Airbnb. We have received your materials for Experience Designer.`,
    receivedAt: '2026-07-28T12:00:00Z',
    company: 'Airbnb',
    role: 'Experience Designer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.96,
    decisionSource: 'rule',
    ruleMatched: 'Workday ATS Domain',
    guardrailNote: '87 days without a reply after applying. Flagged as ghosted (60-day rule).',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-airbnb',
  },
];

export const INITIAL_APPLICATIONS: Application[] = [
  {
    id: 'app-palantir',
    company: 'Palantir',
    domain: 'palantir.com',
    role: 'Product Designer',
    stage: 'needs_action',
    currentStatus: 'Video Challenge Due (7-day relative window)',
    deadline: '2026-10-27T11:15:00Z',
    deadlineRaw: 'within 7 days of receiving this email',
    lastActivity: '2026-10-20T11:15:00Z',
    daysSinceLastActivity: 2,
    emails: [INITIAL_EMAILS[0], INITIAL_EMAILS[1]],
    confidence: 0.98,
    tags: ['Lens A', 'Priority'],
  },
  {
    id: 'app-stripe',
    company: 'Stripe',
    domain: 'stripe.com',
    role: 'Product Designer',
    stage: 'needs_action',
    currentStatus: 'Reschedule Interview (Calendly Link)',
    deadline: '2026-10-24T17:40:00Z',
    deadlineRaw: '48h urgency',
    lastActivity: '2026-10-22T17:40:00Z',
    daysSinceLastActivity: 0,
    emails: [INITIAL_EMAILS[2], INITIAL_EMAILS[3]],
    confidence: 0.96,
    tags: ['Guardrail Overruled AI'],
  },
  {
    id: 'app-scale',
    company: 'Scale AI',
    domain: 'scale.com',
    role: 'Product Systems Designer',
    stage: 'needs_action',
    currentStatus: 'CodeSignal Assessment (75m)',
    deadline: '2026-10-24T08:00:00Z',
    deadlineRaw: 'in the next 48 hours',
    lastActivity: '2026-10-22T08:00:00Z',
    daysSinceLastActivity: 0,
    emails: [INITIAL_EMAILS[4]],
    confidence: 0.97,
    tags: ['Assessment'],
  },
  {
    id: 'app-anduril',
    company: 'Anduril',
    domain: 'anduril.com',
    role: 'Mission Software Designer',
    stage: 'needs_action',
    currentStatus: 'Design Prompt Due',
    deadline: '2026-10-24T00:00:00Z',
    deadlineRaw: 'by Friday 5:00 PM PST',
    lastActivity: '2026-10-21T11:00:00Z',
    daysSinceLastActivity: 1,
    emails: [INITIAL_EMAILS[9]],
    confidence: 0.94,
    tags: ['Take-home'],
  },
  {
    id: 'app-linear',
    company: 'Linear',
    domain: 'linear.app',
    role: 'Product Designer',
    stage: 'in_progress',
    currentStatus: 'Interview with Karri (Thu 3pm PST)',
    deadline: '2026-10-29T22:00:00Z',
    deadlineRaw: 'this Thursday 3pm PST',
    lastActivity: '2026-10-22T21:10:00Z',
    daysSinceLastActivity: 0,
    emails: [INITIAL_EMAILS[5]],
    confidence: 0.92,
    tags: ['Interview'],
  },
  {
    id: 'app-openai',
    company: 'OpenAI',
    domain: 'openai.com',
    role: 'Design Engineer',
    stage: 'in_progress',
    currentStatus: 'Application Under Review',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-10-18T16:45:00Z',
    daysSinceLastActivity: 4,
    emails: [INITIAL_EMAILS[8]],
    confidence: 0.98,
    tags: ['Applied'],
  },
  {
    id: 'app-figma',
    company: 'Figma',
    domain: 'figma.com',
    role: 'Product Designer, Systems',
    stage: 'ghosted',
    currentStatus: 'No reply for 74 days (applied Aug 10)',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-08-10T18:00:00Z',
    daysSinceLastActivity: 74,
    emails: [INITIAL_EMAILS[7]],
    confidence: 0.95,
    tags: ['Ghosted'],
  },
  {
    id: 'app-airbnb',
    company: 'Airbnb',
    domain: 'airbnb.com',
    role: 'Experience Designer',
    stage: 'ghosted',
    currentStatus: 'No reply for 87 days (applied Jul 28)',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-07-28T12:00:00Z',
    daysSinceLastActivity: 87,
    emails: [INITIAL_EMAILS[10]],
    confidence: 0.96,
    tags: ['Ghosted'],
  },
  {
    id: 'app-datadog',
    company: 'Datadog',
    domain: 'datadoghq.com',
    role: 'Senior Product Designer',
    stage: 'closed',
    currentStatus: 'Auto-Archived (Rejection Parsed)',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-10-21T14:30:00Z',
    daysSinceLastActivity: 1,
    emails: [INITIAL_EMAILS[6]],
    confidence: 0.99,
    tags: ['Archived'],
  },
];
