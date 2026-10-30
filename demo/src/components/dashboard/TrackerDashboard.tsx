// The Job Tracker dashboard: counts per stage, the to-do list, weekly counts and
// every application in a dense, searchable table. Same component in Gmail (extension)
// and in the reviewers' demo.
import React, { useEffect, useMemo, useState } from 'react';
import type { Application } from '../../types';
import { buildBoard, type Lane } from '../../utils/board';
import { loadDone, saveDone } from '../../utils/doneStore';
import { Icon } from '../Icon';
import './tracker.css';

interface Props {
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

const RANGES = [
  { key: '7', label: '1 week', days: 7 },
  { key: '30', label: '1 month', days: 30 },
  { key: '90', label: '3 months', days: 90 },
  { key: '365', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: 0 },
] as const;
type Range = (typeof RANGES)[number]['key'] | 'custom';
const RANGE_KEY = 'trackerRange';
const FROM_KEY = 'trackerCustomFrom';
const TO_KEY = 'trackerCustomTo';

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

const savedRange = (): Range => {
  try {
    const v = window.localStorage.getItem(RANGE_KEY);
    if (v === 'custom') return 'custom';
    return (RANGES.find(r => r.key === v)?.key) || 'all';
  } catch {
    return 'all';
  }
};

export const TrackerDashboard: React.FC<Props> = ({ applications, now, onOpenEmail, onRefresh, refreshing, updatedLabel, banner, onOpenSettings }) => {
  const [range, setRange] = useState<Range>(savedRange);
  const [customFrom, setCustomFrom] = useState<string>(() => {
    try {
      const v = window.localStorage.getItem(FROM_KEY);
      if (v) return v;
    } catch {}
    const initialRange = savedRange();
    if (initialRange === 'all') return getEarliestDate(applications, now);
    const days = RANGES.find(r => r.key === initialRange)?.days ?? 30;
    return toDateInputValue(now - days * 86400000);
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    try {
      const v = window.localStorage.getItem(TO_KEY);
      if (v) return v;
    } catch {}
    return toDateInputValue(now);
  });

  const pickRange = (r: Range) => {
    setRange(r);
    try { window.localStorage.setItem(RANGE_KEY, r); } catch { /* remembered for this visit only */ }
    if (r !== 'custom') {
      const days = RANGES.find(x => x.key === r)?.days ?? 0;
      const toStr = toDateInputValue(now);
      const fromStr = days > 0 ? toDateInputValue(now - days * 86400000) : getEarliestDate(applications, now);
      setCustomFrom(fromStr);
      setCustomTo(toStr);
      try {
        window.localStorage.setItem(FROM_KEY, fromStr);
        window.localStorage.setItem(TO_KEY, toStr);
      } catch {}
    }
  };

  const handleFromChange = (val: string) => {
    setCustomFrom(val);
    setRange('custom');
    try {
      window.localStorage.setItem(FROM_KEY, val);
      window.localStorage.setItem(RANGE_KEY, 'custom');
    } catch {}
  };

  const handleToChange = (val: string) => {
    setCustomTo(val);
    setRange('custom');
    try {
      window.localStorage.setItem(TO_KEY, val);
      window.localStorage.setItem(RANGE_KEY, 'custom');
    } catch {}
  };

  // Counts and the board show what happened in the chosen period; To do always
  // uses everything, since a deadline matters whenever its email arrived
  const inRange = useMemo(() => {
    if (range === 'custom') {
      const fromTime = customFrom && !isNaN(new Date(`${customFrom}T00:00:00`).getTime())
        ? new Date(`${customFrom}T00:00:00`).getTime()
        : 0;
      const toTime = customTo && !isNaN(new Date(`${customTo}T23:59:59.999`).getTime())
        ? new Date(`${customTo}T23:59:59.999`).getTime()
        : Infinity;

      return applications
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
    if (!days) return applications;
    const since = now - days * 86400000;
    return applications
      .map(a => ({ ...a, emails: a.emails.filter(e => new Date(e.receivedAt).getTime() >= since) }))
      .filter(a => a.emails.length > 0);
  }, [applications, now, range, customFrom, customTo]);

  const everything = useMemo(() => buildBoard(applications, now), [applications, now]);
  const periodBoard = useMemo(() => buildBoard(inRange, now), [inRange, now]);
  const board = { ...periodBoard, tasks: everything.tasks };
  const [focus, setFocus] = useState<Lane | null>(null);
  const [chart, setChart] = useState<Chart>('applied');
  const [showTimeline, setShowTimeline] = useState<boolean>(false);
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { loadDone().then(setDone); }, []);
  const toggleDone = (emailId: string) => {
    const next = done.includes(emailId) ? done.filter(id => id !== emailId) : done.concat(emailId);
    setDone(next);
    saveDone(next);
  };
  const openTasks = board.tasks.filter(t => !done.includes(t.card.openEmailId));
  const doneTasks = board.tasks.filter(t => done.includes(t.card.openEmailId));

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

  // Close timeline drawer on Escape
  useEffect(() => {
    if (!showTimeline) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTimeline(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTimeline]);

  // Dense Table state
  const [tableStage, setTableStage] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tablePage, setTablePage] = useState<number>(0);
  const TABLE_PAGE_SIZE = 12;

  // Reset pagination if date filter, stage or search changes
  useEffect(() => {
    setTablePage(0);
  }, [range, customFrom, customTo, tableStage, tableSearch]);

  const allCards = useMemo(() => board.lanes.flatMap(l => l.cards), [board.lanes]);

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
  const pagedCards = filteredTableCards.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  return (
    <section className="tk" aria-label="Job Tracker">
      <div className="tk-head">
        <div className="grow">
          <h1>Dashboard</h1>
          <div className="sub">Job applications</div>
        </div>
        <div className="tk-range-controls" role="group" aria-label="Time period and date filters">
          <div className="tk-seg" role="group" aria-label="Time period presets">
            {RANGES.map(r => (
              <button
                key={r.key}
                className={range === r.key ? 'on' : ''}
                aria-pressed={range === r.key}
                onClick={() => pickRange(r.key)}
              >
                {r.label}
              </button>
            ))}
            <button
              className={range === 'custom' ? 'on' : ''}
              aria-pressed={range === 'custom'}
              onClick={() => pickRange('custom')}
            >
              Custom
            </button>
          </div>

          <div className={`tk-date-range${range === 'custom' ? ' active' : ''}`} role="group" aria-label="Date range">
            <label className="tk-date-label">
              <span className="tk-date-tag">From</span>
              <input
                type="date"
                className="tk-date-input"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => handleFromChange(e.target.value)}
                aria-label="Filter from date"
              />
            </label>
            <span className="tk-date-sep">to</span>
            <label className="tk-date-label">
              <span className="tk-date-tag">To</span>
              <input
                type="date"
                className="tk-date-input"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => handleToChange(e.target.value)}
                aria-label="Filter to date"
              />
            </label>
          </div>
        </div>

