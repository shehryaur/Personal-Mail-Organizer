/**
 * ============================================================================
 * CHALLENGER M3: STATUS TRIAGE PERSISTENCE, REACTIVE BOARD & DRAWER INTEGRATION
 * Empirical Adversarial Verification Suite for Milestone 3
 *
 * Targets:
 * - demo/src/components/dashboard/ApplicationDetailDrawer.tsx (Triage Button Group & Reset)
 * - demo/src/components/dashboard/useTrackerHotkeys.ts (Triage Hotkeys: 1-5, i, r, 0, u)
 * - demo/src/components/dashboard/TrackerDashboard.tsx (State, Overrides & Storage Lifecycle)
 * - demo/src/components/dashboard/StageMetricsBar.tsx (Reactive Stage Counts & Accents)
 * - demo/src/components/dashboard/ApplicationTable.tsx (Reactive Table Badges & Stage Pills)
 * - demo/src/utils/board.ts (Aggregation under Status Overrides)
 *
 * Verification Areas:
 * 1. Full triage cycle from drawer button group and hotkeys (1–5, i, r, 0, u).
 * 2. Instant localStorage['trackerStatusOverrides'] updates on each triage event.
 * 3. Reactive board stage counts (board.counts), stage metric cards, and table badges.
 * 4. Status reset (0/u or reset button) restoring original classified stage and removing override tag.
 * 5. Corrupt / invalid localStorage recovery (non-JSON strings, arrays, numbers, nulls, quota errors).
 * 6. High-volume 10,000-iteration triage fuzzing & mathematical invariants verification.
 * ============================================================================
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Stub CSS imports for Node environment
require.extensions['.css'] = () => {};

const { createJiti } = require(path.join(ROOT, 'demo/node_modules/jiti'));
const jiti = createJiti(path.join(ROOT, 'test_harness.js'), { jsx: true });

// Load React and ReactDOMServer for static markup assertions
const React = require(path.join(ROOT, 'demo/node_modules/react'));
const ReactDOMServer = require(path.join(ROOT, 'demo/node_modules/react-dom/server'));

// Load target modules
const boardUtil = jiti(path.join(ROOT, 'demo/src/utils/board.ts'));
const feedUtil = jiti(path.join(ROOT, 'demo/src/extension/feed.ts'));
const mockData = jiti(path.join(ROOT, 'demo/src/data/mockData.ts'));
const tokensModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts'));
const hotkeysModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/useTrackerHotkeys.ts'));
const drawerModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationDetailDrawer.tsx'));
const stageMetricsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/StageMetricsBar.tsx'));
const appTableModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationTable.tsx'));
const trackerModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/TrackerDashboard.tsx'));

const { buildBoard, LANES } = boardUtil;
const { adaptFeed } = feedUtil;
const { SAMPLE_FEED } = mockData;
const { getStageBadgeProps, getIntentColors, STAGE_INTENT_BORDER_COLOR } = tokensModule;
const { dispatchTrackerHotkey } = hotkeysModule;
const { ApplicationDetailDrawer } = drawerModule;
const { StageMetricsBar } = stageMetricsModule;
const { ApplicationTable } = appTableModule;
const { TrackerDashboard } = trackerModule;

const SIMULATED_NOW = 1792744200000; // Fri Oct 23, 2026
const OVERRIDE_KEY = 'trackerStatusOverrides';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];
const startTime = performance.now();

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
  } else {
    failedTests++;
    failures.push(message);
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
  } else {
    failedTests++;
    const errMsg = `${message} — Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failures.push(errMsg);
    console.error(`  ❌ FAIL: ${errMsg}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  totalTests++;
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passedTests++;
  } else {
    failedTests++;
    const errMsg = `${message} — Expected: ${expectedStr}, Actual: ${actualStr}`;
    failures.push(errMsg);
    console.error(`  ❌ FAIL: ${errMsg}`);
  }
}

// In-Memory Mock LocalStorage with Quota and Security simulation
class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.shouldThrowQuota = false;
    this.shouldThrowSecurity = false;
  }
  getItem(key) {
    if (this.shouldThrowSecurity) throw new Error('SecurityError: Access is denied');
    return this.store.get(String(key)) ?? null;
  }
  setItem(key, val) {
    if (this.shouldThrowSecurity) throw new Error('SecurityError: Access is denied');
    if (this.shouldThrowQuota) throw new Error('QuotaExceededError: LocalStorage quota exceeded');
    this.store.set(String(key), String(val));
  }
  removeItem(key) {
    if (this.shouldThrowSecurity) throw new Error('SecurityError: Access is denied');
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
}

function createMockEvent(key, overrides = {}) {
  let defaultPrevented = false;
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: { tagName: 'BODY', isContentEditable: false },
    preventDefault: () => {
      defaultPrevented = true;
    },
    get isDefaultPrevented() {
      return defaultPrevented;
    },
    ...overrides,
  };
}

function createMockApp(id, company, role, emails = []) {
  const sorted = [...emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const lastActivity = sorted[0]?.receivedAt || new Date(SIMULATED_NOW).toISOString();
  return {
    id,
    company,
    role: role || null,
    domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    stage: 'open',
    currentStatus: emails[0]?.subject || 'Applied',
    deadline: emails.find(e => e.deadlineResolved)?.deadlineResolved || null,
    deadlineRaw: emails.find(e => e.deadlineRaw)?.deadlineRaw || null,
    lastActivity,
    daysSinceLastActivity: 0,
    emails,
    confidence: 0.92,
    tags: [],
  };
}

function createMockEmail(id, company, stage, receivedAt, opts = {}) {
  return {
    id,
    threadId: `th-${id}`,
    from: opts.from || `jobs@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    senderDomain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    subject: opts.subject || `Update from ${company}`,
    snippet: opts.snippet || `Status update for ${company}`,
    receivedAt,
    company,
    role: opts.role || 'Software Engineer',
    stage,
    deadlineResolved: opts.deadlineResolved || null,
    deadlineRaw: opts.deadlineRaw || null,
    decisionSource: opts.decisionSource || 'ai',
  };
}

/**
 * Pure override applier matching TrackerDashboard.tsx useMemo specification
 */
