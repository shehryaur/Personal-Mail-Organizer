// Background service worker: fetches the private Apps Script feed and caches it.
// The Gmail page can't call script.google.com directly (cross-origin), so both the
// content script and the board page go through here.
import '@inboxsdk/core/background.js'; // InboxSDK's MV3 helper (injects pageWorld.js)
import { MSG, type FeedResult, type Settings } from './messages';

const inflight: { plain: Promise<FeedResult> | null; refresh: Promise<FeedResult> | null } = {
  plain: null,
  refresh: null,
};

async function fetchFeed(refresh: boolean): Promise<FeedResult> {
  const { webAppUrl, token } = (await chrome.storage.local.get(['webAppUrl', 'token'])) as Settings;
  if (!webAppUrl || !token) return { ok: false, error: 'not_configured' };

  const url = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') +
    'token=' + encodeURIComponent(token) + (refresh ? '&action=refresh' : '');
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  } catch {
    return { ok: false, error: 'network' };
  }
  let feed;
  try {
    feed = JSON.parse(await res.text());
  } catch {
    // Usually an HTML login or error page: wrong URL or the web app isn't deployed for "Anyone"
    return { ok: false, error: 'bad_response' };
  }
  if (!feed.ok) return { ok: false, error: feed.error === 'unauthorized' ? 'unauthorized' : feed.error || 'bad_response' };

  const result: FeedResult = { ok: true, feed, fetchedAt: new Date().toISOString() };
  await chrome.storage.local.set({ feedCache: result }); // pages listen for this change
  return result;
}

function getFeed(refresh: boolean): Promise<FeedResult> {
  // One request of each kind at a time: the board and the inbox section may ask together
  const kind = refresh ? 'refresh' : 'plain';
  if (!inflight[kind]) inflight[kind] = fetchFeed(refresh).finally(() => { inflight[kind] = null; });
  return inflight[kind]!;
}

chrome.runtime.onMessage.addListener(
  (msg: { type: string; refresh?: boolean }, _sender: unknown, sendResponse: (r: FeedResult) => void) => {
    if (msg && msg.type === MSG.GET_FEED) {
      getFeed(!!msg.refresh).then(sendResponse);
      return true; // async response
    }
    if (msg && msg.type === MSG.OPEN_OPTIONS) chrome.runtime.openOptionsPage();
    return false;
  }
);

// Clicking the toolbar icon opens the settings
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
