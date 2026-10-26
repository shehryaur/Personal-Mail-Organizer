# Put the Job Tracker inside your Gmail

About 30 minutes, plus a one-time labelling step with Claude. You need Chrome on a computer and your Gmail account.
Everything below is in the order you do it.

The script only **reads** Gmail. It asks for read-only access, so it can't label, star, archive or delete anything.
What it finds goes into a Google Sheet, and the Job Tracker dashboard in Gmail's sidebar shows it.

## 1. Apps Script (the part that reads your mail)

1. Go to **script.google.com** → **New project**. Rename it **Job Tracker** (click "Untitled project").
2. Delete what's in `Code.gs` and paste the whole of `apps-script/Code.gs` from this folder. Press **Ctrl+S**.
3. Click **+** next to Files → **Script** → name it `ModelCore` → paste `apps-script/ModelCore.gs` → **Ctrl+S**.
4. **Project Settings** (gear icon, left) → tick **Show "appsscript.json" manifest file in editor**.
   Back in the **Editor**, open `appsscript.json`, replace it with `apps-script/appsscript.json`, **Ctrl+S**.
5. Pick **`setup`** in the function dropdown at the top → **Run**.
   - Google asks for permission: **Review permissions** → choose your account → "Google hasn't verified this app" → **Advanced** → **Go to Job Tracker (unsafe)** → **Allow**. (It's unverified because it's your own script; it only runs in your account. Gmail access is read-only.)
   - The log shows a **Feed token**. Keep it; you paste it into the extension in step 4.
   - It also created a **Job Tracker** sheet in your Google Drive.

## 2. Train the classifier on your own mail (once)

1. In the Apps Script editor, pick **`exportTrainingEmails`** → **Run**. It copies your last 6 months of mail
   (sender, subject, the first 1,500 characters, your own labels) into a **Training export** tab of the Job Tracker
   sheet. If the log says "Stopped for time", run it again; it continues where it stopped.
2. Open the Job Tracker sheet → click the **Training export** tab → **File → Download → Comma-separated values (.csv)**.
   Save it in this folder as `data/training-export.csv` (the `data/` folder is never committed).
3. Ask Claude Code: **"Label data/training-export.csv for the job tracker."** Claude reads the emails and writes
   `data/labels.csv` (one category per email), then lists only the emails it was unsure about for a quick yes/no.
   This is the one time your emails are read by an AI.
4. Train the model (takes seconds, nothing leaves your computer):
   ```powershell
   node trainer/train.js --export data/training-export.csv --labels data/labels.csv
   ```
   It prints how accurate it is on emails it didn't train on, and **dangerous mistakes** (an assessment, interview or
   offer it would misfile), which must be 0 after thresholds. It writes `apps-script/Model.gs`.
5. In Apps Script, click **+** → **Script** → name it `Model` → paste the whole of `apps-script/Model.gs` → **Ctrl+S**.
6. Run **`processInbox`**. The log shows one line per email: what the model decided and how sure it was.
   Check the first tab of the Job Tracker sheet; emails the model wasn't sure about say `review`.
7. Pick **`installTrigger`** → **Run**. From now on it runs every 5 minutes by itself.

## 3. Web app (how the dashboard gets the data)

**Deploy** (top right) → **New deployment** → gear next to "Select type" → **Web app**.
- Execute as: **Me**
- Who has access: **Anyone** (the feed token keeps your data private; never share the URL together with the token)
- **Deploy** → copy the **Web app URL** (ends in `/exec`).

## 4. Chrome extension

1. **inboxsdk.com** → sign in → **Register an app** → name it **Job Tracker** → copy the **App ID** (starts with `sdk_`).
2. In this folder, build the extension once (or ask Claude to): `cd demo` then `npm run build:extension`.
   The extension is now in `extension/dist`.
3. Chrome → `chrome://extensions` → turn on **Developer mode** (top right) → **Load unpacked** → choose `extension/dist`.
4. The settings page opens (or click the extension's icon). Paste the **web app URL**, the **feed token** and the
   **InboxSDK App ID** → **Save & test connection** → it should say "Connected. N job emails in your tracker."
5. Reload Gmail. **Job Tracker** appears in the left sidebar. Click it to see the dashboard.

## How it stays up to date

- Every 5 minutes the script reads new mail and adds rows to the sheet.
- Opening the Job Tracker asks it to read new mail right away ("Checking…").
- While Gmail is open, a new email in your inbox triggers the same refresh.
- Retrain whenever the model starts sending a lot to `review` (new kinds of mail): repeat step 2.

## Optional: an AI second opinion

Emails the model isn't sure about stay `review`. To let an AI look at just those, add Script Properties
`AI_KEY` (an OpenAI-compatible key, e.g. NVIDIA NIM) and `AI_FALLBACK` = `true`. Those emails are then sent
to that provider; everything else still never leaves Google.

## If something's off

| You see | Fix |
|---|---|
| No "Job Tracker" in the sidebar | App ID missing or wrong in settings; reload Gmail after saving. |
| "Connect your tracker" | Web app URL or token missing in settings. |
| "The feed token doesn't match" | Copy the token again from the log (run `setup` again; it reuses the same token). |
| "The web app didn't answer with data" | Use the `/exec` URL, and check the deployment's access is **Anyone**. |
| Old data after you changed a script file | **Deploy → Manage deployments → edit → Version: New version → Deploy**. |
| Log says "No trained model yet" and nothing is recorded | Do step 2 (the model), or set `AI_KEY` to use the AI meanwhile. |
| Many emails say `review` | The model hasn't seen mail like that: export again, label, retrain (step 2). |