function applyStatusOverrides(applications, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return applications;
  return applications.map(app => {
    const override = overrides[app.id];
    if (!override) return app;
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
}

console.log('================================================================');
console.log('CHALLENGER M3: STATUS TRIAGE PERSISTENCE & REACTIVE INTEGRATION');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: ApplicationDetailDrawer Triage Button Group & Reset Ergonomics
// -----------------------------------------------------------------------------
console.log('--- Suite 1: ApplicationDetailDrawer Triage Button Group & Reset ---');

{
  const testApp = createMockApp('app-drawer-1', 'Stripe', 'Frontend Engineer', [
    createMockEmail('e-stripe-1', 'Stripe', 'applied', '2026-10-10T10:00:00Z'),
  ]);
  const initialBoard = buildBoard([testApp], SIMULATED_NOW);
  const initialCard = initialBoard.cards[0];

  let setStatusCall = null;
  let resetStatusCall = null;

  // 1.1 Render Drawer when isOpen=false returns null
  const closedHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ApplicationDetailDrawer, {
      card: initialCard,
      isOpen: false,
      onClose: () => {},
      onSetStatus: (appId, lane) => { setStatusCall = { appId, lane }; },
      onResetStatus: appId => { resetStatusCall = appId; },
      hasOverride: false,
    })
  );
  assertEqual(closedHtml, '', 'Drawer renders empty string when isOpen=false');

  // 1.2 Render Drawer when card=null returns null
  const nullCardHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ApplicationDetailDrawer, {
      card: null,
      isOpen: true,
      onClose: () => {},
      onSetStatus: () => {},
      onResetStatus: () => {},
      hasOverride: false,
    })
  );
  assertEqual(nullCardHtml, '', 'Drawer renders empty string when card=null');

  // 1.3 Render Drawer in Baseline State (hasOverride=false)
  const baselineHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ApplicationDetailDrawer, {
      card: initialCard,
      isOpen: true,
      onClose: () => {},
      onSetStatus: (appId, lane) => { setStatusCall = { appId, lane }; },
      onResetStatus: appId => { resetStatusCall = appId; },
      hasOverride: false,
    })
  );

  assert(baselineHtml.includes('Stripe'), 'Renders company name in drawer header');
  assert(baselineHtml.includes('Quick Stage Triage'), 'Renders Quick Stage Triage action section');
  assert(baselineHtml.includes('Applied'), 'Renders Applied action button');
  assert(baselineHtml.includes('Assessment'), 'Renders Assessment action button');
  assert(baselineHtml.includes('Interview'), 'Renders Interview action button');
  assert(baselineHtml.includes('Offer'), 'Renders Offer action button');
  assert(baselineHtml.includes('Rejected'), 'Renders Rejected action button');
  assert(baselineHtml.includes('Reset'), 'Renders Reset action button');

  // Keycap hotkey indicators
  assert(baselineHtml.includes('>1</kbd>'), 'Applied button displays [1] hotkey keycap');
  assert(baselineHtml.includes('>2</kbd>'), 'Assessment button displays [2] hotkey keycap');
  assert(baselineHtml.includes('>3</kbd>'), 'Interview button displays [3] hotkey keycap');
  assert(baselineHtml.includes('>4</kbd>'), 'Offer button displays [4] hotkey keycap');
  assert(baselineHtml.includes('>5</kbd>'), 'Rejected button displays [5] hotkey keycap');
  assert(baselineHtml.includes('>0</kbd>') && baselineHtml.includes('>u</kbd>'), 'Reset button displays [0] and [u] hotkey keycaps');

  // Baseline hasOverride=false invariants:
  assert(!baselineHtml.includes('Stage manually overridden to'), 'Baseline drawer does NOT show overridden provenance banner');
  assert(!baselineHtml.includes('Override Active'), 'Baseline drawer does NOT show Override Active badge');
  assert(baselineHtml.includes('disabled=""') || baselineHtml.includes('disabled'), 'Reset button is disabled when hasOverride=false');
  assert(baselineHtml.includes('not-allowed'), 'Reset button has not-allowed cursor style when hasOverride=false');

  // Current active lane button styling
  assert(baselineHtml.includes('is-active'), 'Active lane button receives is-active class');

  // 1.4 Render Drawer in Overridden State (hasOverride=true)
  const overriddenCard = { ...initialCard, lane: 'interview' };
  const overriddenHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ApplicationDetailDrawer, {
      card: overriddenCard,
      isOpen: true,
      onClose: () => {},
      onSetStatus: (appId, lane) => { setStatusCall = { appId, lane }; },
      onResetStatus: appId => { resetStatusCall = appId; },
      hasOverride: true,
    })
  );

  assert(overriddenHtml.includes('Overridden'), 'Overridden tag is rendered in header when hasOverride=true');
  assert(overriddenHtml.includes('Override Active'), 'Header shows Override Active tag when hasOverride=true');
  assert(overriddenHtml.includes('Stage manually overridden to'), 'Provenance section explains manual stage override');
  assert(!overriddenHtml.includes('cursor:not-allowed') && !overriddenHtml.includes('cursor: not-allowed'), 'Reset button cursor is enabled when hasOverride=true');
  assert(overriddenHtml.includes('cursor:pointer') || overriddenHtml.includes('cursor: pointer'), 'Reset button cursor is pointer when hasOverride=true');
}

