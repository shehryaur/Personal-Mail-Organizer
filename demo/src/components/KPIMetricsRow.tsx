import React from 'react';
import { Clock, ShieldCheck, UserX, Layers, ChevronRight } from 'lucide-react';

interface KPIMetricsRowProps {
  urgentCount: number;
  interviewCount: number;
  overrideCount: number;
  ghostedCount: number;
  activeFilter: string | null;
  onFilterSelect: (filter: string | null) => void;
}

export const KPIMetricsRow: React.FC<KPIMetricsRowProps> = ({
  urgentCount,
  interviewCount,
  overrideCount,
  ghostedCount,
  activeFilter,
  onFilterSelect,
}) => {
  const cards = [
    {
      id: 'urgent',
      label: 'Impending Deadlines',
      value: urgentCount,
      subtext: 'Palantir, Scale AI, Anduril',
      icon: Clock,
      color: '#b06000',
      bgColor: '#fef7e0',
      borderColor: '#fce8b2',
      activeRing: 'ring-[#e37400] bg-[#fff8e1]',
    },
    {
      id: 'interview',
      label: 'Interviews & Screens',
      value: interviewCount,
      subtext: 'Stripe, Linear active loops',
      icon: Layers,
      color: '#0b57d0',
      bgColor: '#eaf1fb',
      borderColor: '#c2e7ff',
      activeRing: 'ring-[#0b57d0] bg-[#e3edfc]',
    },
    {
      id: 'override',
      label: 'Guardrail Protection',
      value: `${overrideCount} Active`,
      subtext: 'Overrode AI false rejection',
      icon: ShieldCheck,
      color: '#137333',
      bgColor: '#e6f4ea',
      borderColor: '#ceead6',
      activeRing: 'ring-[#137333] bg-[#dcf3e3]',
    },
    {
      id: 'ghosted',
      label: 'Silent Pipelines (>21d)',
      value: ghostedCount,
      subtext: 'Figma, Airbnb stale',
      icon: UserX,
      color: '#c5221f',
      bgColor: '#fce8e6',
      borderColor: '#f5c2c7',
      activeRing: 'ring-[#c5221f] bg-[#fadbd8]',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 select-none">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = activeFilter === c.id;

        return (
          <button
            key={c.id}
            onClick={() => onFilterSelect(isActive ? null : c.id)}
            className={`p-3.5 rounded-xl border text-left transition-all duration-300 cursor-pointer relative group flex flex-col justify-between ${
              isActive
                ? `${c.activeRing} shadow-sm ring-2`
                : 'bg-white border-[#e0e2ec] hover:border-[#bdc1c6] hover:shadow-xs'
            }`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-xs font-medium text-[#444746] truncate">{c.label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ backgroundColor: c.bgColor, color: c.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>

            {/* Big bold metric number (Logistics Dashboard style) */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xl font-bold tracking-tight text-[#1f1f1f]">{c.value}</span>
              {isActive && (
                <span className="text-[10px] font-medium text-[#0b57d0] bg-[#c2e7ff] px-1.5 py-0.2 rounded-full">
                  Filtered
                </span>
              )}
            </div>

            {/* Bottom Subtext */}
            <div className="flex items-center justify-between text-[11px] text-[#747775]">
              <span className="truncate">{c.subtext}</span>
              <ChevronRight className="w-3 h-3 text-[#c4c7c5] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        );
      })}
    </div>
  );
};
