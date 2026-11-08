import React from 'react';
import { Icon } from '../Icon';

export interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

const NAVIGATION_SHORTCUTS: ShortcutItem[] = [
  { keys: ['j', '↓'], description: 'Select next record' },
  { keys: ['k', '↑'], description: 'Select previous record' },
  { keys: ['Home'], description: 'Jump to first record' },
  { keys: ['End'], description: 'Jump to last record' },
  { keys: ['['], description: 'Previous page' },
  { keys: [']'], description: 'Next page' },
  { keys: ['Enter', 'Space', 'o'], description: 'Inspect application (open email)' },
  { keys: ['Esc'], description: 'Dismiss modal / clear selection' },
];

const TRIAGE_SHORTCUTS: ShortcutItem[] = [
  { keys: ['1'], description: 'Set status: Applied' },
  { keys: ['2'], description: 'Set status: Assessment' },
  { keys: ['3', 'i'], description: 'Set status: Interview' },
  { keys: ['4'], description: 'Set status: Offer' },
  { keys: ['5', 'r'], description: 'Set status: Rejected' },
  { keys: ['0', 'u'], description: 'Reset status override' },
  { keys: ['/'], description: 'Focus search input' },
  { keys: ['t'], description: 'Toggle activity timeline' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

/**
 * Palantir Blueprint Accessible Keyboard Shortcuts Cheat Sheet Dialog
 * Opens via '?' or 'Shift+/', dismisses via 'Escape' or backdrop click.
 */
export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="bp-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        onClick={e => e.stopPropagation()}
      >
        <div className="bp-dialog-header">
          <h3>Keyboard Shortcuts</h3>
          <button
            type="button"
            className="bp-drawer-close"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="bp-dialog-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '16px' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bp-text-muted)', marginBottom: 10 }}>
              Navigation & Inspection
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {NAVIGATION_SHORTCUTS.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--bp-text-dark)' }}>{s.description}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.keys.map((k, kIdx) => (
                      <kbd key={kIdx} className="bp-keycap">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--bp-text-muted)', marginBottom: 10 }}>
              Triage & Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TRIAGE_SHORTCUTS.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--bp-text-dark)' }}>{s.description}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.keys.map((k, kIdx) => (
                      <kbd key={kIdx} className="bp-keycap">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bp-drawer-footer" style={{ justifyContent: 'flex-end', fontSize: 11, color: 'var(--bp-text-muted)' }}>
          Press <kbd className="bp-keycap" style={{ margin: '0 4px' }}>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};
