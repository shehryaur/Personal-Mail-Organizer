import React, { useState, useMemo } from 'react';
import type { Card, Lane } from '../../utils/board';
import type { Email } from '../../types';
import { Icon } from '../Icon';
import {
  getStageBadgeProps,
  getIntentColors,
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
 * Palantir Blueprint Progressive Disclosure Application Detail Drawer
 *
 * 520px right-docked drawer supporting deep inspection of job applications,
 * chronological email thread history, expandable snippets, decision provenance,
 * confidence meter, and rapid keyboard-first status triage.
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
  const confidenceIntent: BlueprintIntent =
    confidencePct >= 85 ? 'success' : confidencePct >= 65 ? 'primary' : 'warning';
  const confidenceColors = getIntentColors(confidenceIntent);

  // Provenance metadata from latest email
  const latestEmail = card.app.emails.length > 0 ? card.app.emails[0] : null;
  const decisionMeta = getDecisionSourceMeta(latestEmail?.decisionSource);
  const ruleMatched = latestEmail?.ruleMatched;
  const guardrailNote = latestEmail?.guardrailNote;

  // Deadline countdown calculation if applicable
  const deadlineCountdown = card.deadline ? getCountdown(card.deadline) : null;

  return (
    <div
      className="bp-drawer-backdrop tk-drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="bp-drawer bp-position-right bp-elevation-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Application details for ${card.app.company}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 95vw)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bp-white)',
          boxShadow: 'var(--bp-elevation-4)',
        }}
      >
        {/* ==================================================================
            1. Header: Company title, role, status Intent badge, close button
            ================================================================== */}
        <div
          className="bp-drawer-header"
          style={{
            height: 'auto',
            minHeight: 52,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--bp-border-color)',
            backgroundColor: 'var(--bp-panel-bg)',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--bp-text-dark)',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {card.app.company}
              </h3>

              <span className={statusBadge.className} style={statusBadge.style}>
                {statusBadge.label}
              </span>

              {hasOverride && (
                <span
                  className="bp-tag bp-round intent-warning bp-intent-warning"
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    fontWeight: 600,
                  }}
                  title="Stage manually overridden by user"
                >
                  Overridden
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: 12,
                color: 'var(--bp-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{card.app.role || 'Role not specified'}</span>
              {card.app.domain && (
                <span style={{ opacity: 0.75 }}>· {card.app.domain}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="bp-drawer-close"
            onClick={onClose}
            aria-label="Close application drawer"
            title="Close (Esc)"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* ==================================================================
            Drawer Body (Scrollable inspection content)
            ================================================================== */}
        <div
          className="bp-drawer-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Quick Metrics Bar: Deadline, Stages Reached, Last Activity */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}
          >
            {/* Status / Deadline */}
            <div
              className="bp-section-card"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--bp-border-color)',
                borderRadius: 3,
                backgroundColor: 'var(--bp-panel-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bp-text-muted)' }}>
                Deadline
              </span>
              <span
                className="bp-tabular-nums"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: deadlineCountdown?.isUrgent
                    ? 'var(--bp-intent-danger)'
                    : deadlineCountdown?.isWarning
                    ? 'var(--bp-intent-warning)'
                    : 'var(--bp-text-dark)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {deadlineCountdown ? deadlineCountdown.text : card.chip?.text || 'None'}
              </span>
            </div>

            {/* Total Messages */}
            <div
              className="bp-section-card"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--bp-border-color)',
                borderRadius: 3,
                backgroundColor: 'var(--bp-panel-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bp-text-muted)' }}>
                Emails
              </span>
              <span
                className="bp-tabular-nums"
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--bp-text-dark)' }}
              >
                {card.app.emails.length} message{card.app.emails.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Last Activity */}
            <div
              className="bp-section-card"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--bp-border-color)',
                borderRadius: 3,
                backgroundColor: 'var(--bp-panel-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bp-text-muted)' }}>
                Activity
              </span>
              <span
                className="bp-tabular-nums"
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--bp-text-dark)' }}
              >
                {card.lastEmail || (card.app.lastActivity ? formatNiceDate(card.app.lastActivity) : '—')}
              </span>
            </div>
          </div>

          {/* Stages Reached Progression Trail */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 10px',
              backgroundColor: 'var(--bp-white)',
              border: '1px solid var(--bp-border-color)',
              borderRadius: 3,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bp-text-muted)' }}>
              Pipeline Progress
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {PIPELINE_ORDER.map((stage, sIdx) => {
                const reached = card.reached.has(stage);
                const isCurrent = card.lane === stage;
                const badgeProps = getStageBadgeProps(stage);
                return (
                  <React.Fragment key={stage}>
                    {sIdx > 0 && (
                      <span style={{ color: 'var(--bp-text-disabled)', fontSize: 11 }}>→</span>
                    )}
                    <span
                      className={`bp-tag bp-round ${reached ? badgeProps.className : 'intent-neutral'}`}
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        opacity: reached ? 1 : 0.45,
                        fontWeight: isCurrent ? 700 : 500,
                        borderStyle: isCurrent ? 'solid' : 'dashed',
                        borderColor: isCurrent ? 'var(--bp-intent-primary)' : undefined,
                      }}
                    >
                      {badgeProps.label}
                    </span>
                  </React.Fragment>
                );
              })}
              {card.lane === 'rejected' && (
                <>
                  <span style={{ color: 'var(--bp-text-disabled)', fontSize: 11 }}>→</span>
                  <span
                    className="bp-tag bp-round intent-danger bp-intent-danger"
                    style={{ fontSize: 10, padding: '1px 6px', fontWeight: 700 }}
                  >
                    Rejected
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ==================================================================
              2. Decision Provenance / Classifier Confidence Meter
              ================================================================== */}
          <div
            className="bp-section-card"
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--bp-panel-bg)',
              borderRadius: 3,
              border: '1px solid var(--bp-border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--bp-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Icon name="psychology" size={15} />
                Decision Provenance & Confidence
              </span>
              <span
                className="bp-tabular-nums"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: confidenceColors.text,
                }}
              >
                {confidencePct}% Confidence
              </span>
            </div>

            {/* Visual 6px Progress Bar */}
            <div
              style={{
                height: 6,
                width: '100%',
                backgroundColor: 'var(--bp-light-gray-3)',
                borderRadius: 3,
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
                  backgroundColor: confidenceColors.solid,
                  borderRadius: 3,
                  transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>

            {/* Metadata Badges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 6,
                fontSize: 11,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--bp-text-dark)' }}>
                <span style={{ color: 'var(--bp-text-muted)' }}>Source:</span>
                <span
                  className="bp-tag bp-round intent-neutral"
                  style={{ fontSize: 11, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Icon name={decisionMeta.icon} size={13} />
                  {decisionMeta.label}
                </span>
              </div>

              {ruleMatched && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--bp-text-muted)' }}>Rule:</span>
                  <code
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--bp-font-mono)',
                      backgroundColor: 'var(--bp-white)',
                      border: '1px solid var(--bp-border-color)',
                      padding: '1px 5px',
                      borderRadius: 3,
                      color: 'var(--bp-text-dark)',
                    }}
                  >
                    {ruleMatched}
                  </code>
                </div>
              )}
            </div>

            {guardrailNote && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--bp-intent-warning-text)',
                  backgroundColor: 'var(--bp-intent-warning-bg)',
                  border: '1px solid var(--bp-intent-warning-border)',
                  borderRadius: 3,
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="info" size={14} />
                <span>{guardrailNote}</span>
              </div>
            )}

            {hasOverride && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--bp-intent-warning-text)',
                  backgroundColor: 'var(--bp-intent-warning-bg)',
                  border: '1px solid var(--bp-intent-warning-border)',
                  borderRadius: 3,
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon name="warning" size={14} />
                <span>
                  Stage manually overridden to <b>{statusBadge.label}</b> (automated classifier original baseline).
                </span>
              </div>
            )}
          </div>

          {/* ==================================================================
              3. Quick Status Triage Action Bar
              ================================================================== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--bp-text-muted)',
                }}
              >
                Quick Stage Triage
              </span>
              {hasOverride && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--bp-intent-warning)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="tune" size={13} />
                  Override Active
                </span>
              )}
            </div>

            <div
              role="group"
              aria-label="Quick Status Triage"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
              }}
            >
              {TRIAGE_ACTIONS.map(action => {
                const isCurrentLane = card.lane === action.lane;
                const actionIntent = getIntentColors(action.intent);

                return (
                  <button
                    key={action.lane}
                    type="button"
                    onClick={() => onSetStatus(card.app.id, action.lane)}
                    className={`bp-btn ${isCurrentLane ? 'bp-btn-primary is-active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      fontSize: 12,
                      fontWeight: isCurrentLane ? 600 : 500,
                      borderColor: isCurrentLane ? actionIntent.solid : undefined,
                      backgroundColor: isCurrentLane ? actionIntent.bg : undefined,
                      color: isCurrentLane ? actionIntent.text : undefined,
                      transition: 'all 0.1s ease',
                    }}
                    title={`Set stage: ${action.label} (Hotkey: [${action.hotkey}])`}
                  >
                    <span>{action.label}</span>
                    <kbd className="bp-keycap" style={{ marginLeft: 4 }}>
                      {action.hotkey}
                    </kbd>
                  </button>
                );
              })}

              {/* Reset override button */}
              <button
                type="button"
                onClick={() => onResetStatus(card.app.id)}
                disabled={!hasOverride}
                className="bp-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  fontSize: 12,
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
                  <kbd className="bp-keycap">0</kbd>
                  <kbd className="bp-keycap">u</kbd>
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
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--bp-text-muted)',
                }}
              >
                Email Thread History ({sortedEmails.length})
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="bp-btn bp-btn-minimal"
                  onClick={() => setSortAscending(prev => !prev)}
                  style={{ fontSize: 11, padding: '2px 6px', height: 22 }}
                  title="Toggle chronological vs reverse chronological order"
                >
                  <Icon name="swap_vert" size={14} />
                  <span>{sortAscending ? 'Oldest first' : 'Newest first'}</span>
                </button>

                <button
                  type="button"
                  className="bp-btn bp-btn-minimal"
                  onClick={() => {
                    if (expandedEmailIds.size === sortedEmails.length) {
                      handleCollapseAll();
                    } else {
                      handleExpandAll(sortedEmails);
                    }
                  }}
                  style={{ fontSize: 11, padding: '2px 6px', height: 22 }}
                >
                  <span>{expandedEmailIds.size === sortedEmails.length ? 'Collapse all' : 'Expand all'}</span>
                </button>
              </div>
            </div>

            {/* Email Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedEmails.map((email, idx) => {
                const isExpanded = expandedEmailIds.has(email.id);
                const emailBadge = getStageBadgeProps(email.stage);
                const isPrimaryTarget = email.id === card.openEmailId;

                return (
                  <div
                    key={email.id}
                    className="bp-card"
                    style={{
                      border: isPrimaryTarget
                        ? '1px solid var(--bp-intent-primary-border)'
                        : '1px solid var(--bp-border-color)',
                      borderRadius: 3,
                      backgroundColor: isPrimaryTarget ? 'rgba(16, 107, 163, 0.02)' : 'var(--bp-white)',
                      boxShadow: 'var(--bp-elevation-0)',
                      overflow: 'hidden',
                      transition: 'border-color 0.1s ease',
                    }}
                  >
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleExpand(email.id)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        backgroundColor: isExpanded ? 'var(--bp-panel-bg)' : 'transparent',
                        borderBottom: isExpanded ? '1px solid var(--bp-border-color)' : 'none',
                        transition: 'background-color 0.1s ease',
                      }}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--bp-text-muted)',
                              fontFamily: 'var(--bp-font-mono)',
                              width: 18,
                              textAlign: 'center',
                            }}
                          >
                            #{sortAscending ? idx + 1 : sortedEmails.length - idx}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--bp-text-dark)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {email.subject || '(No subject)'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span
                            className={emailBadge.className}
                            style={{ ...emailBadge.style, fontSize: 10, padding: '1px 6px' }}
                          >
                            {emailBadge.label}
                          </span>
                          <span
                            className="bp-tabular-nums"
                            style={{
                              fontSize: 11,
                              color: 'var(--bp-text-muted)',
                              fontFamily: 'var(--bp-font-mono)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatNiceDate(email.receivedAt)}
                          </span>
                          <Icon
                            name={isExpanded ? 'expand_less' : 'expand_more'}
                            size={18}
                            style={{ color: 'var(--bp-text-muted)' }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          color: 'var(--bp-text-muted)',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          From: {email.from}
                        </span>
                        {email.actionNeeded && (
                          <span
                            className="bp-tag intent-warning bp-intent-warning"
                            style={{ fontSize: 9, padding: '0 4px', textTransform: 'uppercase', fontWeight: 700 }}
                          >
                            Action Needed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Body */}
                    <div style={{ padding: '10px 12px', fontSize: 12 }}>
                      {isExpanded ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {email.deadlineResolved && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11,
                                padding: '4px 8px',
                                backgroundColor: 'var(--bp-intent-warning-bg)',
                                border: '1px solid var(--bp-intent-warning-border)',
                                borderRadius: 3,
                                color: 'var(--bp-intent-warning-text)',
                              }}
                            >
                              <Icon name="schedule" size={14} />
                              <span>
                                Deadline: <b>{email.deadlineRaw || formatNiceDate(email.deadlineResolved)}</b>
                              </span>
                            </div>
                          )}

                          <div
                            style={{
                              color: 'var(--bp-text-dark)',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: 12,
                              fontFamily: 'var(--bp-font-family)',
                            }}
                          >
                            {email.fullBody || email.snippet}
                          </div>

                          {/* Action Bar for this email */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: 8,
                              borderTop: '1px solid var(--bp-border-muted)',
                              fontSize: 11,
                              color: 'var(--bp-text-muted)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>
                                Confidence:{' '}
                                <b className="bp-tabular-nums">
                                  {Math.round(email.confidence <= 1 ? email.confidence * 100 : email.confidence)}%
                                </b>
                              </span>
                              <span>·</span>
                              <span>Source: {email.decisionSource}</span>
                            </div>

                            <button
                              type="button"
                              className="bp-btn bp-btn-minimal"
                              onClick={e => {
                                e.stopPropagation();
                                handleOpenEmail(email.id);
                              }}
                              style={{
                                fontSize: 11,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                color: 'var(--bp-intent-primary)',
                                padding: '2px 8px',
                                height: 24,
                              }}
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
                            color: 'var(--bp-text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.4,
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleExpand(email.id)}
                        >
                          {email.snippet || '(No snippet available)'}
                        </div>
                      )}
                    </div>
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
          className="bp-drawer-footer"
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--bp-border-color)',
            backgroundColor: 'var(--bp-panel-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--bp-text-muted)',
            }}
          >
            <span>Nav:</span>
            <kbd className="bp-keycap">j</kbd>
            <span>/</span>
            <kbd className="bp-keycap">k</kbd>
            <span style={{ margin: '0 4px' }}>·</span>
            <span>Triage:</span>
            <kbd className="bp-keycap">1</kbd>
            <span>–</span>
            <kbd className="bp-keycap">5</kbd>
            <span style={{ margin: '0 4px' }}>·</span>
            <kbd className="bp-keycap">Esc</kbd>
            <span>closes</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="bp-btn"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="bp-btn bp-btn-primary"
              onClick={() => handleOpenEmail(card.openEmailId)}
              title="Open the primary email thread in Gmail"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="open_in_new" size={15} />
              <span>Open in Gmail</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
