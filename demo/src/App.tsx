import React, { useState } from 'react';
import type { Application, Email, DeterministicRule } from './types';
import { INITIAL_APPLICATIONS, INITIAL_EMAILS, INITIAL_RULES } from './data/mockData';
import { Header } from './components/Header';
import { RawStreamPane } from './components/RawStreamPane';
import { ApplicationBoardPane } from './components/ApplicationBoardPane';
import { AuditInspectorPane } from './components/AuditInspectorPane';
import { FollowUpModal } from './components/FollowUpModal';

export const App: React.FC = () => {
  const [emails] = useState<Email[]>(INITIAL_EMAILS);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [rules, setRules] = useState<DeterministicRule[]>(INITIAL_RULES);

  const [selectedEmailId, setSelectedEmailId] = useState<string>('msg-palantir-challenge');
  const [selectedAppId, setSelectedAppId] = useState<string>('app-palantir');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [followUpApp, setFollowUpApp] = useState<Application | null>(null);

  // Derived filtered applications
  const filteredApps = applications.filter((app) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.company.toLowerCase().includes(q) ||
      app.role.toLowerCase().includes(q) ||
      app.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const selectedApp = applications.find((a) => a.id === selectedAppId) || applications[0];
  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  // Handlers
  const handleSelectEmail = (email: Email) => {
    setSelectedEmailId(email.id);
    const parentApp = applications.find((a) => a.id === email.applicationId);
    if (parentApp) {
      setSelectedAppId(parentApp.id);
    }
  };

  const handleSelectApplication = (app: Application) => {
    setSelectedAppId(app.id);
    if (app.emails.length > 0) {
      setSelectedEmailId(app.emails[0].id);
    }
  };

  const handleSelectPalantir = () => {
    setSelectedAppId('app-palantir');
    setSelectedEmailId('msg-palantir-challenge');
    setSearchQuery('');
  };

  const handleAddRule = (newRule: DeterministicRule) => {
    setRules((prev) => [newRule, ...prev]);
  };

  const handleStageChange = (appId: string, newStage: Application['stage']) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        return {
          ...app,
          stage: newStage,
          currentStatus: `Manually classified to ${newStage.replace('_', ' ')}`,
        };
      })
    );
  };

  // Operational metrics
  const activeCount = applications.filter((a) => a.stage === 'in_progress').length;
  const needsActionCount = applications.filter((a) => a.stage === 'needs_action').length;
  const overridesCount = emails.filter((e) => e.decisionSource === 'guardrail_override').length;
  const archivedCount = emails.filter((e) => e.isArchived).length;
  const ghostedCount = applications.filter((a) => a.stage === 'ghosted').length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans select-none">
      {/* Global Application Header */}
      <Header
        activeCount={activeCount}
        needsActionCount={needsActionCount}
        overridesCount={overridesCount}
        archivedCount={archivedCount}
        ghostedCount={ghostedCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectPalantir={handleSelectPalantir}
      />

      {/* 3-Column Operational Command Center */}
      <main className="flex-1 flex overflow-hidden">
        {/* Pane 1: Raw Unstructured Stream */}
        <RawStreamPane
          emails={emails}
          selectedEmailId={selectedEmailId}
          onSelectEmail={handleSelectEmail}
        />

        {/* Pane 2: The Application Ontology Board */}
        <ApplicationBoardPane
          applications={filteredApps}
          selectedAppId={selectedAppId}
          onSelectApplication={handleSelectApplication}
          onOpenFollowUpModal={setFollowUpApp}
        />

        {/* Pane 3: "AI Reads, Code Decides" Inspector */}
        <AuditInspectorPane
          application={selectedApp}
          selectedEmail={selectedEmail}
          rules={rules}
          onAddRule={handleAddRule}
          onStageChange={handleStageChange}
        />
      </main>

      {/* Contextual Nudge / Follow-Up Modal */}
      {followUpApp && (
        <FollowUpModal
          application={followUpApp}
          onClose={() => setFollowUpApp(null)}
        />
      )}
    </div>
  );
};

export default App;
