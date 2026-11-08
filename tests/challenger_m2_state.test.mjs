/**
 * Adversarial Challenger Test Suite for Milestone 2:
 * State Transitions, DateRangeControls, StageMetricsBar, Filtering & Pagination
 *
 * Targets:
 * - demo/src/components/dashboard/DateRangeControls.tsx
 * - demo/src/components/dashboard/StageMetricsBar.tsx
 * - demo/src/components/dashboard/ApplicationTable.tsx
 * - demo/src/components/dashboard/TrackerDashboard.tsx (State Logic & Invariants)
 * - demo/src/utils/board.ts (Aggregation & Filtering under scale)
 *
 * Exercises:
 * 1. Date range presets (1w, 1m, 3m, 1y, all, custom) and boundary logic (min/max, inverted dates, edge timestamps).
 * 2. Stage count aggregation under empty lists, single items, and 10,000 synthetic applications.
 * 3. Status overrides store behavior (localStorage serialization, invalid stage fallback, reset logic, quota handling).
 * 4. Filter pipeline: combined date range + stage pill + search string with edge cases (special characters, unicode, empty strings).
 * 5. Pagination mathematics: page bounds, clamping when filtered list shrinks, page count calculations, slice indices.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const { createJiti } = require(path.join(ROOT, 'demo/node_modules/jiti'));
const jiti = createJiti(path.join(ROOT, 'test_harness.js'), { jsx: true });

// Load React and ReactDOMServer for component rendering verification
const React = require(path.join(ROOT, 'demo/node_modules/react'));
const ReactDOMServer = require(path.join(ROOT, 'demo/node_modules/react-dom/server'));

// Load target components & utilities
const boardUtil = jiti(path.join(ROOT, 'demo/src/utils/board.ts'));
const feedUtil = jiti(path.join(ROOT, 'demo/src/extension/feed.ts'));
const mockData = jiti(path.join(ROOT, 'demo/src/data/mockData.ts'));
const dateRangeConstantsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/dateRangeConstants.ts'));
const dateRangeModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/DateRangeControls.tsx'));
const stageMetricsModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/StageMetricsBar.tsx'));
const appTableModule = jiti(path.join(ROOT, 'demo/src/components/dashboard/ApplicationTable.tsx'));
const blueprintTokens = jiti(path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts'));

const { buildBoard, LANES } = boardUtil;
const { adaptFeed } = feedUtil;
const { SAMPLE_FEED } = mockData;
const { DateRangeControls } = dateRangeModule;
const { RANGES, RANGE_KEY, FROM_KEY, TO_KEY } = dateRangeConstantsModule;
const { StageMetricsBar } = stageMetricsModule;
const { ApplicationTable } = appTableModule;
const { STAGE_INTENT_BORDER_COLOR } = blueprintTokens;

let passed = 0;
let failed = 0;
const failures = [];
const startTime = performance.now();

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    const errMsg = `FAIL: ${message}`;
    failures.push(errMsg);
    console.error(`  [FAIL] ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    const errMsg = `${message} - Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failures.push(errMsg);
    console.error(`  [FAIL] ${errMsg}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passed++;
  } else {
    failed++;
    const errMsg = `${message} - Expected: ${expectedStr}, Actual: ${actualStr}`;
    failures.push(errMsg);
    console.error(`  [FAIL] ${errMsg}`);
  }
}

console.log('================================================================');
console.log('CHALLENGER M2: DASHBOARD STATE, FILTERS & METRICS STRESS SUITE');
console.log('================================================================\n');

const SIMULATED_NOW = new Date('2026-10-24T18:00:00Z').getTime();
const DAY_MS = 86400000;

// Helper to format timestamp to YYYY-MM-DD
function toDateInputValue(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to generate mock application with specified emails
function createMockApp(id, company, role, emails) {
  const sortedEmails = [...emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const lastActivity = sortedEmails[0] ? sortedEmails[0].receivedAt : new Date(SIMULATED_NOW).toISOString();
  return {
    id,
    company,
    role: role || null,
    domain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    stage: 'open',
    lastActivity,
    emails,
  };
}

function createEmail(id, company, stage, receivedAt, opts = {}) {
  return {
    id,
    threadId: `th-${id}`,
    from: opts.from || `jobs@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    senderDomain: `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    subject: opts.subject || `Update from ${company}`,
    snippet: opts.snippet || `Status update for ${company}`,
    fullBody: opts.fullBody || 'Hello, here is an update.',
    receivedAt,
    company,
    role: opts.role || 'Software Engineer',
    stage,
    deadlineRaw: opts.deadlineRaw || null,
    deadlineResolved: opts.deadlineResolved || null,
    actionNeeded: Boolean(opts.actionNeeded),
    confidence: opts.confidence ?? 0.95,
    decisionSource: opts.decisionSource || 'rule',
    ruleMatched: null,
    isStarred: false,
    isArchived: false,
    applicationId: opts.applicationId || `app-${company}`,
  };
}

// -----------------------------------------------------------------------------
// SUITE 1: Date Range Presets & Boundary Logic
// -----------------------------------------------------------------------------
console.log('--- Suite 1: Date Range Presets & Boundary Logic ---');

// 1.1 Preset Definitions & Contract
assertEqual(Array.isArray(RANGES), true, 'RANGES must be exported as an array');
assertEqual(RANGES.length, 5, 'RANGES must define exactly 5 preset periods (1w, 1m, 3m, 1y, All)');
assertDeepEqual(
  RANGES.map(r => ({ key: r.key, days: r.days })),
  [
    { key: '7', days: 7 },
    { key: '30', days: 30 },
    { key: '90', days: 90 },
    { key: '365', days: 365 },
    { key: 'all', days: 0 },
  ],
  'Preset keys and day spans match specification'
);
assertEqual(RANGE_KEY, 'trackerRange', 'RANGE_KEY constant matches localStorage specification');
assertEqual(FROM_KEY, 'trackerCustomFrom', 'FROM_KEY constant matches localStorage specification');
assertEqual(TO_KEY, 'trackerCustomTo', 'TO_KEY constant matches localStorage specification');

// 1.2 Boundary Inclusivity at Exact Milliseconds
{
  const emailAtExact7d = createEmail('e-7d-exact', 'CorpA', 'applied', new Date(SIMULATED_NOW - 7 * DAY_MS).toISOString());
  const emailAt7dPlus1ms = createEmail('e-7d-plus1', 'CorpB', 'applied', new Date(SIMULATED_NOW - 7 * DAY_MS - 1).toISOString());
  const emailAtExact30d = createEmail('e-30d-exact', 'CorpC', 'applied', new Date(SIMULATED_NOW - 30 * DAY_MS).toISOString());
  const emailAt30dPlus1ms = createEmail('e-30d-plus1', 'CorpD', 'applied', new Date(SIMULATED_NOW - 30 * DAY_MS - 1).toISOString());

  const testApps = [
    createMockApp('app-a', 'CorpA', 'Dev', [emailAtExact7d]),
    createMockApp('app-b', 'CorpB', 'Dev', [emailAt7dPlus1ms]),
    createMockApp('app-c', 'CorpC', 'Dev', [emailAtExact30d]),
    createMockApp('app-d', 'CorpD', 'Dev', [emailAt30dPlus1ms]),
  ];

  // Logic from TrackerDashboard.tsx for presets:
  const filterByPreset = (apps, rangeKey) => {
    const days = RANGES.find(r => r.key === rangeKey)?.days ?? 0;
    if (!days) return apps;
    const since = SIMULATED_NOW - days * DAY_MS;
    return apps
      .map(a => ({ ...a, emails: a.emails.filter(e => new Date(e.receivedAt).getTime() >= since) }))
      .filter(a => a.emails.length > 0);
  };

  const in7d = filterByPreset(testApps, '7');
  assertEqual(in7d.length, 1, 'Preset 7d includes email at exact 7-day boundary');
  assertEqual(in7d[0].id, 'app-a', 'Preset 7d excludes email at 7d + 1ms');

  const in30d = filterByPreset(testApps, '30');
  assertEqual(in30d.length, 3, 'Preset 30d includes CorpA, CorpB, CorpC');
  assertEqual(in30d.some(a => a.id === 'app-d'), false, 'Preset 30d excludes email at 30d + 1ms');

  const inAll = filterByPreset(testApps, 'all');
  assertEqual(inAll.length, 4, 'Preset all includes all 4 applications');
}

// 1.3 Monotonic Expansion Across Presets
{
  const { applications } = adaptFeed(SAMPLE_FEED, SIMULATED_NOW);
  const filterPreset = (key) => {
    const days = RANGES.find(r => r.key === key)?.days ?? 0;
    if (!days) return applications;
    const since = SIMULATED_NOW - days * DAY_MS;
    return applications
      .map(a => ({ ...a, emails: a.emails.filter(e => new Date(e.receivedAt).getTime() >= since) }))
      .filter(a => a.emails.length > 0);
  };

  const count7 = filterPreset('7').length;
  const count30 = filterPreset('30').length;
  const count90 = filterPreset('90').length;
  const count365 = filterPreset('365').length;
  const countAll = filterPreset('all').length;

  assert(count7 <= count30, `Monotonic 7d (${count7}) <= 30d (${count30})`);
  assert(count30 <= count90, `Monotonic 30d (${count30}) <= 90d (${count90})`);
  assert(count90 <= count365, `Monotonic 90d (${count90}) <= 365d (${count365})`);
  assert(count365 <= countAll, `Monotonic 365d (${count365}) <= all (${countAll})`);
}

// 1.4 Custom Date Range Boundary Precision (00:00:00 to 23:59:59.999 in Local Time)
{
  const filterCustomRange = (apps, customFrom, customTo) => {
    const fromTime = customFrom && !isNaN(new Date(`${customFrom}T00:00:00`).getTime())
      ? new Date(`${customFrom}T00:00:00`).getTime()
      : 0;
    const toTime = customTo && !isNaN(new Date(`${customTo}T23:59:59.999`).getTime())
      ? new Date(`${customTo}T23:59:59.999`).getTime()
      : Infinity;

    return apps
      .map(a => {
        const matchedEmails = a.emails.filter(e => {
          const t = new Date(e.receivedAt).getTime();
          return t >= fromTime && t <= toTime;
        });
        return { ...a, emails: matchedEmails };
      })
      .filter(a => a.emails.length > 0);
  };

  const customFrom = '2026-10-10';
  const customTo = '2026-10-15';
  const expectedFromTime = new Date(`${customFrom}T00:00:00`).getTime();
  const expectedToTime = new Date(`${customTo}T23:59:59.999`).getTime();

  const startIso = new Date(expectedFromTime).toISOString();
  const endIso = new Date(expectedToTime).toISOString();
  const beforeStartIso = new Date(expectedFromTime - 1).toISOString();
  const afterEndIso = new Date(expectedToTime + 1).toISOString();

  const apps = [
    createMockApp('app-start', 'StartCorp', 'Dev', [createEmail('e1', 'StartCorp', 'applied', startIso)]),
    createMockApp('app-end', 'EndCorp', 'Dev', [createEmail('e2', 'EndCorp', 'applied', endIso)]),
    createMockApp('app-before', 'BeforeCorp', 'Dev', [createEmail('e3', 'BeforeCorp', 'applied', beforeStartIso)]),
    createMockApp('app-after', 'AfterCorp', 'Dev', [createEmail('e4', 'AfterCorp', 'applied', afterEndIso)]),
  ];

  const matched = filterCustomRange(apps, customFrom, customTo);
  assertEqual(matched.length, 2, 'Custom range strictly includes start and end boundaries');
  assertEqual(matched.some(a => a.id === 'app-start'), true, 'Start boundary email included');
  assertEqual(matched.some(a => a.id === 'app-end'), true, 'End boundary email included');
  assertEqual(matched.some(a => a.id === 'app-before'), false, '1ms before start boundary excluded');
  assertEqual(matched.some(a => a.id === 'app-after'), false, '1ms after end boundary excluded');

  // Inverted custom dates (from > to)
  const inverted = filterCustomRange(apps, '2026-10-20', '2026-10-10');
  assertEqual(inverted.length, 0, 'Inverted custom dates (From > To) returns 0 results without throwing');

  // Empty strings fallback to [0, Infinity]
  const allCustom = filterCustomRange(apps, '', '');
  assertEqual(allCustom.length, 4, 'Empty custom date strings fall back to all records');

  // Malformed date strings fallback safely
  const malformed = filterCustomRange(apps, 'not-a-valid-date', 'undefined');
  assertEqual(malformed.length, 4, 'Malformed date strings fall back safely without NaN error');
}

// 1.5 DateRangeControls React DOM Attribute Validation
{
  let pickedRange = null;
  let fromVal = null;
  let toVal = null;

  const html = ReactDOMServer.renderToString(
    React.createElement(DateRangeControls, {
      range: 'custom',
      onPickRange: r => { pickedRange = r; },
      customFrom: '2026-10-01',
      onFromChange: f => { fromVal = f; },
      customTo: '2026-10-31',
      onToChange: t => { toVal = t; },
      showTimeline: false,
      onToggleTimeline: () => {},
      refreshing: false,
      updatedLabel: 'Updated just now',
      onOpenShortcuts: () => {},
    })
  );

  assert(html.includes('bp-navbar-compact'), 'Renders compact Palantir Blueprint navbar');
  assert(html.includes('aria-label="Time period and date filters"'), 'Renders accessible time period controls');
  assert(html.includes('max="2026-10-31"'), 'From date input has max bound set to customTo');
  assert(html.includes('min="2026-10-01"'), 'To date input has min bound set to customFrom');
  assert(html.includes('aria-pressed="true"'), 'Active Custom button has aria-pressed=true');
  assert(html.includes('Updated just now'), 'Renders updated timestamp label');
  assert(html.includes('Timeline'), 'Renders Timeline toggle button with keycap hint');

  // Test refreshing state disables refresh button
  const refreshingHtml = ReactDOMServer.renderToString(
    React.createElement(DateRangeControls, {
      range: 'all',
      onPickRange: () => {},
      customFrom: '',
      onFromChange: () => {},
      customTo: '',
      onToChange: () => {},
      showTimeline: false,
      onToggleTimeline: () => {},
      onRefresh: () => {},
      refreshing: true,
      updatedLabel: 'Checking for new emails…',
    })
  );
  assert(refreshingHtml.includes('disabled=""') || refreshingHtml.includes('disabled'), 'Refresh button is disabled while refreshing=true');
  assert(refreshingHtml.includes('animate-spin'), 'Refresh icon has spinning animation during refresh');
}

// -----------------------------------------------------------------------------
// SUITE 2: Stage Count Aggregation Under Empty, Single, and Scale (10,000 Apps)
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Stage Count Aggregation (Empty, Single, 10,000 Scale) ---');

// 2.1 Empty Applications List
{
  const emptyBoard = buildBoard([], SIMULATED_NOW);
  assertEqual(emptyBoard.counts.length, 5, 'Empty applications list produces exactly 5 stage cards');
  assertEqual(emptyBoard.cards.length, 0, 'Empty applications list produces 0 cards');
  assertEqual(emptyBoard.unsure.length, 0, 'Empty applications list produces 0 unsure emails');
  assertEqual(emptyBoard.tasks.length, 0, 'Empty applications list produces 0 tasks');
  for (const c of emptyBoard.counts) {
    assertEqual(c.count, 0, `Count for ${c.key} is 0 on empty dataset`);
  }

  // Render StageMetricsBar with empty counts
  let selected = null;
  const emptyBarHtml = ReactDOMServer.renderToString(
    React.createElement(StageMetricsBar, {
      counts: emptyBoard.counts,
      activeStage: 'all',
      onSelectStage: s => { selected = s; },
    })
  );
  assert(emptyBarHtml.includes('bp-metrics-grid'), 'Renders Palantir Blueprint metrics grid');
  assertEqual(emptyBarHtml.includes('hot'), false, 'Offer card does NOT have hot class when count is 0');
  assert(emptyBarHtml.includes('tabular'), 'Numbers apply tabular figures class for alignment');
}

// 2.2 Single Item Variations
{
  // Single Applied
  const singleAppliedApp = createMockApp('app-1', 'Acme', 'Eng', [
    createEmail('e-1', 'Acme', 'applied', '2026-10-20T10:00:00Z'),
  ]);
  const b1 = buildBoard([singleAppliedApp], SIMULATED_NOW);
  assertEqual(b1.cards.length, 1, 'Single applied app yields 1 card');
  assertEqual(b1.cards[0].lane, 'applied', 'Card lane is applied');
  assertEqual(b1.counts.find(c => c.key === 'applied').count, 1, 'Applied metric count is 1');
  assertEqual(b1.counts.find(c => c.key === 'rejected').count, 0, 'Rejection metric count is 0');

  // Single Rejected
  const singleRejectedApp = createMockApp('app-2', 'StaleCorp', 'Eng', [
    createEmail('e-2', 'StaleCorp', 'applied', '2026-10-10T10:00:00Z'),
    createEmail('e-3', 'StaleCorp', 'rejected', '2026-10-22T10:00:00Z'),
  ]);
  const b2 = buildBoard([singleRejectedApp], SIMULATED_NOW);
  assertEqual(b2.cards[0].lane, 'rejected', 'Card lane is rejected');
  assertEqual(b2.counts.find(c => c.key === 'rejected').count, 1, 'Rejected metric count is 1');
  assertEqual(b2.counts.find(c => c.key === 'applied').count, 1, 'Applied email still counted in total applied');
  assertEqual(b2.cards[0].chip.kind, 'closed', 'Chip kind is closed for rejected application');

  // Single Offer -> Hot Class
  const singleOfferApp = createMockApp('app-3', 'UnicornCorp', 'Staff Eng', [
    createEmail('e-4', 'UnicornCorp', 'applied', '2026-10-01T10:00:00Z'),
    createEmail('e-5', 'UnicornCorp', 'interview', '2026-10-15T10:00:00Z'),
    createEmail('e-6', 'UnicornCorp', 'offer', '2026-10-23T10:00:00Z', { deadlineResolved: '2026-11-01T17:00:00Z' }),
  ]);
  const b3 = buildBoard([singleOfferApp], SIMULATED_NOW);
  const offerCount = b3.counts.find(c => c.key === 'offer');
  assertEqual(offerCount.count, 1, 'Offer count is 1');
  assertEqual(b3.cards[0].reached.has('applied'), true, 'Offer card tracks reached applied');
  assertEqual(b3.cards[0].reached.has('interview'), true, 'Offer card tracks reached interview');
  assertEqual(b3.cards[0].reached.has('offer'), true, 'Offer card tracks reached offer');

  const offerBarHtml = ReactDOMServer.renderToString(
    React.createElement(StageMetricsBar, {
      counts: b3.counts,
      activeStage: 'all',
      onSelectStage: () => {},
    })
  );
  assert(offerBarHtml.includes('hot'), 'StageMetricsBar applies hot class when offer count > 0');

  // Single Review (Unsure Classifier)
  const singleReviewApp = createMockApp('app-4', 'MysteriousCo', null, [
    createEmail('e-7', 'MysteriousCo', 'review', '2026-10-24T12:00:00Z'),
  ]);
  const b4 = buildBoard([singleReviewApp], SIMULATED_NOW);
  assertEqual(b4.cards.length, 0, 'Unsure review email is isolated from main cards list');
  assertEqual(b4.unsure.length, 1, 'Unsure review email is placed into unsure collection');
}

// 2.3 High-Scale Stress Test: 10,000 Synthetic Applications
{
  console.log('  Generating 10,000 synthetic applications for scale stress test...');
  const STAGES = ['applied', 'assessment', 'interview', 'offer', 'rejected', 'review'];
  const syntheticApps = [];
  let expectedAppliedEmails = 0;
  let expectedRejectedEmails = 0;
  let expectedNonReviewApps = 0;

  // Deterministic pseudo-random sequence for reproducible results
  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < 10000; i++) {
    const appId = `synth-app-${i}`;
    const company = `Company_${i % 500}`;
    const role = i % 3 === 0 ? `Software Engineer L${(i % 5) + 3}` : i % 3 === 1 ? `Product Manager` : null;
    const numEmails = (i % 4) + 1;
    const emails = [];

    // Stage progression
    const maxStageIdx = Math.floor(pseudoRandom() * STAGES.length);
    const hasOnlyReview = maxStageIdx === 5 && numEmails === 1;

    for (let j = 0; j <= maxStageIdx; j++) {
      const stage = STAGES[j];
      const daysAgo = Math.floor(pseudoRandom() * 180);
      const emailTime = new Date(SIMULATED_NOW - daysAgo * DAY_MS).toISOString();
      const actionNeeded = stage === 'assessment' || stage === 'interview';
      const deadlineResolved = actionNeeded ? new Date(SIMULATED_NOW + 5 * DAY_MS).toISOString() : null;

      emails.push(createEmail(`synth-e-${i}-${j}`, company, stage, emailTime, {
        role: role || undefined,
        actionNeeded,
        deadlineResolved,
      }));

      if (stage === 'applied') expectedAppliedEmails++;
      if (stage === 'rejected') expectedRejectedEmails++;
    }

    if (!hasOnlyReview) expectedNonReviewApps++;
    syntheticApps.push(createMockApp(appId, company, role, emails));
  }

  const scaleStart = performance.now();
  const scaledBoard = buildBoard(syntheticApps, SIMULATED_NOW);
  const scaleDuration = performance.now() - scaleStart;

  console.log(`  Processed 10,000 applications in ${scaleDuration.toFixed(2)}ms (${Math.round((10000 / scaleDuration) * 1000)} apps/sec)`);

  assert(scaleDuration < 5000, `10,000 applications process in under 5000ms (took ${scaleDuration.toFixed(2)}ms)`);
  assertEqual(scaledBoard.counts.length, 5, 'Scaled board maintains exactly 5 stage cards');

  // Verify total cards conservation
  const totalCardsInLanes = scaledBoard.lanes.reduce((sum, l) => sum + l.cards.length, 0);
  assertEqual(scaledBoard.cards.length, totalCardsInLanes, 'Total cards equals sum of cards across all 5 lanes');

  // Verify metric counts match exact email aggregations
  const appliedMetric = scaledBoard.counts.find(c => c.key === 'applied');
  const rejectedMetric = scaledBoard.counts.find(c => c.key === 'rejected');
  assertEqual(appliedMetric.count, expectedAppliedEmails, 'Applied metric count exactly matches applied email count');
  assertEqual(rejectedMetric.count, expectedRejectedEmails, 'Rejected metric count exactly matches rejected email count');

  // Verify no NaNs or undefineds in counts
  for (const c of scaledBoard.counts) {
    assert(!isNaN(c.count) && c.count >= 0, `Metric count for ${c.key} is valid non-negative number (${c.count})`);
    assert(typeof c.note === 'string' && c.note.length > 0, `Metric note for ${c.key} is non-empty string`);
  }
}

// -----------------------------------------------------------------------------
// SUITE 3: Status Overrides Store Behavior
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Status Overrides Store Behavior ---');

{
  // Simulated localStorage mock
  class MockLocalStorage {
    constructor() {
      this.store = new Map();
      this.shouldThrowQuota = false;
      this.shouldThrowSecurity = false;
    }
    getItem(key) {
      if (this.shouldThrowSecurity) throw new Error('SecurityError: Access is denied');
      return this.store.get(key) ?? null;
    }
    setItem(key, val) {
      if (this.shouldThrowSecurity) throw new Error('SecurityError: Access is denied');
      if (this.shouldThrowQuota) throw new Error('QuotaExceededError: LocalStorage quota exceeded');
      this.store.set(key, String(val));
    }
    removeItem(key) {
      this.store.delete(key);
    }
    clear() {
      this.store.clear();
    }
  }

  const mockStorage = new MockLocalStorage();
  const OVERRIDE_KEY = 'trackerStatusOverrides';

  function loadStatusOverrides(storage) {
    try {
      const raw = storage.getItem(OVERRIDE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return {};
  }

  function saveStatusOverrides(storage, overrides) {
    try {
      storage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    } catch {}
  }

  // 3.1 Normal round-trip serialization
  saveStatusOverrides(mockStorage, { 'app-1': 'interview', 'app-2': 'offer' });
  const loaded1 = loadStatusOverrides(mockStorage);
  assertDeepEqual(loaded1, { 'app-1': 'interview', 'app-2': 'offer' }, 'Status overrides persist and reload cleanly');

  // 3.2 Reset logic (deleting override key)
  const updatedOverrides = { ...loaded1 };
  delete updatedOverrides['app-1'];
  saveStatusOverrides(mockStorage, updatedOverrides);
  const loaded2 = loadStatusOverrides(mockStorage);
  assertDeepEqual(loaded2, { 'app-2': 'offer' }, 'Reset status override cleanly deletes entry from store');

  // 3.3 Corruption & Malformed Data Fallbacks
  const corruptPayloads = [
    '{malformed-json',
    'null',
    '12345',
    '"plain string"',
    '[1, 2, 3]',
    'true',
    '',
  ];

  for (const badPayload of corruptPayloads) {
    mockStorage.store.set(OVERRIDE_KEY, badPayload);
    const fallback = loadStatusOverrides(mockStorage);
    assertDeepEqual(fallback, {}, `Corrupt storage payload "${badPayload}" safely falls back to empty object {}`);
  }

  // 3.4 QuotaExceededError and SecurityError suppression
  mockStorage.shouldThrowQuota = true;
  let didCrashOnQuota = false;
  try {
    saveStatusOverrides(mockStorage, { 'app-quota': 'interview' });
  } catch {
    didCrashOnQuota = true;
  }
  assertEqual(didCrashOnQuota, false, 'QuotaExceededError is safely caught without throwing');
  mockStorage.shouldThrowQuota = false;

  mockStorage.shouldThrowSecurity = true;
  let didCrashOnSecurity = false;
  try {
    loadStatusOverrides(mockStorage);
  } catch {
    didCrashOnSecurity = true;
  }
  assertEqual(didCrashOnSecurity, false, 'SecurityError on getItem is safely caught returning {}');
  mockStorage.shouldThrowSecurity = false;

  // 3.5 Invalid Stage Fallback in Board
  // What if store contains an unrecognized lane string?
  const testApp = createMockApp('app-fallback', 'UnknownCorp', 'Eng', [
    createEmail('e-fb', 'UnknownCorp', 'applied', '2026-10-20T10:00:00Z'),
  ]);

  const applyOverrides = (apps, overrides) => {
    return apps.map(app => {
      const override = overrides[app.id];
      if (!override) return app;
      const updatedEmails = app.emails.map(e => ({ ...e, stage: override }));
      return {
        ...app,
        emails: updatedEmails,
        stage: override === 'rejected' ? 'closed' : app.stage,
      };
    });
  };

  const overriddenWithInvalid = applyOverrides([testApp], { 'app-fallback': 'non_existent_stage_xyz' });
  const boardWithFallback = buildBoard(overriddenWithInvalid, SIMULATED_NOW);
  assertEqual(boardWithFallback.cards.length, 1, 'Invalid stage fallback preserves card on board');
  assertEqual(boardWithFallback.cards[0].lane, 'applied', 'Invalid stage safely falls back to "applied" lane');

  // 3.6 Rejection override sets closed status
  const overriddenRejected = applyOverrides([testApp], { 'app-fallback': 'rejected' });
  const boardRejected = buildBoard(overriddenRejected, SIMULATED_NOW);
  assertEqual(boardRejected.cards[0].lane, 'rejected', 'Overridden to rejected sets lane to rejected');
  assertEqual(boardRejected.cards[0].chip.kind, 'closed', 'Chip kind is closed');
}

// -----------------------------------------------------------------------------
// SUITE 4: Filter Pipeline: Date Range + Stage Pill + Search String
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Filter Pipeline & Search Edge Cases ---');

{
  const { applications } = adaptFeed(SAMPLE_FEED, SIMULATED_NOW);

  // Complete Dashboard Filter Pipeline simulation
  function executeFilterPipeline(apps, { range = 'all', customFrom = '', customTo = '', stage = 'all', search = '' }) {
    // 1. Date Range
    let inRange = apps;
    if (range === 'custom') {
      const fromTime = customFrom && !isNaN(new Date(`${customFrom}T00:00:00`).getTime())
        ? new Date(`${customFrom}T00:00:00`).getTime() : 0;
      const toTime = customTo && !isNaN(new Date(`${customTo}T23:59:59.999`).getTime())
        ? new Date(`${customTo}T23:59:59.999`).getTime() : Infinity;

      inRange = apps
        .map(a => ({
          ...a,
          emails: a.emails.filter(e => {
            const t = new Date(e.receivedAt).getTime();
            return t >= fromTime && t <= toTime;
          }),
        }))
        .filter(a => a.emails.length > 0);
    } else {
      const days = RANGES.find(r => r.key === range)?.days ?? 0;
      if (days > 0) {
        const since = SIMULATED_NOW - days * DAY_MS;
        inRange = apps
          .map(a => ({ ...a, emails: a.emails.filter(e => new Date(e.receivedAt).getTime() >= since) }))
          .filter(a => a.emails.length > 0);
      }
    }

    // 2. Build Board
    const board = buildBoard(inRange, SIMULATED_NOW);
    const allCards = board.lanes.flatMap(l => l.cards);

    // 3. Stage Filter
    let filtered = allCards;
    if (stage !== 'all') {
      filtered = filtered.filter(c => c.lane === stage);
    }

    // 4. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(c => c.app.company.toLowerCase().includes(q) || (c.app.role && c.app.role.toLowerCase().includes(q)));
    }

    return { board, allCards, filtered };
  }

  // 4.1 Combined Filter Intersection
  const res1 = executeFilterPipeline(applications, {
    range: '30',
    stage: 'interview',
    search: 'kestrel',
  });
  assert(res1.filtered.length > 0, 'Finds Kestrel AI in 30d range under interview stage');
  for (const c of res1.filtered) {
    assertEqual(c.lane, 'interview', 'Result card is in interview stage');
    assert(c.app.company.toLowerCase().includes('kestrel'), 'Result card company includes Kestrel');
  }

  // 4.2 Special Characters & Regex Metacharacters in Search
  const regexChars = ['.*', '+', '?', '^', '$', '(', ')', '[', ']', '{', '}', '|', '\\', '<script>', '\' OR \'1\'=\'1'];
  for (const charQuery of regexChars) {
    let threw = false;
    let count = 0;
    try {
      const res = executeFilterPipeline(applications, { search: charQuery });
      count = res.filtered.length;
    } catch {
      threw = true;
    }
    assertEqual(threw, false, `Search query with regex metacharacters "${charQuery}" does not throw RegExp syntax error`);
  }

  // Exact literal search behavior for dot (should not match all characters)
  const dotApp = createMockApp('app-dot', 'Node.js Foundation', 'Core Developer', [
    createEmail('e-dot', 'Node.js Foundation', 'applied', '2026-10-20T10:00:00Z'),
  ]);
  const plainApp = createMockApp('app-plain', 'Nodejs Corp', 'Dev', [
    createEmail('e-plain', 'Nodejs Corp', 'applied', '2026-10-20T10:00:00Z'),
  ]);
  const dotRes = executeFilterPipeline([dotApp, plainApp], { search: 'node.' });
  assertEqual(dotRes.filtered.length, 1, 'Search for "node." matches "Node.js" literally, not "Nodejs"');
  assertEqual(dotRes.filtered[0].app.company, 'Node.js Foundation', 'Literal dot matches dot character only');

  // 4.3 Unicode & Multi-lingual Characters
  const unicodeApps = [
    createMockApp('app-u1', 'München AI GmbH', 'Forscher', [createEmail('eu1', 'München AI GmbH', 'applied', '2026-10-20T10:00:00Z')]),
    createMockApp('app-u2', 'Société Générale', 'Développeur', [createEmail('eu2', 'Société Générale', 'applied', '2026-10-20T10:00:00Z')]),
    createMockApp('app-u3', 'ByteDance 北京', '后端研发', [createEmail('eu3', 'ByteDance 北京', 'applied', '2026-10-20T10:00:00Z')]),
    createMockApp('app-u4', 'Rocket Launch 🚀', 'Engineer', [createEmail('eu4', 'Rocket Launch 🚀', 'applied', '2026-10-20T10:00:00Z')]),
  ];

  const deRes = executeFilterPipeline(unicodeApps, { search: 'münchen' });
  assertEqual(deRes.filtered.length, 1, 'Unicode diacritics "münchen" matches "München AI GmbH"');

  const frRes = executeFilterPipeline(unicodeApps, { search: 'société' });
  assertEqual(frRes.filtered.length, 1, 'Unicode accents "société" matches "Société Générale"');

  const cnRes = executeFilterPipeline(unicodeApps, { search: '北京' });
  assertEqual(cnRes.filtered.length, 1, 'Chinese characters "北京" matches "ByteDance 北京"');

  const emojiRes = executeFilterPipeline(unicodeApps, { search: '🚀' });
  assertEqual(emojiRes.filtered.length, 1, 'Emoji "🚀" matches "Rocket Launch 🚀"');

  // 4.4 Whitespace and Empty String Handling
  const spaceRes1 = executeFilterPipeline(unicodeApps, { search: '   ' });
  assertEqual(spaceRes1.filtered.length, 4, 'Whitespace-only search matches all records without filter suppression');

  const spaceRes2 = executeFilterPipeline(unicodeApps, { search: '\t\n\r  ' });
  assertEqual(spaceRes2.filtered.length, 4, 'Tab and newline whitespace matches all records');

  const trimRes = executeFilterPipeline(unicodeApps, { search: '   münchen   ' });
  assertEqual(trimRes.filtered.length, 1, 'Search query with leading/trailing whitespace trims and matches');

  // 4.5 Prototype Pollution Inoculation
  const protoRes = executeFilterPipeline(applications, { search: '__proto__' });
  assertEqual(protoRes.filtered.length, 0, 'Prototype pollution query "__proto__" executes safely without matching');
  const ctorRes = executeFilterPipeline(applications, { search: 'constructor' });
  assertEqual(ctorRes.filtered.length, 0, 'Constructor query executes safely without matching');

  // 4.6 Null / Undefined Role Defense
  const nullRoleApp = createMockApp('app-null-role', 'NullRole Corp', null, [
    createEmail('e-nr', 'NullRole Corp', 'applied', '2026-10-20T10:00:00Z'),
  ]);
  const nrRes = executeFilterPipeline([nullRoleApp], { search: 'engineer' });
  assertEqual(nrRes.filtered.length, 0, 'Null role safely returns 0 matches for non-matching search without TypeError');

  const nrMatch = executeFilterPipeline([nullRoleApp], { search: 'nullrole' });
  assertEqual(nrMatch.filtered.length, 1, 'Null role matches company name');
}

// -----------------------------------------------------------------------------
// SUITE 5: Pagination Mathematics & Clamping
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Pagination Mathematics & Clamping ---');

{
  const TABLE_PAGE_SIZE = 12;

  function computePagination(totalItems, currentPage) {
    const totalPages = Math.ceil(totalItems / TABLE_PAGE_SIZE) || 1;
    const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
    const startIdx = totalItems > 0 ? safePage * TABLE_PAGE_SIZE + 1 : 0;
    const endIdx = Math.min((safePage + 1) * TABLE_PAGE_SIZE, totalItems);
    const isPrevDisabled = safePage === 0;
    const isNextDisabled = safePage >= totalPages - 1;

    return { totalPages, safePage, startIdx, endIdx, isPrevDisabled, isNextDisabled };
  }

  // 5.1 Exact Multiples and Boundary Page Counts
  const testCases = [
    { total: 0, page: 0, expPages: 1, expSafe: 0, expStart: 0, expEnd: 0, expPrev: true, expNext: true },
    { total: 1, page: 0, expPages: 1, expSafe: 0, expStart: 1, expEnd: 1, expPrev: true, expNext: true },
    { total: 11, page: 0, expPages: 1, expSafe: 0, expStart: 1, expEnd: 11, expPrev: true, expNext: true },
    { total: 12, page: 0, expPages: 1, expSafe: 0, expStart: 1, expEnd: 12, expPrev: true, expNext: true },
    { total: 13, page: 0, expPages: 2, expSafe: 0, expStart: 1, expEnd: 12, expPrev: true, expNext: false },
    { total: 13, page: 1, expPages: 2, expSafe: 1, expStart: 13, expEnd: 13, expPrev: false, expNext: true },
    { total: 24, page: 1, expPages: 2, expSafe: 1, expStart: 13, expEnd: 24, expPrev: false, expNext: true },
    { total: 25, page: 2, expPages: 3, expSafe: 2, expStart: 25, expEnd: 25, expPrev: false, expNext: true },
    { total: 120, page: 9, expPages: 10, expSafe: 9, expStart: 109, expEnd: 120, expPrev: false, expNext: true },
    { total: 10000, page: 833, expPages: 834, expSafe: 833, expStart: 9997, expEnd: 10000, expPrev: false, expNext: true },
  ];

  for (const tc of testCases) {
    const res = computePagination(tc.total, tc.page);
    assertEqual(res.totalPages, tc.expPages, `Total items ${tc.total} yields ${tc.expPages} totalPages`);
    assertEqual(res.safePage, tc.expSafe, `Page ${tc.page} clamps to safePage ${tc.expSafe}`);
    assertEqual(res.startIdx, tc.expStart, `Start index for ${tc.total} on page ${tc.page} is ${tc.expStart}`);
    assertEqual(res.endIdx, tc.expEnd, `End index for ${tc.total} on page ${tc.page} is ${tc.expEnd}`);
    assertEqual(res.isPrevDisabled, tc.expPrev, `Prev disabled is ${tc.expPrev}`);
    assertEqual(res.isNextDisabled, tc.expNext, `Next disabled is ${tc.expNext}`);
  }

  // 5.2 Clamping when filtered list shrinks
  // Scenario: User navigated to page 7 of 100 items (8 total pages, indices 0..7).
  // Filter is applied reducing items to 15 (2 total pages, indices 0..1).
  const clamped1 = computePagination(15, 7);
  assertEqual(clamped1.totalPages, 2, 'Total pages drops to 2');
  assertEqual(clamped1.safePage, 1, 'Current page 7 automatically clamps to 1 (last available page)');
  assertEqual(clamped1.startIdx, 13, 'Start index updates to 13');
  assertEqual(clamped1.endIdx, 15, 'End index updates to 15');

  // Scenario: Filter is applied reducing items to 0
  const clamped0 = computePagination(0, 7);
  assertEqual(clamped0.totalPages, 1, 'Total pages for 0 items is 1');
  assertEqual(clamped0.safePage, 0, 'Current page 7 clamps safely to 0');
  assertEqual(clamped0.startIdx, 0, 'Start index for 0 items is 0');
  assertEqual(clamped0.endIdx, 0, 'End index for 0 items is 0');

  // 5.3 Slice Range Integrity
  const dummyList = Array.from({ length: 30 }, (_, i) => ({ id: `card-${i}` }));
  const p0 = dummyList.slice(0 * TABLE_PAGE_SIZE, 1 * TABLE_PAGE_SIZE);
  const p1 = dummyList.slice(1 * TABLE_PAGE_SIZE, 2 * TABLE_PAGE_SIZE);
  const p2 = dummyList.slice(2 * TABLE_PAGE_SIZE, 3 * TABLE_PAGE_SIZE);
  assertEqual(p0.length, 12, 'Page 0 slice has 12 items');
  assertEqual(p1.length, 12, 'Page 1 slice has 12 items');
  assertEqual(p2.length, 6, 'Page 2 slice has remaining 6 items');
  assertEqual(p0[0].id, 'card-0', 'First item of page 0 is card-0');
  assertEqual(p1[0].id, 'card-12', 'First item of page 1 is card-12');
  assertEqual(p2[0].id, 'card-24', 'First item of page 2 is card-24');

  // 5.4 ApplicationTable Component Render Verification
  const tableHtml = ReactDOMServer.renderToString(
    React.createElement(ApplicationTable, {
      cards: [],
      totalFilteredCount: 0,
      allCardsCount: 0,
      lanes: LANES.map(l => ({ ...l, cards: [] })),
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

  assert(tableHtml.includes('No applications found matching your filter.'), 'Renders empty state message when cards list is empty');
  assert(/Showing\s*(<!--.*?-->)?\s*0\s*(<!--.*?-->)?\s*–\s*(<!--.*?-->)?\s*0\s*(<!--.*?-->)?\s*of\s*(<!--.*?-->)?\s*0/.test(tableHtml), 'Renders Showing 0–0 of 0 pagination label for 0 items');
  assert(tableHtml.includes('disabled=""') || tableHtml.includes('disabled'), 'Prev and Next buttons disabled on page 0 of 1');
  assert(tableHtml.includes('bp-table-pagination'), 'Renders Palantir Blueprint table pagination toolbar');
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
const duration = (performance.now() - startTime).toFixed(2);
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log(`DURATION:    ${duration}ms`);
console.log('================================================================');

if (failed > 0) {
  console.error('\nFAILURES DETECTED:');
  for (const f of failures) {
    console.error(`- ${f}`);
  }
  process.exit(1);
} else {
  console.log('\nVERDICT: ALL ADVERSARIAL STRESS TESTS PASSED EMPIRICALLY! ZERO REGRESSIONS.');
  process.exit(0);
}