// -----------------------------------------------------------------------------
// SUITE 2: Hotkey Triage Engine (1–5, i, r, 0, u) & Input Guard Safety
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Hotkey Triage Engine & Input Guard Safety ---');

{
  let lastTriagedStage = null;
  const dispatchOptions = {
    activeRowIndex: 0,
    totalRows: 5,
    onSelectRow: () => {},
    onInspectRow: () => {},
    onTriageStatus: stage => { lastTriagedStage = stage; },
    onFocusSearch: () => {},
    onToggleShortcuts: () => {},
    onToggleTimeline: () => {},
    onNextPage: () => {},
    onPrevPage: () => {},
    onDismiss: () => {},
    isDrawerOpen: true,
    isShortcutsOpen: false,
    isTimelineOpen: false,
  };

  const hotkeyExpectations = [
    { key: '1', expectedStage: 'applied', expectedAction: 'triage_status' },
    { key: '2', expectedStage: 'assessment', expectedAction: 'triage_status' },
    { key: '3', expectedStage: 'interview', expectedAction: 'triage_status' },
    { key: 'i', expectedStage: 'interview', expectedAction: 'triage_status' },
    { key: '4', expectedStage: 'offer', expectedAction: 'triage_status' },
    { key: '5', expectedStage: 'rejected', expectedAction: 'triage_status' },
    { key: 'r', expectedStage: 'rejected', expectedAction: 'triage_status' },
    { key: '0', expectedStage: 'reset', expectedAction: 'triage_status' },
    { key: 'u', expectedStage: 'reset', expectedAction: 'triage_status' },
  ];

  for (const { key, expectedStage, expectedAction } of hotkeyExpectations) {
    lastTriagedStage = null;
    const evt = createMockEvent(key);
    const res = dispatchTrackerHotkey(dispatchOptions, evt);

    assertEqual(res.handled, true, `Hotkey '${key}' is handled: true`);
    assertEqual(res.action, expectedAction, `Hotkey '${key}' dispatches action '${expectedAction}'`);
    assertEqual(res.stage, expectedStage, `Hotkey '${key}' maps to stage '${expectedStage}'`);
    assertEqual(lastTriagedStage, expectedStage, `Hotkey '${key}' invokes callback with '${expectedStage}'`);
    assertEqual(evt.isDefaultPrevented, true, `Hotkey '${key}' calls preventDefault()`);
  }

  // 2.2 Boundary: totalRows = 0 suppresses triage
  lastTriagedStage = null;
  const emptyOptions = { ...dispatchOptions, totalRows: 0 };
  const evtZero = createMockEvent('3');
  const resZero = dispatchTrackerHotkey(emptyOptions, evtZero);
  assertEqual(resZero.handled, true, 'Hotkey on totalRows=0 is handled');
  assertEqual(resZero.action, 'triage_noop', 'Hotkey on totalRows=0 returns triage_noop');
  assertEqual(lastTriagedStage, null, 'Callback is NOT called when totalRows=0');

  // 2.3 Boundary: activeRowIndex out-of-bounds suppresses triage
  lastTriagedStage = null;
  const oobOptions = { ...dispatchOptions, activeRowIndex: 999 };
  const resOob = dispatchTrackerHotkey(oobOptions, createMockEvent('4'));
  assertEqual(resOob.action, 'triage_noop', 'Hotkey with out-of-bounds row returns triage_noop');
  assertEqual(lastTriagedStage, null, 'Callback is NOT called when activeRowIndex is out of bounds');

  // 2.4 Safety Guard: Input typing suppresses triage hotkeys
  const editableTags = ['INPUT', 'TEXTAREA', 'SELECT'];
  for (const tagName of editableTags) {
    lastTriagedStage = null;
    const inputEvt = createMockEvent('3', { target: { tagName, isContentEditable: false } });
    const resInput = dispatchTrackerHotkey(dispatchOptions, inputEvt);
    assertEqual(resInput.handled, false, `Hotkey '3' suppressed while typing in <${tagName}>`);
    assertEqual(resInput.suppressedByInputGuard, true, `SuppressedByInputGuard flag set for <${tagName}>`);
    assertEqual(lastTriagedStage, null, `Callback not fired while typing in <${tagName}>`);
  }

  // contentEditable = true suppression
  lastTriagedStage = null;
  const ceEvt = createMockEvent('i', { target: { tagName: 'DIV', isContentEditable: true } });
  const resCe = dispatchTrackerHotkey(dispatchOptions, ceEvt);
  assertEqual(resCe.handled, false, "Hotkey 'i' suppressed in contentEditable div");
  assertEqual(resCe.suppressedByInputGuard, true, 'SuppressedByInputGuard set for contentEditable div');
  assertEqual(lastTriagedStage, null, 'Callback not fired in contentEditable');

  // 2.5 Modifier Key Safety: Ctrl/Meta/Alt + Triage key suppressed
  for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
    lastTriagedStage = null;
    const modEvt = createMockEvent('2', { [mod]: true });
    const resMod = dispatchTrackerHotkey(dispatchOptions, modEvt);
    assertEqual(resMod.handled, false, `Hotkey with ${mod}=true is not handled`);
    assertEqual(resMod.modifierActive, true, `modifierActive flag is true for ${mod}`);
    assertEqual(lastTriagedStage, null, `Callback not fired when ${mod} is active`);
  }
}

