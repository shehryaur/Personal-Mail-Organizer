import React, { useState } from 'react';
import type { Application } from '../types';

interface JobAnalyticsDonutProps {
  applications: Application[];
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
}

interface Segment {
  id: string;
  label: string;
  count: number;
  color: string;
  hoverColor: string;
}

export const JobAnalyticsDonut: React.FC<JobAnalyticsDonutProps> = ({
  applications,
  selectedCategory,
  onSelectCategory,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Group applications
  const assessmentCount = applications.filter(
    (a) => a.stage === 'needs_action' || a.tags.includes('Assessment') || a.tags.includes('Take-home')
  ).length;

  const interviewCount = applications.filter(
    (a) => a.tags.includes('Interview') || a.company === 'Stripe' || a.company === 'Linear'
  ).length;

  const appliedCount = applications.filter(
    (a) => a.stage === 'in_progress' && !a.tags.includes('Interview')
  ).length;

  const selectedCount = 1; // 1 selected/offer stage
  const closedCount = applications.filter((a) => a.stage === 'closed' || a.stage === 'ghosted').length;

  const total = assessmentCount + interviewCount + appliedCount + selectedCount + closedCount || 1;

  const segments: Segment[] = [
    {
      id: 'assessment',
      label: 'Assessments & Challenges',
      count: assessmentCount,
      color: '#f59e0b', // Amber / Yellow
      hoverColor: '#d97706',
    },
    {
      id: 'interview',
      label: 'Interviews & Screens',
      count: interviewCount,
      color: '#3b82f6', // Clean Blue
      hoverColor: '#2563eb',
    },
    {
      id: 'applied',
      label: 'Applications In Review',
      count: appliedCount,
      color: '#94a3b8', // Muted Slate
      hoverColor: '#64748b',
    },
    {
      id: 'selected',
      label: 'Advancing / Matches',
      count: selectedCount,
      color: '#10b981', // Emerald / Green
      hoverColor: '#059669',
    },
    {
      id: 'closed',
      label: 'Archived / Stale',
      count: closedCount,
      color: '#cbd5e1', // Light Gray
      hoverColor: '#94a3b8',
    },
  ];

  // SVG Geometry for Donut ("O")
  const size = 110;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  const activeSegment = hoveredId
    ? segments.find((s) => s.id === hoveredId)
    : selectedCategory
    ? segments.find((s) => s.id === selectedCategory)
    : null;

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-white border border-[#e0e2ec] rounded-xl shadow-xs">
      {/* The "O" Donut Ring */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 transition-all duration-300"
        >
          {/* Base background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {segments.map((seg) => {
            const fraction = seg.count / total;
            const strokeDasharray = `${fraction * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += fraction * circumference;

            const isHovered = hoveredId === seg.id;
            const isSelected = selectedCategory === seg.id;

            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={isHovered || isSelected ? seg.hoverColor : seg.color}
                strokeWidth={isHovered || isSelected ? strokeWidth + 2 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="cursor-pointer transition-all duration-300 ease-out"
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelectCategory(selectedCategory === seg.id ? null : seg.id)}
              />
            );
          })}
        </svg>

        {/* Center of the "O" */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-semibold text-[#1f1f1f] leading-none">
            {activeSegment ? activeSegment.count : applications.length}
          </span>
          <span className="text-[10px] text-[#5e5e5e] font-medium leading-tight mt-0.5">
            {activeSegment ? activeSegment.id : 'Active'}
          </span>
        </div>
      </div>

      {/* Minimalist Legend & Controls */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <div className="flex items-center justify-between text-xs text-[#444746] font-medium mb-0.5">
          <span>Pipeline Distribution</span>
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-[11px] text-[#0b57d0] hover:underline cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          {segments.map((seg) => {
            const isSelected = selectedCategory === seg.id;
            return (
              <button
                key={seg.id}
                onClick={() => onSelectCategory(isSelected ? null : seg.id)}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex items-center justify-between gap-2 px-2 py-0.5 rounded transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-[#eaf1fb] font-semibold text-[#0b57d0]'
                    : 'text-[#444746] hover:bg-[#f8fafd]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate">{seg.label}</span>
                </div>
                <span className="text-[11px] font-mono text-[#747775]">{seg.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
