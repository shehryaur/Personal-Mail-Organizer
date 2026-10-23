import React from 'react';
import { Menu, Search, SlidersHorizontal, HelpCircle, Settings, Grid3X3 } from 'lucide-react';

interface GmailNavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPalantirQuickJump: () => void;
}

export const GmailNavbar: React.FC<GmailNavbarProps> = ({
  searchQuery,
  onSearchChange,
  onPalantirQuickJump,
}) => {
  return (
    <header className="h-16 px-4 bg-[#f6f8fc] flex items-center justify-between gap-4 select-none shrink-0 border-b border-[#f0f4f9]">
      {/* Left: Hamburger & Gmail Logo */}
      <div className="flex items-center gap-4 w-60 shrink-0">
        <button
          className="p-2.5 rounded-full hover:bg-[#e9eef6] text-[#444746] transition-colors cursor-pointer"
          aria-label="Main menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 cursor-pointer">
          {/* Minimalist SVG Gmail Icon */}
          <svg className="w-7 h-7" viewBox="0 0 24 24">
            <path
              fill="#ea4335"
              d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
            />
          </svg>
          <span className="text-[21px] text-[#444746] font-normal tracking-tight font-sans">
            Gmail
          </span>
          <span className="ml-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#c2e7ff] text-[#001d35]">
            Jobs Triage
          </span>
        </div>
      </div>

      {/* Center: Material Design 3 Search Pill */}
      <div className="flex-1 max-w-2xl flex items-center">
        <div className="w-full h-11 bg-[#eaf1fb] hover:bg-[#dfe8f6] focus-within:bg-white focus-within:shadow-md focus-within:ring-1 focus-within:ring-[#0b57d0] rounded-full flex items-center px-4 transition-all">
          <Search className="w-5 h-5 text-[#444746] shrink-0" />
          <input
            type="text"
            placeholder="Search mail or jobs (e.g. 'Palantir', 'interview', '48h')"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent border-none outline-none px-3 text-sm text-[#1f1f1f] placeholder-[#444746]"
          />
          <button
            className="p-1 rounded-full text-[#444746] hover:bg-black/5 cursor-pointer"
            title="Search options"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Quick Jump & User Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onPalantirQuickJump}
          className="h-9 px-3.5 bg-white hover:bg-[#f8fafd] text-[#0b57d0] border border-[#c2e7ff] rounded-full text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#0b57d0]"></span>
          <span>Palantir Challenge</span>
        </button>

        <button className="p-2 rounded-full hover:bg-[#e9eef6] text-[#444746] transition-colors cursor-pointer">
          <HelpCircle className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full hover:bg-[#e9eef6] text-[#444746] transition-colors cursor-pointer">
          <Settings className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full hover:bg-[#e9eef6] text-[#444746] transition-colors cursor-pointer">
          <Grid3X3 className="w-5 h-5" />
        </button>

        <div className="w-8 h-8 rounded-full bg-[#7c3aed] text-white flex items-center justify-center font-medium text-sm ml-1 shadow-2xs">
          S
        </div>
      </div>
    </header>
  );
};
