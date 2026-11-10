import React, { useMemo, useRef, useState } from 'react';
import type { Application } from '../../types';
import { buildBoard, type Lane } from '../../utils/board';
import { Icon } from '../Icon';
import './tracker.css';

import { StageMetricsBar } from './StageMetricsBar';
import { ApplicationTable } from './ApplicationTable';
import { DateRangeControls } from './DateRangeControls';
import { type Range, RANGES } from './dateRangeConstants';
import { ApplicationDetailDrawer } from './ApplicationDetailDrawer';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { useTrackerHotkeys } from './useTrackerHotkeys';

export interface Props {
  applications: Application[];
  now: number;
  onOpenEmail: (emailId: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  updatedLabel?: string;
  banner?: React.ReactNode;
  onOpenSettings?: () => void;
}

const CHARTS = {
  applied: { tab: 'Applied', title: 'Applications sent' },
  assessment: { tab: 'Assessments', title: 'Assessments received' },
  interview: { tab: 'Interviews', title: 'Interviews received' },
} as const;
type Chart = keyof typeof CHARTS;

const OVERRIDE_KEY = 'trackerStatusOverrides';
const TABLE_PAGE_SIZE = 12;

function toDateInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEarliestDate(apps: Application[], fallbackNow: number): string {
  let earliest = fallbackNow;
  for (const a of apps) {
    for (const e of a.emails) {
      const t = new Date(e.receivedAt).getTime();
      if (!isNaN(t) && t < earliest) earliest = t;
    }
  }
  return toDateInputValue(earliest);
}

const DEFAULT_RANGE: Range = '7';

function loadStatusOverrides(): Record<string, Lane> {
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, Lane>;
      }
    }
  } catch {}
  return {};
}

function saveStatusOverrides(overrides: Record<string, Lane>): void {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  } catch {}
}

