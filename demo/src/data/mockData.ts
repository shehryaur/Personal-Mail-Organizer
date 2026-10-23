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
    company: 'Palantir Technologies',
    role: 'Product Designer',
    stage: 'assessment',
    deadlineRaw: 'within 7 days of receiving this email',
    deadlineResolved: '2026-10-27T11:15:00Z',
    actionNeeded: true,
    confidence: 0.98,
    decisionSource: 'rule',
    ruleMatched: 'Rule: Keyword "challenge" + ATS whitelist + Relative Date Parser',
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
    company: 'Palantir Technologies',
    role: 'Product Designer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.99,
    decisionSource: 'rule',
    ruleMatched: 'Rule: ATS Domain greenhouse.io + "thank you for applying"',
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
    role: 'Product Designer (Core UX)',
    stage: 'interview',
    deadlineRaw: 'reschedule link (48h urgency)',
    deadlineResolved: '2026-10-24T17:40:00Z',
    actionNeeded: true,
    confidence: 0.96,
    decisionSource: 'guardrail_override',
    ruleMatched: 'SAFETY GUARDRAIL: Booking link (calendly.com) detected.',
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
    role: 'Product Designer (Core UX)',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.94,
    decisionSource: 'rule',
    ruleMatched: 'Rule: Keyword "Application received"',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-stripe',
  },

  // --- SCALE AI (Technical Assessment / HackerRank) ---
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
    ruleMatched: 'Rule: ATS codesignal.com + "assessment"',
    guardrailNote: 'Extracted relative window "+48h" from receipt timestamp.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-scale',
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
    ruleMatched: 'Rule: ATS Rejection Regex ("decided to pursue other candidates")',
    guardrailNote: 'High confidence rejection (0.99) -> Code decided: Auto-archived immediately to reduce inbox cognitive fatigue.',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-datadog',
  },

  // --- FIGMA (Likely Ghosted - 28 Days Inactive) ---
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
    receivedAt: '2026-09-24T18:00:00Z', // 28+ days ago
    company: 'Figma',
    role: 'Product Designer, Systems',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.95,
    decisionSource: 'rule',
    ruleMatched: 'Rule: Ashby ATS Domain + "application received"',
    guardrailNote: 'Cadence Engine: 29 days without inbound recruiter contact. Flagged as [LIKELY GHOSTED].',
    isStarred: false,
    isArchived: false,
    applicationId: 'app-figma',
  },

  // --- LINEAR (Multi-Turn Thread / Active In-Progress) ---
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
    ruleMatched: 'NIM Fallback (meta/llama-3.1-8b-instruct): Extracted founder direct outreach',
    guardrailNote: 'Direct founder outreach without ATS headers. NIM LLM extracted interview invitation.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-linear',
  },
  {
    id: 'msg-linear-applied',
    threadId: 'th-linear-1',
    from: 'Linear Jobs <jobs@linear.app>',
    senderDomain: 'linear.app',
    subject: 'Linear Application: Shehryar',
    snippet: 'Your application has been received...',
    fullBody: `Thank you for reaching out to Linear. We review applications on a rolling basis.`,
    receivedAt: '2026-10-12T10:00:00Z',
    company: 'Linear',
    role: 'Product Designer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.91,
    decisionSource: 'rule',
    ruleMatched: 'Rule: Keyword "Application"',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-linear',
  },

  // --- RETOOL (Ambiguous / Jobs/Review Needed) ---
  {
    id: 'msg-retool-ambiguous',
    threadId: 'th-retool-1',
    from: 'Talent Scout <recruiting-partner@external-source.com>',
    senderDomain: 'external-source.com',
    subject: 'Potential alignment for Retool Product Design role',
    snippet: 'I came across your profile and thought your background might align with a confidential role at Retool...',
    fullBody: `Hi Shehryar,

I am an independent executive search partner working on behalf of Retool. We are exploring candidates for an undisclosed Product Infrastructure design slot.

Let me know if you would be open to an exploratory briefing next Tuesday.

Best,
David`,
    receivedAt: '2026-10-21T19:00:00Z',
    company: 'Retool',
    role: 'Product Infrastructure Designer',
    stage: 'review',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: true,
    confidence: 0.62,
    decisionSource: 'ai',
    ruleMatched: 'NIM Fallback: Low confidence (0.62) third-party agency outreach',
    guardrailNote: 'Confidence < 0.85 -> Safety Rule: Keep in Inbox, label Jobs/Review. Do not auto-categorize.',
    isStarred: false,
    isArchived: false,
    applicationId: 'app-retool',
  },

  // --- OPENAI (Applied / In Progress) ---
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
    ruleMatched: 'Rule: Keyword "Thank you for applying to OpenAI"',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-openai',
  },

  // --- ANDURIL (Assessment / In Progress) ---
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
    company: 'Anduril Industries',
    role: 'Mission Software Designer',
    stage: 'assessment',
    deadlineRaw: 'by Friday 5:00 PM PST',
    deadlineResolved: '2026-10-24T00:00:00Z',
    actionNeeded: true,
    confidence: 0.94,
    decisionSource: 'rule',
    ruleMatched: 'Rule: Keyword "Design Prompt" + "Deadline by Friday"',
    guardrailNote: 'Parsed "by Friday 5:00 PM PST" relative to email arrival timestamp.',
    isStarred: true,
    isArchived: false,
    applicationId: 'app-anduril',
  },

  // --- AIRBNB (Likely Ghosted - 32 Days Inactive) ---
  {
    id: 'msg-airbnb-applied',
    threadId: 'th-airbnb-1',
    from: 'Airbnb Careers <no-reply@myworkdayjobs.com>',
    senderDomain: 'myworkdayjobs.com',
    subject: 'Airbnb Candidate Confirmation - Experience Designer',
    snippet: 'Your application has been successfully submitted to Airbnb...',
    fullBody: `Thank you for your application to Airbnb. We have received your materials for Experience Designer.`,
    receivedAt: '2026-09-20T12:00:00Z',
    company: 'Airbnb',
    role: 'Experience Designer',
    stage: 'applied',
    deadlineRaw: null,
    deadlineResolved: null,
    actionNeeded: false,
    confidence: 0.96,
    decisionSource: 'rule',
    ruleMatched: 'Rule: Workday ATS Domain',
    guardrailNote: 'Cadence Engine: 33 days inactive since submission. Flagged as [LIKELY GHOSTED].',
    isStarred: false,
    isArchived: true,
    applicationId: 'app-airbnb',
  },
];

