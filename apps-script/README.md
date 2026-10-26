# Google Apps Script: the part that reads your mail

Part 1 of the Job Application Inbox Tracker. It **only reads** Gmail (`gmail.readonly` scope): no labels, stars,
archiving or deleting. Everything it finds goes into your Google Sheet, which the Job Tracker dashboard shows.

## Files
| File | What it is |
|---|---|
| `Code.gs` | Finds new mail every 5 minutes, classifies it, works out deadlines and companies, writes the Sheet, serves the feed (`doGet`). Also `exportTrainingEmails` for training data. |
| `ModelCore.gs` | The classifier's code: email → word features → scores. The trainer (`trainer/train.js`) runs this same file. |
| `Model.gs` | The trained weights, made by `node trainer/train.js` from your labelled mail. Not in git (it contains words from your emails). |
| `appsscript.json` | Scopes: read-only Gmail, Sheets, external requests (only for the optional AI), triggers. |

## How an email is classified
1. **The trained model reads it** (inside Apps Script; nothing is sent anywhere) and picks one category:
   `not_job`, `applied`, `assessment`, `interview`, `rejected`, `offer` or `other`, with a confidence.
2. **Each category has its own threshold**, chosen by the trainer so that, on emails it didn't train on, no
   assessment, interview or offer is filed as a receipt, rejection or non-job email. Below the threshold the email is
   recorded as **`review`** and shows on the dashboard for a look, instead of being guessed.
3. **Optional AI second opinion** for `review` emails only: set `AI_KEY` and `AI_FALLBACK=true`. A fast model answers,
   a stronger one when the first is unsure or its quoted evidence isn't in the email. Emails that try to instruct the
   AI are never sent to it. Without a trained model, the AI (if a key is set) classifies everything.
4. **Code does the rest:** company and role from the sender and subject, deadlines from the email's own words
   ("within 7 days of receiving this email") with the date math done from when it arrived, and "needs action" for
   assessments, interviews, offers and anything with a deadline.
5. **If nothing can classify an email** (no model yet, AI outage), it isn't recorded and is retried next run.

## Script Properties
| Property | What it is |
|---|---|
| `SPREADSHEET_ID` | Created by `setup()`. The tracker sheet; also the record of what's been processed. |
| `FEED_TOKEN` | Created by `setup()`. The web app feed only answers requests carrying it. |
| `AI_KEY` | Optional. An OpenAI-compatible key (`NIM_KEY` also works). |
| `AI_FALLBACK` | Optional. `true` = send emails the trained model isn't sure about to the AI. |
| `AI_BASE_URL`, `AI_FAST_MODEL`, `AI_STRONG_MODEL` | Optional. Default NVIDIA NIM and `nvidia/nemotron-3.5-bolt-e4b` / `nvidia/nemotron-3-ultra-550b-a55b`. |

Written by the script: `LAST_MAIL_STAMP`, `LAST_CLEAN_RUN` (so idle runs exit in about a second and later runs only
search mail since the last run), `EXPORT_CURSOR` (while an export is unfinished).

## Functions you run from the editor
- `setup()`: once. Creates the sheet and token, prints the token, says whether a trained model is present.
- `exportTrainingEmails()`: your last 6 months of mail into a "Training export" tab, for training.
- `processInbox()`: one run now (also what the trigger runs).
- `installTrigger()` / `removeTrigger()`: run every 5 minutes / stop.

Step-by-step guide including training and the Chrome extension: [`../SETUP.md`](../SETUP.md).

## Tests (from the repo root)
- `node tests/pipeline.test.js`: the decision logic with a fake trained model and a fake AI.
- `node tests/model.test.js`: `ModelCore.gs` features and prediction, identical in Node and Apps Script.
- `node tests/stress.test.js`: full runs against a fake Gmail that throws on any write (hundreds of emails, paging,
  locking, failures, the training export, the fixture model end to end).
- `node trainer/train.js --synthetic`: trains the test fixture on the hand-written emails in `tests/` and prints its accuracy.
- `node tests/eval-models.js --synthetic`: the optional AI against a real provider (needs `$env:AI_KEY`).
