# Google Apps Script Ingestion & Governance Engine

Part 1 of the Job Application Inbox Tracker.

## Architectural Rule: "AI Only Reads. Code Decides."
1. **Pre-Filter (No AI):** Matches ATS domains (`greenhouse.io`, `lever.co`, `ashbyhq.com`, etc.) and intent keywords before any LLM is invoked.
2. **Deterministic Rules First:** Rejections, assessment links (HackerRank, CodeSignal), and interview booking links (Calendly) are recognized directly via strict regex patterns.
3. **NVIDIA NIM Fallback:** Only called when rules cannot extract company/deadline metadata with high confidence (`meta/llama-3.1-8b-instruct` on NVIDIA API).
4. **Safety Guardrails:** 
   - An email with any scheduling link is NEVER auto-archived, even if the text contains rejection-like sentiment ("Unfortunately our interviewer was sick...").
   - Low confidence (<0.85) items stay in the Inbox labeled `Jobs/Review`.
   - Relative deadlines ("within 7 days of receiving this email") are calculated strictly against the email's arrival timestamp.

## Configuration (Script Properties)
`setup()` creates the first two for you:
- `SPREADSHEET_ID` (required): the tracker sheet. It is also the record of what's been processed: an email counts as done once its row is written, so nothing is lost if a run fails halfway. Without it the script stops before touching any mail.
- `FEED_TOKEN` (required for the extension): a random secret; the web app feed answers only requests carrying it.
- `NIM_KEY` (optional, you add it): NVIDIA NIM API key for the AI fallback.

Internal, written by the script: `LAST_MAIL_STAMP`, `LAST_CLEAN_RUN` (so runs with no new mail exit in about a second and later runs only search mail since the last run).

(`PROCESSED_MESSAGE_IDS` from earlier versions is no longer used and can be deleted.)

## NVIDIA NIM key (optional, for the AI fallback)
1. Go to build.nvidia.com, sign in, open the `meta/llama-3.1-8b-instruct` model and click **Get API Key**. It starts with `nvapi-`.
2. In the Apps Script editor: **Project Settings** (gear icon) → **Script Properties** → **Add script property** → name `NIM_KEY`, value your key → **Save**.
3. Never put the key in a file in this repo.

Without a key, emails the rules can't decide get a `Jobs/Review` label (no star, no AI call).

To run the blind test against the real model on your machine (only the fake test emails are sent):
```powershell
$env:NIM_KEY = "nvapi-..."; node tests/holdout.test.js
```
The variable lasts only for that terminal window.

## Setup
Full click-by-click guide, including the web app and the Chrome extension: [`../SETUP.md`](../SETUP.md). In short:
1. Run `setup()` once (creates the sheet and the feed token, prints the token).
2. Add `NIM_KEY` if you want the AI fallback.
3. Run `processInbox` once and check the log (`[rule]`, `[ai]`, `[guardrail_override]` lines show who decided).
4. Run `installTrigger` to process new mail every 5 minutes. `removeTrigger` stops it.
5. Deploy as a web app (execute as Me, access Anyone) for the extension. `doGet(?token=…)` returns the sheet as JSON; `&action=refresh` processes new mail first.

## Tests
From the repo root, with Google services stubbed out:
- `node tests/rules.test.js`: sample emails, including the Palantir "thank you for applying… within 7 days" email. Must all pass.
- `node tests/adversarial.test.js`: 91 tricky emails (fake rejections, offers, deadlines, prompt injection). A report; known failures are listed.
- `node tests/stress.test.js`: full `processInbox` runs against a fake inbox with hundreds of emails, threads, failures and repeated runs. A report.
- `node tests/holdout.test.js`: 60 emails written blind (without seeing the rules). A report; uses the real AI if `NIM_KEY` is set in the terminal.
