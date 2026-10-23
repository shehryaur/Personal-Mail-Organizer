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
  percentage: number;
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

  const selectedCount = 1;
  const closedCount = applications.filter((a) => a.stage === 'closed' || a.stage === 'ghosted').length;

  const total = assessmentCount + interviewCount + appliedCount + selectedCount + closedCount || 1;

  const segments: Segment[] = [
    {
      id: 'assessment',
      label: 'Assessments & Challenges',
      count: assessmentCount,
      percentage: Math.round((assessmentCount / total) * 100),
      color: '#f59e0b', // Amber / Yellow
      hoverColor: '#d97706',
    },
    {
      id: 'interview',
      label: 'Interviews & Screens',
      count: interviewCount,
      percentage: Math.round((interviewCount / total) * 100),
      color: '#3b82f6', // Clean Blue
      hoverColor: '#2563eb',
    },
    {
      id: 'applied',
      label: 'In Review',
      count: appliedCount,
      percentage: Math.round((appliedCount / total) * 100),
      color: '#94a3b8', // Muted Slate
      hoverColor: '#64748b',
    },
    {
      id: 'selected',
      label: 'Selected / Advancing',
      count: selectedCount,
      percentage: Math.round((selectedCount / total) * 100),
      color: '#10b981', // Emerald / Green
      hoverColor: '#059669',
    },
    {
      id: 'closed',
      label: 'Archived / Stale',
      count: closedCount,
      percentage: Math.round((closedCount / total) * 100),
      color: '#cbd5e1', // Light Gray
      hoverColor: '#94a3b8',
    },
  ];

  // SVG Geometry for Donut ("O")
  const size = 116;
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
    <div className="flex items-center gap-6 select-none">
      {/* The Animated "O" Donut Ring (Rive-inspired click & hover morphing) */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Base track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices with smooth stroke transitions */}
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
                strokeWidth={isHovered || isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-width 0.25s ease, stroke 0.25s ease',
                  transformOrigin: 'center',
                }}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelectCategory(selectedCategory === seg.id ? null : seg.id)}
              />
            );
          })}
        </svg>

        {/* Center of the "O": Dynamic data display on click/hover */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
          <span className="text-base font-bold text-[#1f1f1f] leading-none transition-all">
            {activeSegment ? activeSegment.count : applications.length}
          </span>
          <span className="text-[10px] text-[#5e5e5e] font-medium leading-tight mt-0.5 truncate max-w-[50px] text-center">
            {activeSegment ? `${activeSegment.percentage}%` : 'Total'}
          </span>
        </div>
      </div>

      {/* Minimalist Legend & Controls */}
      <div className="flex flex-col gap-1 flex-1">
        <div className="flex items-center justify-between text-xs text-[#444746] font-semibold mb-1">
          <span>Active Pipeline Breakdown</span>
          {selectedCategory && (
            <button
              onClick={() => onSelectCategory(null)}
              className="text-[11px] text-[#0b57d0] hover:underline cursor-pointer font-normal"
            >
              Reset filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {segments.map((seg) => {
            const isSelected = selectedCategory === seg.id;
            const isHovered = hoveredId === seg.id;

            return (
              <button
                key={seg.id}
                onClick={() => onSelectCategory(isSelected ? null : seg.id)}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-[#eaf1fb] font-semibold text-[#0b57d0] ring-1 ring-[#c2e7ff]'
                    : isHovered
                    ? 'bg-[#f1f5f9] text-[#1f1f1f]'
                    : 'text-[#444746] hover:bg-[#f8fafd]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200"
                    style={{
                      backgroundColor: seg.color,
                      transform: isHovered || isSelected ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                  <span className="truncate text-[11px]">{seg.label}</span>
                </div>
                <span className="text-[11px] font-mono font-medium text-[#747775]">
                  {seg.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