export const TrackerDashboard: React.FC<Props> = ({
  applications,
  now,
  onOpenEmail,
  onRefresh,
  refreshing,
  updatedLabel,
  banner,
  onOpenSettings,
}) => {
  // 1. Status Overrides State
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Lane>>(loadStatusOverrides);

  // Apply status overrides directly to applications so board counts and lanes re-aggregate dynamically
  const appsWithOverrides = useMemo(() => {
    if (Object.keys(statusOverrides).length === 0) return applications;
    return applications.map(app => {
      const override = statusOverrides[app.id];
      if (!override) return app;
      const updatedEmails = app.emails.map(e => ({
        ...e,
        stage: override,
      }));
      return {
        ...app,
        emails: updatedEmails,
        stage: override === 'rejected' ? 'closed' : app.stage,
      };
    });
  }, [applications, statusOverrides]);

  // 2. Date Range State
  // Always opens on the last week; picking another range lasts until reload.
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  const [customFrom, setCustomFrom] = useState<string>(() => toDateInputValue(now - 7 * 86400000));
  const [customTo, setCustomTo] = useState<string>(() => toDateInputValue(now));

  // Table & UI state
  const [tableStage, setTableStage] = useState<string>('interview'); // opens on Interviews
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tablePage, setTablePage] = useState<number>(0);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [focus, setFocus] = useState<Lane | null>('interview');
  const [chart, setChart] = useState<Chart>('applied');
  const [showTimeline, setShowTimeline] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Date range handlers with synchronous pagination/selection reset
  const pickRange = (r: Range) => {
    setRange(r);
    setTablePage(0);
    setSelectedRowIndex(0);
    if (r !== 'custom') {
      const days = RANGES.find(x => x.key === r)?.days ?? 0;
      const toStr = toDateInputValue(now);
      const fromStr = days > 0 ? toDateInputValue(now - days * 86400000) : getEarliestDate(applications, now);
      setCustomFrom(fromStr);
      setCustomTo(toStr);
    }
  };

  const handleFromChange = (val: string) => {
    setCustomFrom(val);
    setRange('custom');
    setTablePage(0);
    setSelectedRowIndex(0);
  };

  const handleToChange = (val: string) => {
    setCustomTo(val);
    setRange('custom');
    setTablePage(0);
    setSelectedRowIndex(0);
  };

  const handleSelectStage = (stage: string) => {
    setTableStage(stage);
    setFocus(stage === 'all' ? null : (stage as Lane));
    setTablePage(0);
    setSelectedRowIndex(0);
  };

  const handleSearchChange = (query: string) => {
    setTableSearch(query);
    setTablePage(0);
    setSelectedRowIndex(0);
  };

  // Filter applications within active date range
  const inRange = useMemo(() => {
    if (range === 'custom') {
      const fromTime = customFrom && !isNaN(new Date(`${customFrom}T00:00:00`).getTime())
        ? new Date(`${customFrom}T00:00:00`).getTime()
        : 0;
      const toTime = customTo && !isNaN(new Date(`${customTo}T23:59:59.999`).getTime())
        ? new Date(`${customTo}T23:59:59.999`).getTime()
        : Infinity;

      return appsWithOverrides
        .map(a => {
          const matchedEmails = a.emails.filter(e => {
            const t = new Date(e.receivedAt).getTime();
            return t >= fromTime && t <= toTime;
          });
          const lastActivity = matchedEmails.length
            ? [...matchedEmails].sort((x, y) => x.receivedAt.localeCompare(y.receivedAt))[matchedEmails.length - 1].receivedAt
            : a.lastActivity;
          return {
            ...a,
            emails: matchedEmails,
            lastActivity,
          };
        })
        .filter(a => a.emails.length > 0);
    }
    const days = RANGES.find(r => r.key === range)?.days ?? 0;
    if (!days) return appsWithOverrides;
    const since = now - days * 86400000;
    return appsWithOverrides
      .map(a => ({ ...a, emails: a.emails.filter(e => new Date(e.receivedAt).getTime() >= since) }))
      .filter(a => a.emails.length > 0);
  }, [appsWithOverrides, now, range, customFrom, customTo]);

  // Aggregate boards with full memoization preserving compiler performance
  const everything = useMemo(() => buildBoard(appsWithOverrides, now), [appsWithOverrides, now]);
  const periodBoard = useMemo(() => buildBoard(inRange, now), [inRange, now]);
  const board = useMemo(
    () => ({ ...periodBoard, tasks: everything.tasks }),
    [periodBoard, everything.tasks]
  );

  const series = board.weekly[chart];
  const max = Math.max(1, ...series);
  const totalCount = useMemo(() => series.reduce((a, b) => a + b, 0), [series]);
  const peakCount = useMemo(() => Math.max(0, ...series), [series]);
  const peakWeek = useMemo(() => {
    const idx = series.indexOf(peakCount);
    return idx >= 0 && peakCount > 0 ? board.weekly.weeks[idx] : null;
  }, [series, peakCount, board.weekly.weeks]);
  const avgCount = useMemo(() => Math.round(totalCount / (series.length || 1)), [totalCount, series.length]);
  const focusName = focus ? board.lanes.find(l => l.key === focus)?.name : null;

  // Flattened cards and table filtering
  const allCards = useMemo(() => periodBoard.lanes.flatMap(l => l.cards), [periodBoard.lanes]);

  const filteredTableCards = useMemo(() => {
    let list = allCards;
    if (tableStage !== 'all') list = list.filter(c => c.lane === tableStage);
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(c => c.app.company.toLowerCase().includes(q) || (c.app.role && c.app.role.toLowerCase().includes(q)));
    }
    return list;
  }, [allCards, tableStage, tableSearch]);

  const totalPages = Math.ceil(filteredTableCards.length / TABLE_PAGE_SIZE) || 1;
  // Derive safe page index directly without triggering cascading render effect
  const safePage = Math.min(tablePage, Math.max(0, totalPages - 1));
  const pagedCards = useMemo(
    () => filteredTableCards.slice(safePage * TABLE_PAGE_SIZE, (safePage + 1) * TABLE_PAGE_SIZE),
    [filteredTableCards, safePage]
  );

  // Derive safe row index and active card directly to avoid set-state-in-effect hazards
  const safeRowIndex = pagedCards.length > 0 ? Math.min(selectedRowIndex, pagedCards.length - 1) : 0;
  const selectedCard = pagedCards[safeRowIndex] ?? null;

  // Status Triage Handlers with instant localStorage persistence
  const handleSetStatus = (appId: string, lane: Lane) => {
    setStatusOverrides(prev => {
      const updated = { ...prev, [appId]: lane };
      saveStatusOverrides(updated);
      return updated;
    });
  };

  const handleResetStatus = (appId: string) => {
    setStatusOverrides(prev => {
      const updated = { ...prev };
      delete updated[appId];
      saveStatusOverrides(updated);
      return updated;
    });
  };

  // Keyboard Hotkeys Engine
  useTrackerHotkeys({
    activeRowIndex: safeRowIndex,
    totalRows: pagedCards.length,
    onSelectRow: index => setSelectedRowIndex(index),
    onInspectRow: index => {
      setSelectedRowIndex(index);
      setShowTimeline(false);
      setIsDrawerOpen(true);
    },
    onFocusSearch: () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    },
    onToggleShortcuts: () => setShowShortcuts(prev => !prev),
    onToggleTimeline: () => {
      setShowTimeline(prev => {
        const next = !prev;
        if (next) setIsDrawerOpen(false);
        return next;
      });
    },
    onDismiss: () => {
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    },
    isDrawerOpen,
    isShortcutsOpen: showShortcuts,
    isTimelineOpen: showTimeline,
  });

  return (
    <section className="bp-dashboard tk" aria-label="Job Tracker">
      <DateRangeControls
        range={range}
        onPickRange={pickRange}
        customFrom={customFrom}
        onFromChange={handleFromChange}
        customTo={customTo}
        onToChange={handleToChange}
        showTimeline={showTimeline}
        onToggleTimeline={() => {
          setShowTimeline(prev => {
            const next = !prev;
            if (next) setIsDrawerOpen(false);
            return next;
          });
        }}
        onOpenSettings={onOpenSettings}
        onRefresh={onRefresh}
        refreshing={refreshing}
        updatedLabel={updatedLabel}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      {banner}

      <StageMetricsBar
        counts={board.counts}
        activeStage={tableStage}
        onSelectStage={handleSelectStage}
      />

      <ApplicationTable
        cards={pagedCards}
        totalFilteredCount={filteredTableCards.length}
        allCardsCount={allCards.length}
        lanes={board.lanes}
        activeStage={tableStage}
        onSelectStage={handleSelectStage}
        searchQuery={tableSearch}
        onSearchChange={handleSearchChange}
        searchInputRef={searchInputRef}
        selectedRowIndex={safeRowIndex}
        onSelectRow={index => setSelectedRowIndex(index)}
        onInspectCard={(_card, index) => {
          setSelectedRowIndex(index);
          setShowTimeline(false);
          setIsDrawerOpen(true);
        }}
        page={safePage}
        pageSize={TABLE_PAGE_SIZE}
        totalPages={totalPages}
        onNextPage={() => {
          if (safePage < totalPages - 1) {
            setTablePage(safePage + 1);
            setSelectedRowIndex(0);
          }
        }}
        onPrevPage={() => {
          if (safePage > 0) {
            setTablePage(safePage - 1);
            setSelectedRowIndex(0);
          }
        }}
        focusName={focusName}
      />

      {board.unsure.length > 0 && (
        <details className="bp-section-card tk-card tk-unsure">
          <summary>
            <span>Not sure about {board.unsure.length} email{board.unsure.length === 1 ? '' : 's'}</span>
            <small>Click to see them. Probably not job emails; open one if the sender looks familiar.</small>
          </summary>
          <div className="tk-unsure-list">
            {board.unsure.map(u => (
              <button key={u.emailId} type="button" onClick={() => onOpenEmail(u.emailId)}>
                <b>{u.company}</b><span>{u.subject}</span><small className="tabular num">{u.date}</small>
              </button>
            ))}
          </div>
        </details>
      )}

      {showTimeline && (
        <div className="bp-drawer-backdrop tk-drawer-backdrop" onClick={() => setShowTimeline(false)}>
          <aside
            className="bp-drawer tk-timeline-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Activity timeline"
            onClick={e => e.stopPropagation()}
          >
            <div className="bp-drawer-header tk-drawer-head">
              <div className="tk-drawer-title-group">
                <div className="tk-drawer-badge">
                  <Icon name="bar_chart" size={16} />
                  <span>Activity Timeline</span>
                </div>
                <h2>{CHARTS[chart].title}</h2>
                <span className="tk-drawer-sub">Weekly activity breakdown over the last 12 weeks</span>
              </div>
              <button
                type="button"
                className="bp-drawer-close tk-drawer-close"
                onClick={() => setShowTimeline(false)}
                aria-label="Close timeline"
                title="Close (Esc)"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="tk-drawer-tabs">
              <div className="bp-btn-group tk-tabs" role="group" aria-label="Chart category">
                {(Object.keys(CHARTS) as Chart[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    className={chart === k ? 'is-active on' : ''}
                    onClick={() => setChart(k)}
                  >
                    {CHARTS[k].tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="tk-drawer-chart-card">
              <div className="tk-bars">
                {series.map((v, i) => (
                  <div
                    key={i}
                    className={`tk-bar${i === series.length - 1 ? ' now' : ''}`}
                    role="img"
                    aria-label={`Week of ${board.weekly.weeks[i]}: ${v}`}
                  >
                    <em className="tabular num">{v || ''}</em>
                    <i style={{ height: v ? `${Math.round((v / max) * 70)}%` : '2%' }} />
                    <small>{i % 2 === 1 ? board.weekly.weeks[i] : ''}</small>
                  </div>
                ))}
              </div>
              <div className="tk-note">Per week, last 12 weeks. This week is highlighted in primary.</div>
            </div>

            <div className="tk-drawer-stats">
              <div className="tk-drawer-stat-item">
                <span className="label">12-Week Total</span>
                <span className="val tabular num">{totalCount}</span>
                <small>{CHARTS[chart].tab.toLowerCase()}</small>
              </div>
              <div className="tk-drawer-stat-item">
                <span className="label">Peak Week</span>
                <span className="val tabular num">{peakCount}</span>
                <small>{peakWeek ? `Week of ${peakWeek}` : 'None'}</small>
              </div>
              <div className="tk-drawer-stat-item">
                <span className="label">Weekly Avg</span>
                <span className="val tabular num">{avgCount}</span>
                <small>per week</small>
              </div>
            </div>
          </aside>
        </div>
      )}

      <ApplicationDetailDrawer
        card={selectedCard}
        isOpen={isDrawerOpen && selectedCard !== null}
        onClose={() => setIsDrawerOpen(false)}
        onOpenEmailExternal={onOpenEmail}
        onSetStatus={handleSetStatus}
        onResetStatus={handleResetStatus}
        hasOverride={Boolean(selectedCard && statusOverrides[selectedCard.app.id])}
      />

      <KeyboardShortcutsDialog
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </section>
  );
};