export const INITIAL_APPLICATIONS: Application[] = [
  {
    id: 'app-palantir',
    company: 'Palantir Technologies',
    role: 'Product Designer',
    stage: 'needs_action',
    currentStatus: 'Show & Tell Video Challenge Due',
    deadline: '2026-10-27T11:15:00Z',
    deadlineRaw: 'within 7 days of receiving this email',
    lastActivity: '2026-10-20T11:15:00Z',
    daysSinceLastActivity: 2,
    emails: [INITIAL_EMAILS[0], INITIAL_EMAILS[1]],
    confidence: 0.98,
    tags: ['Lens A', 'NYC/DC', 'High Priority'],
  },
  {
    id: 'app-stripe',
    company: 'Stripe',
    role: 'Product Designer (Core UX)',
    stage: 'needs_action',
    currentStatus: 'Reschedule Interview (Calendly Link)',
    deadline: '2026-10-24T17:40:00Z',
    deadlineRaw: '48h urgency',
    lastActivity: '2026-10-22T17:40:00Z',
    daysSinceLastActivity: 0,
    emails: [INITIAL_EMAILS[2], INITIAL_EMAILS[3]],
    confidence: 0.96,
    tags: ['Guardrail Overruled AI', 'SF/Remote'],
  },
  {
    id: 'app-scale',
    company: 'Scale AI',
    role: 'Product Systems Designer',
    stage: 'needs_action',
    currentStatus: 'CodeSignal Assessment (75m)',
    deadline: '2026-10-24T08:00:00Z',
    deadlineRaw: 'in the next 48 hours',
    lastActivity: '2026-10-22T08:00:00Z',
    daysSinceLastActivity: 0,
    emails: [INITIAL_EMAILS[4]],
    confidence: 0.97,
    tags: ['Assessment', 'SF'],
  },
  {
    id: 'app-anduril',
    company: 'Anduril Industries',
    role: 'Mission Software Designer',
    stage: 'needs_action',
    currentStatus: 'Lattice UI Design Prompt Due',
    deadline: '2026-10-24T00:00:00Z',
    deadlineRaw: 'by Friday 5:00 PM PST',
    lastActivity: '2026-10-21T11:00:00Z',
    daysSinceLastActivity: 1,
    emails: [INITIAL_EMAILS[9]],
    confidence: 0.94,
    tags: ['Orange County / Costa Mesa', 'Hardware/Defense'],
  },
  {
    id: 'app-linear',
    company: 'Linear',
    role: 'Product Designer',
    stage: 'in_progress',
    currentStatus: 'Call with Founder Karri (Thu 3pm PST)',
    deadline: '2026-10-29T22:00:00Z',
    deadlineRaw: 'this Thursday 3pm PST',
    lastActivity: '2026-10-22T21:10:00Z',
    daysSinceLastActivity: 0,
    emails: [INITIAL_EMAILS[6], INITIAL_EMAILS[7]],
    confidence: 0.92,
    tags: ['High Fit', 'Remote'],
  },
  {
    id: 'app-openai',
    company: 'OpenAI',
    role: 'Design Engineer',
    stage: 'in_progress',
    currentStatus: 'Application Under Review',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-10-18T16:45:00Z',
    daysSinceLastActivity: 4,
    emails: [INITIAL_EMAILS[8]],
    confidence: 0.98,
    tags: ['San Francisco'],
  },
  {
    id: 'app-retool',
    company: 'Retool',
    role: 'Product Infrastructure Designer',
    stage: 'in_progress',
    currentStatus: 'Exploratory Briefing Outreach',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-10-21T19:00:00Z',
    daysSinceLastActivity: 1,
    emails: [INITIAL_EMAILS[8]],
    confidence: 0.62,
    tags: ['Agency Scout', 'Review Needed'],
  },
  {
    id: 'app-figma',
    company: 'Figma',
    role: 'Product Designer, Systems',
    stage: 'ghosted',
    currentStatus: 'Silent for 29 Days (Applied Sep 24)',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-09-24T18:00:00Z',
    daysSinceLastActivity: 29,
    emails: [INITIAL_EMAILS[5]],
    confidence: 0.95,
    tags: ['SF', 'Nudge Recommended'],
  },
  {
    id: 'app-airbnb',
    company: 'Airbnb',
    role: 'Experience Designer',
    stage: 'ghosted',
    currentStatus: 'Silent for 33 Days (Applied Sep 20)',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-09-20T12:00:00Z',
    daysSinceLastActivity: 33,
    emails: [INITIAL_EMAILS[10]],
    confidence: 0.96,
    tags: ['Workday ATS', 'Likely Dropped'],
  },
  {
    id: 'app-datadog',
    company: 'Datadog',
    role: 'Senior Product Designer',
    stage: 'closed',
    currentStatus: 'Auto-Archived (Rejection Parsed)',
    deadline: null,
    deadlineRaw: null,
    lastActivity: '2026-10-21T14:30:00Z',
    daysSinceLastActivity: 1,
    emails: [INITIAL_EMAILS[5]],
    confidence: 0.99,
    tags: ['Archived', 'Zero Clutter'],
  },
];
