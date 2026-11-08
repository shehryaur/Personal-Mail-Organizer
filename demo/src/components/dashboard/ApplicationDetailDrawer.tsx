import React, { useState, useMemo } from 'react';
import type { Card, Lane } from '../../utils/board';
import type { Email } from '../../types';
import { Icon } from '../Icon';
import {
  getStageBadgeProps,
  type BlueprintIntent,
} from './blueprintTokens';
import { formatNiceDate, getCountdown } from '../../utils/dateUtils';

export interface ApplicationDetailDrawerProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEmailExternal?: (emailId: string) => void;
  onOpenEmail?: (emailId: string) => void;
  onSetStatus: (appId: string, lane: Lane) => void;
  onResetStatus: (appId: string) => void;
  hasOverride: boolean;
}

interface TriageAction {
  lane: Lane;
  label: string;
  hotkey: string;
  intent: BlueprintIntent;
}

const TRIAGE_ACTIONS: readonly TriageAction[] = [
  { lane: 'applied', label: 'Applied', hotkey: '1', intent: 'none' },
  { lane: 'assessment', label: 'Assessment', hotkey: '2', intent: 'warning' },
  { lane: 'interview', label: 'Interview', hotkey: '3', intent: 'primary' },
  { lane: 'offer', label: 'Offer', hotkey: '4', intent: 'success' },
  { lane: 'rejected', label: 'Rejected', hotkey: '5', intent: 'danger' },
] as const;

const PIPELINE_ORDER: readonly Lane[] = ['applied', 'assessment', 'interview', 'offer'] as const;

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  review: 'Review',
  other: 'Other',
};

function getDecisionSourceMeta(source?: string): { label: string; icon: string } {
  switch (source) {
    case 'ai':
      return { label: 'Gemini AI Model', icon: 'psychology' };
    case 'guardrail_override':
      return { label: 'Security Guardrail', icon: 'warning' };
    case 'rule':
    default:
      return { label: 'Deterministic Rule Engine', icon: 'bolt' };
  }
}

/**
 * Application Detail Drawer
 * Deep inspection drawer supporting chronological email thread history,
 * expandable snippets, decision provenance, confidence meter, and rapid keyboard-first status triage.
 */
