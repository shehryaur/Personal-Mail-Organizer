import React, { useEffect, useRef } from 'react';
import type { Card, Lane } from '../../utils/board';
import { getStageBadgeProps } from './blueprintTokens';

export interface ApplicationTableProps {
  cards: Card[];
  totalFilteredCount: number;
  allCardsCount: number;
  lanes: { key: Lane; name: string; cards: Card[] }[];
  activeStage: string;
  onSelectStage: (stage: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  selectedRowIndex: number;
  onSelectRow: (index: number) => void;
  onInspectCard: (card: Card, index: number) => void;
  page: number;
  pageSize?: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  focusName?: string | null;
}

const PROGRESS_LANES: Lane[] = ['applied', 'assessment', 'interview', 'offer'];

/**
 * Palantir Blueprint High-Density Application Data Table
 * Features 32px rows, sticky header, zebra striping, Cobalt selection bar,
 * keyboard focus ring, stage tags, countdown chips, filter pills, search, and pagination.
 */
export const ApplicationTable: React.FC<ApplicationTableProps> = ({
  cards,
  totalFilteredCount,
  allCardsCount,
  lanes,
  activeStage,
  onSelectStage,
  searchQuery,
  onSearchChange,
  searchInputRef,
  selectedRowIndex,
  onSelectRow,
  onInspectCard,
  page,
  pageSize = 12,
  totalPages,
  onNextPage,
  onPrevPage,
  focusName,
}) => {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  // Keep active keyboard selection within scrollable table view
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedRowIndex]);

  const startIdx = totalFilteredCount > 0 ? page * pageSize + 1 : 0;
  const endIdx = Math.min((page + 1) * pageSize, totalFilteredCount);

  return (
    <div className="bp-section-card tk-card" aria-label="Applications table view">
      <div className="bp-card-head tk-card-head">
        <h2>Where every application stands</h2>
        <span className="aside">
          {activeStage !== 'all'
            ? `Filtered to ${focusName || activeStage}. Click stage again to show all.`
            : 'Click a row to open its latest email'}
        </span>
      </div>

      <div className="tk-table-view">
        <div className="bp-table-toolbar tk-table-controls">
          <div className="bp-table-filters tk-table-filters" role="group" aria-label="Stage filters">
            <button
              type="button"
              className={`bp-table-pill tk-table-pill ${activeStage === 'all' ? 'is-active on' : ''}`}
              onClick={() => onSelectStage('all')}
              aria-pressed={activeStage === 'all'}
            >
              All ({allCardsCount})
            </button>
            {lanes.map(l => (
              <button
                key={l.key}
                type="button"
                className={`bp-table-pill tk-table-pill ${activeStage === l.key ? 'is-active on' : ''}`}
                onClick={() => onSelectStage(activeStage === l.key ? 'all' : l.key)}
                aria-pressed={activeStage === l.key}
              >
                {l.name} ({l.cards.length})
              </button>
            ))}
          </div>

          <div className="bp-search-input-group">
            <input
              ref={searchInputRef}
              type="text"
              className="bp-search-input tk-table-search"
              placeholder="Filter by company or role..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              aria-label="Filter applications by company or role"
            />
            <span className="bp-key-hint" title="Press / to focus search">
              <kbd>/</kbd>
            </span>
          </div>
        </div>

        <div className="bp-table-container tk-table-container">
          <table className="bp-html-table tk-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Company</th>
                <th style={{ width: '20%' }}>Role</th>
                <th style={{ width: '13%' }}>Stage</th>
                <th style={{ width: '18%' }}>Status / Deadline</th>
                <th style={{ width: '13%' }}>Stages Reached</th>
                <th style={{ width: '14%' }}>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {cards.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--bp-text-muted)' }}>
                    No applications found matching your filter.
                  </td>
                </tr>
              ) : (
                cards.map((c, index) => {
                  const isSelected = index === selectedRowIndex;
                  const badge = getStageBadgeProps(c.lane);

                  return (
                    <tr
                      key={c.app.id}
                      ref={isSelected ? selectedRowRef : undefined}
                      className={`bp-table-row tk-table-row ${isSelected ? 'is-selected has-focus' : ''}`}
                      onClick={() => {
                        onSelectRow(index);
                        onInspectCard(c, index);
                      }}
                      tabIndex={0}
                      aria-selected={isSelected}
                    >
                      <td>
                        <b>{c.app.company}</b>
                      </td>
                      <td style={{ color: 'var(--bp-text-muted)' }}>{c.app.role || '—'}</td>
                      <td>
                        <span className={`${badge.className} c-${c.lane}`} style={badge.style}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        <span className={`tk-chip bp-tag ${c.chip.kind}`}>
                          {c.chip.text}
                        </span>
                      </td>
                      <td>
                        <span className="tk-dots" aria-label="Stages reached">
                          {PROGRESS_LANES.map(k => (
                            <i key={k} className={c.reached.has(k) ? (k === 'offer' ? 'o' : 'd') : ''} />
                          ))}
                          {c.lane === 'rejected' && <i className="x" />}
                        </span>
                      </td>
                      <td style={{ color: 'var(--bp-text-muted)', fontSize: 12 }} className="tabular num">
                        {c.lastEmail}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bp-table-pagination tk-table-pagination">
          <span>
            Showing {startIdx}–{endIdx} of {totalFilteredCount}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="bp-page-btn tk-page-btn"
              disabled={page === 0}
              onClick={onPrevPage}
              title="Previous page ([)"
            >
              ← Previous <kbd className="bp-keycap" style={{ marginLeft: 4 }}>[</kbd>
            </button>
            <button
              type="button"
              className="bp-page-btn tk-page-btn"
              disabled={page >= totalPages - 1}
              onClick={onNextPage}
              title="Next page (])"
            >
              Next → <kbd className="bp-keycap" style={{ marginLeft: 4 }}>]</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
