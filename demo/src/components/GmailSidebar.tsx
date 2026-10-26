import React from 'react';
import { Icon } from './Icon';

export type Tab = 'tracker' | 'inbox';

interface GmailSidebarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  todoCount: number;
  inboxCount: number;
}

// Gmail nav item: 32px pill, icon + label + count
const NavItem: React.FC<{
  icon: string;
  label: string;
  count?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon, label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full h-8 flex items-center pl-[26px] pr-3 rounded-full text-sm cursor-pointer ${
      active ? 'bg-[#d3e3fd] text-[#001d35] font-bold' : 'text-[#1f1f1f] hover:bg-[#e8eaed]'
    }`}
  >
    <Icon name={icon} size={20} fill={active} className="mr-[18px]" />
    <span className="flex-1 text-left truncate">{label}</span>
    {count}
  </button>
);

export const GmailSidebar: React.FC<GmailSidebarProps> = ({ currentTab, onTabChange, todoCount, inboxCount }) => (
  <aside className="hidden md:flex w-[256px] bg-[#f6f8fc] flex-col h-full pr-4 select-none shrink-0 overflow-y-auto">
    <button className="ml-2 mt-2 mb-4 h-14 min-w-[138px] self-start pl-4 pr-6 bg-[#c2e7ff] text-[#001d35] rounded-2xl flex items-center gap-3 text-sm font-medium font-gs cursor-pointer">
      <Icon name="edit" size={24} />
      Compose
    </button>
    <nav>
      <NavItem icon="inbox" label="Inbox" active={currentTab === 'inbox'} onClick={() => onTabChange('inbox')}
        count={<span className="text-xs font-bold">{inboxCount}</span>} />
      <NavItem icon="star" label="Starred" onClick={() => onTabChange('inbox')} />
      <NavItem icon="schedule" label="Snoozed" onClick={() => onTabChange('inbox')} />
      <NavItem icon="send" label="Sent" onClick={() => onTabChange('inbox')} />
      <NavItem icon="draft" label="Drafts" onClick={() => onTabChange('inbox')} />
      <div className="h-px bg-[#dde1e6] my-2 ml-[26px] mr-3" />
      <NavItem icon="work" label="Job Tracker" active={currentTab === 'tracker'} onClick={() => onTabChange('tracker')}
        count={todoCount > 0 && <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-[#d4f24a] text-[#1b1b1b] text-[11px] font-bold grid place-items-center">{todoCount}</span>} />
    </nav>
  </aside>
);
