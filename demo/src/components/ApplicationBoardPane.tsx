import React, { useState } from 'react';
import type { Application } from '../types';
import { getCountdown, formatNiceDate } from '../utils/dateUtils';
import {
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  UserX,
  Send,
} from 'lucide-react';

interface ApplicationBoardPaneProps {
  applications: Application[];
  selectedAppId: string;
  onSelectApplication: (app: Application) => void;
  onOpenFollowUpModal: (app: Application) => void;
}

export const ApplicationBoardPane: React.FC<ApplicationBoardPaneProps> = ({
  applications,
  selectedAppId,
  onSelectApplication,
  onOpenFollowUpModal,
}) => {
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({
    'app-palantir': true,
    'app-stripe': true,
  });

  const toggleTimeline = (e: React.MouseEvent, appId: string) => {
    e.stopPropagation();
    setExpandedTimelines((prev) => ({
      ...prev,
      [appId]: !prev[appId],
    }));
  };

  const needsActionApps = applications.filter((a) => a.stage === 'needs_action');
  const inProgressApps = applications.filter((a) => a.stage === 'in_progress');
  const ghostedApps = applications.filter((a) => a.stage === 'ghosted');
  const closedApps = applications.filter((a) => a.stage === 'closed');

  return (
    <div className="flex-1 bg-slate-900 flex flex-col h-full overflow-hidden">
      {/* Board Top Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Application Entity Board (Ontology Model)
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          <span>Entity Resolution: </span>
          <strong className="text-blue-400">{applications.length} applications</strong> linked from{' '}
          <strong className="text-slate-200">
            {applications.reduce((acc, a) => acc + a.emails.length, 0)} emails
          </strong>
        </div>
      </div>

      {/* 4 Swimlane Columns (Horizontal Scrollable Grid) */}
      <div className="flex-1 p-4 overflow-x-auto grid grid-cols-4 gap-4 min-w-[1050px]">
        {/* COLUMN 1: Needs Action (Top Priority with Countdowns) */}
        <div className="flex flex-col bg-slate-950/70 border border-red-950/40 rounded-lg p-2.5 overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-rose-400">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>Needs Action</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 font-mono text-[10px] border border-rose-800/60">
              {needsActionApps.length} urgent
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {needsActionApps.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                isSelected={app.id === selectedAppId}
                isExpanded={Boolean(expandedTimelines[app.id])}
                onSelect={() => onSelectApplication(app)}
                onToggleTimeline={(e) => toggleTimeline(e, app.id)}
                onOpenFollowUpModal={onOpenFollowUpModal}
              />
            ))}
          </div>
        </div>

        {/* COLUMN 2: In Progress */}
        <div className="flex flex-col bg-slate-950/70 border border-blue-950/40 rounded-lg p-2.5 overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-blue-400">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>In Progress</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 font-mono text-[10px] border border-blue-800/60">
              {inProgressApps.length} active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {inProgressApps.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                isSelected={app.id === selectedAppId}
                isExpanded={Boolean(expandedTimelines[app.id])}
                onSelect={() => onSelectApplication(app)}
                onToggleTimeline={(e) => toggleTimeline(e, app.id)}
                onOpenFollowUpModal={onOpenFollowUpModal}
              />
            ))}
          </div>
        </div>

        {/* COLUMN 3: Likely Ghosted */}
        <div className="flex flex-col bg-slate-950/70 border border-orange-950/40 rounded-lg p-2.5 overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-orange-400">
              <UserX className="w-3.5 h-3.5 text-orange-400" />
              <span>Likely Ghosted (&gt;21d)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-orange-950/80 text-orange-300 font-mono text-[10px] border border-orange-800/60">
              {ghostedApps.length} stale
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {ghostedApps.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                isSelected={app.id === selectedAppId}
                isExpanded={Boolean(expandedTimelines[app.id])}
                onSelect={() => onSelectApplication(app)}
                onToggleTimeline={(e) => toggleTimeline(e, app.id)}
                onOpenFollowUpModal={onOpenFollowUpModal}
              />
            ))}
          </div>
        </div>

        {/* COLUMN 4: Closed / Archived */}
        <div className="flex flex-col bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 overflow-hidden opacity-85">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Closed & Archived</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
              {closedApps.length} archived
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {closedApps.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                isSelected={app.id === selectedAppId}
                isExpanded={Boolean(expandedTimelines[app.id])}
                onSelect={() => onSelectApplication(app)}
                onToggleTimeline={(e) => toggleTimeline(e, app.id)}
                onOpenFollowUpModal={onOpenFollowUpModal}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ApplicationCardProps {
  app: Application;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleTimeline: (e: React.MouseEvent) => void;
  onOpenFollowUpModal: (app: Application) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  app,
  isSelected,
  isExpanded,
  onSelect,
  onToggleTimeline,
  onOpenFollowUpModal,
}) => {
  const countdown = app.deadline ? getCountdown(app.deadline) : null;
  const isPalantir = app.company.toLowerCase().includes('palantir');

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-3 cursor-pointer text-left transition-all ${
        isSelected
          ? 'bg-slate-900 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
      } ${isPalantir ? 'ring-1 ring-indigo-500/50 bg-gradient-to-b from-slate-900 to-indigo-950/20' : ''}`}
    >
      {/* Card Header: Company, Palantir Star, Deadline Badge */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-slate-100">{app.company}</span>
            {isPalantir && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-900 text-indigo-300 font-mono font-bold">
                HOOK
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 font-medium">{app.role}</div>
        </div>

        {/* Live Countdown Badge */}
        {countdown && !countdown.isPassed && (
          <div
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 shadow-sm ${
              countdown.isUrgent
                ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                : 'bg-amber-950 text-amber-300 border border-amber-800/80'
            }`}
            title={`Deadline: ${app.deadlineRaw}`}
          >
            {countdown.text}
          </div>
        )}
      </div>

      {/* Current Status Line */}
      <div className="text-xs text-slate-300 mb-2 font-mono flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
        <span className="truncate">{app.currentStatus}</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {app.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/50"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Timeline Toggle & Action Row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
        <button
          onClick={onToggleTimeline}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-pointer font-mono"
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>{app.emails.length} email{app.emails.length > 1 ? 's' : ''}</span>
        </button>

        {app.stage === 'ghosted' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFollowUpModal(app);
            }}
            className="flex items-center gap-1 text-[11px] bg-orange-950 hover:bg-orange-900 text-orange-300 border border-orange-700/60 px-2 py-0.5 rounded font-mono cursor-pointer transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Nudge (Follow-Up)</span>
          </button>
        )}
      </div>

      {/* Expanded Multi-Turn Email Timeline (Entity Resolution) */}
      {isExpanded && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 space-y-1.5 pl-2 border-l border-slate-700">
          <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider mb-1">
            Chronological Events
          </div>
          {app.emails.map((m) => (
            <div
              key={m.id}
              className="text-[11px] bg-slate-950/80 rounded p-1.5 border border-slate-800"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                <span className="font-semibold text-slate-300 truncate max-w-[140px]">{m.from}</span>
                <span className="font-mono">{formatNiceDate(m.receivedAt)}</span>
              </div>
              <div className="text-slate-300 font-medium truncate text-[11px]">{m.subject}</div>
              {m.deadlineRaw && (
                <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                  ⏱ "{m.deadlineRaw}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