        {updatedLabel && <span className="tk-updated" aria-live="polite">{refreshing ? 'Checking for new emails…' : updatedLabel}</span>}
        <button
          className={`tk-timeline-btn${showTimeline ? ' on' : ''}`}
          onClick={() => setShowTimeline(true)}
          aria-label="Open timeline"
          title="Open activity timeline"
        >
          <Icon name="bar_chart" size={18} />
          <span>Timeline</span>
        </button>
        {onOpenSettings && (
          <button className="tk-icon-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings">
            <Icon name="settings" size={20} />
          </button>
        )}
        {onRefresh && (
          <button className="tk-cta" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Refresh'}
            <span><Icon name="refresh" size={18} className={refreshing ? 'animate-spin' : ''} /></span>
          </button>
        )}
      </div>

      {banner}

      <div className="tk-counts" role="group" aria-label="Applications by stage">
        {board.counts.map(c => (
          <button
            key={c.key}
            className={`tk-count${c.key === 'offer' && c.count > 0 ? ' hot' : ''}${tableStage === c.key ? ' on' : ''}`}
            onClick={() => {
              const next = tableStage === c.key ? 'all' : c.key;
              setTableStage(next);
              setFocus(next === 'all' ? null : next as Lane);
              setTablePage(0);
            }}
            aria-pressed={tableStage === c.key}
          >
            <span className="k"><i className={`c-${c.key}`} />{c.label}</span>
            <span className="num">{c.count}</span>
            <small>{c.note}</small>
          </button>
        ))}
      </div>

