// The Job Tracker as it runs inside Gmail (an extension page in an iframe).
// Shows the cached feed instantly, then asks the Apps Script to read new mail.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrackerDashboard } from '../components/dashboard/TrackerDashboard';
import { Icon } from '../components/Icon';
import { SIMULATED_NOW, tickNow } from '../utils/dateUtils';
import { adaptFeed } from './feed';
import { FRAME_SOURCE, MSG, getCachedFeed, getFeed, type FeedResult } from './messages';

const ERRORS: Record<string, { title: string; body: string }> = {
  not_configured: {
    title: 'Connect your tracker',
    body: 'Add your Apps Script web app URL and feed token in the extension settings.',
  },
  unauthorized: {
    title: 'The feed token doesn’t match',
    body: 'Copy the token again from the Apps Script log (run setup()) into the extension settings.',
  },
  bad_response: {
    title: 'The web app didn’t answer with data',
    body: 'Check the web app URL, and that the deployment’s access is set to “Anyone”.',
  },
  network: {
    title: 'Couldn’t reach your web app',
    body: 'Check your connection, then try again.',
  },
};

function ago(iso?: string): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `Updated ${hours} h ago` : `Updated ${new Date(iso).toLocaleDateString()}`;
}

const openSettings = () => chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS });

export const BoardApp: React.FC = () => {
  const [result, setResult] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [, forceTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await getFeed(true);
    tickNow();
    // keep showing the last good data if a refresh fails
    setResult(prev => (res.ok || !prev || !prev.ok ? res : { ...prev, error: res.error }));
    setLoading(false);
  }, []);

  useEffect(() => {
    getCachedFeed().then(cached => {
      if (cached) setResult(cached);
      refresh();
    });
    // updates triggered elsewhere (the inbox noticed new mail) land here too
    const onChange = (changes: Record<string, { newValue?: FeedResult }>, area: string) => {
      if (area === 'local' && changes.feedCache && changes.feedCache.newValue) {
        tickNow();
        setResult(changes.feedCache.newValue);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    const timer = setInterval(() => { tickNow(); forceTick(n => n + 1); }, 60000); // keep "x min ago" and countdowns fresh
    return () => {
      chrome.storage.onChanged.removeListener(onChange);
      clearInterval(timer);
    };
  }, [refresh]);

  const board = useMemo(
    () => (result && result.feed && result.feed.items ? adaptFeed(result.feed.items, SIMULATED_NOW) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, SIMULATED_NOW]
  );

  const openThread = (emailId: string) => {
    const email = board && board.emails.find(e => e.id === emailId);
    if (!email) return;
    window.parent.postMessage({ source: FRAME_SOURCE, type: 'openThread', threadId: email.threadId }, 'https://mail.google.com');
  };

  const error = result && !result.ok ? ERRORS[result.error || ''] || ERRORS.network : null;
  const staleError = result && result.ok && result.error ? ERRORS[result.error] || ERRORS.network : null;

  const message = (icon: string, title: string, body: React.ReactNode, actions?: React.ReactNode) => (
    <div className="tk-message">
      <Icon name={icon} size={40} className="text-[#66665f]" />
      <h2>{title}</h2>
      <div>{body}</div>
      {actions}
    </div>
  );

  return (
    <div className="h-screen overflow-y-auto bg-white p-2">
      {error ? (
        message('link_off', error.title, error.body, (
          <div className="flex justify-center gap-2 pt-2">
            <button onClick={openSettings} className="h-10 px-5 rounded-full bg-[#1b1b1b] text-white text-sm font-semibold cursor-pointer">Open settings</button>
            <button onClick={refresh} className="h-10 px-5 rounded-full text-[#1b1b1b] text-sm font-semibold cursor-pointer hover:bg-[#ecece8]">Try again</button>
          </div>
        ))
      ) : !board ? (
        message('progress_activity', 'Loading your applications…', '')
      ) : board.applications.length === 0 ? (
        message('inbox', 'No job emails yet', 'They show up here after the tracker reads your mail (every 5 minutes, or press refresh).', (
          <div className="flex justify-center pt-2">
            <button onClick={refresh} className="h-10 px-5 rounded-full bg-[#1b1b1b] text-white text-sm font-semibold cursor-pointer">Refresh</button>
          </div>
        ))
      ) : (
        <TrackerDashboard
          applications={board.applications}
          now={SIMULATED_NOW}
          onOpenEmail={openThread}
          onRefresh={refresh}
          refreshing={loading}
          updatedLabel={result && result.ok ? ago(result.fetchedAt) : ''}
          onOpenSettings={openSettings}
          banner={staleError && <div className="tk-banner">Showing saved data: {staleError.title.toLowerCase()}.</div>}
        />
      )}
    </div>
  );
};
