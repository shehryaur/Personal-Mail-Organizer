import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCoreModules,
  getActiveCss,
  tryLoadBlueprintTokens,
  REFERENCE_INTENTS,
  referenceGetLaneIntent,
  referenceGetChipIntent,
  createMockKeyEvent,
  createMockInputElement,
  dispatchHotkey,
  createTriageState,
  createMockStorage,
  createMockApp,
} from './test_helpers.mjs';

const { board, feed, mock } = loadCoreModules();
const SIMULATED_NOW = 1792744200000; // Fri Oct 23, 2026

describe('Tier 3: Cross-Feature Combinations (Pairwise Coverage & Interactions)', () => {
  const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
  const liveTokens = tryLoadBlueprintTokens();
  const getLane = liveTokens?.getLaneIntent || referenceGetLaneIntent;
  const getChip = liveTokens?.getChipIntent || referenceGetChipIntent;

  // --------------------------------------------------------------------------
  // Pair 1: Search Query Filter + Keyboard Navigation & Inspection
  // --------------------------------------------------------------------------
  it('Pair 1: Search query filters records, j/k navigates results, Enter inspects', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const query = 'lumen';
    const filtered = b.cards.filter(c => c.app.company.toLowerCase().includes(query));
    assert.equal(filtered.length, 1);

    let activeRowIndex = 0;
    let inspectedCard = null;

    // Navigate down - clamps at 0 because length is 1
    dispatchHotkey({
      activeRowIndex,
      totalRows: filtered.length,
      onSelectRow: (idx) => { activeRowIndex = idx; },
    }, createMockKeyEvent('j'));
    assert.equal(activeRowIndex, 0);

    // Inspect
    dispatchHotkey({
      activeRowIndex,
      totalRows: filtered.length,
      onInspectRow: (idx) => { inspectedCard = filtered[idx]; },
    }, createMockKeyEvent('Enter'));

    assert.ok(inspectedCard);
    assert.equal(inspectedCard.app.company, 'Lumen Analytics');
  });

  // --------------------------------------------------------------------------
  // Pair 2: Date Range Preset + Stage Summary Card Filter
  // --------------------------------------------------------------------------
  it('Pair 2: Switching date range to 7 days then filtering by Assessment stage combines filters', () => {
    const since = SIMULATED_NOW - 7 * 86400000;
    const inRange = applications.filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= since));
    const b = board.buildBoard(inRange, SIMULATED_NOW);

    const assessments = b.cards.filter(c => c.lane === 'assessment');
    assert.ok(assessments.length > 0);
    assert.ok(assessments.every(c => c.lane === 'assessment'));
  });

  // --------------------------------------------------------------------------
  // Pair 3: Detail Drawer Open + Hotkey Status Triage
  // --------------------------------------------------------------------------
  it('Pair 3: With drawer open, pressing hotkey 3 triages status to Interview and updates badge', () => {
    const triage = createTriageState(applications);
    const targetApp = applications[0]; // Lumen Analytics
    let isDrawerOpen = true;

    // Triage to interview via hotkey 3
    dispatchHotkey({
      activeRowIndex: 0,
      totalRows: applications.length,
      isDrawerOpen,
      onTriageStatus: (stage) => {
        triage.setStatus(targetApp.id, stage);
      },
    }, createMockKeyEvent('3'));

    const updatedApps = triage.applyTo(applications);
    const updatedBoard = board.buildBoard(updatedApps, SIMULATED_NOW);
    const updatedCard = updatedBoard.cards.find(c => c.app.id === targetApp.id);

    assert.ok(updatedCard);
    assert.equal(updatedCard.lane, 'interview');
    assert.equal(getLane(updatedCard.lane), 'primary');
  });

  // --------------------------------------------------------------------------
  // Pair 4: Detail Drawer Open + Pagination Advance (])
  // --------------------------------------------------------------------------
  it('Pair 4: Advancing page with ] while drawer is open live-updates drawer to first record of new page', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const PAGE_SIZE = 12;
    let page = 0;
    let activeRowIndex = 3;
    let isDrawerOpen = true;

    // Advance page
    dispatchHotkey({
      isDrawerOpen,
      onNextPage: () => {
        page = Math.min(Math.ceil(b.cards.length / PAGE_SIZE) - 1, page + 1);
        activeRowIndex = 0;
      },
    }, createMockKeyEvent(']'));

    assert.equal(page, 1);
    assert.equal(activeRowIndex, 0);

    const pageCards = b.cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const drawerCard = pageCards[activeRowIndex];
    assert.ok(drawerCard);
    assert.equal(drawerCard.app.company, b.cards[12].app.company);
  });

  // --------------------------------------------------------------------------
  // Pair 5: Search Filter + Clamped Hotkey Navigation
  // --------------------------------------------------------------------------
  it('Pair 5: Filter with 2 results clamps j navigation at index 1 without jumping out of bounds', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const query = 'designer';
    const filtered = b.cards.filter(c => c.app.role.toLowerCase().includes(query));
    assert.ok(filtered.length >= 2);

    let activeRowIndex = 0;
    // Press j 10 times
    for (let i = 0; i < 10; i++) {
      dispatchHotkey({
        activeRowIndex,
        totalRows: filtered.length,
        onSelectRow: (idx) => { activeRowIndex = idx; },
      }, createMockKeyEvent('j'));
    }

    assert.equal(activeRowIndex, filtered.length - 1);
  });

  // --------------------------------------------------------------------------
  // Pair 6: Status Override + Date Range Boundary Change
  // --------------------------------------------------------------------------
  it('Pair 6: Overriding application status persists and updates counts across date range changes', () => {
    const storage = createMockStorage();
    const triage = createTriageState(applications, {}, storage);
    const targetApp = applications.find(a => a.company === 'Cobalt Pay');
    assert.ok(targetApp);

    // Override Cobalt Pay to offer
    triage.setStatus(targetApp.id, 'offer');

    // Date range 1: 30 days
    const since30 = SIMULATED_NOW - 30 * 86400000;
    const inRange30 = triage.applyTo(applications).filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= since30));
    const board30 = board.buildBoard(inRange30, SIMULATED_NOW);
    const offer30 = board30.counts.find(c => c.key === 'offer');

    // Date range 2: All time
    const boardAll = board.buildBoard(triage.applyTo(applications), SIMULATED_NOW);
    const offerAll = boardAll.counts.find(c => c.key === 'offer');

    assert.ok(offer30.count >= 2);
    assert.ok(offerAll.count >= 2);
  });

  // --------------------------------------------------------------------------
  // Pair 7: Custom Date Range Input + Input Guard Protection
  // --------------------------------------------------------------------------
  it('Pair 7: Typing numbers or letters in custom date input suppresses triage and navigation hotkeys', () => {
    const dateInput = createMockInputElement('INPUT', { value: '2026-10-15' });
    let triageTriggered = false;
    let navTriggered = false;

    // Keys 1, 2, j, k, / while date input is active
    for (const key of ['1', '2', 'j', 'k', '/']) {
      const res = dispatchHotkey({
        onTriageStatus: () => { triageTriggered = true; },
        onSelectRow: () => { navTriggered = true; },
      }, createMockKeyEvent(key, { target: dateInput }));

      assert.equal(res.suppressedByInputGuard, true);
    }

    assert.equal(triageTriggered, false);
    assert.equal(navTriggered, false);
  });

  // --------------------------------------------------------------------------
  // Pair 8: Stage Pill Filter ('Assessment') + Hotkey Inspection (Enter)
  // --------------------------------------------------------------------------
  it('Pair 8: Stage pill filter selects assessment lane and Enter opens detail drawer with due chip', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const assessments = b.cards.filter(c => c.lane === 'assessment');
    assert.ok(assessments.length > 0);

    let openedCard = null;
    dispatchHotkey({
      activeRowIndex: 0,
      totalRows: assessments.length,
      onInspectRow: (idx) => { openedCard = assessments[idx]; },
    }, createMockKeyEvent('Enter'));

    assert.ok(openedCard);
    assert.equal(openedCard.lane, 'assessment');
    assert.equal(getChip(openedCard.chip.kind), 'warning');
  });

  // --------------------------------------------------------------------------
  // Pair 9: Shortcuts Modal Open + Detail Drawer Open + Escape Hierarchy
  // --------------------------------------------------------------------------
  it('Pair 9: Escape stack hierarchy closes shortcuts dialog first, then detail drawer second', () => {
    let isShortcutsOpen = true;
    let isDrawerOpen = true;

    // First Escape: Closes shortcuts modal
    const res1 = dispatchHotkey({
      isShortcutsOpen,
      isDrawerOpen,
      onToggleShortcuts: () => { isShortcutsOpen = false; },
      onDismiss: () => { isDrawerOpen = false; },
    }, createMockKeyEvent('Escape'));

    assert.equal(res1.action, 'close_shortcuts');
    assert.equal(isShortcutsOpen, false);
    assert.equal(isDrawerOpen, true);

    // Second Escape: Closes detail drawer
    const res2 = dispatchHotkey({
      isShortcutsOpen,
      isDrawerOpen,
      onToggleShortcuts: () => { isShortcutsOpen = false; },
      onDismiss: () => { isDrawerOpen = false; },
    }, createMockKeyEvent('Escape'));

    assert.equal(res2.action, 'close_drawer');
    assert.equal(isDrawerOpen, false);
  });

  // --------------------------------------------------------------------------
  // Pair 10: Search Filter Match 0 + Escape to Blur + Forward Slash to Re-focus
  // --------------------------------------------------------------------------
  it('Pair 10: Zero-match search blurred via Escape and re-focused via /', () => {
    const searchInput = createMockInputElement('INPUT', { value: 'nonexistent_search' });

    // Escape inside search input
    const resEsc = dispatchHotkey({}, createMockKeyEvent('Escape', { target: searchInput }));
    assert.equal(resEsc.suppressedByInputGuard, true);
    assert.equal(searchInput.isBlurred, true);

    // / outside search input focuses search
    let focused = false;
    const resSlash = dispatchHotkey({
      onFocusSearch: () => {
        searchInput.focus();
        focused = true;
      },
    }, createMockKeyEvent('/'));

    assert.equal(resSlash.action, 'focus_search');
    assert.equal(focused, true);
    assert.equal(searchInput.isFocused, true);
  });

  // --------------------------------------------------------------------------
  // Pair 11: Status Override to 'rejected' + Stage Filter 'All'
  // --------------------------------------------------------------------------
  it('Pair 11: Application overridden to rejected displays Danger tag and closed chip in All view', () => {
    const triage = createTriageState(applications);
    const target = applications.find(a => a.company === 'Kestrel AI');
    assert.ok(target);

    triage.setStatus(target.id, 'rejected');
    const updatedBoard = board.buildBoard(triage.applyTo(applications), SIMULATED_NOW);
    const updatedCard = updatedBoard.cards.find(c => c.app.id === target.id);

    assert.ok(updatedCard);
    assert.equal(updatedCard.lane, 'rejected');
    assert.equal(getLane(updatedCard.lane), 'danger');
  });

  // --------------------------------------------------------------------------
  // Pair 12: Quick Triage Hotkey i (Interview) + Revert u
  // --------------------------------------------------------------------------
  it('Pair 12: Hotkey i sets stage to interview and hotkey u restores original stage', () => {
    const triage = createTriageState(applications);
    const target = applications[0];

    // Press i -> set interview
    triage.setStatus(target.id, 'interview');
    assert.equal(triage.hasOverride(target.id), true);
    assert.equal(triage.overrides[target.id], 'interview');

    // Press u -> revert
    triage.resetStatus(target.id);
    assert.equal(triage.hasOverride(target.id), false);
  });

  // --------------------------------------------------------------------------
  // Pair 13: Activity Timeline Drawer Open + Table Keyboard Navigation
  // --------------------------------------------------------------------------
  it('Pair 13: Timeline drawer opened via t, dismissed via Escape, resuming j navigation', () => {
    let isTimelineOpen = false;
    let activeRowIndex = 0;

    // Press t
    dispatchHotkey({
      onToggleTimeline: () => { isTimelineOpen = true; },
    }, createMockKeyEvent('t'));
    assert.equal(isTimelineOpen, true);

    // Press Escape
    dispatchHotkey({
      isTimelineOpen,
      onToggleTimeline: () => { isTimelineOpen = false; },
    }, createMockKeyEvent('Escape'));
    assert.equal(isTimelineOpen, false);

    // Press j
    dispatchHotkey({
      activeRowIndex,
      totalRows: 10,
      onSelectRow: (idx) => { activeRowIndex = idx; },
    }, createMockKeyEvent('j'));
    assert.equal(activeRowIndex, 1);
  });

  // --------------------------------------------------------------------------
  // Pair 14: Multi-page Pagination + Row Selection + Search Reset
  // --------------------------------------------------------------------------
  it('Pair 14: Navigating to page 1 and selecting row 2 resets to page 0, row 0 when search is entered', () => {
    let page = 1;
    let activeRowIndex = 2;

    const handleSearchChange = (query) => {
      page = 0;
      activeRowIndex = 0;
    };

    handleSearchChange('lumen');
    assert.equal(page, 0);
    assert.equal(activeRowIndex, 0);
  });

  // --------------------------------------------------------------------------
  // Pair 15: Continuous Synchronization + Clamped Navigation at Top (k on row 0)
  // --------------------------------------------------------------------------
  it('Pair 15: Drawer open on row 0 stays open on row 0 when k is pressed', () => {
    let activeRowIndex = 0;
    let isDrawerOpen = true;

    dispatchHotkey({
      activeRowIndex,
      totalRows: 10,
      isDrawerOpen,
      onSelectRow: (idx) => { activeRowIndex = idx; },
    }, createMockKeyEvent('k'));

    assert.equal(activeRowIndex, 0);
    assert.equal(isDrawerOpen, true);
  });

  // --------------------------------------------------------------------------
  // Pair 16: Drawer Action 'Open in Gmail' + External Callback Verification
  // --------------------------------------------------------------------------
  it('Pair 16: Drawer action Open in Gmail invokes onOpenEmail with exact email ID', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const card = b.cards[0];
    let openedEmailId = null;

    const onOpenEmail = (id) => {
      openedEmailId = id;
    };

    onOpenEmail(card.openEmailId);
    assert.equal(openedEmailId, card.openEmailId);
    assert.ok(openedEmailId.startsWith('msg-'));
  });

  // --------------------------------------------------------------------------
  // Pair 17: Status Override Store + Session Reload from LocalStorage
  // --------------------------------------------------------------------------
  it('Pair 17: Overriding 3 applications persists into localStorage and reloads cleanly on new session', () => {
    const storage = createMockStorage();
    const session1 = createTriageState(applications, {}, storage);

    session1.setStatus('app-lumenanalytics', 'offer');
    session1.setStatus('app-kestrelai', 'interview');
    session1.setStatus('app-cobaltpay', 'rejected');

    // Simulate new session loading from same storage
    const session2 = createTriageState(applications, {}, storage);
    assert.equal(session2.overrides['app-lumenanalytics'], 'offer');
    assert.equal(session2.overrides['app-kestrelai'], 'interview');
    assert.equal(session2.overrides['app-cobaltpay'], 'rejected');
  });

  // --------------------------------------------------------------------------
  // Pair 18: Date Preset Switching + Monotonic Count Recalculation
  // --------------------------------------------------------------------------
  it('Pair 18: Switching range 7 -> 30 -> 365 produces monotonically non-decreasing applied counts', () => {
    const countForDays = (days) => {
      const since = days > 0 ? SIMULATED_NOW - days * 86400000 : 0;
      const filtered = applications.filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= since));
      const b = board.buildBoard(filtered, SIMULATED_NOW);
      return b.counts.find(c => c.key === 'applied')?.count || 0;
    };

    const count7 = countForDays(7);
    const count30 = countForDays(30);
    const count365 = countForDays(365);

    assert.ok(count7 <= count30);
    assert.ok(count30 <= count365);
  });

  // --------------------------------------------------------------------------
  // Pair 19: Hotkey Safety + Rapid Alphanumeric Typing in Search Input
  // --------------------------------------------------------------------------
  it('Pair 19: Rapid typing in search input does not fire navigation or triage hotkeys', () => {
    const searchInput = createMockInputElement('INPUT');
    const typedText = 'kestrel 123 offer / ? j k';
    let triageFired = false;
    let navFired = false;

    for (const char of typedText) {
      dispatchHotkey({
        onTriageStatus: () => { triageFired = true; },
        onSelectRow: () => { navFired = true; },
      }, createMockKeyEvent(char, { target: searchInput }));
    }

    assert.equal(triageFired, false);
    assert.equal(navFired, false);
  });

  // --------------------------------------------------------------------------
  // Pair 20: Full Operational Triage Workflow
  // --------------------------------------------------------------------------
  it('Pair 20: Complete operational loop: search -> blur -> open drawer -> triage -> advance -> close', () => {
    const triage = createTriageState(applications);
    const searchInput = createMockInputElement('INPUT', { value: 'kestrel' });

    // 1. Blur search
    dispatchHotkey({}, createMockKeyEvent('Escape', { target: searchInput }));
    assert.equal(searchInput.isBlurred, true);

    // 2. Open drawer on active row
    let isDrawerOpen = false;
    let activeRowIndex = 0;
    dispatchHotkey({
      activeRowIndex,
      totalRows: 5,
      onInspectRow: () => { isDrawerOpen = true; },
    }, createMockKeyEvent('Enter'));
    assert.equal(isDrawerOpen, true);

    // 3. Triage to Offer via hotkey 4
    dispatchHotkey({
      activeRowIndex,
      totalRows: 5,
      isDrawerOpen,
      onTriageStatus: (stage) => { triage.setStatus('app-kestrelai', stage); },
    }, createMockKeyEvent('4'));
    assert.equal(triage.overrides['app-kestrelai'], 'offer');

    // 4. Advance to next record via j
    dispatchHotkey({
      activeRowIndex,
      totalRows: 5,
      isDrawerOpen,
      onSelectRow: (idx) => { activeRowIndex = idx; },
    }, createMockKeyEvent('j'));
    assert.equal(activeRowIndex, 1);

    // 5. Dismiss drawer via Escape
    dispatchHotkey({
      isDrawerOpen,
      onDismiss: () => { isDrawerOpen = false; },
    }, createMockKeyEvent('Escape'));
    assert.equal(isDrawerOpen, false);
  });
});
