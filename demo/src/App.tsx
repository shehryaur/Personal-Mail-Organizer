// The reviewers' demo: a Gmail-like frame with sample data. "Job Tracker" in the
// sidebar opens the same dashboard the Chrome extension shows inside real Gmail.
import React, { useMemo, useState } from 'react';
import { GmailNavbar } from './components/GmailNavbar';
import { GmailSidebar, type Tab } from './components/GmailSidebar';
import { TrackerDashboard } from './components/dashboard/TrackerDashboard';
import { Icon } from './components/Icon';
import { SAMPLE_FEED, OTHER_MAIL } from './data/mockData';
import { adaptFeed } from './extension/feed';
import { buildBoard } from './utils/board';
import { SIMULATED_NOW } from './utils/dateUtils';

interface MailRow { id: string; from: string; subject: string; snippet: string; date: string; note: string | null; unread: boolean }

const STAGE_NOTE: Record<string, string> = {
  applied: 'Applied', assessment: 'Assessment', interview: 'Interview', offer: 'Offer', rejected: 'Rejection', other: 'About an application',
  review: 'Not sure what this is: listed under "Not sure about…" at the bottom of the tracker',
};

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return SIMULATED_NOW - d.getTime() < 86400000 ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const App: React.FC = () => {
  const { applications, emails } = useMemo(() => adaptFeed(SAMPLE_FEED, SIMULATED_NOW), []);
  const todoCount = useMemo(() => buildBoard(applications, SIMULATED_NOW).tasks.length, [applications]);
  // demo.example/#tracker opens straight on the dashboard
  const [tab, setTab] = useState<Tab>(() => (window.location.hash === '#tracker' ? 'tracker' : 'inbox'));
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const inbox: MailRow[] = useMemo(() => {
    const job = emails.map(e => {
      const name = e.from.replace(/\s*<.*$/, '');
      const deadline = e.deadlineResolved
        ? ` Deadline "${e.deadlineRaw}" works out to ${new Date(e.deadlineResolved).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.`
        : '';
      return { id: e.id, from: name, subject: e.subject, snippet: e.snippet, date: e.receivedAt, unread: SIMULATED_NOW - new Date(e.receivedAt).getTime() < 2 * 86400000,
        note: `${STAGE_NOTE[e.stage] || e.stage} · ${e.company}.${deadline}` };
    });
    const other = OTHER_MAIL.map(m => ({ ...m, unread: false, note: null }));
    const q = searchQuery.toLowerCase();
    return [...job, ...other]
      .filter(m => !q || (m.from + m.subject + m.snippet).toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [emails, searchQuery]);

  const open = inbox.find(m => m.id === openId) || null;
  const openEmail = (id: string) => setOpenId(id);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f8fc] text-[#1f1f1f]">
      <GmailNavbar searchQuery={searchQuery} onSearchChange={q => { setSearchQuery(q); setTab('inbox'); setOpenId(null); }} />
      {/* Phones: the sidebar becomes two tabs */}
      <div className="md:hidden flex gap-2 px-4 pb-2">
        {(['inbox', 'tracker'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setOpenId(null); }}
            className={`h-9 px-4 rounded-full text-sm font-medium cursor-pointer ${tab === t ? 'bg-[#d3e3fd] text-[#001d35]' : 'bg-white text-[#444746]'}`}>
            {t === 'inbox' ? 'Inbox' : `Job Tracker (${todoCount})`}
          </button>
        ))}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <GmailSidebar currentTab={tab} onTabChange={t => { setTab(t); setOpenId(null); }} todoCount={todoCount} inboxCount={inbox.filter(m => m.unread).length} />

        <main className={`flex-1 min-w-0 mb-4 mx-2 md:ml-0 md:mr-4 flex flex-col overflow-y-auto rounded-2xl ${tab === 'tracker' && !open ? 'bg-transparent' : 'bg-white'}`}>
          {open ? (
            <article className="p-4 md:pl-16 md:pr-10 max-w-[900px]">
              <button onClick={() => setOpenId(null)} className="h-10 px-3 -ml-3 rounded-full flex items-center gap-2 text-sm text-[#444746] hover:bg-[#f1f3f4] cursor-pointer">
                <Icon name="arrow_back" size={20} /> {tab === 'tracker' ? 'Back to Job Tracker' : 'Back to Inbox'}
              </button>
              <h1 className="text-[22px] font-gs mt-2 mb-4">{open.subject}</h1>
              <div className={`rounded-xl px-4 py-2.5 flex items-center gap-2 text-[13px] ${open.note ? 'bg-[#d4f24a] text-[#1b1b1b]' : 'bg-[#f1f1ed] text-[#4a4a45]'}`}>
                <Icon name="work" size={18} />
                <span><b>Job Tracker:</b> {open.note || 'Not a job email. Ignored.'}</span>
              </div>
              <div className="flex items-center gap-3 my-5">
                <div className="w-10 h-10 rounded-full bg-[#e9eef6] grid place-items-center font-bold text-[#444746]">{open.from[0]}</div>
                <div className="flex-1 min-w-0"><b className="text-sm">{open.from}</b><div className="text-xs text-[#5f6368]">to me</div></div>
                <div className="text-xs text-[#5f6368]">{new Date(open.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-line max-w-[65ch]">{open.snippet}</div>
            </article>
          ) : tab === 'tracker' ? (
            <TrackerDashboard applications={applications} now={SIMULATED_NOW} onOpenEmail={openEmail} updatedLabel="Sample data" />
          ) : (
            <div>
              <div className="h-12 px-4 flex items-center text-[13px] text-[#444746] border-b border-[#eceef1]">
                <span className="font-semibold text-[#1f1f1f] text-sm">Primary</span>
                <span className="ml-auto">1–{inbox.length} of {inbox.length}</span>
              </div>
              {inbox.map(m => (
                <button key={m.id} onClick={() => openEmail(m.id)}
                  className="w-full min-h-12 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-b border-[#f0f1f3] text-sm text-left hover:bg-[#f7f7f4] cursor-pointer">
                  <span className={`basis-[200px] shrink-0 truncate ${m.unread ? 'font-bold' : ''}`}>{m.from}</span>
                  <span className="flex-1 basis-[320px] min-w-0 truncate"><span className={m.unread ? 'font-bold' : ''}>{m.subject}</span><span className="text-[#5f6368]"> – {m.snippet.replace(/\s+/g, ' ')}</span></span>
                  <span className={`text-xs ${m.unread ? 'font-bold' : 'text-[#5f6368]'}`}>{shortDate(m.date)}</span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
