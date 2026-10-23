import React from 'react';
import {
  Inbox,
  Star,
  Clock,
  Send,
  FileText,
  Briefcase,
  ChevronRight,
  Pencil,
  AlertCircle,
} from 'lucide-react';

interface GmailSidebarProps {
  currentTab: 'jobs' | 'inbox' | 'starred' | 'review';
  onTabChange: (tab: 'jobs' | 'inbox' | 'starred' | 'review') => void;
  urgentCount: number;
  totalJobsCount: number;
}

export const GmailSidebar: React.FC<GmailSidebarProps> = ({
  currentTab,
  onTabChange,
  urgentCount,
  totalJobsCount,
}) => {
  return (
    <aside className="w-64 bg-[#f6f8fc] flex flex-col h-full py-3 px-3 select-none shrink-0 overflow-y-auto">
      {/* Compose Pill Button */}
      <button className="h-14 w-36 bg-[#c2e7ff] hover:bg-[#b3ddff] hover:shadow-md text-[#001d35] rounded-2xl flex items-center justify-center gap-3 text-sm font-medium transition-all mb-4 shadow-xs cursor-pointer">
        <Pencil className="w-5 h-5 text-[#001d35]" />
        <span>Compose</span>
      </button>

      {/* Main Mail Folders */}
      <nav className="space-y-0.5 text-sm">
        {/* The Dedicated Jobs Triage Tab (Palantir Show & Tell Feature) */}
        <button
          onClick={() => onTabChange('jobs')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full font-medium transition-colors cursor-pointer ${
            currentTab === 'jobs'
              ? 'bg-[#d3e3fd] text-[#041e49] font-semibold'
              : 'text-[#444746] hover:bg-[#eaebef]'
          }`}
        >
          <div className="flex items-center gap-4">
            <Briefcase className="w-5 h-5 text-[#0b57d0]" />
            <span>Jobs Board</span>
          </div>
          {urgentCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#b3261e] text-white">
              {urgentCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('inbox')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full font-medium transition-colors cursor-pointer ${
            currentTab === 'inbox'
              ? 'bg-[#d3e3fd] text-[#041e49] font-semibold'
              : 'text-[#444746] hover:bg-[#eaebef]'
          }`}
        >
          <div className="flex items-center gap-4">
            <Inbox className="w-5 h-5" />
            <span>Inbox</span>
          </div>
          <span className="text-xs font-mono text-[#444746]">{totalJobsCount}</span>
        </button>

        <button
          onClick={() => onTabChange('starred')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full font-medium transition-colors cursor-pointer ${
            currentTab === 'starred'
              ? 'bg-[#d3e3fd] text-[#041e49] font-semibold'
              : 'text-[#444746] hover:bg-[#eaebef]'
          }`}
        >
          <div className="flex items-center gap-4">
            <Star className="w-5 h-5" />
            <span>Starred</span>
          </div>
        </button>

        <button
          onClick={() => onTabChange('review')}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full font-medium transition-colors cursor-pointer ${
            currentTab === 'review'
              ? 'bg-[#d3e3fd] text-[#041e49] font-semibold'
              : 'text-[#444746] hover:bg-[#eaebef]'
          }`}
        >
          <div className="flex items-center gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>Jobs/Review</span>
          </div>
          <span className="text-xs font-mono text-amber-700 font-semibold">1</span>
        </button>

        <div className="w-full flex items-center gap-4 px-4 py-2.5 text-[#444746] rounded-full hover:bg-[#eaebef] cursor-pointer">
          <Clock className="w-5 h-5" />
          <span>Snoozed</span>
        </div>

        <div className="w-full flex items-center gap-4 px-4 py-2.5 text-[#444746] rounded-full hover:bg-[#eaebef] cursor-pointer">
          <Send className="w-5 h-5" />
          <span>Sent</span>
        </div>

        <div className="w-full flex items-center gap-4 px-4 py-2.5 text-[#444746] rounded-full hover:bg-[#eaebef] cursor-pointer">
          <FileText className="w-5 h-5" />
          <span>Drafts</span>
        </div>
      </nav>

      {/* Gmail Labels Section */}
      <div className="mt-6 pt-4 border-t border-[#e0e2ec]">
        <div className="flex items-center justify-between px-4 text-xs font-medium text-[#444746] mb-2 uppercase tracking-wider">
          <span>Triage Labels</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
        <div className="space-y-1 text-xs text-[#444746]">
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full hover:bg-[#eaebef] cursor-pointer">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Jobs/Assessment</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full hover:bg-[#eaebef] cursor-pointer">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Jobs/Interview</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full hover:bg-[#eaebef] cursor-pointer">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            <span>Jobs/Applied</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full hover:bg-[#eaebef] cursor-pointer">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Jobs/Offer</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
