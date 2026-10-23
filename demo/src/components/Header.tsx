import React from 'react';
import { ShieldCheck, Clock, Archive, UserX, Sparkles, Layers } from 'lucide-react';

interface HeaderProps {
  activeCount: number;
  needsActionCount: number;
  overridesCount: number;
  archivedCount: number;
  ghostedCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectPalantir: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  needsActionCount,
  overridesCount,
  archivedCount,
  ghostedCount,
  searchQuery,
  onSearchChange,
  onSelectPalantir,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
      {/* Title & Challenge Badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
          J
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-slate-100 text-sm tracking-wide">
              Job Application Triage Cockpit
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
              Palantir Show & Tell (Lens A)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Core Thesis: <span className="text-slate-200 font-medium">"AI only reads. Code decides."</span>
          </p>
        </div>
      </div>

      {/* Operational Metrics Bar */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Needs Action:</span>
          <strong className="text-amber-400">{needsActionCount}</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>In Progress:</span>
          <strong className="text-blue-400">{activeCount}</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Guardrail Overrides:</span>
          <strong className="text-emerald-400">{overridesCount}</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
          <UserX className="w-3.5 h-3.5 text-orange-400" />
          <span>Likely Ghosted:</span>
          <strong className="text-orange-400">{ghostedCount}</strong>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
          <Archive className="w-3.5 h-3.5 text-slate-400" />
          <span>Auto-Archived:</span>
          <strong className="text-slate-300">{archivedCount}</strong>
        </div>
      </div>

      {/* Search & Fast Jump Hook */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Filter company, role, regex..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-56 bg-slate-950 border border-slate-800 rounded px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>

        <button
          onClick={onSelectPalantir}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium px-3 py-1 rounded text-xs transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
          title="Inspect the Palantir 'within 7 days' challenge email"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Inspect Palantir Challenge</span>
        </button>
      </div>
    </header>
  );
};