export const ApplicationDetailDrawer: React.FC<ApplicationDetailDrawerProps> = ({
  card,
  isOpen,
  onClose,
  onOpenEmailExternal,
  onOpenEmail,
  onSetStatus,
  onResetStatus,
  hasOverride,
}) => {
  // Expand/collapse tracking for email snippets
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<string>>(() => new Set());
  const [prevCardKey, setPrevCardKey] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState<boolean>(true);

  // Synchronize drawer when switching records via j/k navigation: auto-expand the primary/open email
  const currentCardKey = card ? `${card.app.id}:${card.openEmailId}` : null;
  if (currentCardKey !== prevCardKey) {
    setPrevCardKey(currentCardKey);
    const initialOpenId = card?.openEmailId || (card && card.app.emails.length > 0 ? card.app.emails[0].id : null);
    setExpandedEmailIds(initialOpenId ? new Set([initialOpenId]) : new Set());
  }

  // Unified email opener callback
  const handleOpenEmail = (emailId: string) => {
    if (onOpenEmailExternal) {
      onOpenEmailExternal(emailId);
    } else if (onOpenEmail) {
      onOpenEmail(emailId);
    }
  };

  const toggleExpand = (emailId: string) => {
    setExpandedEmailIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  };

  const handleExpandAll = (emails: Email[]) => {
    setExpandedEmailIds(new Set(emails.map(e => e.id)));
  };

  const handleCollapseAll = () => {
    setExpandedEmailIds(new Set());
  };

  // Sort emails chronologically (or reverse)
  const sortedEmails = useMemo(() => {
    if (!card) return [];
    const list = [...card.app.emails];
    return list.sort((a, b) => {
      const timeA = new Date(a.receivedAt).getTime();
      const timeB = new Date(b.receivedAt).getTime();
      return sortAscending ? timeA - timeB : timeB - timeA;
    });
  }, [card, sortAscending]);

  if (!isOpen || !card) {
    return null;
  }

  // Active status badge & colors
  const statusBadge = getStageBadgeProps(card.lane);

  // Classifier confidence calculation
  const rawConfidence = card.app.confidence ?? 0;
  const confidencePct = Math.min(100, Math.max(0, Math.round(rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence)));

  // Provenance metadata from latest email
  const latestEmail = card.app.emails.length > 0 ? card.app.emails[0] : null;
  const decisionMeta = getDecisionSourceMeta(latestEmail?.decisionSource);
  const ruleMatched = latestEmail?.ruleMatched;
  const guardrailNote = latestEmail?.guardrailNote;

  // Deadline countdown calculation if applicable
  const deadlineCountdown = card.deadline ? getCountdown(card.deadline) : null;

  return (
    <div
      className="tk-drawer-backdrop bp-drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="tk-timeline-drawer tk-detail-drawer bp-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Application details for ${card.app.company}`}
        onClick={e => e.stopPropagation()}
      >
        {/* ==================================================================
            1. Header: Company title, role, status badge, close button
            ================================================================== */}
        <div className="tk-drawer-head bp-drawer-header">
          <div className="tk-drawer-title-group" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="tk-drawer-badge">
                <Icon name="work" size={16} />
                <span>Application Details</span>
              </div>
              {hasOverride && (
                <span className="tk-chip warn" style={{ fontSize: 10, padding: '1px 7px', minHeight: 20 }}>
                  Override Active
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
              <h2 style={{ margin: 0 }}>{card.app.company}</h2>
              <span className={`tk-stage-badge ${card.lane}`}>
                <i className={`c-${card.lane}`} aria-hidden="true" />
                {STAGE_LABELS[card.lane] || card.lane}
              </span>
            </div>

            <div className="tk-drawer-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{card.app.role || 'Role not specified'}</span>
              {card.app.domain && <span style={{ opacity: 0.7 }}>· {card.app.domain}</span>}
            </div>
          </div>

          <button
            type="button"
            className="tk-drawer-close bp-drawer-close"
            onClick={onClose}
            aria-label="Close application drawer"
            title="Close (Esc)"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* ==================================================================
            Drawer Body (Scrollable inspection content)
            ================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Metrics Bar: Deadline, Emails, Last Activity */}
          <div className="tk-drawer-stats">
            {/* Status / Deadline */}
            <div className="tk-drawer-stat-item">
              <span className="label">Deadline</span>
              <span className="val tabular num" style={{ fontSize: 16, marginTop: 4 }}>
                {deadlineCountdown ? deadlineCountdown.text : card.chip?.text || 'None'}
              </span>
              <small>{card.deadline ? 'Target completion' : 'No hard deadline'}</small>
            </div>

            {/* Total Messages */}
            <div className="tk-drawer-stat-item">
              <span className="label">Emails</span>
              <span className="val tabular num">
                {card.app.emails.length}
              </span>
              <small>in this thread</small>
            </div>

            {/* Last Activity */}
            <div className="tk-drawer-stat-item">
              <span className="label">Last Activity</span>
              <span className="val tabular num" style={{ fontSize: 16, marginTop: 4 }}>
                {card.lastEmail || (card.app.lastActivity ? formatNiceDate(card.app.lastActivity) : '—')}
              </span>
              <small>most recent date</small>
            </div>
          </div>

          {/* Stages Reached Progression Trail */}
          <div className="tk-detail-section">
            <span className="tk-detail-section-title">
              <Icon name="timeline" size={15} />
              Pipeline Progress
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {PIPELINE_ORDER.map((stage, sIdx) => {
                const reached = card.reached.has(stage);
                const isCurrent = card.lane === stage;
                return (
                  <React.Fragment key={stage}>
                    {sIdx > 0 && <span style={{ color: 'var(--tk-muted)', fontSize: 12 }}>→</span>}
                    <span
                      className={`tk-stage-badge ${stage}`}
                      style={{
                        opacity: reached ? 1 : 0.4,
                        fontWeight: isCurrent ? 800 : 600,
                        border: isCurrent ? '2px solid var(--tk-ink)' : '2px solid transparent',
                        padding: '4px 10px',
                      }}
                    >
                      <i className={`c-${stage}`} aria-hidden="true" />
                      {STAGE_LABELS[stage] || stage}
                    </span>
                  </React.Fragment>
                );
              })}
              {card.lane === 'rejected' && (
                <>
                  <span style={{ color: 'var(--tk-muted)', fontSize: 12 }}>→</span>
                  <span className="tk-stage-badge rejected" style={{ fontWeight: 800, border: '2px solid var(--tk-ink)', padding: '4px 10px' }}>
                    <i className="c-rejected" aria-hidden="true" />
                    Rejected
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ==================================================================
              2. Decision Provenance / Classifier Confidence Meter
              ================================================================== */}
          <div className="tk-detail-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="tk-detail-section-title">
                <Icon name="psychology" size={16} />
                Decision Provenance & Confidence
              </span>
              <span className="num tabular" style={{ fontSize: 13, fontWeight: 700, color: 'var(--tk-ink)' }}>
                {confidencePct}% Confidence
              </span>
            </div>

            {/* Visual 8px Progress Bar */}
            <div
              style={{
                height: 8,
                width: '100%',
                backgroundColor: '#e6e6e1',
                borderRadius: 4,
                overflow: 'hidden',
              }}
              role="progressbar"
              aria-valuenow={confidencePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Classifier confidence meter"
            >
              <div
                style={{
                  height: '100%',
                  width: `${confidencePct}%`,
                  backgroundColor: confidencePct >= 80 ? 'var(--tk-green)' : 'var(--tk-ink)',
                  borderRadius: 4,
                  transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>

            {/* Metadata Badges */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--tk-muted)' }}>Source:</span>
                <span className="tk-chip info" style={{ fontSize: 11, padding: '2px 8px', minHeight: 22 }}>
                  <Icon name={decisionMeta.icon} size={13} />
                  <span>{decisionMeta.label}</span>
                </span>
              </div>

              {ruleMatched && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--tk-muted)' }}>Rule:</span>
                  <code style={{ fontSize: 11, background: '#fff', padding: '2px 6px', borderRadius: 6, border: '1px solid #d9d9d3' }}>
                    {ruleMatched}
                  </code>
                </div>
              )}
            </div>

            {guardrailNote && (
              <div className="tk-chip warn" style={{ width: '100%', borderRadius: 10, padding: '6px 10px' }}>
                <Icon name="info" size={14} />
                <span>{guardrailNote}</span>
              </div>
            )}

            {hasOverride && (
              <div className="tk-chip warn" style={{ width: '100%', borderRadius: 10, padding: '6px 10px' }}>
                <Icon name="warning" size={14} />
                <span>
                  Stage manually set to <b>{statusBadge.label}</b> (overriding automated classifier).
                </span>
              </div>
            )}
          </div>

          {/* ==================================================================
              3. Quick Status Triage Action Bar
              ================================================================== */}
          <div className="tk-detail-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="tk-detail-section-title">
                <Icon name="tune" size={15} />
                Quick Stage Triage (1–5)
              </span>
              {hasOverride && (
                <span style={{ fontSize: 11, color: 'var(--tk-amber-ink)', fontWeight: 600 }}>
                  Override active
                </span>
              )}
            </div>

            <div role="group" aria-label="Quick Status Triage" className="tk-triage-grid">
              {TRIAGE_ACTIONS.map(action => {
                const isCurrentLane = card.lane === action.lane;

                return (
                  <button
                    key={action.lane}
                    type="button"
                    onClick={() => onSetStatus(card.app.id, action.lane)}
                    className={`tk-triage-pill bp-btn ${isCurrentLane ? 'on is-active' : ''}`}
                    title={`Set stage: ${action.label} (Hotkey: [${action.hotkey}])`}
                  >
                    <span>{action.label}</span>
                    <kbd className="tk-keycap bp-keycap">{action.hotkey}</kbd>
                  </button>
                );
              })}

              {/* Reset override button */}
              <button
                type="button"
                onClick={() => onResetStatus(card.app.id)}
                disabled={!hasOverride}
                className="tk-triage-pill bp-btn"
                style={{
                  opacity: hasOverride ? 1 : 0.45,
                  cursor: hasOverride ? 'pointer' : 'not-allowed',
                }}
                title="Reset manual override to classifier default (Hotkeys: [0] or [u])"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="restart_alt" size={13} />
                  Reset
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <kbd className="tk-keycap bp-keycap">0</kbd>
                  <kbd className="tk-keycap bp-keycap">u</kbd>
                </div>
              </button>
            </div>
          </div>

          {/* ==================================================================
              4. Chronological Email Thread List with Expandable Snippets
              ================================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Thread Header Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="tk-detail-section-title">
                <Icon name="mail" size={15} />
                Email Thread History ({sortedEmails.length})
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="tk-page-btn"
                  onClick={() => setSortAscending(prev => !prev)}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  title="Toggle chronological vs reverse chronological order"
                >
                  <Icon name="swap_vert" size={14} />
                  <span>{sortAscending ? 'Oldest first' : 'Newest first'}</span>
                </button>

                <button
                  type="button"
                  className="tk-page-btn"
                  onClick={() => {
                    if (expandedEmailIds.size === sortedEmails.length) {
                      handleCollapseAll();
                    } else {
                      handleExpandAll(sortedEmails);
                    }
                  }}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  <span>{expandedEmailIds.size === sortedEmails.length ? 'Collapse all' : 'Expand all'}</span>
                </button>
              </div>
            </div>

            {/* Email Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortedEmails.map((email, idx) => {
                const isExpanded = expandedEmailIds.has(email.id);
                const isPrimaryTarget = email.id === card.openEmailId;

                return (
                  <div
                    key={email.id}
                    className="tk-email-card bp-card"
                    style={{
                      borderColor: isPrimaryTarget ? 'var(--tk-ink)' : '#e9e9e4',
                    }}
                  >
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleExpand(email.id)}
                      className="tk-email-header"
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(email.id);
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tk-muted)' }}>
                            #{sortAscending ? idx + 1 : sortedEmails.length - idx}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tk-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {email.subject || '(No subject)'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span className={`tk-stage-badge ${email.stage}`}>
                            <i className={`c-${email.stage}`} aria-hidden="true" />
                            {STAGE_LABELS[email.stage] || email.stage}
                          </span>
                          <span className="tabular num" style={{ fontSize: 11, color: 'var(--tk-muted)', whiteSpace: 'nowrap' }}>
                            {formatNiceDate(email.receivedAt)}
                          </span>
                          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--tk-muted)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          From: {email.from}
                        </span>
                        {email.actionNeeded && (
                          <span className="tk-chip warn" style={{ fontSize: 10, padding: '1px 6px', minHeight: 20 }}>
                            Action Needed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Body */}
                    {isExpanded ? (
                      <div className="tk-email-body">
                        {email.deadlineResolved && (
                          <div className="tk-chip warn" style={{ width: '100%', marginBottom: 10 }}>
                            <Icon name="schedule" size={14} />
                            <span>
                              Deadline: <b>{email.deadlineRaw || formatNiceDate(email.deadlineResolved)}</b>
                            </span>
                          </div>
                        )}

                        <div style={{ color: 'var(--tk-ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.6 }}>
                          {email.fullBody || email.snippet}
                        </div>

                        {/* Action Bar for this email */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginTop: 12, borderTop: '1px solid #f0f0eb', fontSize: 12, color: 'var(--tk-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>Confidence: <b className="num tabular">{Math.round(email.confidence <= 1 ? email.confidence * 100 : email.confidence)}%</b></span>
                            <span>·</span>
                            <span>Source: {email.decisionSource}</span>
                          </div>

                          <button
                            type="button"
                            className="tk-page-btn"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenEmail(email.id);
                            }}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            title="Open this specific message in Gmail"
                          >
                            <Icon name="open_in_new" size={14} />
                            <span>Open in Gmail</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Collapsed Preview */
                      <div
                        style={{
                          padding: '8px 16px 12px',
                          color: 'var(--tk-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          fontSize: 12,
                          lineHeight: 1.5,
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleExpand(email.id)}
                      >
                        {email.snippet || '(No snippet available)'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================================================================
            5. Footer: Close button & Primary "Open in Gmail" action
            ================================================================== */}
        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid var(--tk-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tk-muted)' }}>
            <span>Nav:</span>
            <kbd className="tk-keycap bp-keycap">j</kbd>
            <span>/</span>
            <kbd className="tk-keycap bp-keycap">k</kbd>
            <span style={{ margin: '0 4px' }}>·</span>
            <span>Triage:</span>
            <kbd className="tk-keycap bp-keycap">1</kbd>
            <span>–</span>
            <kbd className="tk-keycap bp-keycap">5</kbd>
            <span style={{ margin: '0 4px' }}>·</span>
            <kbd className="tk-keycap bp-keycap">Esc</kbd>
            <span>closes</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="tk-page-btn bp-btn"
              onClick={onClose}
              style={{ height: 38, padding: '0 16px' }}
            >
              Close
            </button>
            <button
              type="button"
              className="tk-cta bp-btn-primary"
              onClick={() => handleOpenEmail(card.openEmailId)}
              title="Open the primary email thread in Gmail"
            >
              <span>Open in Gmail</span>
              <span><Icon name="open_in_new" size={16} /></span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
