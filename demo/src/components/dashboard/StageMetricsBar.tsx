import React from 'react';
import type { Lane } from '../../utils/board';

export interface StageCountItem {
  key: Lane | string;
  label: string;
  count: number;
  note: string;
}

export interface StageMetricsBarProps {
  counts: StageCountItem[];
  activeStage: string;
  onSelectStage: (stage: string) => void;
}

/**
 * Stage Metrics Bar
 * 5 metric cards with 52px tabular counts, stage dots, and signature warm/lime styling.
 */
export const StageMetricsBar: React.FC<StageMetricsBarProps> = ({
  counts,
  activeStage,
  onSelectStage,
}) => {
  return (
    <div className="tk-counts bp-metrics-grid" role="group" aria-label="Applications by stage">
      {counts.map(c => {
        const isActive = activeStage === c.key;
        const isHot = c.key === 'offer' && c.count > 0;

        return (
          <button
            key={c.key}
            type="button"
            className={`tk-count bp-metric-card ${isHot ? 'hot' : ''} ${isActive ? 'on is-active' : ''}`}
            onClick={() => {
              const next = isActive ? 'all' : c.key;
              onSelectStage(next);
            }}
            aria-pressed={isActive}
            title={`Filter by ${c.label} (${c.count})`}
          >
            <div className="k tk-count-header">
              <i className={`c-${c.key}`} aria-hidden="true" />
              <span>{c.label}</span>
            </div>
            <span className="num tabular">{c.count}</span>
            <small>{c.note}</small>
          </button>
        );
      })}
    </div>
  );
};
