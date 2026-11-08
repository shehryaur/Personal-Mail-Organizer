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
 * Keyboard Shortcuts Cheat Sheet Dialog
 * Opens via '?' or 'Shift+/', dismisses via 'Escape' or backdrop click.
 */
export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="tk-dialog-backdrop bp-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="tk-dialog bp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        onClick={e => e.stopPropagation()}
      >
        <div className="tk-dialog-header bp-dialog-header">
          <h3>Keyboard Shortcuts</h3>
          <button
            type="button"
            className="tk-drawer-close bp-drawer-close"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close (Esc)"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--tk-muted)', marginBottom: 12 }}>
              Navigation & Inspection
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NAVIGATION_SHORTCUTS.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--tk-ink)' }}>{s.description}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.keys.map((k, kIdx) => (
                      <kbd key={kIdx} className="tk-keycap bp-keycap">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--tk-muted)', marginBottom: 12 }}>
              Triage & Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TRIAGE_SHORTCUTS.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--tk-ink)' }}>{s.description}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.keys.map((k, kIdx) => (
                      <kbd key={kIdx} className="tk-keycap bp-keycap">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--tk-muted)', borderTop: '1px solid var(--tk-line)', paddingTop: 16 }}>
          Press <kbd className="tk-keycap bp-keycap" style={{ margin: '0 4px' }}>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};
