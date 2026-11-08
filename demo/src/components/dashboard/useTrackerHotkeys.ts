import { useEffect, useRef } from 'react';

/**
 * Palantir Blueprint Keyboard Ergonomics Engine
 * Options interface for useTrackerHotkeys
 */
export interface TrackerHotkeyOptions {
  activeRowIndex: number;
  totalRows: number;
  onSelectRow: (index: number) => void;
  onInspectRow: (index: number) => void;
  onTriageStatus?: (stage: string) => void;
  onFocusSearch: () => void;
  onToggleShortcuts: () => void;
  onToggleTimeline: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onDismiss: () => void;
  isDrawerOpen: boolean;
  isShortcutsOpen: boolean;
  isTimelineOpen: boolean;
  enabled?: boolean;
}

export interface HotkeyDispatchResult {
  handled: boolean;
  action?: string;
  suppressedByInputGuard?: boolean;
  modifierActive?: boolean;
  nextIndex?: number;
  prevIndex?: number;
  stage?: string;
  index?: number;
}

const TRIAGE_MAP: Record<string, string> = {
  '1': 'applied',
  '2': 'assessment',
  '3': 'interview',
  'i': 'interview',
  '4': 'offer',
  '5': 'rejected',
  'r': 'rejected',
  '0': 'reset',
  'u': 'reset',
};

/**
 * Pure hotkey dispatcher function implementing the Input Guard, modifier suppression,
 * and deterministic priority Escape hierarchy.
 */
export function dispatchTrackerHotkey(
  options: TrackerHotkeyOptions,
  event: KeyboardEvent | {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    target?: EventTarget | { tagName?: string; isContentEditable?: boolean; blur?: () => void } | null;
    preventDefault?: () => void;
  }
): HotkeyDispatchResult {
  const {
    activeRowIndex = 0,
    totalRows = 0,
    onSelectRow = () => {},
    onInspectRow = () => {},
    onTriageStatus = () => {},
    onFocusSearch = () => {},
    onToggleShortcuts = () => {},
    onToggleTimeline = () => {},
    onNextPage = () => {},
    onPrevPage = () => {},
    onDismiss = () => {},
    isDrawerOpen = false,
    isShortcutsOpen = false,
    isTimelineOpen = false,
  } = options;

  // 1. Bulletproof Input Guard: Suppress hotkeys while typing in editable elements
  const target = (event.target as HTMLElement | null) || ({} as HTMLElement);
  const isEditing =
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    Boolean(target.isContentEditable);

  if (isEditing) {
    if (event.key === 'Escape') {
      if (typeof target.blur === 'function') {
        target.blur();
      }
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }
    return { handled: false, suppressedByInputGuard: true };
  }

  // 2. Ignore shortcut triggers when meta modifiers (Ctrl, Cmd, Alt) are active
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return { handled: false, modifierActive: true };
  }

  // 3. Hierarchical Priority Escape Dismissal Stack
  // Shortcuts Dialog -> Detail Drawer -> Timeline Drawer -> Blur Search -> Clear Selection
  if (event.key === 'Escape') {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (isShortcutsOpen) {
      onToggleShortcuts();
      return { handled: true, action: 'close_shortcuts' };
    }
    if (isDrawerOpen) {
      onDismiss();
      return { handled: true, action: 'close_drawer' };
    }
    if (isTimelineOpen) {
      onToggleTimeline();
      return { handled: true, action: 'close_timeline' };
    }
    onDismiss();
    return { handled: true, action: 'clear_selection' };
  }

  // 4. Record Navigation Hotkeys
  if (event.key === 'j' || event.key === 'ArrowDown') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (totalRows <= 0) return { handled: true, action: 'navigate_noop' };
    const nextIdx = Math.min(activeRowIndex + 1, totalRows - 1);
    onSelectRow(nextIdx);
    return { handled: true, action: 'nav_down', nextIndex: nextIdx };
  }

  if (event.key === 'k' || event.key === 'ArrowUp') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (totalRows <= 0) return { handled: true, action: 'navigate_noop' };
    const prevIdx = Math.max(activeRowIndex - 1, 0);
    onSelectRow(prevIdx);
    return { handled: true, action: 'nav_up', prevIndex: prevIdx };
  }

  if (event.key === 'Home') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (totalRows <= 0) return { handled: true, action: 'navigate_noop' };
    onSelectRow(0);
    return { handled: true, action: 'nav_home', nextIndex: 0 };
  }

  if (event.key === 'End') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (totalRows <= 0) return { handled: true, action: 'navigate_noop' };
    const lastIdx = Math.max(0, totalRows - 1);
    onSelectRow(lastIdx);
    return { handled: true, action: 'nav_end', nextIndex: lastIdx };
  }

  // 5. Pagination Hotkeys
  if (event.key === ']' || event.key === 'n') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    onNextPage();
    return { handled: true, action: 'next_page' };
  }

  if (event.key === '[' || event.key === 'p') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    onPrevPage();
    return { handled: true, action: 'prev_page' };
  }

  // 6. Record Inspection Hotkeys (Enter / Space / o)
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'o') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (totalRows > 0 && activeRowIndex >= 0 && activeRowIndex < totalRows) {
      onInspectRow(activeRowIndex);
      return { handled: true, action: 'inspect_row', index: activeRowIndex };
    }
    return { handled: true, action: 'inspect_noop' };
  }

  // 7. Quick Status Triage Hotkeys (1–5, i, r, 0, u)
  if (event.key in TRIAGE_MAP) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (totalRows > 0 && activeRowIndex >= 0 && activeRowIndex < totalRows && onTriageStatus) {
      const stage = TRIAGE_MAP[event.key];
      onTriageStatus(stage);
      return { handled: true, action: 'triage_status', stage };
    }
    return { handled: true, action: 'triage_noop' };
  }

  // 8. Shortcuts Cheat Sheet Modal Hotkey (? or Shift+/)
  if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    onToggleShortcuts();
    return { handled: true, action: 'toggle_shortcuts' };
  }

  // 9. Search Focus Hotkey (/)
  if (event.key === '/') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    onFocusSearch();
    return { handled: true, action: 'focus_search' };
  }

  // 10. Timeline Drawer Toggle Hotkey (t)
  if (event.key === 't') {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    onToggleTimeline();
    return { handled: true, action: 'toggle_timeline' };
  }

  return { handled: false, action: 'unmapped_key' };
}

/**
 * Custom React Hook connecting keyboard events to Tracker actions
 */
export function useTrackerHotkeys(options: TrackerHotkeyOptions): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (options.enabled === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      dispatchTrackerHotkey(optionsRef.current, e);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options.enabled]);
}
