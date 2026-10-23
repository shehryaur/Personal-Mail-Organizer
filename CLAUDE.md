# Job Application Inbox Tracker

Submission for Palantir's **Product Design Show & Tell**, Lens A ("Make it work").

## Challenge constraints (do not violate)
- **3 hours max build time.** Prioritize a working core over breadth. Stop adding features when time is up.
- Reviewers must be able to **click through a working link** without my Gmail → ship a demo page with sample data.
- Deliverables: ≤3 min unlisted YouTube video + link, emailed to designchallenge@palantir.com.
- They judge: real personal friction, design decisions, how AI was used (incl. where it failed), plain talk. **Not** visual polish or backend architecture.

## The problem
I'm actively applying to jobs. Gmail shows a flat list of emails: confirmations, rejections, assessments and interview invites from 30+ companies get mixed together, and deadlines get buried. Palantir's own challenge email ("within 7 days of receiving this email", no actual date) landed between ~40 other job emails.

## Core principle
**AI only reads. Code decides.** AI extracts fields; deterministic rules decide labels, archiving and alerts. Anything needing action or uncertain stays visible in the inbox. Never let AI hide an important email.

## Architecture
```
Gmail ──(Apps Script, every 10 min)──> rules → NIM fallback → labels/archive/star
                                                     │
                                                     ▼
                                          Google Sheet (data store)
                                                     │
                       ┌─────────────────────────────┴──────────────┐
                       ▼                                            ▼
        Chrome extension (InboxSDK) in Gmail              Demo page (sample data)
        - action banner                                    - same board UI for reviewers
        - "Jobs" tab board
```

## Part 1: Google Apps Script (`apps-script/`)
1. **Pre-filter (no AI):** only process emails that match
   - ATS domains: `greenhouse.io`, `lever.co`, `ashbyhq.com`, `myworkdayjobs.com`, `smartrecruiters.com`, `workable.com`, `icims.com`
   - or keywords: "application", "interview", "assessment", "candidate", "thank you for applying"
   - Skip already-processed messages (track message IDs in Script Properties or the Sheet).
2. **Rules first (no AI):**
   - rejected: "unfortunately", "not moving forward", "other candidates", "decided to pursue"
   - assessment: "HackerRank", "CodeSignal", "take-home", "challenge", "assessment"
   - interview: "schedule", "interview", "Calendly", "availability"
   - applied: "received your application", "thank you for applying"
3. **NVIDIA NIM fallback** only when rules don't match or can't extract company/deadline.
   - Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions` (OpenAI-compatible)
   - Model: small instruct model, e.g. `meta/llama-3.1-8b-instruct`, `temperature: 0`
   - Key in Script Properties as `NIM_KEY`. Never hardcode it. **Do not use the Gemini API.**
   - Send only sender + subject + first 500 chars.
   - Ask for JSON only; validate and handle parse failures (on failure → leave in inbox, label `Jobs/Review`).
   - Schema:
     ```json
     {"company": "", "role": "", "stage": "applied|assessment|interview|rejected|offer|other",
      "deadline": "YYYY-MM-DD|null", "action_needed": true, "confidence": 0.0}
     ```
4. **Actions (code decides):**
   - Labels: `Jobs/Applied`, `Jobs/Assessment`, `Jobs/Interview`, `Jobs/Rejected`, `Jobs/Offer`, `Jobs/Review`
   - `action_needed` → keep in inbox + star
   - rejected/applied with confidence ≥ 0.85 (or matched by rule) → archive
   - confidence < 0.85 → stay in inbox, label `Jobs/Review`
5. **Write to Google Sheet:** one row per email: message_id, thread_id, date, sender, company, role, stage, deadline, action_needed, confidence, source (rule|ai), application_id.
6. Time-driven trigger every 10 minutes.

## Features (build in this order)
1. **Core flow:** filter → rules → NIM → labels/archive/star → Sheet. *Must work before anything else.*
2. **Relative deadline resolution:** turn "within 7 days of receiving this email", "by end of week", "in the next 48 hours" into an actual date using the email's received timestamp. Show a countdown. (Demo hook: Palantir's own email.)
3. **Merge emails into one application (entity resolution):** link emails from ATS no-reply, a recruiter's personal address and calendar invites into one `application_id` by company name normalization, sender domain and role. One application = one timeline.
4. **Ghosting detection:** no new email for an application in 21+ days after applied/interview → mark "likely ghosted" and suggest a follow-up.
5. **Learn from corrections:** when I move/relabel an application in the board, save that as a rule (e.g. sender domain → company, phrase → stage) so the same mistake doesn't repeat.

If time runs out, unfinished features go in the video's "with more time" section.

## Part 2: Chrome extension (`extension/`, Manifest V3 + InboxSDK)
- **Action banner** at the top of the Gmail inbox: assessments/interviews with countdowns, e.g. "Palantir: video due in 4 days · Stripe: interview Thu 2pm".
- **"Jobs" tab** → board with one row per company/application:
  - Sections: **Needs action** (top, sorted by deadline) / **In progress** / **Closed** (rejections faded) / **Likely ghosted**
  - Auto-replies collapsed into one line
  - Click an application → timeline of its emails
  - Manual relabel control (feeds feature 5)
- Reads data from the Sheet (published JSON via an Apps Script web app `doGet`).

## Part 3: Demo page (`demo/`)
- Static page with the same board UI and ~25 realistic **anonymized** sample emails (fake company names, include one "within 7 days" email).
- Deploy on Vercel. This is the link reviewers click.

## UI
- Use existing components: shadcn/ui, Magic UI, uiverse.io, Lucide icons. Check licenses and credit creators in README.
- Dense, clear, workspace-style. No landing page, no login screen.

## Working conventions
- Keep secrets out of the repo (`.env`, Script Properties). Add `.gitignore`.
- Small, testable functions; log rule vs AI decisions so I can show them in the video.
- Before building a feature, state the plan briefly; after, tell me how to test it.

## Video notes (for me)
1. Open on the buried Palantir email (0:00–0:30).
2. Live flow: emails → board → banner; show the deadline countdown (0:30–1:30).
3. AI & trade-offs: "AI reads, code decides"; one place the model failed and how I constrained it; I'm the sole creator, built with Claude Code (1:30–2:15).
4. Alternatives: Huntr/Teal/Simplify (manual or apply-time tracking), Streak (CRM in Gmail, manual sorting). What's next (2:15–2:40).
- Keep under 2:45. Talk plainly. Record my screen and prompts while building.
