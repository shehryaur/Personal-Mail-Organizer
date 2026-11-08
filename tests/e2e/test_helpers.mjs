import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

// Initialize jiti with JSX parsing for loading React .tsx components in demo/
const { createJiti } = require(path.join(ROOT, 'demo/node_modules/jiti'));
export const jiti = createJiti(path.join(ROOT, 'test_harness.js'), { jsx: true });

// React and ReactDOMServer for authentic component rendering in Node.js
const React = require(path.join(ROOT, 'demo/node_modules/react'));
const ReactDOMServer = require(path.join(ROOT, 'demo/node_modules/react-dom/server'));
export { React, ReactDOMServer };

/**
 * Renders a React component to an authentic static HTML string.
 */
export function renderComponent(Component, props = {}) {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(Component, props));
}

// Authentic dashboard components & modules
export const { KeyboardShortcutsDialog } = jiti(path.join(ROOT, 'demo/src/components/dashboard/KeyboardShortcutsDialog.tsx'));
export const { ApplicationTable } = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationTable.tsx'));
export const { ApplicationDetailDrawer } = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationDetailDrawer.tsx'));
export const { StageMetricsBar } = jiti(path.join(ROOT, 'demo/src/components/dashboard/StageMetricsBar.tsx'));
export const { DateRangeControls } = jiti(path.join(ROOT, 'demo/src/components/dashboard/DateRangeControls.tsx'));
export const blueprintTokens = jiti(path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts'));
export const dateRangeConstants = jiti(path.join(ROOT, 'demo/src/components/dashboard/dateRangeConstants.ts'));

// Genuine production hotkey dispatcher
const trackerHotkeysModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/useTrackerHotkeys.ts'));
export const dispatchTrackerHotkey = trackerHotkeysModule.dispatchTrackerHotkey;
export const dispatchHotkey = dispatchTrackerHotkey; // Backward-compatible alias

/**
 * Loads board utility, feed adapter, and mock data modules.
 */
export function loadCoreModules() {
  const board = jiti(path.join(ROOT, 'demo/src/utils/board.ts'));
  const feed = jiti(path.join(ROOT, 'demo/src/extension/feed.ts'));
  const mock = jiti(path.join(ROOT, 'demo/src/data/mockData.ts'));
  return { board, feed, mock };
}

export { fs, path };

/**
 * Strips block and line comments from JSONC strings
 */
export function stripJsonComments(str) {
  return str.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

/**
 * Reads demo/src/components/dashboard/tracker.css
 */
export function readTrackerCss() {
  const p = path.join(ROOT, 'demo/src/components/dashboard/tracker.css');
  return fs.readFileSync(p, 'utf8');
}

/**
 * Checks if demo/src/components/dashboard/blueprintTokens.ts exists,
 * loads it if present, otherwise returns null.
 */
export function tryLoadBlueprintTokens() {
  const p = path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts');
  if (fs.existsSync(p)) {
    return jiti(p);
  }
  return null;
}

/**
 * Returns active CSS strictly from the live stylesheet tracker.css.
 * No mock string fallback is permitted (ensures genuine verification).
 */
export function getActiveCss() {
  const fileCss = readTrackerCss();
  return {
    css: fileCss,
    isLiveFile: true,
    rawFileCss: fileCss,
  };
}

/**
 * Authoritative Blueprint Intent Color Definitions (from PROJECT.md & Survey 2)
 */
export const REFERENCE_INTENTS = {
  primary: {
    solid: '#106ba3',
    hover: '#0e5a8a',
    bg: '#ebf1f5',
    text: '#106ba3',
    border: '#2b95d6',
  },
  success: {
    solid: '#0d8050',
    hover: '#0a6640',
    bg: '#edf8f2',
    text: '#0d8050',
    border: '#32a467',
  },
  warning: {
    solid: '#bf7300',
    hover: '#a66321',
    bg: '#fdf5ea',
    text: '#bf7300',
    border: '#ec9a3c',
  },
  danger: {
    solid: '#c23030',
    hover: '#a82222',
    bg: '#fdf2f2',
    text: '#c23030',
    border: '#e76a6e',
  },
};

/**
 * Authoritative lane to intent mapping function
 */
export function referenceGetLaneIntent(lane) {
  switch (String(lane || '').toLowerCase()) {
    case 'interview': return 'primary';
    case 'offer': return 'success';
    case 'assessment': return 'warning';
    case 'rejected': return 'danger';
    case 'applied':
    case 'review':
    default:
      return 'none';
  }
}

/**
 * Authoritative chip kind to intent mapping function
 */
export function referenceGetChipIntent(kind) {
  switch (String(kind || '').toLowerCase()) {
    case 'due': return 'warning';
    case 'info': return 'primary';
    case 'warn': return 'warning';
    case 'closed': return 'danger';
    case 'wait':
    default:
      return 'none';
  }
}

/**
 * In-memory Mock Storage implementing localStorage API with quota simulation
 */
export function createMockStorage(options = {}) {
  const store = new Map();
  let failOnSet = options.failOnSet || false;

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (failOnSet) {
        throw new Error('QuotaExceededError: DOMException quota exceeded');
      }
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    _setFailOnSet(val) {
      failOnSet = val;
    },
  };
}

/**
 * Creates a mock synthetic DOM KeyboardEvent
 */
export function createMockKeyEvent(key, options = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;

  return {
    key,
    type: 'keydown',
    ctrlKey: !!options.ctrlKey,
    metaKey: !!options.metaKey,
    altKey: !!options.altKey,
    shiftKey: !!options.shiftKey,
    target: options.target || { tagName: 'BODY', isContentEditable: false },
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {
      propagationStopped = true;
    },
    get isDefaultPrevented() {
      return defaultPrevented;
    },
    get isPropagationStopped() {
      return propagationStopped;
    },
  };
}

/**
 * Creates a mock DOM input element
 */
export function createMockInputElement(tagName = 'INPUT', options = {}) {
  let blurred = false;
  let focused = true;

  return {
    tagName: tagName.toUpperCase(),
    value: options.value || '',
    isContentEditable: !!options.isContentEditable,
    blur() {
      blurred = true;
      focused = false;
    },
    focus() {
      focused = true;
      blurred = false;
    },
    get isBlurred() {
      return blurred;
    },
    get isFocused() {
      return focused;
    },
  };
}

/**
 * Status Override & Triage State Simulator
 */
export function createTriageState(initialApplications, initialOverrides = {}, storage = createMockStorage()) {
  const OVERRIDE_KEY = 'trackerStatusOverrides';
  let overrides = { ...initialOverrides };

  // Load from storage if present
  try {
    const raw = storage.getItem(OVERRIDE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        overrides = { ...overrides, ...parsed };
      }
    }
  } catch {}

  const saveOverrides = () => {
    try {
      storage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    } catch {}
  };

  return {
    get overrides() {
      return { ...overrides };
    },
    setStatus(appId, stage) {
      overrides[appId] = stage;
      saveOverrides();
    },
    resetStatus(appId) {
      delete overrides[appId];
      saveOverrides();
    },
    hasOverride(appId) {
      return appId in overrides;
    },
    /**
     * Injects overrides onto applications, adjusting email stages so board.buildBoard()
     * dynamically computes new lane, counts, and chips.
     */
    applyTo(applications) {
      return applications.map(app => {
        const override = overrides[app.id];
        if (!override) return app;

        // If override is set, adjust emails to reflect overridden stage
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
    },
  };
}

/**
 * Creates a synthetic Application object for test isolation
 */
export function createMockApp(id, company, role, emails = []) {
  return {
    id,
    company,
    domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    role,
    stage: 'in_progress',
    currentStatus: emails[0]?.subject || 'Applied',
    deadline: emails.find(e => e.deadlineResolved)?.deadlineResolved || null,
    deadlineRaw: emails.find(e => e.deadlineRaw)?.deadlineRaw || null,
    lastActivity: emails[0]?.receivedAt || '2026-10-23T12:00:00Z',
    daysSinceLastActivity: 0,
    emails,
    confidence: 0.95,
    tags: [],
  };
}
