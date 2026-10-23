// Runs inside Gmail. Adds "Jobs Board" to Gmail's left sidebar, shows the board
// (an extension page in an iframe) in the main area, opens real threads when the
// board asks, shows a "Job deadlines" section at the top of the inbox, and asks
// the tracker to process new mail as soon as Gmail shows a new thread.
import * as InboxSDK from '@inboxsdk/core';
import { adaptFeed } from './feed';
import { FRAME_SOURCE, getCachedFeed, getFeed, type FeedResult } from './messages';

const ROUTE = 'jobs-board';
const BRIEFCASE_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#444746" d="M10 3h4a2 2 0 0 1 2 2v2h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h4V5a2 2 0 0 1 2-2Zm0 4h4V5h-4v2ZM5 9v10h14V9H5Z"/></svg>'
  );
const AUTO_REFRESH_MIN_GAP_MS = 45 * 1000;
const NEW_MAIL_SETTLE_MS = 10 * 1000; // ignore the rows Gmail renders on first load

function timeLeft(deadlineIso: string): string {
  const hours = Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 3600000));
  return hours >= 24 ? `${Math.floor(hours / 24)}d left` : `${hours}h left`;
}

async function main() {
  const { appId } = await chrome.storage.local.get('appId');
  if (!appId) {
    console.info('[Jobs Board] Add your InboxSDK App ID in the extension settings, then reload Gmail.');
    return;
  }
  const sdk = await InboxSDK.load(2, appId);
  const extOrigin = new URL(chrome.runtime.getURL('board.html')).origin;

  // ---- Sidebar item + the board page -------------------------------------------
  sdk.NavMenu.addNavItem({ name: 'Jobs Board', routeID: ROUTE, iconUrl: BRIEFCASE_ICON, orderHint: -1 });

  sdk.Router.handleCustomRoute(ROUTE, view => {
    view.setFullWidth(true);
    const el = view.getElement();
    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('board.html');
    frame.title = 'Jobs Board';
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

  // The board asks to open a real thread
  window.addEventListener('message', event => {
    if (event.origin !== extOrigin) return;
    const data = event.data || {};
    if (data.source !== FRAME_SOURCE) return;
    if (data.type === 'openThread' && data.threadId) {
      sdk.Router.goto(sdk.Router.NativeRouteIDs.THREAD, { threadID: String(data.threadId) });
    }
  });

  // ---- "Job deadlines" section at the top of the inbox ------------------------
  let latest: FeedResult | null = await getCachedFeed();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inboxView: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let section: any = null;

  const renderSection = () => {
    if (section) {
      section.destroy();
      section = null;
    }
    if (!inboxView || !latest || !latest.ok || !latest.feed || !latest.feed.items) return;
    const { applications } = adaptFeed(latest.feed.items, Date.now());
    const due = applications
      .filter(a => a.stage === 'needs_action' && a.deadline)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
      .slice(0, 5);
    if (!due.length) return;
    section = inboxView.addCollapsibleSection({
      title: 'Job deadlines',
      subtitle: `${due.length} due soon`,
      titleLinkText: 'Open Jobs Board',
      onTitleLinkClick: () => sdk.Router.goto(ROUTE),
      tableRows: due.map(a => {
        const email = a.emails.find(e => e.deadlineResolved === a.deadline) || a.emails[0];
        return {
          title: a.company,
          snippet: `${timeLeft(a.deadline!)} · ${a.currentStatus}`,
          shortDetailText: new Date(a.deadline!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          isRead: false,
          labels: [],
          iconUrl: BRIEFCASE_ICON,
          onClick: () => sdk.Router.goto(sdk.Router.NativeRouteIDs.THREAD, { threadID: email.threadId }),
        };
      }),
    });
  };

  sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, listView => {
    inboxView = listView;
    renderSection();
    listView.on('destroy', () => {
      if (inboxView === listView) {
        inboxView = null;
        section = null;
      }
    });
  });

  chrome.storage.onChanged.addListener((changes: Record<string, { newValue?: FeedResult }>, area: string) => {
    if (area === 'local' && changes.feedCache && changes.feedCache.newValue) {
      latest = changes.feedCache.newValue;
      renderSection();
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

main().catch(err => console.error('[Jobs Board]', err));
