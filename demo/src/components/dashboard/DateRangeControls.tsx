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
 * Palantir Blueprint Compact Header Bar & Date Range Controls
 * 36px header bar with presets (1w, 1m, 3m, 1y, All, Custom), bounds validation,
 * custom date inputs, timeline toggle, settings, and refresh buttons.
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
  onOpenSettings,
  onRefresh,
  refreshing,
  updatedLabel,
  onOpenShortcuts,
}) => {
  return (
    <div className="bp-navbar-compact tk-head">
      <div className="bp-navbar-title-group grow">
        <h1>Dashboard</h1>
        <div className="bp-navbar-divider" aria-hidden="true" />
        <div className="bp-navbar-sub sub">Job applications</div>
      </div>

      <div className="bp-navbar-actions tk-range-controls" role="group" aria-label="Time period and date filters">
        <div className="bp-btn-group tk-seg" role="group" aria-label="Time period presets">
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? 'is-active on' : ''}
              aria-pressed={range === r.key}
              onClick={() => onPickRange(r.key)}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            className={range === 'custom' ? 'is-active on' : ''}
            aria-pressed={range === 'custom'}
            onClick={() => onPickRange('custom')}
          >
            Custom
          </button>
        </div>

        {range === 'custom' && (
          <div className="bp-date-range tk-date-range active" role="group" aria-label="Date range">
            <label className="bp-date-label tk-date-label">
              <span className="tk-date-tag">From</span>
              <input
                type="date"
                className="bp-date-input tk-date-input"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => onFromChange(e.target.value)}
                aria-label="Filter from date"
              />
            </label>
            <span className="bp-date-sep tk-date-sep">to</span>
            <label className="bp-date-label tk-date-label">
              <span className="tk-date-tag">To</span>
              <input
                type="date"
                className="bp-date-input tk-date-input"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => onToChange(e.target.value)}
                aria-label="Filter to date"
              />
            </label>
          </div>
        )}
      </div>

      {updatedLabel && (
        <span className="tk-updated" aria-live="polite">
          {refreshing ? 'Checking for new emails…' : updatedLabel}
        </span>
      )}

      <button
        type="button"
        className={`tk-timeline-btn ${showTimeline ? 'on' : ''}`}
        onClick={onToggleTimeline}
        aria-label="Open timeline"
        title="Open activity timeline (t)"
      >
        <Icon name="bar_chart" size={18} />
        <span>Timeline</span>
        <kbd className="bp-keycap" style={{ marginLeft: 4 }}>t</kbd>
      </button>

      {onOpenShortcuts && (
        <button
          type="button"
          className="tk-icon-btn bp-btn-minimal"
          onClick={onOpenShortcuts}
          aria-label="Keyboard Shortcuts"
          title="Keyboard Shortcuts (?)"
        >
          <kbd className="bp-keycap">?</kbd>
        </button>
      )}

      {onOpenSettings && (
        <button
          type="button"
          className="tk-icon-btn"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <Icon name="settings" size={20} />
        </button>
      )}

      {onRefresh && (
        <button
          type="button"
          className="bp-btn bp-btn-primary tk-cta"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Checking…' : 'Refresh'}
          <span>
            <Icon name="refresh" size={18} className={refreshing ? 'animate-spin' : ''} />
          </span>
        </button>
      )}
    </div>
  );
};
