# Chrome extension: Job Tracker in Gmail (Manifest V3 + InboxSDK)

Adds **Job Tracker** to Gmail's left sidebar. Clicking it shows the dashboard in Gmail's main area, in the same tab:
counts per stage, a to-do list with deadlines, weekly counts and every application on a stage board, built from your
own tracker sheet. Clicking an item opens the real email. It never changes anything in Gmail.

Setup steps: see [`../SETUP.md`](../SETUP.md).

## How it's put together
- `manifest.json`: permissions are Gmail, your Apps Script web app, `storage` and `scripting` (InboxSDK needs it to load its page script).
- Source lives in `demo/src/extension/` so it shares the dashboard with the demo:
  - `content.ts`: runs in Gmail. InboxSDK sidebar item and route, opens real threads, refreshes when new mail appears.
  - `BoardApp.tsx` / `board.html`: the dashboard (`demo/src/components/dashboard/TrackerDashboard.tsx`) as an extension page in an iframe (keeps Gmail's styles and ours apart).
  - `options.tsx` / `options.html`: web app URL, feed token, InboxSDK App ID (stored in this browser only).
  - `background.ts`: fetches the private feed (`?token=…`, `&action=refresh`) and caches it.
  - `feed.ts`: turns sheet rows into applications (one per company); `demo/src/utils/board.ts` turns those into the dashboard.
- Build: `cd demo && npm run build:extension` → `extension/dist` (load that folder unpacked). `dist/` is not committed.
