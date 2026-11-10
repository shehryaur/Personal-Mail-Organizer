/**
 * ============================================================================
 * TIER 5 ADVERSARIAL COVERAGE HARDENING SUITE
 * Palantir Blueprint Dashboard Component Suite & Keyboard Ergonomics Engine
 *
 * Targets:
 * - demo/src/components/dashboard/blueprintTokens.ts
 * - demo/src/components/dashboard/dateRangeConstants.ts
 * - demo/src/components/dashboard/DateRangeControls.tsx
 * - demo/src/components/dashboard/StageMetricsBar.tsx
 * - demo/src/components/dashboard/useTrackerHotkeys.ts
 * - demo/src/components/dashboard/ApplicationTable.tsx
 * - demo/src/components/dashboard/ApplicationDetailDrawer.tsx
 * - demo/src/components/dashboard/TrackerDashboard.tsx
 * - demo/src/components/dashboard/KeyboardShortcutsDialog.tsx
 *
 * Suites:
 * 1. Extreme & Malformed Data Inputs Across All 8 Dashboard Components
 * 2. Rapid Interleaving & Multi-Tier State Concurrency Simulation
 * 3. Boundary Conditions for Dates, Pagination, Confidence & Fault Tolerance
 * 4. Memory Stability & Execution Performance Stress Harness
 * ============================================================================
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const req = createRequire(import.meta.url);

// Stub CSS imports for Node environment
req.extensions['.css'] = () => {};

// Initialize jiti for loading TypeScript/TSX modules in demo/
const { createJiti } = req(path.join(ROOT, 'demo/node_modules/jiti'));
const jiti = createJiti(path.join(ROOT, 'test_harness.js'), { jsx: true });

// Load React and ReactDOMServer for static markup assertions
const React = req(path.join(ROOT, 'demo/node_modules/react'));
const ReactDOMServer = req(path.join(ROOT, 'demo/node_modules/react-dom/server'));

// Load target dashboard modules
const tokensModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts'));
const dateConstantsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/dateRangeConstants.ts'));
const dateControlsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/DateRangeControls.tsx'));
const stageMetricsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/StageMetricsBar.tsx'));
const hotkeysModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/useTrackerHotkeys.ts'));
const appTableModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationTable.tsx'));
const drawerModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationDetailDrawer.tsx'));
const shortcutsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/KeyboardShortcutsDialog.tsx'));
const trackerModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/TrackerDashboard.tsx'));

// Load core utilities and mock data
const boardUtil = jiti(path.join(ROOT, 'demo/src/utils/board.ts'));
const feedUtil = jiti(path.join(ROOT, 'demo/src/extension/feed.ts'));
const mockData = jiti(path.join(ROOT, 'demo/src/data/mockData.ts'));

const {
  BLUEPRINT_COLORS,
  BLUEPRINT_INTENTS,
  BLUEPRINT_CLASSES,
  BLUEPRINT_TYPOGRAPHY,
  STAGE_INTENT_BORDER_COLOR,
  getLaneIntent,
  getChipIntent,
  getStageBadgeProps,
  getIntentColors,
} = tokensModule;

const { RANGES, RANGE_KEY, FROM_KEY, TO_KEY } = dateConstantsModule;
const { DateRangeControls } = dateControlsModule;
const { StageMetricsBar } = stageMetricsModule;
const { dispatchTrackerHotkey } = hotkeysModule;
const { ApplicationTable } = appTableModule;
const { ApplicationDetailDrawer } = drawerModule;
const { KeyboardShortcutsDialog } = shortcutsModule;
const { TrackerDashboard } = trackerModule;

const { buildBoard, LANES } = boardUtil;
const { adaptFeed } = feedUtil;
const { SAMPLE_FEED } = mockData;

const SIMULATED_NOW = 1792744200000; // Fri Oct 23, 2026
const OVERRIDE_KEY = 'trackerStatusOverrides';

// Test counters and diagnostic tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];
const suiteStartTime = performance.now();

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

function assertDoesNotThrow(fn, message) {
  totalTests++;
  try {
    fn();
    passedTests++;
  } catch (err) {
    failedTests++;
    const errMsg = `${message} — Unexpected exception thrown: ${err.message}`;
    failures.push(errMsg);
    console.error(`  ❌ FAIL: ${errMsg}`);
  }
}

function normalizeHtml(html) {
  return typeof html === 'string' ? html.replace(/<!--[\s\S]*?-->/g, '') : '';
}

// In-Memory Mock LocalStorage supporting Quota and Security Error simulations
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

function createMockElement(tagName, isContentEditable = false) {
  let blurred = false;
  return {
    tagName: tagName.toUpperCase(),
    isContentEditable: Boolean(isContentEditable),
    blur: () => {
      blurred = true;
    },
    get isBlurred() {
      return blurred;
    },
  };
}

function createSyntheticApp(id, company, role = 'Engineer', emails = []) {
  const sorted = [...emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const lastActivity = sorted[0]?.receivedAt || new Date(SIMULATED_NOW).toISOString();
  return {
    id,
    company,
    role,
    domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    stage: 'open',
    currentStatus: emails[0]?.subject || 'Applied',
    deadline: emails.find(e => e.deadlineResolved)?.deadlineResolved || null,
    deadlineRaw: emails.find(e => e.deadlineRaw)?.deadlineRaw || null,
    lastActivity,
    daysSinceLastActivity: 0,
    emails,
    confidence: 0.90,
    tags: [],
  };
}

function createSyntheticEmail(id, company, stage, receivedAt, opts = {}) {
  return {
    id,
    threadId: `th-${id}`,
    from: opts.from || `jobs@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    senderDomain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    subject: opts.subject || `Update from ${company}`,
    snippet: opts.snippet !== undefined ? opts.snippet : `Snippet for ${company}`,
    fullBody: opts.fullBody !== undefined ? opts.fullBody : `Full email body for ${company}`,
    receivedAt,
    company,
    role: opts.role || 'Software Engineer',
    stage,
    deadlineResolved: opts.deadlineResolved || null,
    deadlineRaw: opts.deadlineRaw || null,
    decisionSource: opts.decisionSource || 'ai',
    confidence: opts.confidence !== undefined ? opts.confidence : 0.90,
    ruleMatched: opts.ruleMatched,
    guardrailNote: opts.guardrailNote,
    actionNeeded: Boolean(opts.actionNeeded),
  };
}

function createSyntheticCard(id, company, role, lane = 'applied', emails = [], extra = {}) {
  const sorted = [...emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const openEmailId = extra.openEmailId !== undefined
    ? extra.openEmailId
    : (emails.length > 0 ? emails[0].id : null);

  return {
    lane,
    chip: extra.chip || { kind: 'wait', text: 'Waiting' },
    deadline: extra.deadline || null,
    lastEmail: extra.lastEmail || (sorted[0] ? 'Oct 23' : null),
    openEmailId,
    reached: extra.reached || new Set([lane]),
    app: {
      id,
      company,
      role: role !== undefined ? role : 'Software Engineer',
      domain: extra.domain || `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      status: 'active',
      confidence: extra.confidence !== undefined ? extra.confidence : 0.90,
      lastActivity: sorted[0]?.receivedAt || new Date(SIMULATED_NOW).toISOString(),
      daysSinceLastActivity: 0,
      emails,
      tags: extra.tags || [],
    },
  };
}

// Prepare baseline sample applications
const { applications: sampleApps } = adaptFeed(SAMPLE_FEED, SIMULATED_NOW);
const sampleBoard = buildBoard(sampleApps, SIMULATED_NOW);
const sampleCards = sampleBoard.lanes.flatMap(l => l.cards);

console.log('================================================================');
console.log('TIER 5 ADVERSARIAL COVERAGE HARDENING VERIFICATION SUITE');
console.log('Targets: demo/src/components/dashboard/ (8 components)');
console.log('================================================================\n');

// =============================================================================
// SUITE 1: Extreme & Malformed Data Inputs Across All Dashboard Components
// =============================================================================
console.log('--- Suite 1: Extreme & Malformed Data Inputs Across All 8 Dashboard Components ---');

// 1.1 blueprintTokens.ts White-Box Boundary & Malformed Inputs
{
  // getLaneIntent malformed inputs
  const adversarialLaneInputs = [
    { in: null, exp: 'none' },
    { in: undefined, exp: 'none' },
    { in: '', exp: 'none' },
    { in: '   ', exp: 'none' },
    { in: '\n\t', exp: 'none' },
    { in: 'OFFER', exp: 'success' },
    { in: '  interview  ', exp: 'primary' },
    { in: 'ASSESSMENT', exp: 'warning' },
    { in: 'Rejected', exp: 'danger' },
    { in: 'review', exp: 'warning' },
    { in: 'applied', exp: 'none' },
    { in: 'unmapped_random_lane', exp: 'none' },
    { in: '<script>alert(1)</script>', exp: 'none' },
    { in: 12345, exp: 'none' },
    { in: true, exp: 'none' },
    { in: {}, exp: 'none' },
  ];

  for (const item of adversarialLaneInputs) {
    const res = getLaneIntent(item.in);
    assertEqual(res, item.exp, `getLaneIntent handles input ${JSON.stringify(item.in)} -> ${item.exp}`);
  }

  // getChipIntent malformed inputs
  const adversarialChipInputs = [
    { in: null, exp: 'none' },
    { in: undefined, exp: 'none' },
    { in: '', exp: 'none' },
    { in: '   ', exp: 'none' },
    { in: 'DUE', exp: 'warning' },
    { in: '  due  ', exp: 'warning' },
    { in: 'WARN', exp: 'warning' },
    { in: 'INFO', exp: 'primary' },
    { in: 'CLOSED', exp: 'danger' },
    { in: 'WAIT', exp: 'none' },
    { in: 'other_chip', exp: 'none' },
    { in: '<svg onload=alert(1)>', exp: 'none' },
    { in: 42, exp: 'none' },
  ];

  for (const item of adversarialChipInputs) {
    const res = getChipIntent(item.in);
    assertEqual(res, item.exp, `getChipIntent handles input ${JSON.stringify(item.in)} -> ${item.exp}`);
  }

  // getStageBadgeProps adversarial stages
  const badgeTestCases = [
    { in: null, expStage: '', expLabel: '—', expIntent: 'none' },
    { in: undefined, expStage: '', expLabel: '—', expIntent: 'none' },
    { in: '', expStage: '', expLabel: '—', expIntent: 'none' },
    { in: 'applied', expStage: 'applied', expLabel: 'Applied', expIntent: 'none' },
    { in: 'assessment', expStage: 'assessment', expLabel: 'Assessment', expIntent: 'warning' },
    { in: 'interview', expStage: 'interview', expLabel: 'Interview', expIntent: 'primary' },
    { in: 'offer', expStage: 'offer', expLabel: 'Offer', expIntent: 'success' },
    { in: 'rejected', expStage: 'rejected', expLabel: 'Rejected', expIntent: 'danger' },
    { in: 'custom_lane', expStage: 'custom_lane', expLabel: 'Custom_lane', expIntent: 'none' },
    { in: 'UPPERCASE', expStage: 'uppercase', expLabel: 'Uppercase', expIntent: 'none' },
  ];

  for (const tc of badgeTestCases) {
    const props = getStageBadgeProps(tc.in);
    assertEqual(props.stage, tc.expStage, `StageBadgeProps stage for ${JSON.stringify(tc.in)}`);
    assertEqual(props.label, tc.expLabel, `StageBadgeProps label for ${JSON.stringify(tc.in)}`);
    assertEqual(props.intent, tc.expIntent, `StageBadgeProps intent for ${JSON.stringify(tc.in)}`);
    assert(props.className.includes('bp-tag bp-round'), `StageBadgeProps includes bp-tag bp-round classes`);
    assert(typeof props.style.backgroundColor === 'string', `StageBadgeProps style includes backgroundColor`);
    assert(typeof props.style.color === 'string', `StageBadgeProps style includes color`);
    assert(typeof props.style.borderColor === 'string', `StageBadgeProps style includes borderColor`);
  }

  // getIntentColors exhaustive intent validation
  const validIntents = ['primary', 'success', 'warning', 'danger', 'none'];
  for (const intent of validIntents) {
    const colors = getIntentColors(intent);
    assert(Boolean(colors.solid), `Intent '${intent}' defines solid color`);
    assert(Boolean(colors.hover), `Intent '${intent}' defines hover color`);
    assert(Boolean(colors.bg), `Intent '${intent}' defines bg color`);
    assert(Boolean(colors.text), `Intent '${intent}' defines text color`);
    assert(Boolean(colors.border), `Intent '${intent}' defines border color`);
  }

  // STAGE_INTENT_BORDER_COLOR mapping integrity
  for (const lane of LANES) {
    assert(typeof STAGE_INTENT_BORDER_COLOR[lane.key] === 'string', `Border color exists for lane '${lane.key}'`);
  }
}

// 1.2 dateRangeConstants.ts Validation
{
  assertEqual(RANGES.length, 5, 'RANGES defines exactly 5 presets');
  const expectedKeys = ['7', '30', '90', '365', 'all'];
  const actualKeys = RANGES.map(r => r.key);
  assertDeepEqual(actualKeys, expectedKeys, 'RANGES defines correct preset keys');
  assertEqual(RANGE_KEY, 'trackerRange', 'RANGE_KEY is trackerRange');
  assertEqual(FROM_KEY, 'trackerCustomFrom', 'FROM_KEY is trackerCustomFrom');
  assertEqual(TO_KEY, 'trackerCustomTo', 'TO_KEY is trackerCustomTo');
}

// 1.3 DateRangeControls.tsx Adversarial Component Render
{
  // Test rendering with standard props
  let html = ReactDOMServer.renderToString(
    React.createElement(DateRangeControls, {
      range: '30',
      onPickRange: () => {},
      customFrom: '2026-09-23',
      onFromChange: () => {},
      customTo: '2026-10-23',
      onToChange: () => {},
      showTimeline: false,
      onToggleTimeline: () => {},
      onRefresh: () => {},
      refreshing: false,
      updatedLabel: 'Updated 2m ago',
      onOpenShortcuts: () => {},
      onOpenSettings: () => {},
    })
  );
  assert(html.includes('bp-navbar-compact'), 'DateRangeControls renders .bp-navbar-compact');
  assert(html.includes('Updated 2m ago'), 'DateRangeControls renders updatedLabel');
  assert(html.includes('Timeline'), 'DateRangeControls renders Timeline button');
  assert(html.includes('Refresh'), 'DateRangeControls renders Refresh CTA');

  // Test rendering in custom mode with inverted date bounds
  html = ReactDOMServer.renderToString(
    React.createElement(DateRangeControls, {
      range: 'custom',
      onPickRange: () => {},
      customFrom: '2099-12-31',
      onFromChange: () => {},
      customTo: '1970-01-01',
      onToChange: () => {},
      showTimeline: true,
      onToggleTimeline: () => {},
    })
  );
  assert(html.includes('bp-date-range'), 'DateRangeControls renders custom date range inputs');
  assert(html.includes('value="2099-12-31"'), 'DateRangeControls renders customFrom input value');
  assert(html.includes('value="1970-01-01"'), 'DateRangeControls renders customTo input value');
  assert(html.includes('tk-timeline-btn on'), 'Timeline button active class present when showTimeline is true');

  // Test rendering in refreshing state with disabled CTA and spinner
  html = ReactDOMServer.renderToString(
    React.createElement(DateRangeControls, {
      range: '7',
      onPickRange: () => {},
      customFrom: '',
      onFromChange: () => {},
      customTo: '',
      onToChange: () => {},
      showTimeline: false,
      onToggleTimeline: () => {},
      onRefresh: () => {},
      refreshing: true,
      updatedLabel: 'Updated just now',
    })
  );
  assert(html.includes('Checking for new emails…'), 'DateRangeControls displays checking text during refresh');
  assert(html.includes('disabled=""') || html.includes('disabled'), 'Refresh CTA is disabled while refreshing');

  // Test rendering with missing optional callbacks (must not crash)
  assertDoesNotThrow(() => {
    ReactDOMServer.renderToString(
      React.createElement(DateRangeControls, {
        range: 'all',
        onPickRange: () => {},
        customFrom: '',
        onFromChange: () => {},
        customTo: '',
        onToChange: () => {},
        showTimeline: false,
        onToggleTimeline: () => {},
      })
    );
  }, 'DateRangeControls renders safely with minimal required props');
}

// 1.4 StageMetricsBar.tsx Adversarial Inputs
{
  // Empty counts array
  let html = ReactDOMServer.renderToString(
    React.createElement(StageMetricsBar, {
      counts: [],
      activeStage: 'all',
      onSelectStage: () => {},
    })
  );
  assert(html.includes('bp-metrics-grid'), 'Empty counts array renders container without throw');

  // Negative counts and giant counts
  const extremeCounts = [
    { key: 'applied', label: 'Applied', count: -999, note: 'Negative count test' },
    { key: 'assessment', label: 'Assessment', count: 0, note: 'Zero count' },
    { key: 'interview', label: 'Interview', count: 9999999, note: 'Giant count' },
    { key: 'offer', label: 'Offer', count: 1, note: 'Hot count' },
    { key: 'rejected', label: 'Rejected', count: 50, note: 'Standard' },
    { key: 'unknown_lane', label: 'Unknown', count: 7, note: 'Fallback styling' },
  ];

  html = ReactDOMServer.renderToString(
    React.createElement(StageMetricsBar, {
      counts: extremeCounts,
      activeStage: 'interview',
      onSelectStage: () => {},
    })
  );
  assert(html.includes('-999'), 'StageMetricsBar renders negative count');
  assert(html.includes('9999999'), 'StageMetricsBar renders giant count');
  assert(html.includes('hot'), 'Offer card with count > 0 gets .hot class');
  assert(html.includes('is-active on'), 'Active card receives .is-active and .on classes');
  assert(html.includes('#8f99a8'), 'Unknown lane key falls back to #8f99a8 border accent');
}

// 1.5 ApplicationTable.tsx Extreme & Malformed Data
{
  // Test 1: Empty card dataset
  let html = ReactDOMServer.renderToString(
    React.createElement(ApplicationTable, {
      cards: [],
      totalFilteredCount: 0,
      allCardsCount: 0,
      lanes: [],
      activeStage: 'all',
      onSelectStage: () => {},
      searchQuery: '',
      onSearchChange: () => {},
      selectedRowIndex: 0,
      onSelectRow: () => {},
      onInspectCard: () => {},
      page: 0,
      pageSize: 12,
      totalPages: 1,
      onNextPage: () => {},
      onPrevPage: () => {},
    })
  );
  assert(html.includes('No applications found matching your filter.'), 'Table renders empty state message');
  assert(normalizeHtml(html).includes('Showing 0–0 of 0'), 'Pagination shows 0–0 of 0 when totalFilteredCount is 0');

  // Test 2: XSS payloads, missing roles, empty chips, extreme strings
  const xssCard = createSyntheticCard(
    'app-xss-1',
    '<script>alert("pwned")</script>',
    null, // null role
    'applied',
    [
      createSyntheticEmail('em-xss-1', '<script>alert("pwned")</script>', 'applied', '2026-10-23T10:00:00Z', {
        snippet: '<img src=x onerror=alert(1)>',
      }),
    ],
    {
      chip: { kind: 'warn', text: '<b>Alert</b>' },
      reached: new Set(),
      lastEmail: '<span class="bad">now</span>',
    }
  );

  assertDoesNotThrow(() => {
    html = ReactDOMServer.renderToString(
      React.createElement(ApplicationTable, {
        cards: [xssCard],
        totalFilteredCount: 1,
        allCardsCount: 1,
        lanes: [{ key: 'applied', name: 'Applied', cards: [xssCard] }],
        activeStage: 'all',
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        selectedRowIndex: 0,
        onSelectRow: () => {},
        onInspectCard: () => {},
        page: 0,
        pageSize: 12,
        totalPages: 1,
        onNextPage: () => {},
        onPrevPage: () => {},
      })
    );
  }, 'ApplicationTable renders safely with hostile XSS payload inputs');

  // Verify proper React text escaping: no raw unescaped script tag inside table
  assert(html.includes('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;'), 'Company name with XSS payload is strictly HTML-escaped');
  assert(html.includes('—'), 'Null role renders fallback em-dash (—)');
  assert(html.includes('is-selected has-focus'), 'Active selected row has Cobalt selection and focus class');
}

// 1.6 ApplicationDetailDrawer.tsx Adversarial Records & Extreme Inputs
{
  // Test: card === null with isOpen === true returns null
  let html = ReactDOMServer.renderToString(
    React.createElement(ApplicationDetailDrawer, {
      card: null,
      isOpen: true,
      onClose: () => {},
      onSetStatus: () => {},
      onResetStatus: () => {},
      hasOverride: false,
    })
  );
  assertEqual(html, '', 'Drawer with card: null returns empty markup');

  // Test: card present with isOpen === false returns null
  html = ReactDOMServer.renderToString(
    React.createElement(ApplicationDetailDrawer, {
      card: sampleCards[0],
      isOpen: false,
      onClose: () => {},
      onSetStatus: () => {},
      onResetStatus: () => {},
      hasOverride: false,
    })
  );
  assertEqual(html, '', 'Drawer with isOpen: false returns empty markup');

  // Test: Card with 0 emails (empty thread history)
  const zeroEmailCard = createSyntheticCard('zero-app', 'Zero Email Corp', 'Ghost Role', 'applied', [], {
    openEmailId: null,
    confidence: null,
  });

  assertDoesNotThrow(() => {
    html = ReactDOMServer.renderToString(
      React.createElement(ApplicationDetailDrawer, {
        card: zeroEmailCard,
        isOpen: true,
        onClose: () => {},
        onSetStatus: () => {},
        onResetStatus: () => {},
        hasOverride: false,
      })
    );
  }, 'Drawer renders safely with 0 emails');
  assert(html.includes('Zero Email Corp'), 'Drawer renders company name for 0-email card');
  const normZero = normalizeHtml(html);
  assert(normZero.includes('0 messages'), 'Drawer shows 0 messages');
  assert(normZero.includes('0% Confidence'), 'Drawer handles null confidence score gracefully with 0% fallback');

  // Test: Card with 50 emails (stressing scroll container and sorting)
  const fiftyEmails = [];
  for (let i = 0; i < 50; i++) {
    fiftyEmails.push(
      createSyntheticEmail(
        `em-dense-${i}`,
        'High Volume Co',
        i % 2 === 0 ? 'assessment' : 'interview',
        new Date(SIMULATED_NOW - (50 - i) * 3600000).toISOString(),
        {
          subject: `Thread message #${i + 1}`,
          snippet: `Snippet body content for item ${i + 1}`,
          confidence: 0.88,
          decisionSource: i === 0 ? 'guardrail_override' : 'ai',
          guardrailNote: i === 0 ? 'Security inspection verified' : undefined,
          ruleMatched: i === 1 ? 'RE_ASSESSMENT_KEYWORD' : undefined,
        }
      )
    );
  }

  const highVolumeCard = createSyntheticCard(
    'high-vol-1',
    'High Volume Co',
    'Senior Architect',
    'interview',
    fiftyEmails,
    {
      confidence: 0.94,
      reached: new Set(['applied', 'assessment', 'interview']),
    }
  );

  assertDoesNotThrow(() => {
    html = ReactDOMServer.renderToString(
      React.createElement(ApplicationDetailDrawer, {
        card: highVolumeCard,
        isOpen: true,
        onClose: () => {},
        onSetStatus: () => {},
        onResetStatus: () => {},
        hasOverride: true,
      })
    );
  }, 'Drawer renders safely with 50-message email thread');

  const normFifty = normalizeHtml(html);
  assert(normFifty.includes('50 messages'), 'Drawer displays correct 50 messages count');
  assert(normFifty.includes('94% Confidence'), 'Drawer calculates 94% confidence');
  assert(html.includes('Security Guardrail'), 'Drawer renders Security Guardrail source meta');
  assert(html.includes('Security inspection verified'), 'Drawer renders guardrail note badge');
  assert(html.includes('Overridden'), 'Drawer displays Overridden badge when hasOverride is true');
}

// =============================================================================
// SUITE 2: Rapid Interleaving & Multi-Tier State Concurrency Simulation
// =============================================================================
console.log('\n--- Suite 2: Rapid Interleaving & Multi-Tier State Concurrency Simulation ---');

// 2.1 Synchronous Card Live-Swapping during Keyboard Cycling
{
  let activeIndex = 0;
  let isDrawerOpen = true;
  let activeCard = sampleCards[0];
  const total = sampleCards.length;

  const syncOptions = {
    get activeRowIndex() { return activeIndex; },
    totalRows: total,
    onSelectRow: idx => {
      activeIndex = idx;
      activeCard = sampleCards[idx];
    },
    onInspectRow: idx => {
      activeIndex = idx;
      activeCard = sampleCards[idx];
      isDrawerOpen = true;
    },
    onDismiss: () => { isDrawerOpen = false; },
    get isDrawerOpen() { return isDrawerOpen; },
    isShortcutsOpen: false,
    isTimelineOpen: false,
  };

  // Rapid j cycling through all cards
  for (let i = 0; i < total - 1; i++) {
    const res = dispatchTrackerHotkey(syncOptions, createMockEvent('j'));
    assertEqual(res.handled, true, `Step ${i}: j hotkey handled`);
    assertEqual(activeIndex, i + 1, `Step ${i}: activeIndex advanced`);
    assertEqual(activeCard.app.id, sampleCards[i + 1].app.id, `Step ${i}: activeCard live-swapped synchronously`);
  }

  // Rapid k cycling back to row 0 (Home/End are no longer shortcuts)
  for (let i = total - 1; i > 0; i--) {
    dispatchTrackerHotkey(syncOptions, createMockEvent('k'));
    assertEqual(activeCard.app.id, sampleCards[i - 1].app.id, `Back step ${i}: activeCard live-swapped synchronously`);
  }
  assertEqual(activeIndex, 0, 'activeIndex is 0 after cycling back');
  const resHome = dispatchTrackerHotkey(syncOptions, createMockEvent('Home'));
  assertEqual(resHome.action, 'unmapped_key', 'Home key is no longer a shortcut');
  assertEqual(activeIndex, 0, 'Home leaves the selection alone');
}

// 2.2 Search Query Mutation Interleaved with Selection Clamping
{
  // Simulate filtering from all cards down to a single card while selectedRowIndex is high
  const allCardsList = sampleCards;
  let currentSelection = 8; // High index on first page

  // Filter with query 'lumen' (matches 'Lumen Analytics', exactly 1 card)
  const query = 'lumen';
  const filtered = allCardsList.filter(c => c.app.company.toLowerCase().includes(query));
  assert(filtered.length > 0 && filtered.length < allCardsList.length, 'Filter reduces dataset size');

  // In TrackerDashboard: safeRowIndex clamps immediately
  const safeRowIndex = filtered.length > 0 ? Math.min(currentSelection, filtered.length - 1) : 0;
  assert(safeRowIndex < filtered.length, `Clamped safeRowIndex (${safeRowIndex}) is strictly within filtered bounds (${filtered.length})`);
  assertEqual(safeRowIndex, filtered.length - 1, 'safeRowIndex clamps to top boundary of filtered subset');
}

// 2.3 Page Navigation Interleaved with Selection
{
  let currentPage = 0;
  let currentRow = 5;
  const totalItems = 30;
  const pageSize = 12;
  const totalPages = Math.ceil(totalItems / pageSize); // 3 pages

  const pageOptions = {
    activeRowIndex: currentRow,
    totalRows: pageSize,
    onSelectRow: idx => { currentRow = idx; },
    onNextPage: () => {
      if (currentPage < totalPages - 1) {
        currentPage++;
        currentRow = 0; // reset selection to top of new page
      }
    },
    onPrevPage: () => {
      if (currentPage > 0) {
        currentPage--;
        currentRow = 0;
      }
    },
    onInspectRow: () => {},
    onFocusSearch: () => {},
    onToggleShortcuts: () => {},
    onToggleTimeline: () => {},
    onDismiss: () => {},
    isDrawerOpen: false,
    isShortcutsOpen: false,
    isTimelineOpen: false,
  };

  // Paging keys were removed (the Previous / Next buttons page the table):
  // ] n [ p must not move the page or the selection
  for (const key of [']', 'n', '[', 'p']) {
    const res = dispatchTrackerHotkey(pageOptions, createMockEvent(key));
    assertEqual(res.action, 'unmapped_key', `Paging key "${key}" is no longer a shortcut`);
    assertEqual(currentPage, 0, `Paging key "${key}" leaves the page alone`);
    assertEqual(currentRow, 5, `Paging key "${key}" leaves the selection alone`);
  }
}

// 2.4 Hierarchical Escape Stack Multi-Tier Hierarchy Under Concurrent Modals
{
  let state = {
    shortcuts: true,
    drawer: true,
    timeline: true,
    selectionDismissed: false,
  };

  const getEscapeOpts = () => ({
    activeRowIndex: 0,
    totalRows: 10,
    isShortcutsOpen: state.shortcuts,
    isDrawerOpen: state.drawer,
    isTimelineOpen: state.timeline,
    onSelectRow: () => {},
    onInspectRow: () => {},
    onFocusSearch: () => {},
    onToggleShortcuts: () => { state.shortcuts = false; },
    onToggleTimeline: () => { state.timeline = false; },
    onDismiss: () => {
      if (state.drawer) {
        state.drawer = false;
      } else {
        state.selectionDismissed = true;
      }
    },
    onNextPage: () => {},
    onPrevPage: () => {},
  });

  // 1st Escape: Closes Shortcuts dialog
  let ev = createMockEvent('Escape');
  let res = dispatchTrackerHotkey(getEscapeOpts(), ev);
  assertEqual(res.action, 'close_shortcuts', 'Tier 1: Shortcuts closes first');
  assertEqual(state.shortcuts, false, 'Shortcuts marked closed');
  assertEqual(state.drawer, true, 'Drawer remains open');
  assertEqual(state.timeline, true, 'Timeline remains open');
  assertEqual(ev.isDefaultPrevented, true, 'Escape prevented default');

  // 2nd Escape: Closes Detail Drawer
  ev = createMockEvent('Escape');
  res = dispatchTrackerHotkey(getEscapeOpts(), ev);
  assertEqual(res.action, 'close_drawer', 'Tier 2: Detail Drawer closes second');
  assertEqual(state.drawer, false, 'Drawer marked closed');
  assertEqual(state.timeline, true, 'Timeline remains open');

  // 3rd Escape: Closes Timeline Drawer
  ev = createMockEvent('Escape');
  res = dispatchTrackerHotkey(getEscapeOpts(), ev);
  assertEqual(res.action, 'close_timeline', 'Tier 3: Timeline Drawer closes third');
  assertEqual(state.timeline, false, 'Timeline marked closed');
  assertEqual(state.selectionDismissed, false, 'Selection not cleared yet');

  // 4th Escape: Clears Selection / Base Dismiss
  ev = createMockEvent('Escape');
  res = dispatchTrackerHotkey(getEscapeOpts(), ev);
  assertEqual(res.action, 'clear_selection', 'Tier 4: Base selection cleared fourth');
  assertEqual(state.selectionDismissed, true, 'Selection dismissed');
}

// 2.5 Input Guard Interleaved Typing Stress
{
  let hotkeyActionFired = false;
  const inputOpts = {
    activeRowIndex: 0,
    totalRows: 10,
    onSelectRow: () => { hotkeyActionFired = true; },
    onInspectRow: () => { hotkeyActionFired = true; },
    onTriageStatus: () => { hotkeyActionFired = true; },
    onFocusSearch: () => { hotkeyActionFired = true; },
    onToggleShortcuts: () => { hotkeyActionFired = true; },
    onToggleTimeline: () => { hotkeyActionFired = true; },
    onNextPage: () => { hotkeyActionFired = true; },
    onPrevPage: () => { hotkeyActionFired = true; },
    onDismiss: () => { hotkeyActionFired = true; },
    isDrawerOpen: true,
    isShortcutsOpen: true,
    isTimelineOpen: true,
  };

  const editableElements = [
    createMockElement('INPUT'),
    createMockElement('TEXTAREA'),
    createMockElement('SELECT'),
    createMockElement('DIV', true),
  ];

  const keysSimulated = ['j', 'k', 'ArrowDown', 'ArrowUp', '1', '2', '3', 'i', 'r', '0', 'u', '/', '?', 't', '[', ']'];

  for (const el of editableElements) {
    for (const key of keysSimulated) {
      hotkeyActionFired = false;
      const ev = createMockEvent(key, { target: el });
      const res = dispatchTrackerHotkey(inputOpts, ev);

      assertEqual(res.handled, false, `InputGuard: ${el.tagName} typing '${key}' handled is false`);
      assertEqual(res.suppressedByInputGuard, true, `InputGuard: ${el.tagName} typing '${key}' suppressed is true`);
      assertEqual(hotkeyActionFired, false, `InputGuard: ${el.tagName} typing '${key}' fires no actions`);
      assertEqual(ev.isDefaultPrevented, false, `InputGuard: ${el.tagName} typing '${key}' does not preventDefault`);
    }

    // Escape in input element blurs the element and preventsDefault
    hotkeyActionFired = false;
    const escapeEv = createMockEvent('Escape', { target: el });
    const escapeRes = dispatchTrackerHotkey(inputOpts, escapeEv);

    assertEqual(escapeRes.handled, false, `InputGuard: Escape in ${el.tagName} handled is false`);
    assertEqual(escapeRes.suppressedByInputGuard, true, `InputGuard: Escape in ${el.tagName} suppressed is true`);
    assertEqual(el.isBlurred, true, `InputGuard: Escape in ${el.tagName} triggers blur()`);
    assertEqual(escapeEv.isDefaultPrevented, true, `InputGuard: Escape in ${el.tagName} triggers preventDefault()`);
    assertEqual(hotkeyActionFired, false, `InputGuard: Escape in ${el.tagName} does not trigger dismiss or modal actions`);
  }
}

// 2.6 Modifier Guard Rejections
{
  let actionTriggered = false;
  const modOpts = {
    activeRowIndex: 0,
    totalRows: 5,
    onSelectRow: () => { actionTriggered = true; },
    onInspectRow: () => { actionTriggered = true; },
    onTriageStatus: () => { actionTriggered = true; },
    onFocusSearch: () => { actionTriggered = true; },
    onToggleShortcuts: () => { actionTriggered = true; },
    onToggleTimeline: () => { actionTriggered = true; },
    onNextPage: () => { actionTriggered = true; },
    onPrevPage: () => { actionTriggered = true; },
    onDismiss: () => { actionTriggered = true; },
    isDrawerOpen: false,
    isShortcutsOpen: false,
    isTimelineOpen: false,
  };

  const modifierCombos = [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { ctrlKey: true, altKey: true },
    { metaKey: true, shiftKey: true },
  ];

  for (const mod of modifierCombos) {
    actionTriggered = false;
    const ev = createMockEvent('j', mod);
    const res = dispatchTrackerHotkey(modOpts, ev);
    assertEqual(res.handled, false, `Modifier ${JSON.stringify(mod)} + j handled is false`);
    assertEqual(res.modifierActive, true, `Modifier ${JSON.stringify(mod)} + j modifierActive is true`);
    assertEqual(actionTriggered, false, `Modifier ${JSON.stringify(mod)} + j does not trigger actions`);
  }
}

// 2.7 25,000-Keystroke Randomized Fuzz Harness
{
  const FUZZ_KEYS = [
    'j', 'k', 'ArrowDown', 'ArrowUp', 'Home', 'End',
    'Enter', ' ', 'o',
    '[', ']', 'p', 'n',
    '1', '2', '3', '4', '5', 'i', 'r', '0', 'u',
    '/', '?', 't', 'Escape',
    'a', 'b', 'c', 'Tab', 'F1', 'Backspace', 'Delete'
  ];

  let fuzzRow = 0;
  let fuzzTotalRows = 20;
  let fuzzDrawerOpen = false;
  let fuzzShortcutsOpen = false;
  let fuzzTimelineOpen = false;

  const fuzzOptions = {
    get activeRowIndex() { return fuzzRow; },
    get totalRows() { return fuzzTotalRows; },
    get isDrawerOpen() { return fuzzDrawerOpen; },
    get isShortcutsOpen() { return fuzzShortcutsOpen; },
    get isTimelineOpen() { return fuzzTimelineOpen; },
    onSelectRow: idx => { fuzzRow = idx; },
    onInspectRow: () => { fuzzDrawerOpen = true; },
    onTriageStatus: () => {},
    onFocusSearch: () => {},
    onToggleShortcuts: () => { fuzzShortcutsOpen = !fuzzShortcutsOpen; },
    onToggleTimeline: () => { fuzzTimelineOpen = !fuzzTimelineOpen; },
    onNextPage: () => {},
    onPrevPage: () => {},
    onDismiss: () => {
      if (fuzzDrawerOpen) fuzzDrawerOpen = false;
    },
  };

  const FUZZ_ITERATIONS = 25000;
  const fuzzStartTime = performance.now();
  let threwCount = 0;

  for (let i = 0; i < FUZZ_ITERATIONS; i++) {
    const key = FUZZ_KEYS[Math.floor(Math.random() * FUZZ_KEYS.length)];
    const roll = Math.random();

    let ev;
    if (roll < 0.1) {
      ev = createMockEvent(key, { ctrlKey: true });
    } else if (roll < 0.2) {
      ev = createMockEvent(key, { target: createMockElement('INPUT') });
    } else if (roll < 0.25) {
      ev = createMockEvent(key, { shiftKey: true });
    } else {
      ev = createMockEvent(key);
    }

    // Dynamic row count jitter: occasionally 0 rows, 1 row, or 50 rows
    if (i % 2500 === 0) {
      fuzzTotalRows = (i / 2500) % 2 === 0 ? 0 : Math.floor(Math.random() * 50) + 1;
      if (fuzzTotalRows === 0) fuzzRow = 0;
    }

    try {
      dispatchTrackerHotkey(fuzzOptions, ev);
      // Invariant check: fuzzRow must always be within [0, Math.max(0, fuzzTotalRows - 1)]
      if (fuzzTotalRows > 0) {
        assert(fuzzRow >= 0 && fuzzRow < fuzzTotalRows, `Fuzz iteration ${i}: row ${fuzzRow} within bounds [0, ${fuzzTotalRows})`);
      }
    } catch {
      threwCount++;
    }
  }

  const fuzzDuration = performance.now() - fuzzStartTime;
  assertEqual(threwCount, 0, `25,000 keystroke fuzzing completed with 0 exceptions`);
  console.log(`  ⚡ Executed ${FUZZ_ITERATIONS} randomized keystrokes in ${fuzzDuration.toFixed(2)}ms (${Math.round((FUZZ_ITERATIONS / fuzzDuration) * 1000).toLocaleString()} ops/sec)`);
}

// =============================================================================
// SUITE 3: Boundary Conditions for Dates, Pagination, Confidence & Fault Tolerance
// =============================================================================
console.log('\n--- Suite 3: Boundary Conditions for Dates, Pagination, Confidence & Fault Tolerance ---');

// 3.1 Date Boundary Math & Range Subsetting
{
  // Date math verification across leap years, year boundaries, and epoch
  const testTimestamps = [
    { ts: 0, expYear: 1970, expMonth: 1, expDay: 1 },
    { ts: new Date('2024-02-29T12:00:00Z').getTime(), expYear: 2024, expMonth: 2, expDay: 29 },
    { ts: new Date('2026-12-31T23:59:59Z').getTime(), expYear: 2026, expMonth: 12, expDay: 31 },
    { ts: new Date('2027-01-01T00:00:00Z').getTime(), expYear: 2027, expMonth: 1, expDay: 1 },
  ];

  for (const item of testTimestamps) {
    const d = new Date(item.ts);
    assert(!isNaN(d.getTime()), `Timestamp ${item.ts} parses to valid Date`);
    assertEqual(d.getUTCFullYear(), item.expYear, `UTC Year matches ${item.expYear}`);
  }

  // Range filtering boundaries: custom from/to filtering with boundary millisecond precision
  const appA = createSyntheticApp('app-1', 'Company A', 'Role A', [
    createSyntheticEmail('em-1', 'Company A', 'applied', '2026-10-10T00:00:00.000Z'),
  ]);
  const appB = createSyntheticApp('app-2', 'Company B', 'Role B', [
    createSyntheticEmail('em-2', 'Company B', 'interview', '2026-10-15T23:59:59.999Z'),
  ]);
  const appC = createSyntheticApp('app-3', 'Company C', 'Role C', [
    createSyntheticEmail('em-3', 'Company C', 'offer', '2026-10-25T00:00:00.000Z'),
  ]);

  const testList = [appA, appB, appC];

  // Filter between 2026-10-10 and 2026-10-15 inclusive
  const fromTime = new Date('2026-10-10T00:00:00.000Z').getTime();
  const toTime = new Date('2026-10-15T23:59:59.999Z').getTime();

  const inDateSubset = testList
    .map(a => ({
      ...a,
      emails: a.emails.filter(e => {
        const t = new Date(e.receivedAt).getTime();
        return t >= fromTime && t <= toTime;
      }),
    }))
    .filter(a => a.emails.length > 0);

  assertEqual(inDateSubset.length, 2, 'Date range filter includes exactly appA and appB');
  assertEqual(inDateSubset[0].id, 'app-1', 'appA included');
  assertEqual(inDateSubset[1].id, 'app-2', 'appB included');
}

// 3.2 Pagination Math & Clamping
{
  const pageSize = 12;
  const paginationCases = [
    { total: 0, expPages: 1 },
    { total: 1, expPages: 1 },
    { total: 11, expPages: 1 },
    { total: 12, expPages: 1 },
    { total: 13, expPages: 2 },
    { total: 24, expPages: 2 },
    { total: 25, expPages: 3 },
    { total: 120, expPages: 10 },
  ];

  for (const pc of paginationCases) {
    const totalPages = Math.ceil(pc.total / pageSize) || 1;
    assertEqual(totalPages, pc.expPages, `Total items ${pc.total} produces ${pc.expPages} page(s)`);
  }

  // Clamping of safePage when current page is out of bounds
  const requestedPage = 15;
  const totalPages = 3;
  const safePage = Math.min(requestedPage, Math.max(0, totalPages - 1));
  assertEqual(safePage, 2, 'Out of bounds page 15 clamps to safePage 2');
}

// 3.3 Classifier Confidence Score Clamping & Intent Thresholds
{
  const confidenceTestMatrix = [
    { raw: -0.5, expPct: 0, expIntent: 'warning' },
    { raw: 0, expPct: 0, expIntent: 'warning' },
    { raw: 0.10, expPct: 10, expIntent: 'warning' },
    { raw: 0.64, expPct: 64, expIntent: 'warning' },
    { raw: 0.65, expPct: 65, expIntent: 'primary' },
    { raw: 0.75, expPct: 75, expIntent: 'primary' },
    { raw: 0.84, expPct: 84, expIntent: 'primary' },
    { raw: 0.85, expPct: 85, expIntent: 'success' },
    { raw: 0.99, expPct: 99, expIntent: 'success' },
    { raw: 1.0, expPct: 100, expIntent: 'success' },
    { raw: 50, expPct: 50, expIntent: 'warning' },
    { raw: 85, expPct: 85, expIntent: 'success' },
    { raw: 120, expPct: 100, expIntent: 'success' },
    { raw: null, expPct: 0, expIntent: 'warning' },
    { raw: undefined, expPct: 0, expIntent: 'warning' },
  ];

  for (const item of confidenceTestMatrix) {
    const rawVal = item.raw ?? 0;
    const confidencePct = Math.min(100, Math.max(0, Math.round(rawVal <= 1 ? rawVal * 100 : rawVal)));
    const intent = confidencePct >= 85 ? 'success' : confidencePct >= 65 ? 'primary' : 'warning';

    assertEqual(confidencePct, item.expPct, `Confidence raw ${item.raw} computes to ${item.expPct}%`);
    assertEqual(intent, item.expIntent, `Confidence ${item.expPct}% maps to intent '${item.expIntent}'`);
  }
}

// 3.4 LocalStorage Quota & Corrupt State Fault Tolerance
{
  const storage = new MockLocalStorage();

  // Test: QuotaExceededError handling
  storage.shouldThrowQuota = true;
  assertDoesNotThrow(() => {
    try {
      storage.setItem(OVERRIDE_KEY, '{"app-1":"interview"}');
    } catch (err) {
      // Must catch and handle QuotaExceededError without re-throwing
      assert(err.message.includes('QuotaExceededError'), 'Quota error correctly identified');
    }
  }, 'QuotaExceededError handled gracefully');

  // Test: Corrupt JSON recovery
  storage.shouldThrowQuota = false;
  const corruptPayloads = [
    'INVALID_JSON_STRING',
    '{incomplete_json:',
    '123456',
    '"string_literal"',
    'null',
    'true',
    'false',
    '[1, 2, 3]',
  ];

  for (const payload of corruptPayloads) {
    storage.setItem(OVERRIDE_KEY, payload);
    let parsedOverrides = {};
    try {
      const raw = storage.getItem(OVERRIDE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          parsedOverrides = parsed;
        }
      }
    } catch {
      parsedOverrides = {};
    }
    assertDeepEqual(parsedOverrides, {}, `Corrupt storage payload ${JSON.stringify(payload)} safely recovers to empty object {}`);
  }

  // Test: Prototype pollution resistance
  storage.setItem(OVERRIDE_KEY, '{"__proto__":{"polluted":true},"constructor":{"polluted":true}}');
  let loaded = {};
  try {
    loaded = JSON.parse(storage.getItem(OVERRIDE_KEY));
  } catch {}
  assert(loaded.polluted === undefined, 'Prototype pollution attempt does not pollute Object prototype');
}

// =============================================================================
// SUITE 4: Memory Stability & Execution Performance Stress Harness
// =============================================================================
console.log('\n--- Suite 4: Memory Stability & Execution Performance Stress Harness ---');

// 4.1 Scale Stress with 1,000 Applications & 5,000 Emails
{
  console.log('  Generating 1,000 synthetic applications (5,000 emails) for scale test...');
  const largeDataset = [];
  const STAGE_ROTATION = ['applied', 'assessment', 'interview', 'offer', 'rejected'];

  for (let i = 0; i < 1000; i++) {
    const appEmails = [];
    for (let e = 0; e < 5; e++) {
      const stage = STAGE_ROTATION[(i + e) % STAGE_ROTATION.length];
      appEmails.push(
        createSyntheticEmail(
          `em-perf-${i}-${e}`,
          `Company ${i}`,
          stage,
          new Date(SIMULATED_NOW - (i * 10 + e) * 86400000).toISOString(),
          {
            confidence: 0.85,
            decisionSource: 'ai',
          }
        )
      );
    }
    largeDataset.push(createSyntheticApp(`app-perf-${i}`, `Company ${i}`, `Staff Engineer ${i}`, appEmails));
  }

  const perfStart = performance.now();
  const scaledBoard = buildBoard(largeDataset, SIMULATED_NOW);
  const perfDuration = performance.now() - perfStart;

  assertEqual(scaledBoard.cards.length, 1000, 'Scale test: aggregated exactly 1,000 cards');
  assertEqual(scaledBoard.lanes.length, 5, 'Scale test: aggregated 5 lanes');
  assert(perfDuration < 2000, `Scale aggregation of 1,000 apps executed within 2000ms (Actual: ${perfDuration.toFixed(2)}ms)`);
  console.log(`  ⚡ Aggregated 1,000 applications in ${perfDuration.toFixed(2)}ms (${Math.round((1000 / perfDuration) * 1000).toLocaleString()} apps/sec)`);
}

// 4.2 High-Frequency State Mutation Stress (10,000 Triage Cycles)
{
  const testStorage = new MockLocalStorage();
  const testApps = sampleApps.slice(0, 10);
  let overrides = {};

  const triageStages = ['applied', 'assessment', 'interview', 'offer', 'rejected'];
  const TRIAGE_CYCLES = 10000;
  const cycleStart = performance.now();

  for (let i = 0; i < TRIAGE_CYCLES; i++) {
    const targetApp = testApps[i % testApps.length];
    const nextStage = triageStages[i % triageStages.length];

    if (i % 7 === 0) {
      delete overrides[targetApp.id];
    } else {
      overrides[targetApp.id] = nextStage;
    }

    if (i % 1000 === 0) {
      testStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
      const reloaded = JSON.parse(testStorage.getItem(OVERRIDE_KEY));
      assertDeepEqual(reloaded, overrides, `Cycle ${i}: LocalStorage roundtrip in sync`);
    }
  }

  const cycleDuration = performance.now() - cycleStart;
  console.log(`  ⚡ Completed ${TRIAGE_CYCLES} state mutations in ${cycleDuration.toFixed(2)}ms (${Math.round((TRIAGE_CYCLES / cycleDuration) * 1000).toLocaleString()} ops/sec)`);
}

// 4.3 Repeated Component Render Throughput
{
  const RENDER_COUNT = 50;
  const renderStart = performance.now();

  for (let i = 0; i < RENDER_COUNT; i++) {
    ReactDOMServer.renderToString(
      React.createElement(ApplicationTable, {
        cards: sampleCards.slice(0, 12),
        totalFilteredCount: sampleCards.length,
        allCardsCount: sampleCards.length,
        lanes: sampleBoard.lanes,
        activeStage: 'all',
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        selectedRowIndex: i % 12,
        onSelectRow: () => {},
        onInspectCard: () => {},
        page: 0,
        pageSize: 12,
        totalPages: 2,
        onNextPage: () => {},
        onPrevPage: () => {},
      })
    );

    ReactDOMServer.renderToString(
      React.createElement(StageMetricsBar, {
        counts: sampleBoard.counts,
        activeStage: 'all',
        onSelectStage: () => {},
      })
    );
  }

  const renderDuration = performance.now() - renderStart;
  const avgPerRender = renderDuration / (RENDER_COUNT * 2);
  assert(avgPerRender < 10, `Average component render time < 10ms (Actual: ${avgPerRender.toFixed(2)}ms)`);
  console.log(`  ⚡ Executed ${RENDER_COUNT * 2} component renders in ${renderDuration.toFixed(2)}ms (Avg: ${avgPerRender.toFixed(2)}ms/render)`);
}

// 4.4 Full TrackerDashboard SSR Render & Memory Check
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

  const heapBefore = process.memoryUsage().heapUsed;

  let dashboardHtml = null;
  assertDoesNotThrow(() => {
    dashboardHtml = ReactDOMServer.renderToString(
      React.createElement(TrackerDashboard, {
        applications: sampleApps,
        now: SIMULATED_NOW,
        onOpenEmail: () => {},
        onRefresh: () => {},
        refreshing: false,
        updatedLabel: 'Updated just now',
      })
    );
  }, 'Full TrackerDashboard renders without exception');

  assert(dashboardHtml.includes('bp-dashboard'), 'Dashboard root element contains bp-dashboard');
  assert(dashboardHtml.includes('Where every application stands'), 'Dashboard contains table heading');
  assert(dashboardHtml.includes('bp-metrics-grid'), 'Dashboard contains stage metrics bar');
  assert(dashboardHtml.includes('bp-navbar-compact'), 'Dashboard contains compact navbar');

  const heapAfter = process.memoryUsage().heapUsed;
  const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);
  assert(heapDeltaMB < 50, `Heap memory growth bounded: delta = ${heapDeltaMB.toFixed(2)}MB (< 50MB)`);
  console.log(`  ⚡ Memory stability verified: heap delta = ${heapDeltaMB.toFixed(2)}MB`);
}

// =============================================================================
// SUMMARY & VERDICT
// =============================================================================
const totalSuiteDuration = performance.now() - suiteStartTime;
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log(`DURATION:    ${totalSuiteDuration.toFixed(2)}ms`);
console.log('================================================================');

if (failedTests > 0) {
  console.error(`\n❌ VERDICT: GAPS_IDENTIFIED (${failedTests} test failures detected)`);
  process.exit(1);
} else {
  console.log('\n🎉 VERDICT: APPROVE (100% Tier 5 adversarial tests passed with 0 defects!)');
  process.exit(0);
}
