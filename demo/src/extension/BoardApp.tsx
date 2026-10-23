// The Jobs Board as it runs inside Gmail (an extension page in an iframe).
// Shows the cached feed instantly, then asks the Apps Script to process new mail.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Application } from '../types';
import { JobsBoard } from '../components/JobsBoard';
import { FollowUpModal } from '../components/FollowUpModal';
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

export const BoardApp: React.FC = () => {
  const [result, setResult] = useState<FeedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpApp, setFollowUpApp] = useState<Application | null>(null);
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

  return (
    <div className="h-screen flex flex-col bg-white text-[#1f1f1f]">
      {/* Header */}
      <header className="h-16 shrink-0 px-4 flex items-center gap-3 border-b border-[#e0e2ec]">
        <Icon name="work" size={24} className="text-[#0b57d0]" fill />
        <h1 className="text-[22px] font-gs">Jobs Board</h1>
        <span className="text-xs text-[#747775] ml-1" aria-live="polite">
          {loading ? 'Checking for new emails…' : result && result.ok ? ago(result.fetchedAt) : ''}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden md:flex items-center h-10 w-72 rounded-full bg-[#e9eef6] focus-within:bg-white focus-within:shadow px-3 gap-2">
            <Icon name="search" size={20} className="text-[#444746]" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search companies"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
            />
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            title="Check for new emails"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#444746] hover:bg-[#e8eaed] cursor-pointer disabled:cursor-default"
          >
            <Icon name="refresh" size={22} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS })}
            title="Settings"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#444746] hover:bg-[#e8eaed] cursor-pointer"
          >
            <Icon name="settings" size={22} />
          </button>
        </div>
      </header>

      {staleError && (
        <div className="shrink-0 px-4 h-10 flex items-center gap-2 bg-[#fef7e0] text-[#b06000] text-sm">
          <Icon name="error" size={18} /> Showing saved data: {staleError.title.toLowerCase()}.
        </div>
      )}

      {/* Body */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-3">
            <Icon name="link_off" size={40} className="text-[#747775]" />
            <h2 className="text-lg font-gs">{error.title}</h2>
            <p className="text-sm text-[#444746]">{error.body}</p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => chrome.runtime.sendMessage({ type: MSG.OPEN_OPTIONS })}
                className="h-10 px-5 rounded-full bg-[#0b57d0] text-white text-sm font-medium cursor-pointer hover:bg-[#0842a0]"
              >
                Open settings
              </button>
              <button
                onClick={refresh}
                className="h-10 px-5 rounded-full text-[#0b57d0] text-sm font-medium cursor-pointer hover:bg-[#f1f3f4]"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : !board ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[#747775] gap-2">
          <Icon name="progress_activity" size={20} className="animate-spin" /> Loading your applications…
        </div>
      ) : board.applications.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-2">
            <Icon name="inbox" size={40} className="text-[#747775]" />
            <h2 className="text-lg font-gs">No job emails yet</h2>
            <p className="text-sm text-[#444746]">
              Application emails show up here after the tracker processes them (every 5 minutes, or press refresh).
            </p>
          </div>
        </div>
      ) : (
        <JobsBoard
          applications={board.applications}
          emails={board.emails}
          searchQuery={searchQuery}
          onOpenEmail={openThread}
          onOpenFollowUp={setFollowUpApp}
        />
      )}

      {followUpApp && <FollowUpModal application={followUpApp} onClose={() => setFollowUpApp(null)} />}
    </div>
  );
};
