import React, { useState } from 'react';
import type { Email } from '../types';
import { formatNiceDate, getCountdown } from '../utils/dateUtils';
import { Star, Archive, AlertCircle, ShieldAlert, Inbox } from 'lucide-react';

interface RawStreamPaneProps {
  emails: Email[];
  selectedEmailId: string;
  onSelectEmail: (email: Email) => void;
}

export const RawStreamPane: React.FC<RawStreamPaneProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
}) => {
  const [filter, setFilter] = useState<'all' | 'starred' | 'review' | 'archived'>('all');

  const filteredEmails = emails.filter((email) => {
    if (filter === 'starred') return email.isStarred;
    if (filter === 'review') return email.stage === 'review' || email.confidence < 0.85;
    if (filter === 'archived') return email.isArchived;
    return true;
  });

  return (
    <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
      {/* Pane Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Inbox className="w-3.5 h-3.5 text-blue-400" />
          <span>Raw Ingestion Stream</span>
        </div>
        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          {filteredEmails.length} messages
        </span>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-800/80 bg-slate-900/40 text-[11px]">
        <button
          onClick={() => setFilter('all')}
          className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('starred')}
          className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
            filter === 'starred'
              ? 'bg-amber-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span>Starred</span>
        </button>
        <button
          onClick={() => setFilter('review')}
          className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
            filter === 'review'
              ? 'bg-yellow-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <AlertCircle className="w-3 h-3 text-yellow-400" />
          <span>Review</span>
        </button>
        <button
          onClick={() => setFilter('archived')}
          className={`px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
            filter === 'archived'
              ? 'bg-slate-700 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Archive className="w-3 h-3 text-slate-400" />
          <span>Archived</span>
        </button>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filteredEmails.map((email) => {
          const isSelected = email.id === selectedEmailId;
          const countdown = email.deadlineResolved ? getCountdown(email.deadlineResolved) : null;

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className={`p-3 text-left cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-950/40 border-l-2 border-blue-500 pl-2.5'
                  : 'hover:bg-slate-900/60'
              } ${email.isArchived ? 'opacity-70' : ''}`}
            >
              {/* Top Row: Sender & Date */}
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-200 truncate max-w-[170px]" title={email.from}>
                  {email.company}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatNiceDate(email.receivedAt)}
                </span>
              </div>

              {/* Subject */}
              <div className="text-xs text-slate-300 font-medium truncate mb-1" title={email.subject}>
                {email.subject}
              </div>

              {/* Snippet */}
              <div className="text-[11px] text-slate-500 line-clamp-1 mb-2 font-mono">
                {email.snippet}
              </div>

              {/* Metadata Badges & Guardrail Flags */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {/* Stage Tag */}
                <span
                  className={`px-1.5 py-0.5 rounded uppercase font-mono font-medium ${
                    email.stage === 'assessment'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                      : email.stage === 'interview'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : email.stage === 'rejected'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                      : email.stage === 'review'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {email.stage}
                </span>

                {/* Relative Deadline Countdown Badge */}
                {countdown && !countdown.isPassed && (
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono font-semibold ${
                      countdown.isUrgent
                        ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                        : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    }`}
                  >
                    ⏳ {countdown.text}
                  </span>
                )}

                {/* Guardrail Override Indicator */}
                {email.decisionSource === 'guardrail_override' && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-600/60 font-mono font-semibold"
                    title="Safety guardrail overrode LLM classification to prevent missed interview!"
                  >
                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                    <span>OVERRIDE</span>
                  </span>
                )}

                {/* Starred indicator */}
                {email.isStarred && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0 ml-auto" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
