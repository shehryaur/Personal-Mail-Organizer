// The Job Tracker dashboard: counts per stage, the to-do list, weekly counts and
// every application on a stage board. Same component in Gmail (extension) and
// in the reviewers' demo. Design: prototype/job-tracker.html.
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

export const TrackerDashboard: React.FC<Props> = ({ applications, now, onOpenEmail, onRefresh, refreshing, updatedLabel, banner, onOpenSettings }) => {
  const board = useMemo(() => buildBoard(applications, now), [applications, now]);
  const [focus, setFocus] = useState<Lane | null>(null);
  const [chart, setChart] = useState<Chart>('applied');
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
  const focusName = focus ? board.lanes.find(l => l.key === focus)?.name : null;

  return (
    <section className="tk" aria-label="Job Tracker">
      <div className="tk-head">
        <div className="grow">
          <h1>Dashboard</h1>
          <div className="sub">Job applications</div>
        </div>
        {updatedLabel && <span className="tk-updated" aria-live="polite">{refreshing ? 'Checking for new emails…' : updatedLabel}</span>}
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
            className={`tk-count${c.key === 'offer' && c.count > 0 ? ' hot' : ''}${focus === c.key ? ' on' : ''}`}
            onClick={() => setFocus(focus === c.key ? null : c.key)}
            aria-pressed={focus === c.key}
          >
            <span className="k"><i className={`c-${c.key}`} />{c.label}</span>
            <span className="num">{c.count}</span>
            <small>{c.note}</small>
          </button>
        ))}
      </div>

      <div className="tk-row2">
        <div className="tk-card">
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
            <h2>{CHARTS[chart].title}</h2>
            <div className="tk-tabs" role="group" aria-label="Chart">
              {(Object.keys(CHARTS) as Chart[]).map(k => (
                <button key={k} className={chart === k ? 'on' : ''} onClick={() => setChart(k)}>{CHARTS[k].tab}</button>
              ))}
            </div>
          </div>
          <div className="tk-bars">
            {series.map((v, i) => (
              <div key={i} className={`tk-bar${i === series.length - 1 ? ' now' : ''}`} role="img" aria-label={`Week of ${board.weekly.weeks[i]}: ${v}`}>
                <em>{v || ''}</em>
                <i style={{ height: v ? `${Math.round((v / max) * 70)}%` : '2%' }} />
                <small>{i % 2 === 1 ? board.weekly.weeks[i] : ''}</small>
              </div>
            ))}
          </div>
          <div className="tk-note">Per week, last 12 weeks. This week is in lime.</div>
        </div>
      </div>

      <div className="tk-card">
        <div className="tk-card-head">
          <h2>Where every application stands</h2>
          <span className="aside">
            {focusName ? `Showing ${focusName}. Click the number again to show all.` : 'Click a company to open its latest email'}
          </span>
        </div>
        <div className="tk-board-box">
          {/* each column at least 170px; narrower screens scroll the board sideways */}
          <div className="tk-board" style={{ minWidth: board.lanes.length * 182 - 12 }}>
            {board.lanes.map(l => (
              <div key={l.key} className={`tk-lane${focus && focus !== l.key ? ' dim' : ''}`}>
                <div className="tk-lane-head"><i className={`c-${l.key}`} />{l.name}<span>{l.cards.length}</span></div>
                {l.cards.length === 0 && <div className="empty">Nothing here</div>}
                {l.cards.map(c => (
                  <button key={c.app.id} className="tk-co" onClick={() => onOpenEmail(c.openEmailId)}>
                    <b>{c.app.company}</b>
                    {c.app.role && <span className="role">{c.app.role}</span>}
                    <span className={`tk-chip ${c.chip.kind}`}>{c.chip.text}</span>
                    <span className="foot">
                      <span className="tk-dots" aria-label="Stages reached">
                        {(['applied', 'assessment', 'interview', 'offer'] as Lane[]).map(k => (
                          <i key={k} className={c.reached.has(k) ? (k === 'offer' ? 'o' : 'd') : ''} />
                        ))}
                        {c.lane === 'rejected' && <i className="x" />}
                      </span>
                      <span title="Last email">{c.lastEmail}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
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
    </section>
  );
};
