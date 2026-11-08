import React from 'react';
import type { Lane } from '../../utils/board';
import { STAGE_INTENT_BORDER_COLOR } from './blueprintTokens';

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
 * Palantir Blueprint Stage Metrics Bar
 * 5 compact metric cards with 26px tabular counts, uppercase labels, and 3px intent-colored left accents.
 */
export const StageMetricsBar: React.FC<StageMetricsBarProps> = ({
  counts,
  activeStage,
  onSelectStage,
}) => {
  return (
    <div className="bp-metrics-grid tk-counts" role="group" aria-label="Applications by stage">
      {counts.map(c => {
        const isActive = activeStage === c.key;
        const isHot = c.key === 'offer' && c.count > 0;
        const intentColor = STAGE_INTENT_BORDER_COLOR[c.key] || '#8f99a8';

        return (
          <button
            key={c.key}
            type="button"
            className={`bp-metric-card tk-count intent-${c.key} ${isHot ? 'hot' : ''} ${isActive ? 'is-active on' : ''}`}
            style={{ borderLeftColor: intentColor }}
            onClick={() => {
              const next = isActive ? 'all' : c.key;
              onSelectStage(next);
            }}
            aria-pressed={isActive}
            title={`Filter by ${c.label} (${c.count})`}
          >
            <div className="bp-metric-header tk-count-header">
              <span className="bp-metric-label k">
                <i className={`c-${c.key}`} aria-hidden="true" />
                {c.label}
              </span>
            </div>
            <span className="bp-metric-value num tabular">{c.count}</span>
            <small className="bp-metric-note">{c.note}</small>
          </button>
        );
      })}
    </div>
  );
};
