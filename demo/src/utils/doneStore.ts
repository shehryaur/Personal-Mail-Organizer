// To-dos you've ticked off, by the email id behind each one. In the extension
// they're kept in Chrome's synced storage, so they follow you to any Chrome
// signed in to the same account; in the demo, in this browser only. Gmail is
// never touched. A new email for the same company is a new to-do, unticked.
declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any

const KEY = 'doneTasks';
const MAX = 300; // chrome.storage.sync allows 8 KB per item

const synced = () => typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.sync;

export async function loadDone(): Promise<string[]> {
  try {
    if (synced()) {
      const got = await chrome.storage.sync.get(KEY);
      return Array.isArray(got[KEY]) ? got[KEY] : [];
    }
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDone(ids: string[]): void {
  const list = ids.slice(-MAX);
  try {
    if (synced()) chrome.storage.sync.set({ [KEY]: list });
    else window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private window, quota): ticks last until reload
  }
}
