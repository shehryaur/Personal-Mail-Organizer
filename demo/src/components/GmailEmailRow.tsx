import React from 'react';
import type { Email } from '../types';
import { getCountdown, formatNiceDate } from '../utils/dateUtils';
import { Star, Clock, ShieldAlert, Archive, Trash2, Mail, CheckSquare, Square } from 'lucide-react';

interface GmailEmailRowProps {
  email: Email;
  isSelected: boolean;
  isChecked: boolean;
  onToggleCheck: (e: React.MouseEvent) => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onArchive: (e: React.MouseEvent) => void;
}

export const GmailEmailRow: React.FC<GmailEmailRowProps> = ({
  email,
  isSelected,
  isChecked,
  onToggleCheck,
  onToggleStar,
  onSelect,
  onArchive,
}) => {
  const countdown = email.deadlineResolved ? getCountdown(email.deadlineResolved) : null;
  const isPalantir = email.company.toLowerCase().includes('palantir');

  return (
    <div
      onClick={onSelect}
      className={`email-row-item group flex items-center gap-3 px-6 py-3 border-b border-[#f2f4f8] cursor-pointer transition-colors text-sm select-none ${
        isSelected
          ? 'bg-[#c2e7ff]/30 hover:bg-[#c2e7ff]/40'
          : email.isArchived
          ? 'bg-white opacity-60 hover:opacity-100 hover:bg-[#f6f8fc]'
          : 'bg-white hover:bg-[#f6f8fc]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleCheck}
        className="p-1 rounded text-[#747775] hover:text-[#1f1f1f] cursor-pointer"
        aria-label="Select"
      >
        {isChecked ? (
          <CheckSquare className="w-4 h-4 text-[#0b57d0]" />
        ) : (
          <Square className="w-4 h-4 text-[#c4c7c5] hover:text-[#747775]" />
        )}
      </button>

      {/* Star */}
      <button
        onClick={onToggleStar}
        className="p-1 rounded text-[#747775] hover:text-[#f4b400] cursor-pointer"
        aria-label="Star"
      >
        <Star
          className={`w-4 h-4 transition-colors ${
            email.isStarred ? 'fill-[#f4b400] text-[#f4b400]' : 'text-[#c4c7c5] hover:text-[#747775]'
          }`}
        />
      </button>

      {/* Sender Column */}
      <div className="w-52 shrink-0 truncate flex items-center gap-1.5">
        <span className={`truncate text-sm ${email.actionNeeded ? 'font-semibold text-[#1f1f1f]' : 'text-[#444746]'}`}>
          {email.company}
        </span>
        {isPalantir && (
          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#e8def8] text-[#4a4458] shrink-0">
            Show & Tell
          </span>
        )}
      </div>

      {/* Subject & Snippet & Deadline Tags */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span
          className={`truncate text-sm ${
            email.actionNeeded ? 'font-semibold text-[#1f1f1f]' : 'font-normal text-[#1f1f1f]'
          }`}
        >
          {email.subject}
        </span>
        <span className="text-xs text-[#747775] truncate shrink max-w-sm hidden md:inline">
          — {email.snippet}
        </span>

        {/* Minimalist Deadline Pill */}
        {countdown && !countdown.isPassed && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
              countdown.isUrgent
                ? 'bg-[#fce8e6] text-[#c5221f] border border-[#f5c2c7]'
                : 'bg-[#fef7e0] text-[#b06000] border border-[#fce8b2]'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{countdown.text}</span>
          </span>
        )}

        {/* Safety Guardrail Override Pill */}
        {email.decisionSource === 'guardrail_override' && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#e8f0fe] text-[#1967d2] border border-[#aecbfa] shrink-0"
            title="Deterministic rule overrode LLM to prevent missed interview"
          >
            <ShieldAlert className="w-3 h-3 text-[#1967d2]" />
            <span>Guardrail Protected</span>
          </span>
        )}
      </div>

      {/* Right Column: Date or Quick Actions on Hover */}
      <div className="w-24 shrink-0 text-right flex items-center justify-end">
        {/* Quick action buttons on hover */}
        <div className="hidden group-hover:flex items-center gap-1 text-[#444746]">
          <button
            onClick={onArchive}
            className="p-1 rounded-full hover:bg-[#eaebef] text-[#444746]"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button className="p-1 rounded-full hover:bg-[#eaebef] text-[#444746]" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-1 rounded-full hover:bg-[#eaebef] text-[#444746]" title="Mark as unread">
            <Mail className="w-4 h-4" />
          </button>
        </div>

        {/* Normal Date display */}
        <span className="group-hover:hidden text-xs text-[#747775] font-mono">
          {formatNiceDate(email.receivedAt)}
        </span>
      </div>
    </div>
  );
};
