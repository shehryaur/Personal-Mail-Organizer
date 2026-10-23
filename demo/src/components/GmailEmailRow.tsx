import React from 'react';
import type { Email } from '../types';
import { getCountdown } from '../utils/dateUtils';
import { Icon } from './Icon';
import { Chip } from './Visuals';

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
      className={`email-row-item group flex items-center gap-3 pl-4 pr-4 h-10 border-b border-[#f2f4f8] cursor-pointer text-sm select-none hover:relative hover:z-[1] hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] ${
        isSelected
          ? 'bg-[#c2dbff]'
          : email.isArchived
          ? 'bg-[#f2f6fc]'
          : 'bg-white'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleCheck}
        className="p-1 rounded text-[#747775] hover:text-[#1f1f1f] cursor-pointer"
        aria-label="Select"
      >
        {isChecked ? (
          <Icon name="check_box" size={20} fill className="text-[#0b57d0]" />
        ) : (
          <Icon name="check_box_outline_blank" size={20} className="text-[#747775]" />
        )}
      </button>

      {/* Star */}
      <button
        onClick={onToggleStar}
        className="p-1 rounded text-[#747775] hover:text-[#f4b400] cursor-pointer"
        aria-label="Star"
      >
        <Icon name="star" size={20} fill={email.isStarred} className={email.isStarred ? 'text-[#f4b400]' : 'text-[#747775] hover:text-[#1f1f1f]'} />
      </button>

      {/* Sender Column */}
      <div className="w-[200px] shrink-0 truncate flex items-center gap-1.5 pl-2">
        <span className={`truncate text-sm ${email.actionNeeded ? 'font-semibold text-[#1f1f1f]' : 'text-[#444746]'}`}>
          {email.company}
        </span>
        {isPalantir && (
          <Chip tone="purple" shape="label">Show & Tell</Chip>
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
          <Chip tone={countdown.isUrgent ? 'red' : 'yellow'} icon="schedule" shape="label">
            {countdown.text}
          </Chip>
        )}

        {/* Safety Guardrail Override Pill */}
        {email.decisionSource === 'guardrail_override' && (
          <Chip tone="green" icon="verified_user" shape="label" title="A booking link kept this in the inbox">
            Guardrail
          </Chip>
        )}
      </div>

      {/* Right Column: Date or Quick Actions on Hover */}
      <div className="w-24 shrink-0 text-right flex items-center justify-end">
        {/* Quick action buttons on hover */}
        <div className="hidden group-hover:flex items-center gap-1 text-[#444746]">
          <button
            onClick={onArchive}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#eaebef] text-[#444746]"
            title="Archive"
          >
            <Icon name="archive" size={20} />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#eaebef] text-[#444746]" title="Delete">
            <Icon name="delete" size={20} />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#eaebef] text-[#444746]" title="Mark as unread">
            <Icon name="mark_email_unread" size={20} />
          </button>
        </div>

        {/* Normal Date display */}
        <span className={`group-hover:hidden text-xs ${email.actionNeeded ? 'font-semibold text-[#1f1f1f]' : 'text-[#444746]'}`}>
          {new Date(email.receivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
};
