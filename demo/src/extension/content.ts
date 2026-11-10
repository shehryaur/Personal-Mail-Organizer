// Runs inside Gmail. Adds "Job Tracker" to Gmail's left sidebar, shows the
// dashboard (an extension page in an iframe) in the main area, opens real threads
// when the dashboard asks, and asks the tracker to read new mail as soon as Gmail
// shows a new thread. It never changes anything in Gmail.
import * as InboxSDK from '@inboxsdk/core';
import { FRAME_SOURCE, getFeed } from './messages';

const ROUTE = 'job-tracker';
const BRIEFCASE_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#444746" d="M10 3h4a2 2 0 0 1 2 2v2h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h4V5a2 2 0 0 1 2-2Zm0 4h4V5h-4v2ZM5 9v10h14V9H5Z"/></svg>'
  );
const AUTO_REFRESH_MIN_GAP_MS = 45 * 1000;
const NEW_MAIL_SETTLE_MS = 10 * 1000; // ignore the rows Gmail renders on first load
const FALLBACK_AFTER_MS = 6 * 1000;

function addFallbackButton(open: () => void) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Open Job Tracker';
  btn.innerHTML = `<img src="${BRIEFCASE_ICON}" alt="" width="18" height="18"> Job Tracker`;
  Object.assign(btn.style, {
    position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483000',
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
    border: '1px solid #c4c7c5', borderRadius: '16px', background: '#fff', color: '#1f1f1f',
    font: '500 14px "Google Sans", Roboto, Arial, sans-serif', cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
  });
  btn.addEventListener('click', open);
  document.body.appendChild(btn);
}

async function main() {
  const { appId } = await chrome.storage.local.get('appId');
  if (!appId) {
    console.info('[Job Tracker] Add your InboxSDK App ID in the extension settings, then reload Gmail.');
    return;
  }
  const sdk = await InboxSDK.load(2, appId);
  const extOrigin = new URL(chrome.runtime.getURL('board.html')).origin;

  // ---- Sidebar item + the dashboard page -------------------------------------------
  try {
    sdk.NavMenu.addNavItem({ name: 'Job Tracker', routeID: ROUTE, iconUrl: BRIEFCASE_ICON, orderHint: -1 });
  } catch (err) {
    console.warn('[Job Tracker] Sidebar item failed', err);
  }
  // Newer Gmail layouts can stop InboxSDK finding the left menu (it logs "should not
  // happen" and adds nothing). Then show a small button that opens the same page.
  setTimeout(() => {
    const shown = Array.from(document.querySelectorAll<HTMLElement>('.inboxsdk__navItem'))
      .some(el => el.offsetParent !== null && (el.textContent || '').includes('Job Tracker'));
    if (shown) return;
    console.warn('[Job Tracker] Sidebar item missing; showing the Job Tracker button instead.');
    addFallbackButton(() => sdk.Router.goto(ROUTE));
  }, FALLBACK_AFTER_MS);

  sdk.Router.handleCustomRoute(ROUTE, view => {
    view.setFullWidth(true);
    const el = view.getElement();
    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('board.html');
    frame.title = 'Job Tracker';
    Object.assign(frame.style, { width: '100%', border: '0', display: 'block', background: '#fff', borderRadius: '16px' });
    // fill the space Gmail gives the main area
    const size = () => {
      const top = el.getBoundingClientRect().top;
      frame.style.height = Math.max(400, window.innerHeight - top - 16) + 'px';
    };
    el.appendChild(frame);
    requestAnimationFrame(size);
    window.addEventListener('resize', size);
    view.on('destroy', () => window.removeEventListener('resize', size));
  });

  // The dashboard asks to open a real thread
  window.addEventListener('message', event => {
    if (event.origin !== extOrigin) return;
    const data = event.data || {};
    if (data.source !== FRAME_SOURCE) return;
    if (data.type === 'openThread' && data.threadId) {
      sdk.Router.goto(sdk.Router.NativeRouteIDs.THREAD, { threadID: String(data.threadId) });
    }
  });

  // ---- Process new mail as soon as Gmail shows it -------------------------------
  let lastRefresh = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const refreshSoon = () => {
    if (pending) clearTimeout(pending);
    const wait = Math.max(3000, lastRefresh + AUTO_REFRESH_MIN_GAP_MS - Date.now());
    pending = setTimeout(() => {
      pending = null;
      lastRefresh = Date.now();
      getFeed(true); // result arrives through chrome.storage (feedCache)
    }, wait);
  };

  const seenThreads = new Set<string>();
  let armed = false;
  setTimeout(() => { armed = true; }, NEW_MAIL_SETTLE_MS);
  sdk.Lists.registerThreadRowViewHandler(row => {
    row.getThreadIDAsync().then((id: string) => {
      if (seenThreads.has(id)) return;
      seenThreads.add(id);
      if (armed) refreshSoon();
    }).catch(() => {});
  });

  // Catch up once when Gmail opens (cheap if nothing new)
  lastRefresh = Date.now();
  getFeed(true);
}

main().catch(err => console.error('[Job Tracker]', err));
