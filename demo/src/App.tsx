import React, { useState } from 'react';
import type { Application, Email, DeterministicRule } from './types';
import { INITIAL_APPLICATIONS, INITIAL_EMAILS, INITIAL_RULES } from './data/mockData';
import { GmailNavbar } from './components/GmailNavbar';
import { GmailSidebar } from './components/GmailSidebar';
import { JobAnalyticsDonut } from './components/JobAnalyticsDonut';
import { GmailEmailRow } from './components/GmailEmailRow';
import { GmailEmailDetail } from './components/GmailEmailDetail';
import { FollowUpModal } from './components/FollowUpModal';
import { RotateCw, MoreVertical, Square, CheckSquare } from 'lucide-react';

export const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>(INITIAL_EMAILS);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [, setRules] = useState<DeterministicRule[]>(INITIAL_RULES);

  const [currentTab, setCurrentTab] = useState<'jobs' | 'inbox' | 'starred' | 'review'>('jobs');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [followUpApp, setFollowUpApp] = useState<Application | null>(null);

  // Derived filtered emails
  const filteredEmails = emails.filter((email) => {
    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        email.company.toLowerCase().includes(q) ||
        email.subject.toLowerCase().includes(q) ||
        email.snippet.toLowerCase().includes(q) ||
        email.role.toLowerCase().includes(q);
      if (!match) return false;
    }

    // 2. Sidebar Tab filter
    if (currentTab === 'starred' && !email.isStarred) return false;
    if (currentTab === 'review' && email.stage !== 'review' && email.confidence >= 0.85) return false;
    if (currentTab === 'inbox' && email.isArchived) return false;

    // 3. Donut Ring Slice filter
    if (selectedCategory) {
      if (selectedCategory === 'assessment' && email.stage !== 'assessment') return false;
      if (selectedCategory === 'interview' && email.stage !== 'interview') return false;
      if (selectedCategory === 'applied' && email.stage !== 'applied') return false;
      if (selectedCategory === 'closed' && !email.isArchived) return false;
    }

    return true;
  });

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  // Handlers
  const handleToggleStar = (emailId: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isStarred: !e.isStarred } : e))
    );
  };

  const handleToggleCheck = (emailId: string) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedEmailIds.size === filteredEmails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(filteredEmails.map((e) => e.id)));
    }
  };

  const handleArchive = (emailId: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isArchived: true, actionNeeded: false } : e))
    );
  };

  const handlePalantirQuickJump = () => {
    setSelectedEmailId('msg-palantir-challenge');
    setSearchQuery('');
    setSelectedCategory(null);
  };

  const handleAddRule = (newRule: DeterministicRule) => {
    setRules((prev) => [newRule, ...prev]);
  };

  const urgentCount = emails.filter((e) => e.actionNeeded && !e.isArchived).length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f8fc] text-[#1f1f1f]">
      {/* 1. Gmail Native Navbar */}
      <GmailNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onPalantirQuickJump={handlePalantirQuickJump}
      />

      {/* 2. Main Body: Sidebar + Gmail Mail Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <GmailSidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setSelectedEmailId(null);
          }}
          urgentCount={urgentCount}
          totalJobsCount={emails.length}
        />

        {/* Right Gmail Rounded Mail Surface */}
        <main className="flex-1 bg-white rounded-2xl border border-[#e0e2ec] shadow-2xs mr-3 mb-3 flex flex-col overflow-hidden">
          {selectedEmail ? (
            /* Single Email View with Integrated "AI Reads, Code Decides" Triage */
            <GmailEmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmailId(null)}
              onToggleStar={() => handleToggleStar(selectedEmail.id)}
              onAddRule={handleAddRule}
            />
          ) : (
            /* Email List View + Integrated Donut Visualizer */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Top Banner: Palantir Challenge Callout */}
              <div className="bg-[#fef7e0] border-b border-[#fce8b2] px-4 py-2 flex items-center justify-between text-xs text-[#b06000]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#e37400] animate-ping shrink-0" />
                  <span>
                    <strong>Impending Challenge:</strong> Palantir video due in 4 days ("within 7 days
                    of receiving this email")
                  </span>
                </div>
                <button
                  onClick={handlePalantirQuickJump}
                  className="font-medium underline hover:text-[#7d4400] cursor-pointer"
                >
                  View Palantir Email & Triage
                </button>
              </div>

              {/* Integrated Visualizer Bar: Minimalist Donut ("O") Chart & Analytics */}
              <div className="p-4 border-b border-[#f0f4f9] bg-[#fbfcfe]">
                <JobAnalyticsDonut
                  applications={applications}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              </div>

              {/* Gmail List Actions Bar */}
              <div className="h-11 px-4 border-b border-[#f0f4f9] flex items-center justify-between text-[#444746] select-none shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 rounded hover:bg-[#eaebef] cursor-pointer"
                    title="Select all"
                  >
                    {selectedEmailIds.size === filteredEmails.length && filteredEmails.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[#0b57d0]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#747775]" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setEmails(INITIAL_EMAILS);
                      setApplications(INITIAL_APPLICATIONS);
                    }}
                    className="p-1.5 rounded-full hover:bg-[#eaebef] cursor-pointer"
                    title="Refresh"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <button className="p-1.5 rounded-full hover:bg-[#eaebef] cursor-pointer" title="More">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-[#747775] font-mono">
                  Showing 1–{filteredEmails.length} of {emails.length}
                </div>
              </div>

              {/* Email Rows List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#f2f4f8]">
                {filteredEmails.length === 0 ? (
                  <div className="p-12 text-center text-sm text-[#747775]">
                    No messages match this filter.
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <GmailEmailRow
                      key={email.id}
                      email={email}
                      isSelected={email.id === selectedEmailId}
                      isChecked={selectedEmailIds.has(email.id)}
                      onToggleCheck={(e) => {
                        e.stopPropagation();
                        handleToggleCheck(email.id);
                      }}
                      onToggleStar={(e) => {
                        e.stopPropagation();
                        handleToggleStar(email.id);
                      }}
                      onSelect={() => setSelectedEmailId(email.id)}
                      onArchive={(e) => {
                        e.stopPropagation();
                        handleArchive(email.id);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Ghosting Follow-Up Modal */}
      {followUpApp && (
        <FollowUpModal application={followUpApp} onClose={() => setFollowUpApp(null)} />
      )}
    </div>
  );
};

export default App;
