// Messages between the Gmail content script, the board page and the background worker
import type { Feed } from './feed';

export interface Settings {
  webAppUrl?: string;
  token?: string;
  appId?: string;
}

export interface FeedResult {
  ok: boolean;
  error?: 'not_configured' | 'unauthorized' | 'network' | 'bad_response' | string;
  feed?: Feed;
  fetchedAt?: string;
}

export const MSG = {
  GET_FEED: 'jobs:getFeed', // { refresh: boolean } -> FeedResult
  OPEN_OPTIONS: 'jobs:openOptions',
} as const;

// postMessage from the board iframe to the Gmail page
export const FRAME_SOURCE = 'jobs-board-frame';

export function getFeed(refresh: boolean): Promise<FeedResult> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: MSG.GET_FEED, refresh }, (res: FeedResult | undefined) => {
      if (chrome.runtime.lastError || !res) resolve({ ok: false, error: 'network' });
      else resolve(res);
    });
  });
}

export async function getCachedFeed(): Promise<FeedResult | null> {
  const { feedCache } = await chrome.storage.local.get('feedCache');
  return feedCache || null;
}
