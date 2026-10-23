import React from 'react';
import { Icon } from './Icon';

interface GmailNavbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const IconButton: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <button
    className="w-12 h-12 flex items-center justify-center rounded-full text-[#444746] hover:bg-[#e9eef6] cursor-pointer"
    aria-label={label}
    title={label}
  >
    <Icon name={icon} size={24} />
  </button>
);

export const GmailNavbar: React.FC<GmailNavbarProps> = ({ searchQuery, onSearchChange }) => {
  return (
    <header className="h-16 pl-2 pr-2 bg-[#f6f8fc] flex items-center gap-2 select-none shrink-0 font-gs">
      {/* Left: menu + logo, same width as the sidebar below it */}
      <div className="flex items-center w-[238px] shrink-0">
        <IconButton icon="menu" label="Main menu" />
        <div className="flex items-center gap-2 pl-1 cursor-pointer">
          <svg width="30" height="23" viewBox="52 42 88 66" aria-hidden="true">
            <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
            <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
            <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
            <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
            <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
          </svg>
          <span className="text-[22px] leading-6 text-[#444746]">Gmail</span>
        </div>
      </div>

      {/* Search pill */}
      <div className="flex-1 max-w-[720px] h-12 bg-[#e9eef6] focus-within:bg-white focus-within:shadow-[0_1px_1px_0_rgba(65,69,73,.3),0_1px_3px_1px_rgba(65,69,73,.15)] rounded-full flex items-center pl-1 pr-1">
        <IconButton icon="search" label="Search" />
        <input
          type="text"
          placeholder="Search mail"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-base text-[#1f1f1f] placeholder-[#444746]"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#444746] hover:bg-black/5 cursor-pointer"
            aria-label="Clear search"
          >
            <Icon name="close" size={24} />
          </button>
        )}
        <IconButton icon="tune" label="Show search options" />
      </div>

      {/* Right: help, settings, apps, account */}
      <div className="ml-auto flex items-center shrink-0">
        <IconButton icon="help" label="Support" />
        <IconButton icon="settings" label="Settings" />
        <IconButton icon="apps" label="Google apps" />
        <div className="w-12 h-12 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[#9334e6] text-white flex items-center justify-center text-sm font-medium">
            S
          </div>
        </div>
      </div>
    </header>
  );
};
