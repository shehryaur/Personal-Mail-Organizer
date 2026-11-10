import React from 'react';
import { Icon } from '../Icon';

import { RANGES, type Range } from './dateRangeConstants';

export type { Range };

export interface DateRangeControlsProps {
  range: Range;
  onPickRange: (range: Range) => void;
  customFrom: string;
  onFromChange: (val: string) => void;
  customTo: string;
  onToChange: (val: string) => void;
  showTimeline: boolean;
  onToggleTimeline: () => void;
  onOpenSettings?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  updatedLabel?: string;
  onOpenShortcuts?: () => void;
}

/**
 * Header Bar & Date Range Controls
 * Warm typography and pill presets (1w, 1m, 3m, 1y, All, Custom),
 * custom date inputs, timeline toggle, shortcuts, settings, and refresh buttons.
 */
export const DateRangeControls: React.FC<DateRangeControlsProps> = ({
  range,
  onPickRange,
  customFrom,
  onFromChange,
  customTo,
  onToChange,
  showTimeline,
  onToggleTimeline,
  onRefresh,
  refreshing,
  updatedLabel,
  onOpenShortcuts,
}) => {
  return (
    <div className="tk-head bp-navbar-compact">
      {onRefresh && (
        <button
          type="button"
          className="tk-icon-btn"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Check for new emails"
          title="Check for new emails"
        >
          <Icon name="refresh" size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      )}

      {updatedLabel && (
        <span className="tk-updated" aria-live="polite">
          {refreshing ? 'Checking for new emails…' : updatedLabel}
        </span>
      )}

      <div className="grow" />

      <div className="tk-range-controls bp-navbar-actions" role="group" aria-label="Time period and date filters">
        <div className="tk-seg bp-btn-group" role="group" aria-label="Time period presets">
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? 'on is-active' : ''}
              aria-pressed={range === r.key}
              onClick={() => onPickRange(r.key)}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            className={range === 'custom' ? 'on is-active' : ''}
            aria-pressed={range === 'custom'}
            onClick={() => onPickRange('custom')}
          >
            Custom
          </button>
        </div>

        {range === 'custom' && (
          <div className="tk-date-range bp-date-range active" role="group" aria-label="Date range">
            <label className="tk-date-label bp-date-label">
              <span className="tk-date-tag">From</span>
              <input
                type="date"
                className="tk-date-input bp-date-input"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => onFromChange(e.target.value)}
                aria-label="Filter from date"
              />
            </label>
            <span className="tk-date-sep bp-date-sep">to</span>
            <label className="tk-date-label bp-date-label">
              <span className="tk-date-tag">To</span>
              <input
                type="date"
                className="tk-date-input bp-date-input"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => onToChange(e.target.value)}
                aria-label="Filter to date"
              />
            </label>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`tk-timeline-btn ${showTimeline ? 'on' : ''}`}
        onClick={onToggleTimeline}
        aria-label="Open timeline"
        title="Open activity timeline (t)"
      >
        <Icon name="bar_chart" size={18} />
        <span>Timeline</span>
      </button>

      {onOpenShortcuts && (
        <button
          type="button"
          className="tk-icon-btn"
          onClick={onOpenShortcuts}
          aria-label="Keyboard Shortcuts"
          title="Keyboard Shortcuts (?)"
        >
          <span className="tk-help-mark" aria-hidden="true">?</span>
        </button>
      )}
    </div>
  );
};
