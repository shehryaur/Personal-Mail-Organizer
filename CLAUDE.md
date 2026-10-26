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
**The model only reads; Gmail is never changed.** The script has read-only Gmail access: no labels, stars or archiving. A small model trained on my own labelled mail classifies each email; code works out companies, deadlines and "needs action", and the Job Tracker dashboard inside Gmail shows the result. Anything the model isn't sure about is shown as `review`, never guessed. Never let a model hide or drop an important email.

## Architecture
```
Gmail ──(Apps Script, every 5 min, read-only)──> trained model (Model.gs) → unsure? "review" (optional AI second opinion)
                                                     │
                                                     ▼
                                          Google Sheet (data store)
                                                     │
                       ┌─────────────────────────────┴──────────────┐
                       ▼                                            ▼
        Chrome extension (InboxSDK) in Gmail              Demo page (sample data)
        - "Job Tracker" sidebar item → dashboard           - same dashboard for reviewers

Training (once, then now and then): exportTrainingEmails → CSV → Claude labels → trainer/train.js → Model.gs
```

## Part 1: Google Apps Script (`apps-script/`)
History: keyword rules mislabelled real mail, then an AI-on-every-email design labelled Gmail badly in the first real run (a retired model's errors were treated as answers). Decision: never change Gmail, and classify with a model trained on my own mail.
1. **Every new email is read** (except my own sent mail). Skip already-processed messages (the Sheet is the ledger).
2. **Trained classifier** (`ModelCore.gs` + `Model.gs`): word features + softmax regression, trained by `trainer/train.js` (Node, no dependencies) on emails Claude labelled once. Categories: `not_job | applied | assessment | interview | rejected | offer | other`. Per-category confidence thresholds chosen in cross-validation so no assessment/interview/offer is misfiled; below threshold → `review`.
3. **Optional AI second opinion** for `review` emails (`AI_KEY` + `AI_FALLBACK=true`, any OpenAI-compatible provider, NVIDIA NIM by default): fast model, strong model if unsure, exact evidence quote checked, prompt-injection guard. Never hardcode keys. **Do not use the Gemini API.**
4. **Code decides the rest:** company/role from sender and subject, deadline date math from the email's own words and arrival time, `action_needed` for assessments, interviews, offers and deadlines.
5. **Write to Google Sheet:** one row per email: message_id, thread_id, date, sender, company, role, stage, deadline, action_needed, confidence, source (model | model+ai:… | ai:…), application_id, subject, snippet.
6. Time-driven trigger every 5 minutes; the extension can also trigger a refresh.

## Features (build in this order)
1. **Core flow:** read Gmail → trained model → Sheet → dashboard. *Must work before anything else.*
2. **Relative deadline resolution:** turn "within 7 days of receiving this email", "by end of week", "in the next 48 hours" into an actual date using the email's received timestamp. Show a countdown. (Demo hook: Palantir's own email.)
3. **Merge emails into one application (entity resolution):** link emails from ATS no-reply, a recruiter's personal address and calendar invites into one `application_id` by company name normalization, sender domain and role. One application = one timeline.
4. **Ghosting detection:** application still at "applied" with no reply in 60+ days → mark "ghosted" and suggest a follow-up.
5. **Retraining instead of learning from corrections:** when the model sends too much to `review`, export, label and retrain (decided: no in-board correction rules).

If time runs out, unfinished features go in the video's "with more time" section.

## Part 2: Chrome extension (`extension/`, Manifest V3 + InboxSDK)
- **"Job Tracker"** item in Gmail's left sidebar → the dashboard fills Gmail's main area (same tab):
  - counts per stage (applied, assessments, interviews, offers, rejections) with one useful line each; no rates or averages
  - **To do**: what needs me, soonest deadline first, each opening the real email
  - weekly counts chart (applications sent, assessments, interviews received)
  - **Where every application stands**: one column per stage, a card per company (ghosted = no reply in 60+ days)
- Approved prototype: `prototype/job-tracker.html`.
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
2. Live flow: emails → Job Tracker dashboard in Gmail; show the deadline countdown (0:30–1:30).
3. AI & trade-offs: the first AI design mislabelled my real Gmail, so the script became read-only and the model is trained on my own mail with "review" instead of guessing; I'm the sole creator, built with Claude Code (1:30–2:15).
4. Alternatives: Huntr/Teal/Simplify (manual or apply-time tracking), Streak (CRM in Gmail, manual sorting). What's next (2:15–2:40).
- Keep under 2:45. Talk plainly. Record my screen and prompts while building.