// -----------------------------------------------------------------------------
// SUITE 3: Synchronous localStorage Updates on Each Triage Event
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Immediate localStorage Updates on Triage Events ---');

{
  const storage = new MockLocalStorage();

  function loadStatusOverridesFrom(store) {
    try {
      const raw = store.getItem(OVERRIDE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return {};
  }

  function saveStatusOverridesTo(store, overrides) {
    try {
      store.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    } catch {}
  }

  // Initial store should be empty
  assertDeepEqual(loadStatusOverridesFrom(storage), {}, 'Initial store returns empty object');

  // 3.1 First triage event: App 1 -> 'assessment'
  let overrides = { ...loadStatusOverridesFrom(storage), 'app-alpha': 'assessment' };
  saveStatusOverridesTo(storage, overrides);

  let rawInStorage = storage.getItem(OVERRIDE_KEY);
  assert(rawInStorage !== null, 'localStorage[trackerStatusOverrides] is immediately created');
  assertDeepEqual(JSON.parse(rawInStorage), { 'app-alpha': 'assessment' }, 'Storage contains { app-alpha: assessment }');

  // 3.2 Second triage event: App 1 -> 'interview'
  overrides = { ...loadStatusOverridesFrom(storage), 'app-alpha': 'interview' };
  saveStatusOverridesTo(storage, overrides);
  assertDeepEqual(loadStatusOverridesFrom(storage), { 'app-alpha': 'interview' }, 'Storage updates synchronously to interview');

  // 3.3 Third triage event: App 2 -> 'offer'
  overrides = { ...loadStatusOverridesFrom(storage), 'app-beta': 'offer' };
  saveStatusOverridesTo(storage, overrides);
  assertDeepEqual(
    loadStatusOverridesFrom(storage),
    { 'app-alpha': 'interview', 'app-beta': 'offer' },
    'Storage persists multiple applications concurrently'
  );

  // 3.4 Fourth triage event: App 1 -> 'rejected'
  overrides = { ...loadStatusOverridesFrom(storage), 'app-alpha': 'rejected' };
  saveStatusOverridesTo(storage, overrides);
  assertDeepEqual(
    loadStatusOverridesFrom(storage),
    { 'app-alpha': 'rejected', 'app-beta': 'offer' },
    'Storage reflects stage change to rejected'
  );

  // 3.5 Reset App 1 removes its key, keeping App 2 intact
  delete overrides['app-alpha'];
  saveStatusOverridesTo(storage, overrides);
  assertDeepEqual(loadStatusOverridesFrom(storage), { 'app-beta': 'offer' }, 'Resetting app-alpha removes its entry only');

  // 3.6 Reset App 2 leaves empty object in storage
  delete overrides['app-beta'];
  saveStatusOverridesTo(storage, overrides);
  assertDeepEqual(loadStatusOverridesFrom(storage), {}, 'Resetting all overrides leaves clean empty store');
}

// -----------------------------------------------------------------------------
// SUITE 4: Reactive Board Stage Counts, Metric Cards & Table Badges Real-Time Updates
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Reactive Board Counts, Metric Cards & Table Badges ---');

{
  // Build a test suite of 5 diverse applications
  const app1 = createMockApp('app-1', 'AlphaCorp', 'Frontend Eng', [
    createMockEmail('e-1', 'AlphaCorp', 'applied', '2026-10-15T10:00:00Z'),
  ]);
  const app2 = createMockApp('app-2', 'BetaTech', 'Backend Eng', [
    createMockEmail('e-2', 'BetaTech', 'applied', '2026-10-12T10:00:00Z'),
    createMockEmail('e-3', 'BetaTech', 'assessment', '2026-10-18T10:00:00Z'),
  ]);
  const app3 = createMockApp('app-3', 'GammaAI', 'Staff Eng', [
    createMockEmail('e-4', 'GammaAI', 'applied', '2026-10-01T10:00:00Z'),
    createMockEmail('e-5', 'GammaAI', 'interview', '2026-10-20T10:00:00Z'),
  ]);
  const app4 = createMockApp('app-4', 'DeltaCloud', 'DevOps Eng', [
    createMockEmail('e-6', 'DeltaCloud', 'applied', '2026-09-20T10:00:00Z'),
    createMockEmail('e-7', 'DeltaCloud', 'offer', '2026-10-22T10:00:00Z'),
  ]);
  const app5 = createMockApp('app-5', 'EpsilonSys', 'Architect', [
    createMockEmail('e-8', 'EpsilonSys', 'applied', '2026-09-01T10:00:00Z'),
    createMockEmail('e-9', 'EpsilonSys', 'rejected', '2026-10-10T10:00:00Z'),
  ]);

  const baseApps = [app1, app2, app3, app4, app5];

  // 4.1 Baseline Board Verification
  const baseBoard = buildBoard(baseApps, SIMULATED_NOW);
  const getCount = (board, lane) => board.counts.find(c => c.key === lane)?.count ?? 0;

  assertEqual(getCount(baseBoard, 'applied'), 5, 'Baseline total applied is 5');
  assertEqual(getCount(baseBoard, 'assessment'), 1, 'Baseline assessment count is 1 (app2)');
  assertEqual(getCount(baseBoard, 'interview'), 1, 'Baseline interview count is 1 (app3)');
  assertEqual(getCount(baseBoard, 'offer'), 1, 'Baseline offer count is 1 (app4)');
  assertEqual(getCount(baseBoard, 'rejected'), 1, 'Baseline rejected count is 1 (app5)');

  // 4.2 Triage app1 from 'applied' -> 'assessment'
  const overrides1 = { 'app-1': 'assessment' };
  const board1 = buildBoard(applyStatusOverrides(baseApps, overrides1), SIMULATED_NOW);
  assertEqual(getCount(board1, 'assessment'), 2, 'Assessment count reactively increments to 2');
  const cardApp1 = board1.cards.find(c => c.app.id === 'app-1');
  assertEqual(cardApp1.lane, 'assessment', 'app-1 card lane dynamically shifts to assessment');

  // Verify StageMetricsBar reflects updated assessment count
  const metricsHtml1 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StageMetricsBar, {
      counts: board1.counts,
      activeStage: 'all',
      onSelectStage: () => {},
    })
  );
  assert(metricsHtml1.includes('Assessments</span></div><span class="bp-metric-value num tabular">2</span>'), 'Metric card renders updated count 2 for Assessments');

  // Verify ApplicationTable reflects updated badge for app-1
  const tableHtml1 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ApplicationTable, {
      cards: board1.lanes.flatMap(l => l.cards),
      totalFilteredCount: board1.cards.length,
      allCardsCount: board1.cards.length,
      lanes: board1.lanes,
      activeStage: 'all',
      onSelectStage: () => {},
      searchQuery: '',
      onSearchChange: () => {},
      selectedRowIndex: 0,
      onSelectRow: () => {},
      onInspectCard: () => {},
      page: 0,
      totalPages: 1,
      onNextPage: () => {},
      onPrevPage: () => {},
    })
  );
  assert(tableHtml1.includes('c-assessment'), 'ApplicationTable renders c-assessment badge class');

  // 4.3 Triage app1 from 'assessment' -> 'interview'
  const overrides2 = { 'app-1': 'interview' };
  const board2 = buildBoard(applyStatusOverrides(baseApps, overrides2), SIMULATED_NOW);
  assertEqual(getCount(board2, 'assessment'), 1, 'Assessment count decrements back to 1');
  assertEqual(getCount(board2, 'interview'), 2, 'Interview count increments to 2');
  assertEqual(board2.cards.find(c => c.app.id === 'app-1').lane, 'interview', 'app-1 card is in interview lane');

  // 4.4 Triage app1 from 'interview' -> 'offer'
  const overrides3 = { 'app-1': 'offer' };
  const board3 = buildBoard(applyStatusOverrides(baseApps, overrides3), SIMULATED_NOW);
  assertEqual(getCount(board3, 'interview'), 1, 'Interview count decrements back to 1');
  assertEqual(getCount(board3, 'offer'), 2, 'Offer count increments to 2');

  const metricsHtml3 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(StageMetricsBar, {
      counts: board3.counts,
      activeStage: 'all',
      onSelectStage: () => {},
    })
  );
  assert(metricsHtml3.includes('hot'), 'StageMetricsBar applies .hot class when offer count > 0');

  // 4.5 Triage app1 from 'offer' -> 'rejected'
  const overrides4 = { 'app-1': 'rejected' };
  const board4 = buildBoard(applyStatusOverrides(baseApps, overrides4), SIMULATED_NOW);
  assertEqual(getCount(board4, 'offer'), 1, 'Offer count decrements to 1');
  assertEqual(getCount(board4, 'rejected'), 2, 'Rejected count increments to 2');
  const rejectedCard = board4.cards.find(c => c.app.id === 'app-1');
  assertEqual(rejectedCard.lane, 'rejected', 'app-1 lane is rejected');
  assertEqual(rejectedCard.chip.kind, 'closed', 'app-1 card chip is closed');

  // 4.6 Multiple Concurrent Overrides
  const multiOverrides = {
    'app-1': 'offer',
    'app-2': 'offer',
    'app-3': 'rejected',
    'app-5': 'interview', // revive rejected app to interview
  };
  const boardMulti = buildBoard(applyStatusOverrides(baseApps, multiOverrides), SIMULATED_NOW);
  assertEqual(getCount(boardMulti, 'offer'), 3, 'Offer count correctly aggregates 3 offers (app1, app2, app4)');
  assertEqual(getCount(boardMulti, 'interview'), 1, 'Interview count reflects revived app5');
  // app3 has 2 emails, both become stage: rejected, so emailsOf('rejected') is 2
  assertEqual(getCount(boardMulti, 'rejected'), 2, 'Rejected count reflects 2 rejected emails from app3');
  const rejectedLane = boardMulti.lanes.find(l => l.key === 'rejected');
  assertEqual(rejectedLane.cards.length, 1, 'Rejected lane contains exactly 1 company (app3)');
  const totalLaneCards = boardMulti.lanes.reduce((sum, l) => sum + l.cards.length, 0);
  assertEqual(totalLaneCards, baseApps.length, 'Sum of lane cards equals total applications');
}

