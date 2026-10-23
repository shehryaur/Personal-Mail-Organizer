# Chrome extension: Jobs Board in Gmail (Manifest V3 + InboxSDK)

Adds **Jobs Board** to Gmail's left sidebar. Clicking it shows the board (one row per
application, stages, deadlines, ghosted follow-ups) in Gmail's main area, built from
your own tracker sheet. Also adds a **Job deadlines** section at the top of the inbox.

Setup steps: see [`../SETUP.md`](../SETUP.md).

## How it's put together
- `manifest.json`: permissions are Gmail, your Apps Script web app, `storage` and `scripting` (InboxSDK needs it to load its page script).
- Source lives in `demo/src/extension/` so it shares the board components with the demo:
  - `content.ts`: runs in Gmail. InboxSDK sidebar item and route, inbox section, opens real threads, refreshes when new mail appears.
  - `BoardApp.tsx` / `board.html`: the board, as an extension page shown in an iframe (keeps Gmail's styles and ours apart).
  - `options.tsx` / `options.html`: web app URL, feed token, InboxSDK App ID (stored in this browser only).
  - `background.ts`: fetches the private feed (`?token=…`, `&action=refresh`) and caches it.
  - `feed.ts`: turns sheet rows into applications (one per company) and board sections.
- Build: `cd demo && npm run build:extension` → `extension/dist` (load that folder unpacked). `dist/` is not committed.
