import React, { useEffect, useRef } from 'react';
import type { Card, Lane } from '../../utils/board';

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

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  review: 'Review',
  other: 'Other',
};

/**
 * Application Data Table
 * Fast, dense, warm table view featuring row selection, keyboard navigation,
 * stage badges, countdown chips, filter pills, search, and pagination.
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
    <div className="tk-card bp-section-card" aria-label="Applications table view">
      <div className="tk-card-head bp-card-head">
        <h2>Where every application stands</h2>
        <span className="aside">
          {activeStage !== 'all'
            ? `Filtered to ${focusName || activeStage}. Click stage again to show all.`
            : 'Click a row to inspect details and email thread'}
        </span>
      </div>

      <div className="tk-table-view">
        <div className="tk-table-controls bp-table-toolbar">
          <div className="tk-table-filters bp-table-filters" role="group" aria-label="Stage filters">
            <button
              type="button"
              className={`tk-table-pill bp-table-pill ${activeStage === 'all' ? 'on is-active' : ''}`}
              onClick={() => onSelectStage('all')}
              aria-pressed={activeStage === 'all'}
            >
              All ({allCardsCount})
            </button>
            {lanes.map(l => (
              <button
                key={l.key}
                type="button"
                className={`tk-table-pill bp-table-pill ${activeStage === l.key ? 'on is-active' : ''}`}
                onClick={() => onSelectStage(activeStage === l.key ? 'all' : l.key)}
                aria-pressed={activeStage === l.key}
              >
                {l.name} ({l.cards.length})
              </button>
            ))}
          </div>

          <div className="tk-search-wrapper bp-search-input-group">
            <input
              ref={searchInputRef}
              type="text"
              className="tk-table-search bp-search-input"
              placeholder="Filter by company or role... (/)"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              aria-label="Filter applications by company or role"
            />
            <span className="bp-key-hint" title="Press / to focus search">
              <kbd className="tk-keycap bp-keycap">/</kbd>
            </span>
          </div>
        </div>

        <div className="tk-table-container bp-table-container">
          <table className="tk-table bp-html-table">
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
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--tk-muted)' }}>
                    No applications found matching your filter.
                  </td>
                </tr>
              ) : (
                cards.map((c, index) => {
                  const isSelected = index === selectedRowIndex;

                  return (
                    <tr
                      key={c.app.id}
                      ref={isSelected ? selectedRowRef : undefined}
                      className={`tk-table-row bp-table-row ${isSelected ? 'selected is-selected' : ''}`}
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
                      <td className="tk-muted-cell">{c.app.role || '—'}</td>
                      <td>
                        <span className={`tk-stage-badge ${c.lane}`}>
                          <i className={`c-${c.lane}`} aria-hidden="true" />
                          {STAGE_LABELS[c.lane] || c.lane}
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
                      <td className="tk-muted-cell tabular num">
                        {c.lastEmail}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="tk-table-pagination bp-table-pagination">
          <span>
            Showing {startIdx}–{endIdx} of {totalFilteredCount}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="tk-page-btn bp-page-btn"
              disabled={page === 0}
              onClick={onPrevPage}
              title="Previous page ([)"
            >
              ← Previous <kbd className="tk-keycap bp-keycap" style={{ marginLeft: 4 }}>[</kbd>
            </button>
            <button
              type="button"
              className="tk-page-btn bp-page-btn"
              disabled={page >= totalPages - 1}
              onClick={onNextPage}
              title="Next page (])"
            >
              Next → <kbd className="tk-keycap bp-keycap" style={{ marginLeft: 4 }}>]</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