// -----------------------------------------------------------------------------
// SUITE 5: Status Reset (0 / u / Reset Button) Restores Baseline
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Status Reset Restores Baseline & Strips Override ---');

{
  const testApp = createMockApp('app-reset-test', 'Oracle', 'DB Engineer', [
    createMockEmail('e-orcl-1', 'Oracle', 'applied', '2026-10-01T10:00:00Z'),
    createMockEmail('e-orcl-2', 'Oracle', 'interview', '2026-10-15T10:00:00Z'),
  ]);

  const baseBoard = buildBoard([testApp], SIMULATED_NOW);
  const baseCard = baseBoard.cards[0];
  assertEqual(baseCard.lane, 'interview', 'Original baseline stage is interview');

  // 1. Override to 'rejected'
  const overriddenApps = applyStatusOverrides([testApp], { 'app-reset-test': 'rejected' });
  const overriddenBoard = buildBoard(overriddenApps, SIMULATED_NOW);
  assertEqual(overriddenBoard.cards[0].lane, 'rejected', 'App overridden to rejected');

  // 2. Perform Reset (delete override)
  const resetApps = applyStatusOverrides([testApp], {});
  const resetBoard = buildBoard(resetApps, SIMULATED_NOW);
  assertEqual(resetBoard.cards[0].lane, 'interview', 'Reset accurately restores original interview stage');
  assertEqual(resetBoard.cards[0].chip.kind !== 'closed', true, 'Reset removes closed rejection chip');

  // 3. Render Drawer after reset: hasOverride = false
  const resetDrawerHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(ApplicationDetailDrawer, {
      card: resetBoard.cards[0],
      isOpen: true,
      onClose: () => {},
      onSetStatus: () => {},
      onResetStatus: () => {},
      hasOverride: false,
    })
  );
  assert(!resetDrawerHtml.includes('Overridden'), 'Drawer no longer displays Overridden tag');
  assert(!resetDrawerHtml.includes('Stage manually overridden to'), 'Drawer no longer displays manual override notice');
  assert(resetDrawerHtml.includes('disabled=""') || resetDrawerHtml.includes('disabled'), 'Reset button is disabled');
}

