import React, { useState } from 'react';
import type { Application, Email, DeterministicRule } from './types';
import { INITIAL_APPLICATIONS, INITIAL_EMAILS, INITIAL_RULES } from './data/mockData';
import { GmailNavbar } from './components/GmailNavbar';
import { GmailSidebar } from './components/GmailSidebar';
import { JobsBoard } from './components/JobsBoard';
import { GmailEmailRow } from './components/GmailEmailRow';
import { GmailEmailDetail } from './components/GmailEmailDetail';
import { FollowUpModal } from './components/FollowUpModal';
import { DeadlineBar } from './components/Visuals';
import { getCountdown } from './utils/dateUtils';
import { applyGhostingRule } from './utils/ghosting';
import { Icon } from './components/Icon';

export const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>(INITIAL_EMAILS);
  // Ghosted is decided by rule (60 days with no reply after applying), not stored
  const applications = applyGhostingRule(INITIAL_APPLICATIONS, emails);
  const [, setRules] = useState<DeterministicRule[]>(INITIAL_RULES);

  const [currentTab, setCurrentTab] = useState<'jobs' | 'inbox' | 'starred' | 'review'>('jobs');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [followUpApp, setFollowUpApp] = useState<Application | null>(null);

  // Email list (Inbox / Starred / Review tabs)
  const filteredEmails = emails.filter((email) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        email.company.toLowerCase().includes(q) ||
        email.subject.toLowerCase().includes(q) ||
        email.snippet.toLowerCase().includes(q) ||
        email.role.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (currentTab === 'starred' && !email.isStarred) return false;
    if (currentTab === 'review' && email.stage !== 'review' && email.confidence >= 0.85) return false;
    if (currentTab === 'inbox' && email.isArchived) return false;
    return true;
  });

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;
  const selectedParentApp = selectedEmail
    ? applications.find((a) => a.id === selectedEmail.applicationId)
    : undefined;

  const palantirApp = applications.find((a) => a.id === 'app-palantir');
  const palantirCountdown = palantirApp ? getCountdown(palantirApp.deadline) : null;

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
  };

  const handleAddRule = (newRule: DeterministicRule) => {
    setRules((prev) => [newRule, ...prev]);
  };

  const needsActionCount = applications.filter((a) => a.stage === 'needs_action').length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f6f8fc] text-[#1f1f1f]">
      <GmailNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex overflow-hidden">
        <GmailSidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setSelectedEmailId(null);
          }}
          urgentCount={needsActionCount}
          totalJobsCount={emails.length}
        />

        <main className="flex-1 min-w-0 bg-white rounded-2xl mb-4 flex flex-col overflow-hidden">
          {selectedEmail ? (
            <GmailEmailDetail
              email={selectedEmail}
              application={selectedParentApp}
              onBack={() => setSelectedEmailId(null)}
              onToggleStar={() => handleToggleStar(selectedEmail.id)}
              onAddRule={handleAddRule}
            />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Palantir challenge callout */}
              {palantirApp?.deadline && palantirCountdown && !palantirCountdown.isPassed && (
                <button
                  onClick={handlePalantirQuickJump}
                  title={`"${palantirApp.deadlineRaw}"`}
                  className="bg-[#fef7e0] hover:bg-[#fdefc3] px-4 h-10 flex items-center gap-3 text-sm text-[#b06000] shrink-0 cursor-pointer text-left"
                >
                  <Icon name="schedule" size={20} />
                  <span className="font-medium shrink-0">Palantir video</span>
                  <DeadlineBar startIso={palantirApp.lastActivity} deadlineIso={palantirApp.deadline} width={140} />
                </button>
              )}

              {currentTab === 'jobs' ? (
                <JobsBoard
                  applications={applications}
                  emails={emails}
                  searchQuery={searchQuery}
                  onOpenEmail={setSelectedEmailId}
                  onOpenFollowUp={setFollowUpApp}
                />
              ) : (
                <>
                  {/* Gmail list toolbar */}
                  <div className="h-12 pl-4 pr-4 flex items-center text-[#444746] select-none shrink-0">
                    <button
                      onClick={handleToggleSelectAll}
                      className="h-10 pl-2 pr-0.5 flex items-center rounded hover:bg-[#e8eaed] cursor-pointer"
                      title="Select"
                    >
                      {selectedEmailIds.size === filteredEmails.length && filteredEmails.length > 0 ? (
                        <Icon name="check_box" size={20} fill className="text-[#0b57d0]" />
                      ) : (
                        <Icon name="check_box_outline_blank" size={20} />
                      )}
                      <Icon name="arrow_drop_down" size={20} />
                    </button>
                    <button
                      onClick={() => setEmails(INITIAL_EMAILS)}
                      className="ml-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] cursor-pointer"
                      title="Refresh"
                    >
                      <Icon name="refresh" size={20} />
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] cursor-pointer" title="More">
                      <Icon name="more_vert" size={20} />
                    </button>

                    <span className="ml-auto text-xs text-[#444746]">
                      1–{filteredEmails.length} of {emails.length}
                    </span>
                    <button className="ml-2 w-10 h-10 flex items-center justify-center rounded-full text-[#c4c7c5]" title="Newer" disabled>
                      <Icon name="chevron_left" size={20} />
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center rounded-full text-[#c4c7c5]" title="Older" disabled>
                      <Icon name="chevron_right" size={20} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
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
                </>
              )}
            </div>
          )}
        </main>

        {/* Gmail side panel (Calendar, Keep, Tasks, Contacts) */}
        <aside className="w-14 shrink-0 flex flex-col items-center gap-2 pt-1 select-none">
          {[
            { icon: 'calendar_month', color: '#1a73e8', label: 'Calendar' },
            { icon: 'lightbulb', color: '#fbbc04', label: 'Keep' },
            { icon: 'task_alt', color: '#1a73e8', label: 'Tasks' },
            { icon: 'person', color: '#1a73e8', label: 'Contacts' },
          ].map((a) => (
            <button key={a.label} title={a.label} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e8eaed] cursor-pointer">
              <Icon name={a.icon} size={20} fill style={{ color: a.color }} />
            </button>
          ))}
          <div className="w-5 h-px bg-[#c4c7c5] my-1" />
          <button title="Get add-ons" className="w-10 h-10 flex items-center justify-center rounded-full text-[#444746] hover:bg-[#e8eaed] cursor-pointer">
            <Icon name="add" size={20} />
          </button>
        </aside>
      </div>

      {followUpApp && (
        <FollowUpModal application={followUpApp} onClose={() => setFollowUpApp(null)} />
      )}
    </div>
  );
};

export default App;
