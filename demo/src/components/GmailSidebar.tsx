import React from 'react';
import { Icon } from './Icon';

type Tab = 'jobs' | 'inbox' | 'starred' | 'review';

interface GmailSidebarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  urgentCount: number;
  totalJobsCount: number;
}

// Gmail nav item: 32px pill, icon + label + count
const NavItem: React.FC<{
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  bold?: boolean;
  onClick?: () => void;
}> = ({ icon, label, count, active, bold, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full h-8 flex items-center pl-[26px] pr-3 rounded-full text-sm cursor-pointer ${
      active ? 'bg-[#d3e3fd] text-[#001d35] font-bold' : `text-[#1f1f1f] hover:bg-[#e8eaed] ${bold ? 'font-bold' : ''}`
    }`}
  >
    <Icon name={icon} size={20} fill={active} className="mr-[18px]" />
    <span className="flex-1 text-left truncate">{label}</span>
    {count !== undefined && count > 0 && (
      <span className={`text-xs ${active || bold ? 'font-bold' : ''}`}>{count.toLocaleString()}</span>
    )}
  </button>
);

export const GmailSidebar: React.FC<GmailSidebarProps> = ({
  currentTab,
  onTabChange,
  urgentCount,
  totalJobsCount,
}) => {
  return (
    <aside className="w-[256px] bg-[#f6f8fc] flex flex-col h-full pr-4 select-none shrink-0 overflow-y-auto">
      <button className="ml-2 mt-2 mb-4 h-14 min-w-[138px] self-start pl-4 pr-6 bg-[#c2e7ff] hover:shadow-[0_1px_3px_0_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] text-[#001d35] rounded-2xl flex items-center gap-3 text-sm font-medium font-gs cursor-pointer">
        <Icon name="edit" size={24} />
        Compose
      </button>

      <nav>
        <NavItem
          icon="work"
          label="Jobs Board"
          count={urgentCount}
          bold
          active={currentTab === 'jobs'}
          onClick={() => onTabChange('jobs')}
        />
        <NavItem
          icon="inbox"
          label="Inbox"
          count={totalJobsCount}
          active={currentTab === 'inbox'}
          onClick={() => onTabChange('inbox')}
        />
        <NavItem icon="star" label="Starred" active={currentTab === 'starred'} onClick={() => onTabChange('starred')} />
        <NavItem
          icon="error"
          label="Needs review"
          count={1}
          active={currentTab === 'review'}
          onClick={() => onTabChange('review')}
        />
        <NavItem icon="schedule" label="Snoozed" />
        <NavItem icon="send" label="Sent" />
        <NavItem icon="draft" label="Drafts" />
      </nav>
    </aside>
  );
};