      <div className="tk-card tk-todo-card">
        <div className="tk-card-head">
          <h2>To do</h2>
          <span className="aside">{openTasks.length ? `${openTasks.length} things, soonest first` : 'Nothing waiting on you'}</span>
        </div>
        <div className="tk-todo">
          {openTasks.length === 0 && <div className="tk-empty">No deadlines or requests right now.</div>}
          {openTasks.map(t => (
            <div key={t.card.app.id} className="tk-task">
              <button className="tk-check" role="checkbox" aria-checked="false" onClick={() => toggleDone(t.card.openEmailId)}
                aria-label={`Mark ${t.card.app.company} done`} title="Mark done" />
              <button className="tk-task-open" onClick={() => onOpenEmail(t.card.openEmailId)}>
                <span className={`tk-when${t.tone === 'plain' ? '' : ' ' + t.tone}`}>{t.when}</span>
                <span className="what">
                  <b>{t.card.app.company}</b>
                  <small>{t.what} · {t.detail}</small>
                </span>
                <span className="go"><span>Open email</span><Icon name="arrow_forward" size={16} /></span>
              </button>
            </div>
          ))}
          {doneTasks.length > 0 && (
            <details className="tk-done">
              <summary>Done ({doneTasks.length})</summary>
              {doneTasks.map(t => (
                <div key={t.card.app.id} className="tk-task done">
                  <button className="tk-check on" role="checkbox" aria-checked="true" onClick={() => toggleDone(t.card.openEmailId)}
                    aria-label={`Mark ${t.card.app.company} not done`} title="Mark not done">
                    <Icon name="check" size={18} />
                  </button>
                  <button className="tk-task-open" onClick={() => onOpenEmail(t.card.openEmailId)}>
                    <span className="what"><b>{t.card.app.company}</b><small>{t.what}</small></span>
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
      </div>

      <div className="tk-card">
        <div className="tk-card-head">
          <h2>Where every application stands</h2>
          <span className="aside">
            {tableStage !== 'all' ? `Filtered to ${focusName || tableStage}. Click stage again to show all.` : 'Click a row to open its latest email'}
          </span>
        </div>

        <div className="tk-table-view">
          <div className="tk-table-controls">
            <div className="tk-table-filters">
              <button
                className={`tk-table-pill ${tableStage === 'all' ? 'on' : ''}`}
                onClick={() => { setTableStage('all'); setFocus(null); setTablePage(0); }}
              >
                All ({allCards.length})
              </button>
              {board.lanes.map(l => (
                <button
                  key={l.key}
                  className={`tk-table-pill ${tableStage === l.key ? 'on' : ''}`}
                  onClick={() => {
                    const next = tableStage === l.key ? 'all' : l.key;
                    setTableStage(next);
                    setFocus(next === 'all' ? null : next as Lane);
                    setTablePage(0);
                  }}
                >
                  {l.name} ({l.cards.length})
                </button>
              ))}
            </div>
            <input
              type="text"
              className="tk-table-search"
              placeholder="Filter by company or role..."
              value={tableSearch}
              onChange={e => { setTableSearch(e.target.value); setTablePage(0); }}
            />
          </div>

          <div className="tk-table-container">
            <table className="tk-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>Status / Deadline</th>
                  <th>Stages Reached</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {pagedCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--tk-muted)' }}>
                      No applications found matching your filter.
                    </td>
                  </tr>
                ) : (
                  pagedCards.map(c => (
                    <tr key={c.app.id} className="tk-table-row" onClick={() => onOpenEmail(c.openEmailId)}>
                      <td><b>{c.app.company}</b></td>
                      <td style={{ color: 'var(--tk-muted)' }}>{c.app.role || '—'}</td>
                      <td><span className={`tk-stage-badge c-${c.lane}`}>{c.lane}</span></td>
                      <td><span className={`tk-chip ${c.chip.kind}`}>{c.chip.text}</span></td>
                      <td>
                        <span className="tk-dots" aria-label="Stages reached">
                          {(['applied', 'assessment', 'interview', 'offer'] as Lane[]).map(k => (
                            <i key={k} className={c.reached.has(k) ? (k === 'offer' ? 'o' : 'd') : ''} />
                          ))}
                          {c.lane === 'rejected' && <i className="x" />}
                        </span>
                      </td>
                      <td style={{ color: 'var(--tk-muted)', fontSize: 12 }}>{c.lastEmail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="tk-table-pagination">
            <span>
              Showing {filteredTableCards.length > 0 ? tablePage * TABLE_PAGE_SIZE + 1 : 0}–
              {Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filteredTableCards.length)} of {filteredTableCards.length}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="tk-page-btn"
                disabled={tablePage === 0}
                onClick={() => setTablePage(p => Math.max(0, p - 1))}
              >
                ← Previous
              </button>
              <button
                className="tk-page-btn"
                disabled={tablePage >= totalPages - 1}
                onClick={() => setTablePage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {board.unsure.length > 0 && (
        <details className="tk-card tk-unsure">
          <summary>
            <span>Not sure about {board.unsure.length} email{board.unsure.length === 1 ? '' : 's'}</span>
            <small>Click to see them. Probably not job emails; open one if the sender looks familiar.</small>
          </summary>
          <div className="tk-unsure-list">
            {board.unsure.map(u => (
              <button key={u.emailId} onClick={() => onOpenEmail(u.emailId)}>
                <b>{u.company}</b><span>{u.subject}</span><small>{u.date}</small>
              </button>
            ))}
          </div>
        </details>
      )}

      {showTimeline && (
        <div className="tk-drawer-backdrop" onClick={() => setShowTimeline(false)}>
          <aside
            className="tk-timeline-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Activity timeline"
            onClick={e => e.stopPropagation()}
          >
            <div className="tk-drawer-head">
              <div className="tk-drawer-title-group">
                <div className="tk-drawer-badge">
                  <Icon name="bar_chart" size={16} />
                  <span>Activity Timeline</span>
                </div>
                <h2>{CHARTS[chart].title}</h2>
                <span className="tk-drawer-sub">Weekly activity breakdown over the last 12 weeks</span>
              </div>
              <button
                className="tk-drawer-close"
                onClick={() => setShowTimeline(false)}
                aria-label="Close timeline"
                title="Close (Esc)"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="tk-drawer-tabs">
              <div className="tk-tabs" role="group" aria-label="Chart category">
                {(Object.keys(CHARTS) as Chart[]).map(k => (
                  <button
                    key={k}
                    className={chart === k ? 'on' : ''}
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
                    <em>{v || ''}</em>
                    <i style={{ height: v ? `${Math.round((v / max) * 70)}%` : '2%' }} />
                    <small>{i % 2 === 1 ? board.weekly.weeks[i] : ''}</small>
                  </div>
                ))}
              </div>
              <div className="tk-note">Per week, last 12 weeks. This week is in lime.</div>
            </div>

            <div className="tk-drawer-stats">
              <div className="tk-drawer-stat-item">
                <span className="label">12-Week Total</span>
                <span className="val">{totalCount}</span>
                <small>{CHARTS[chart].tab.toLowerCase()}</small>
              </div>
              <div className="tk-drawer-stat-item">
                <span className="label">Peak Week</span>
                <span className="val">{peakCount}</span>
                <small>{peakWeek ? `Week of ${peakWeek}` : 'None'}</small>
              </div>
              <div className="tk-drawer-stat-item">
                <span className="label">Weekly Avg</span>
                <span className="val">{avgCount}</span>
                <small>per week</small>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