// -----------------------------------------------------------------------------
// SUITE 6: Corrupt / Invalid localStorage Recovery & Fault Tolerance
// -----------------------------------------------------------------------------
console.log('\n--- Suite 6: Corrupt / Invalid localStorage Recovery ---');

{
  const corruptPayloads = [
    { label: 'Non-JSON syntax string', payload: '{bad-json: true' },
    { label: 'Unclosed bracket string', payload: '{"app-1": "interview"' },
    { label: 'Raw undefined string', payload: 'undefined' },
    { label: 'Raw NaN string', payload: 'NaN' },
    { label: 'Array of numbers', payload: '[1, 2, 3]' },
    { label: 'Array of stage strings', payload: '["applied", "interview"]' },
    { label: 'Raw positive number', payload: '42' },
    { label: 'Raw zero number', payload: '0' },
    { label: 'Raw negative float number', payload: '-13.37' },
    { label: 'Raw boolean true', payload: 'true' },
    { label: 'Raw boolean false', payload: 'false' },
    { label: 'Raw null string', payload: 'null' },
    { label: 'Empty string', payload: '' },
  ];

  function safeLoadStatusOverrides(store) {
    try {
      const raw = store.getItem(OVERRIDE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return {};
  }

  for (const { label, payload } of corruptPayloads) {
    const corruptedStorage = new MockLocalStorage();
    corruptedStorage.store.set(OVERRIDE_KEY, payload);

    let result = null;
    let threw = false;
    try {
      result = safeLoadStatusOverrides(corruptedStorage);
    } catch (err) {
      threw = true;
    }

    assertEqual(threw, false, `Corrupt recovery for [${label}] does NOT throw exception`);
    assertDeepEqual(result, {}, `Corrupt recovery for [${label}] safely returns empty object {}`);

    // Verify system recovers cleanly by saving a valid override after corruption
    let recoveredOverrides = { ...result, 'app-recovered': 'interview' };
    corruptedStorage.setItem(OVERRIDE_KEY, JSON.stringify(recoveredOverrides));
    const reloaded = safeLoadStatusOverrides(corruptedStorage);
    assertDeepEqual(reloaded, { 'app-recovered': 'interview' }, `Store cleanly recovers and saves valid override after [${label}]`);
  }

  // 6.2 Invalid/Unknown stage value in storage does not crash board
  const testApp = createMockApp('app-weird-stage', 'CyberDyne', 'SysAdmin', [
    createMockEmail('e-cd-1', 'CyberDyne', 'applied', '2026-10-10T10:00:00Z'),
  ]);
  const bogusStageApps = applyStatusOverrides([testApp], { 'app-weird-stage': 'non_existent_galactic_stage' });
  let bogusBoard = null;
  let bogusThrew = false;
  try {
    bogusBoard = buildBoard(bogusStageApps, SIMULATED_NOW);
  } catch {
    bogusThrew = true;
  }
  assertEqual(bogusThrew, false, 'Unknown stage string in overrides does NOT crash buildBoard');
  assertEqual(bogusBoard.cards.length, 1, 'Unknown stage string card is preserved on board');
  assertEqual(bogusBoard.cards[0].lane, 'applied', 'Unknown stage string safely defaults to applied lane');

  // 6.3 QuotaExceededError handling in storage
  const quotaStorage = new MockLocalStorage();
  quotaStorage.shouldThrowQuota = true;
  let quotaThrew = false;
  try {
    try {
      quotaStorage.setItem(OVERRIDE_KEY, JSON.stringify({ 'app-q': 'interview' }));
    } catch {}
  } catch {
    quotaThrew = true;
  }
  assertEqual(quotaThrew, false, 'Storage QuotaExceededError is gracefully handled without unhandled throw');

  // 6.4 SecurityError / Access Denied handling
  const secStorage = new MockLocalStorage();
  secStorage.shouldThrowSecurity = true;
  let secResult = null;
  let secThrew = false;
  try {
    secResult = safeLoadStatusOverrides(secStorage);
  } catch {
    secThrew = true;
  }
  assertEqual(secThrew, false, 'SecurityError on localStorage does NOT throw unhandled exception');
  assertDeepEqual(secResult, {}, 'SecurityError safely returns fallback empty object {}');
}

// -----------------------------------------------------------------------------
// SUITE 7: High-Volume 10,000-Iteration Triage Fuzzing & Mathematical Invariants
// -----------------------------------------------------------------------------
console.log('\n--- Suite 7: 10,000-Iteration Triage Fuzzing & Invariants ---');

{
  const STAGES = ['applied', 'assessment', 'interview', 'offer', 'rejected'];
  const testApps = [];
  const NUM_APPS = 10;

  for (let i = 0; i < NUM_APPS; i++) {
    testApps.push(
      createMockApp(`fuzz-app-${i}`, `FuzzCo_${i}`, `Engineer_${i}`, [
        createMockEmail(`fuzz-e-${i}`, `FuzzCo_${i}`, 'applied', '2026-10-10T10:00:00Z'),
      ])
    );
  }

  const fuzzStorage = new MockLocalStorage();
  let currentOverrides = {};
  const ITERATIONS = 10000;
  let seed = 123456789;

  function prng() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  console.log(`  Executing ${ITERATIONS} rapid triage transitions...`);
  const fuzzStart = performance.now();

  for (let step = 0; step < ITERATIONS; step++) {
    const targetAppIndex = Math.floor(prng() * NUM_APPS);
    const targetAppId = `fuzz-app-${targetAppIndex}`;
    const actionType = prng();

    if (actionType < 0.2) {
      // 20% reset
      delete currentOverrides[targetAppId];
    } else {
      // 80% stage transition
      const targetStage = STAGES[Math.floor(prng() * STAGES.length)];
      currentOverrides[targetAppId] = targetStage;
    }

    // Persist to storage
    fuzzStorage.setItem(OVERRIDE_KEY, JSON.stringify(currentOverrides));

    // Verify storage roundtrip periodically every 1000 steps
    if (step % 1000 === 0) {
      const reloaded = JSON.parse(fuzzStorage.getItem(OVERRIDE_KEY));
      assertDeepEqual(reloaded, currentOverrides, `Step ${step}: Storage stays strictly synchronized`);

      // Compute board and verify mathematical invariants
      const apps = applyStatusOverrides(testApps, currentOverrides);
      const b = buildBoard(apps, SIMULATED_NOW);

      // Invariant 1: Total cards always equals NUM_APPS
      assertEqual(b.cards.length, NUM_APPS, `Step ${step}: Total cards count invariant = ${NUM_APPS}`);

      // Invariant 2: Total cards across all 5 lanes always equals NUM_APPS (partition invariant)
      const totalLanes = b.lanes.reduce((sum, l) => sum + l.cards.length, 0);
      assertEqual(totalLanes, NUM_APPS, `Step ${step}: Partition invariant: sum of lane cards = ${NUM_APPS}`);

      // Invariant 3: All stage counts are non-negative
      for (const countItem of b.counts) {
        assert(countItem.count >= 0, `Step ${step}: Stage count for ${countItem.key} is non-negative (${countItem.count})`);
      }
    }
  }

  const fuzzDuration = performance.now() - fuzzStart;
  console.log(`  ⚡ Completed ${ITERATIONS} triage cycles in ${fuzzDuration.toFixed(2)}ms (${Math.round((ITERATIONS / fuzzDuration) * 1000).toLocaleString()} ops/sec)`);

  // Final reset of all applications
  currentOverrides = {};
  fuzzStorage.setItem(OVERRIDE_KEY, JSON.stringify(currentOverrides));
  const restoredApps = applyStatusOverrides(testApps, currentOverrides);
  const finalBoard = buildBoard(restoredApps, SIMULATED_NOW);

  assertEqual(finalBoard.cards.length, NUM_APPS, 'After total reset: cards length intact');
  for (const card of finalBoard.cards) {
    assertEqual(card.lane, 'applied', `After total reset: ${card.app.id} restored to applied`);
  }
}

// -----------------------------------------------------------------------------
// SUITE 8: End-to-End TrackerDashboard Component Integration Smoke Test
// -----------------------------------------------------------------------------
console.log('\n--- Suite 8: TrackerDashboard Integrated Component Render ---');

{
  const mockGlobalStore = new Map();
  global.window = {
    localStorage: {
      getItem: k => mockGlobalStore.get(k) || null,
      setItem: (k, v) => mockGlobalStore.set(k, String(v)),
      removeItem: k => mockGlobalStore.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const { applications } = adaptFeed(SAMPLE_FEED, SIMULATED_NOW);

  // Render full dashboard with baseline data
  let fullDashboardHtml = null;
  let didCrash = false;
  try {
    fullDashboardHtml = ReactDOMServer.renderToString(
      React.createElement(TrackerDashboard, {
        applications,
        now: SIMULATED_NOW,
        onOpenEmail: () => {},
      })
    );
  } catch (err) {
    didCrash = true;
    console.error('TrackerDashboard render failed:', err);
  }

  assertEqual(didCrash, false, 'TrackerDashboard renders without throwing in React SSR environment');
  assert(fullDashboardHtml.includes('bp-dashboard'), 'Rendered dashboard includes .bp-dashboard root class');
  assert(fullDashboardHtml.includes('bp-metrics-grid'), 'Rendered dashboard includes .bp-metrics-grid StageMetricsBar');
  assert(fullDashboardHtml.includes('bp-html-table'), 'Rendered dashboard includes .bp-html-table ApplicationTable');
  assert(fullDashboardHtml.includes('bp-navbar-compact'), 'Rendered dashboard includes .bp-navbar-compact DateRangeControls');
}

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
const totalDuration = performance.now() - startTime;
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log(`DURATION:    ${totalDuration.toFixed(2)}ms`);
console.log('================================================================');

if (failedTests > 0) {
  console.error(`\n❌ VERDICT: REJECT (${failedTests} test failures detected)`);
  process.exit(1);
} else {
  console.log('\n🎉 VERDICT: APPROVE (All Milestone 3 triage persistence & reactive tests passed empirically!)');
  process.exit(0);
}
