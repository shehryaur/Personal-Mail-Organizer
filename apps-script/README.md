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
Set the following properties in Apps Script Settings:
- `NIM_KEY`: NVIDIA NIM API key for LLM fallback parsing.
- `SPREADSHEET_ID`: Target Google Sheet for the data store.
- `PROCESSED_MESSAGE_IDS`: Internal cache tracking processed message IDs.

## Setup
1. Set the Script Properties above.
2. Run `processInbox` once from the editor to grant permissions and check the logs (`[rule]`, `[ai]`, `[guardrail_override]` lines show who decided).
3. Run `installTrigger` once to schedule `processInbox` every 10 minutes. `removeTrigger` stops it.
