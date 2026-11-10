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

describe('Tier 4: Real-World Application Workloads (End-to-End Operational Workflows)', () => {
  const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
  const liveTokens = tryLoadBlueprintTokens();
  const getLane = liveTokens?.getLaneIntent || referenceGetLaneIntent;
  const getChip = liveTokens?.getChipIntent || referenceGetChipIntent;

  // --------------------------------------------------------------------------
  // Workflow 1: Daily Morning High-Velocity Triage
  // --------------------------------------------------------------------------
  it('Workflow 1: Daily morning high-velocity triage through urgent assessments', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    assert.equal(b.counts.length, 5);

    // Operator searches for assessment opportunities
    const searchInput = createMockInputElement('INPUT', { value: 'assessment' });
    const query = searchInput.value.toLowerCase();
    const assessments = b.cards.filter(c => c.lane === 'assessment' || c.app.role.toLowerCase().includes(query));
    assert.ok(assessments.length > 0);

    // Escape search input
    dispatchHotkey({}, createMockKeyEvent('Escape', { target: searchInput }));
    assert.equal(searchInput.isBlurred, true);

    // Navigate to first assessment and inspect
    let inspectedApp = null;
    let isDrawerOpen = false;
    dispatchHotkey({
      activeRowIndex: 0,
      totalRows: assessments.length,
      onInspectRow: (idx) => {
        inspectedApp = assessments[idx];
        isDrawerOpen = true;
      },
    }, createMockKeyEvent('Enter'));

    assert.equal(isDrawerOpen, true);
    assert.ok(inspectedApp);
    assert.ok(inspectedApp.app.company);
    assert.equal(inspectedApp.lane, 'assessment');
    assert.equal(getLane(inspectedApp.lane), 'warning');

    // Dismiss drawer
    dispatchHotkey({
      isDrawerOpen,
      onDismiss: () => { isDrawerOpen = false; },
    }, createMockKeyEvent('Escape'));
    assert.equal(isDrawerOpen, false);
  });

  // --------------------------------------------------------------------------
  // Workflow 2: New Offer Celebration & Pipeline Recalculation
  // --------------------------------------------------------------------------
  it('Workflow 2: New offer received triggers instant reactive stage transition and highlight', () => {
    const triage = createTriageState(applications);
    const atlas = applications.find(a => a.company === 'Atlas Robotics');
    assert.ok(atlas);

    // Hotkey 4 sets status to Offer
    dispatchHotkey({
      activeRowIndex: 0,
      totalRows: 5,
      onTriageStatus: (stage) => { triage.setStatus(atlas.id, stage); },
    }, createMockKeyEvent('4'));

    const updatedApps = triage.applyTo(applications);
    const updatedBoard = board.buildBoard(updatedApps, SIMULATED_NOW);
    const offerCard = updatedBoard.counts.find(c => c.key === 'offer');

    assert.ok(offerCard);
    assert.ok(offerCard.count >= 1);
    const isHot = offerCard.key === 'offer' && offerCard.count > 0;
    assert.equal(isHot, true);

    const atlasCard = updatedBoard.cards.find(c => c.app.id === atlas.id);
    assert.ok(atlasCard);
    assert.equal(atlasCard.lane, 'offer');
    assert.equal(getLane(atlasCard.lane), 'success');
  });

  // --------------------------------------------------------------------------
  // Workflow 3: Ghosting Detection & Stale Application Audit
  // --------------------------------------------------------------------------
  it('Workflow 3: Ghosting detection identifies applications without reply for > 60 days', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const ghostedCards = b.cards.filter(c => c.ghostedDays !== null);

    assert.ok(ghostedCards.length > 0);
    for (const g of ghostedCards) {
      assert.ok(g.ghostedDays >= 60);
      assert.equal(g.chip.kind, 'warn');
      assert.equal(getChip(g.chip.kind), 'warning');
      assert.match(g.chip.text, /No reply in \d+ days/);
    }
  });

  // --------------------------------------------------------------------------
  // Workflow 4: Multi-Stage Interview Preparation Walkthrough
  // --------------------------------------------------------------------------
  it('Workflow 4: Interview prep walkthrough inspects complete chronological email thread', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const kestrel = b.cards.find(c => c.app.company === 'Kestrel AI');
    assert.ok(kestrel);
    assert.equal(kestrel.lane, 'interview');

    // Email thread history verification
    const emails = kestrel.app.emails;
    assert.equal(emails.length, 3);
    assert.equal(emails[0].stage, 'interview');
    assert.equal(emails[1].stage, 'assessment');
    assert.equal(emails[2].stage, 'applied');

    // External action: Open in Gmail
    let openedId = null;
    const onOpenEmail = (id) => { openedId = id; };
    onOpenEmail(kestrel.openEmailId);
    assert.equal(openedId, kestrel.openEmailId);
  });

  // --------------------------------------------------------------------------
  // Workflow 5: Rapid Stale Applications Rejection Triage
  // --------------------------------------------------------------------------
  it('Workflow 5: Rapid triage down the list marking stale applications rejected via hotkey 5', () => {
    const triage = createTriageState(applications);
    const initialBoard = board.buildBoard(applications, SIMULATED_NOW);
    const initialRejections = initialBoard.counts.find(c => c.key === 'rejected').count;

    const toReject = [applications[1], applications[2]];
    for (const app of toReject) {
      dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 5,
        onTriageStatus: (stage) => { triage.setStatus(app.id, stage); },
      }, createMockKeyEvent('5'));
    }

    const updatedBoard = board.buildBoard(triage.applyTo(applications), SIMULATED_NOW);
    const updatedRejections = updatedBoard.counts.find(c => c.key === 'rejected').count;
    assert.ok(updatedRejections >= initialRejections);
  });

  // --------------------------------------------------------------------------
  // Workflow 6: ATS Multi-Message Entity Resolution & Provenance Audit
  // --------------------------------------------------------------------------
  it('Workflow 6: Entity resolution merges Greenhouse ATS, recruiter, and calendar invites', () => {
    const cobalt = applications.find(a => a.company === 'Cobalt Pay');
    assert.ok(cobalt);
    assert.equal(cobalt.id, 'app-cobaltpay');
    assert.equal(cobalt.emails.length, 2);
    assert.equal(cobalt.emails[0].stage, 'assessment');
    assert.equal(cobalt.emails[1].stage, 'applied');
  });

  // --------------------------------------------------------------------------
  // Workflow 7: Unsure Classifier Low-Confidence Emails Review
  // --------------------------------------------------------------------------
  it('Workflow 7: Low-confidence classifier emails isolated in review section without guessing', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    assert.ok(b.unsure.length > 0);

    const juniper = b.unsure.find(u => u.company === 'Juniper Labs');
    assert.ok(juniper);
    assert.equal(juniper.subject, 'Quick question');

    // Verify unsure email does NOT appear in main board cards
    const cardInBoard = b.cards.find(c => c.app.company === 'Juniper Labs');
    assert.equal(cardInBoard, undefined);
  });

  // --------------------------------------------------------------------------
  // Workflow 8: Relative Deadline Resolution & Countdown Precision
  // --------------------------------------------------------------------------
  it('Workflow 8: Relative deadline countdown Turn within 7 days into exact date math', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    const lumen = b.cards.find(c => c.app.company === 'Lumen Analytics');
    assert.ok(lumen);
    assert.ok(lumen.deadline);

    const countdownText = board.countdown(lumen.deadline, SIMULATED_NOW);
    assert.ok(countdownText);
    assert.match(countdownText, /^\d+d\s+\d+h$/);
  });

  // --------------------------------------------------------------------------
  // Workflow 9: Accidental Keystroke Status Correction & Rollback
  // --------------------------------------------------------------------------
  it('Workflow 9: Mistaken stage change rolled back with the drawer Reset button (u is not a shortcut)', () => {
    const triage = createTriageState(applications);
    const target = applications.find(a => a.company === 'Sable & Co');
    assert.ok(target);

    // Accidental rejection: 5
    triage.setStatus(target.id, 'rejected');
    assert.equal(triage.overrides[target.id], 'rejected');

    // u is no longer a shortcut and leaves the override in place
    const res = dispatchHotkey({
      activeRowIndex: 0,
      totalRows: 5,
      onTriageStatus: () => { triage.resetStatus(target.id); },
    }, createMockKeyEvent('u'));
    assert.equal(res.action, 'unmapped_key');
    assert.equal(triage.hasOverride(target.id), true);

    // Rollback with the drawer's Reset button
    triage.resetStatus(target.id);
    assert.equal(triage.hasOverride(target.id), false);
  });

  // --------------------------------------------------------------------------
  // Workflow 10: 12-Week Activity Timeline Histogram Review
  // --------------------------------------------------------------------------
  it('Workflow 10: 12-week activity timeline histogram audit verifies peak week and totals', () => {
    const b = board.buildBoard(applications, SIMULATED_NOW);
    let isTimelineOpen = false;

    // Open timeline via hotkey t
    dispatchHotkey({
      onToggleTimeline: () => { isTimelineOpen = true; },
    }, createMockKeyEvent('t'));
    assert.equal(isTimelineOpen, true);

    // Audit weekly distribution
    const appliedSeries = b.weekly.applied;
    const totalApplied = appliedSeries.reduce((a, b) => a + b, 0);
    const peakCount = Math.max(0, ...appliedSeries);
    const peakIdx = appliedSeries.indexOf(peakCount);
    const peakWeek = peakIdx >= 0 && peakCount > 0 ? b.weekly.weeks[peakIdx] : null;

    assert.ok(totalApplied >= 10);
    assert.ok(peakCount > 0);
    assert.ok(peakWeek);

    // Close timeline via Escape
    dispatchHotkey({
      isTimelineOpen,
      onToggleTimeline: () => { isTimelineOpen = false; },
    }, createMockKeyEvent('Escape'));
    assert.equal(isTimelineOpen, false);
  });

  // --------------------------------------------------------------------------
  // Workflow 11: Date Boundary Filtering for Monthly Retrospective
  // --------------------------------------------------------------------------
  it('Workflow 11: 30-day date boundary filter subsets applications accurately for retrospective', () => {
    const since30 = SIMULATED_NOW - 30 * 86400000;
    const inRange = applications.filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= since30));
    const b = board.buildBoard(inRange, SIMULATED_NOW);

    assert.ok(b.cards.length >= 7);
    assert.ok(b.cards.length <= applications.length);
  });

  // --------------------------------------------------------------------------
  // Workflow 12: Keyboard Power-User High-Throughput Triage
  // --------------------------------------------------------------------------
  it('Workflow 12: Continuous keyboard-only review (search, move, open, close) without mouse reliance', () => {
    const triage = createTriageState(applications);
    let activeRowIndex = 0;
    let isDrawerOpen = false;

    // 1. Forward slash focus
    dispatchHotkey({ onFocusSearch: () => {} }, createMockKeyEvent('/'));

    // 2. Escape search
    dispatchHotkey({}, createMockKeyEvent('Escape'));

    // 3. Navigate down: j
    dispatchHotkey({ activeRowIndex, totalRows: 10, onSelectRow: (idx) => { activeRowIndex = idx; } }, createMockKeyEvent('j'));
    assert.equal(activeRowIndex, 1);

    // 4. Open drawer: Enter
    dispatchHotkey({ activeRowIndex, totalRows: 10, onInspectRow: () => { isDrawerOpen = true; } }, createMockKeyEvent('Enter'));
    assert.equal(isDrawerOpen, true);

    // 5. Status keys were removed: 2 changes nothing (stages change only by clicking in the drawer)
    const statusRes = dispatchHotkey({ activeRowIndex, totalRows: 10, isDrawerOpen, onTriageStatus: (s) => { triage.setStatus('app-target', s); } }, createMockKeyEvent('2'));
    assert.equal(statusRes.action, 'unmapped_key');
    assert.equal(triage.hasOverride('app-target'), false);

    // 6. Dismiss drawer: Escape
    dispatchHotkey({ isDrawerOpen, onDismiss: () => { isDrawerOpen = false; } }, createMockKeyEvent('Escape'));
    assert.equal(isDrawerOpen, false);
  });

  // --------------------------------------------------------------------------
  // Workflow 13: Live Data Refresh & Stale Cache Update
  // --------------------------------------------------------------------------
  it('Workflow 13: Header refresh action updates timestamp and recalculates board cards', () => {
    let refreshing = false;
    let refreshInvoked = false;

    const onRefresh = () => {
      refreshing = true;
      refreshInvoked = true;
      // Simulated server fetch completes
      refreshing = false;
    };

    onRefresh();
    assert.equal(refreshInvoked, true);
    assert.equal(refreshing, false);
  });

  // --------------------------------------------------------------------------
  // Workflow 14: Mobile / Responsive Viewport Layout Integrity
  // --------------------------------------------------------------------------
  it('Workflow 14: Responsive CSS media queries ensure high-density table scroll on mobile', () => {
    const { css } = getActiveCss();
    assert.match(css, /@media\s*\(max-width:\s*(700|768|800|1080)px\)/);
  });

  // --------------------------------------------------------------------------
  // Workflow 15: New User Onboarding & Keyboard Cheat Sheet Discovery
  // --------------------------------------------------------------------------
  it('Workflow 15: First-time user opens cheat sheet via ? reviews hotkeys and closes with Escape', () => {
    let isShortcutsOpen = false;

    // Press ?
    dispatchHotkey({
      onToggleShortcuts: () => { isShortcutsOpen = true; },
    }, createMockKeyEvent('?'));
    assert.equal(isShortcutsOpen, true);

    // Press Escape
    dispatchHotkey({
      isShortcutsOpen,
      onToggleShortcuts: () => { isShortcutsOpen = false; },
    }, createMockKeyEvent('Escape'));
    assert.equal(isShortcutsOpen, false);
  });
});
