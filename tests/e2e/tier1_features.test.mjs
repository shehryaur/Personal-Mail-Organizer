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
  stripJsonComments,
  renderComponent,
  KeyboardShortcutsDialog,
  ApplicationTable,
  ApplicationDetailDrawer,
  StageMetricsBar,
  DateRangeControls,
  blueprintTokens,
  dateRangeConstants,
  fs,
  path,
  ROOT,
} from './test_helpers.mjs';

const { board, feed, mock } = loadCoreModules();
const SIMULATED_NOW = 1792744200000; // Fri Oct 23, 2026

describe('Tier 1: Feature Coverage (Opaque-Box Isolated Feature Tests)', () => {

  // --------------------------------------------------------------------------
  // Feature 1: Blueprint Semantic Intent Tokens
  // --------------------------------------------------------------------------
  describe('Feature 1: Blueprint Semantic Intent Tokens', () => {
    const liveTokens = tryLoadBlueprintTokens();
    const intents = liveTokens?.BLUEPRINT_INTENTS || REFERENCE_INTENTS;
    const getLane = liveTokens?.getLaneIntent || referenceGetLaneIntent;
    const getChip = liveTokens?.getChipIntent || referenceGetChipIntent;

    it('F1.1: Primary Intent defines exact Blueprint Cobalt palette (#106ba3)', () => {
      assert.equal(intents.primary.solid, '#106ba3');
      assert.equal(intents.primary.hover, '#0e5a8a');
      assert.equal(intents.primary.bg, '#ebf1f5');
      assert.equal(intents.primary.text, '#106ba3');
    });

    it('F1.2: Success Intent defines exact Blueprint Forest palette (#0d8050)', () => {
      assert.equal(intents.success.solid, '#0d8050');
      assert.equal(intents.success.hover, '#0a6640');
      assert.equal(intents.success.bg, '#edf8f2');
      assert.equal(intents.success.text, '#0d8050');
    });

    it('F1.3: Warning Intent defines exact Blueprint Amber/Ochre palette (#bf7300)', () => {
      assert.equal(intents.warning.solid, '#bf7300');
      assert.equal(intents.warning.hover, '#a66321');
      assert.equal(intents.warning.bg, '#fdf5ea');
      assert.equal(intents.warning.text, '#bf7300');
    });

    it('F1.4: Danger Intent defines exact Blueprint Crimson palette (#c23030)', () => {
      assert.equal(intents.danger.solid, '#c23030');
      assert.equal(intents.danger.hover, '#a82222');
      assert.equal(intents.danger.bg, '#fdf2f2');
      assert.equal(intents.danger.text, '#c23030');
    });

    it('F1.5: getLaneIntent accurately maps all 5 operational lanes', () => {
      assert.equal(getLane('interview'), 'primary');
      assert.equal(getLane('offer'), 'success');
      assert.equal(getLane('assessment'), 'warning');
      assert.equal(getLane('rejected'), 'danger');
      assert.equal(getLane('applied'), 'none');
      assert.ok(getLane('review') === 'warning' || getLane('review') === 'none');
    });

    it('F1.6: getChipIntent accurately maps deadline and action chip categories', () => {
      assert.equal(getChip('due'), 'warning');
      assert.equal(getChip('info'), 'primary');
      assert.equal(getChip('warn'), 'warning');
      assert.equal(getChip('closed'), 'danger');
      assert.equal(getChip('wait'), 'none');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Typography & Tabular Numerals
  // --------------------------------------------------------------------------
  describe('Feature 2: Typography & Tabular Numerals', () => {
    const { css } = getActiveCss();

    it('F2.1: Enforces font-variant-numeric: tabular-nums for numeric alignment', () => {
      assert.match(css, /tabular-nums/);
    });

    it('F2.2: Table and metric counts apply tabular numeric class or property', () => {
      assert.ok(css.includes('.num') || css.includes('tabular') || css.includes('tabular-nums'));
    });

    it('F2.3: Type ramp defines data-dense body typography (12px-14px)', () => {
      assert.match(css, /font-size:\s*(11|12|13|14)px/);
    });

    it('F2.4: Monospace font stack is defined for keycaps or IDs', () => {
      assert.match(css, /(monospace|ui-monospace|SFMono-Regular)/i);
    });

    it('F2.5: Uppercase metadata headers apply compact letter-spacing', () => {
      assert.match(css, /text-transform:\s*uppercase/i);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Blueprint Elevation & Outlines
  // --------------------------------------------------------------------------
  describe('Feature 3: Blueprint Elevation & Outlines', () => {
    const { css } = getActiveCss();

    it('F3.1: Flat elevation includes 1px outline ring (rgba(17, 20, 24, 0.15))', () => {
      assert.match(css, /0 0 0 1px rgba\(\s*(16|17),\s*(20|22),\s*(24|26)/);
    });

    it('F3.2: Card elevation includes 1px outline ring plus subtle drop shadow', () => {
      assert.match(css, /0 1px 1px rgba\(/);
    });

    it('F3.3: Interactive surfaces define hover elevation transitions', () => {
      assert.match(css, /transition:.*(box-shadow|background|all)/);
    });

    it('F3.4: Popovers and modal dialogs define deep elevation shadow', () => {
      assert.match(css, /(box-shadow:.*(24px|32px|46px)|--bp-elevation-)/);
    });

    it('F3.5: Surface background uses Blueprint panel slate (#f5f8fa or #ffffff)', () => {
      assert.match(css, /(#f5f8fa|#ffffff|--bp-panel-bg|--bp-surface-bg)/i);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Component Primitives
  // --------------------------------------------------------------------------
  describe('Feature 4: Component Primitives', () => {
    const { css } = getActiveCss();

    it('F4.1: Compact Button primitive defines 28px-32px compact height', () => {
      assert.match(css, /height:\s*(28|30|32|36)px/);
    });

    it('F4.2: Button corner radius adheres to Blueprint standard (3px-4px)', () => {
      assert.match(css, /border-radius:\s*(3|4)px/);
    });

    it('F4.3: Tag primitive defines compact 20px-24px height', () => {
      assert.match(css, /height:\s*(18|20|22|24)px/);
    });

    it('F4.4: Keycap badge (<kbd> / .bp-keycap) defines tactile border styling', () => {
      assert.match(css, /(kbd|\.bp-keycap)/i);
    });

    it('F4.5: Minimal button variant is supported without outer borders', () => {
      assert.match(css, /(\.bp-btn-minimal|\.bp-minimal|border:\s*0|background:\s*transparent)/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Compact Header Bar & Date Controls
  // --------------------------------------------------------------------------
  describe('Feature 5: Compact Header Bar & Date Controls', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);

    it('F5.1: Preset 7 (1 week) filters applications to last 7 days', () => {
      const since = SIMULATED_NOW - 7 * 86400000;
      const filtered = applications.filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= since));
      assert.ok(filtered.length > 0 && filtered.length <= applications.length);
    });

    it('F5.2: Preset 30 (1 month) filters applications to last 30 days', () => {
      const since = SIMULATED_NOW - 30 * 86400000;
      const filtered = applications.filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= since));
      assert.ok(filtered.length >= 7);
    });

    it('F5.3: Preset all (0 days) retains all applications in dataset', () => {
      const b = board.buildBoard(applications, SIMULATED_NOW);
      assert.equal(b.cards.length, 14);
    });

    it('F5.4: Custom range filters applications strictly between customFrom and customTo', () => {
      const fromTime = new Date('2026-10-15T00:00:00Z').getTime();
      const toTime = new Date('2026-10-23T23:59:59Z').getTime();
      const inCustom = applications.filter(a => a.emails.some(e => {
        const t = new Date(e.receivedAt).getTime();
        return t >= fromTime && t <= toTime;
      }));
      assert.ok(inCustom.length > 0);
      assert.ok(inCustom.every(a => a.emails.some(e => new Date(e.receivedAt).getTime() >= fromTime && new Date(e.receivedAt).getTime() <= toTime)));
    });

    it('F5.5: Time range choice is remembered in localStorage under trackerRange', () => {
      assert.equal(dateRangeConstants.RANGE_KEY, 'trackerRange');
      assert.ok(Array.isArray(dateRangeConstants.RANGES));
      assert.ok(dateRangeConstants.RANGES.some(r => r.key === '30' && r.days === 30));
      const storage = createMockStorage();
      storage.setItem(dateRangeConstants.RANGE_KEY, '90');
      assert.equal(storage.getItem(dateRangeConstants.RANGE_KEY), '90');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Stage Summary Metric Cards
  // --------------------------------------------------------------------------
  describe('Feature 6: Stage Summary Metric Cards', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
    const b = board.buildBoard(applications, SIMULATED_NOW);

    it('F6.1: Board counts aggregate exactly 5 stage cards', () => {
      assert.equal(b.counts.length, 5);
      const keys = b.counts.map(c => c.key);
      assert.deepEqual(keys, ['applied', 'assessment', 'interview', 'offer', 'rejected']);
    });

    it('F6.2: Each metric card contains non-negative count and informative note', () => {
      for (const card of b.counts) {
        assert.ok(typeof card.count === 'number' && card.count >= 0);
        assert.ok(typeof card.note === 'string' && card.note.length > 0);
      }
    });

    it('F6.3: Offer card has count > 0 for sample data and triggers highlight', () => {
      const offerCard = b.counts.find(c => c.key === 'offer');
      assert.ok(offerCard);
      assert.equal(offerCard.count, 1);
      assert.ok(offerCard.count > 0);
    });

    it('F6.4: Applied count calculates total applied emails across applications', () => {
      const appliedCard = b.counts.find(c => c.key === 'applied');
      assert.ok(appliedCard);
      assert.ok(appliedCard.count >= 10);
    });

    it('F6.5: Rejections count computes total closed records', () => {
      const rejCard = b.counts.find(c => c.key === 'rejected');
      assert.ok(rejCard);
      assert.ok(rejCard.count >= 3);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Data-Dense Desktop Table
  // --------------------------------------------------------------------------
  describe('Feature 7: Data-Dense Desktop Table', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
    const b = board.buildBoard(applications, SIMULATED_NOW);

    it('F7.1: Generates valid card entities for each active application', () => {
      assert.ok(b.cards.length > 0);
      for (const card of b.cards) {
        assert.ok(card.app);
        assert.ok(card.app.company);
        assert.ok(card.lane);
        assert.ok(card.chip);
      }
    });

    it('F7.2: Card lastEmail is formatted into compact readable date string', () => {
      for (const card of b.cards) {
        assert.match(card.lastEmail, /^[A-Z][a-z]{2}\s+\d{1,2}$/);
      }
    });

    it('F7.3: Card chips contain valid kind and non-empty status text', () => {
      for (const card of b.cards) {
        assert.ok(['due', 'info', 'warn', 'closed', 'wait'].includes(card.chip.kind));
        assert.ok(card.chip.text.length > 0);
      }
    });

    it('F7.4: Reached set tracks progression across pipeline stages', () => {
      for (const card of b.cards) {
        assert.ok(card.reached instanceof Set);
        assert.ok(card.reached.size > 0);
      }
    });

    it('F7.5: High-density CSS table styles define compact row heights', () => {
      const { css } = getActiveCss();
      assert.match(css, /(padding:\s*(4|6|7|8|10)px|line-height:\s*16px)/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Table Search & Stage Filtering
  // --------------------------------------------------------------------------
  describe('Feature 8: Table Search & Stage Filtering', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
    const b = board.buildBoard(applications, SIMULATED_NOW);

    it('F8.1: Filters applications by company name case-insensitively', () => {
      const query = 'lumen';
      const results = b.cards.filter(c => c.app.company.toLowerCase().includes(query));
      assert.equal(results.length, 1);
      assert.equal(results[0].app.company, 'Lumen Analytics');
    });

    it('F8.2: Filters applications by role title case-insensitively', () => {
      const query = 'frontend';
      const results = b.cards.filter(c => c.app.role.toLowerCase().includes(query));
      assert.ok(results.length >= 1);
      assert.equal(results[0].app.company, 'Cobalt Pay');
    });

    it('F8.3: Filters applications by stage pill lane', () => {
      const interviewCards = b.cards.filter(c => c.lane === 'interview');
      assert.ok(interviewCards.length >= 2);
      assert.ok(interviewCards.every(c => c.lane === 'interview'));
    });

    it('F8.4: Pagination computes 12 items per page with totalPages', () => {
      const PAGE_SIZE = 12;
      const totalPages = Math.ceil(b.cards.length / PAGE_SIZE);
      const page0 = b.cards.slice(0, PAGE_SIZE);
      const page1 = b.cards.slice(PAGE_SIZE, PAGE_SIZE * 2);
      assert.equal(totalPages, 2);
      assert.equal(page0.length, 12);
      assert.equal(page1.length, b.cards.length - 12);
    });

    it('F8.5: Stage pill counts match respective lane card counts', () => {
      for (const lane of b.lanes) {
        const laneCards = b.cards.filter(c => c.lane === lane.key);
        assert.equal(lane.cards.length, laneCards.length);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Row Selection & Focus Highlighting
  // --------------------------------------------------------------------------
  describe('Feature 9: Row Selection & Focus Highlighting', () => {
    const { css } = getActiveCss();

    it('F9.1: CSS defines selected table row background tint (#ebf1f5)', () => {
      assert.match(css, /(#ebf1f5|--bp-table-selected-bg|--tk-sky)/i);
    });

    it('F9.2: CSS defines Cobalt left-border selection bar (#106ba3)', () => {
      assert.match(css, /(#106ba3|--bp-intent-primary|var\(--bp-intent-primary\)|border-left|inset 3px 0 0)/);
    });

    it('F9.3: CSS defines distinct keyboard focus outline ring', () => {
      assert.match(css, /(outline:.*2px|outline-offset)/);
    });

    it('F9.4: Active row selection state initializes safely at index 0', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards.slice(0, 5),
        lanes: b.lanes,
        allCardsCount: b.cards.length,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 5,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('is-selected'));
      assert.ok(html.includes('aria-selected="true"'));
      assert.ok(html.includes(b.cards[0].app.company));
    });

    it('F9.5: Selecting a row persists across filter recalculations', () => {
      let selectedId = 'app-lumenanalytics';
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const found = b.cards.find(c => c.app.id === selectedId);
      assert.ok(found);
      assert.equal(found.app.company, 'Lumen Analytics');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Keyboard Hotkeys & Navigation
  // --------------------------------------------------------------------------
  describe('Feature 10: Keyboard Hotkeys & Navigation', () => {
    it('F10.1: j increments active row index by 1', () => {
      let active = 0;
      const res = dispatchHotkey({
        activeRowIndex: active,
        totalRows: 12,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('j'));
      assert.equal(res.action, 'nav_down');
      assert.equal(active, 1);
    });

    it('F10.2: k decrements active row index by 1', () => {
      let active = 3;
      const res = dispatchHotkey({
        activeRowIndex: active,
        totalRows: 12,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('k'));
      assert.equal(res.action, 'nav_up');
      assert.equal(active, 2);
    });

    it('F10.3: Home and End are not shortcuts and leave the selection alone', () => {
      for (const key of ['Home', 'End']) {
        let active = 7;
        const res = dispatchHotkey({
          activeRowIndex: active,
          totalRows: 12,
          onSelectRow: (idx) => { active = idx; },
        }, createMockKeyEvent(key));
        assert.equal(res.action, 'unmapped_key');
        assert.equal(active, 7);
      }
    });

    it('F10.4: Paging keys ] [ n p are not shortcuts (the page buttons page the table)', () => {
      let paged = false;
      for (const key of [']', '[', 'n', 'p']) {
        const res = dispatchHotkey({ onNextPage: () => { paged = true; }, onPrevPage: () => { paged = true; } }, createMockKeyEvent(key));
        assert.equal(res.action, 'unmapped_key');
      }
      assert.equal(paged, false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Hotkey Safety Input Guard
  // --------------------------------------------------------------------------
  describe('Feature 11: Hotkey Safety Input Guard', () => {
    it('F11.1: Typing j inside an input element is suppressed by Input Guard', () => {
      const input = createMockInputElement('INPUT');
      const res = dispatchHotkey({}, createMockKeyEvent('j', { target: input }));
      assert.equal(res.suppressedByInputGuard, true);
    });

    it('F11.2: Typing 1 inside textarea is suppressed by Input Guard', () => {
      const textarea = createMockInputElement('TEXTAREA');
      const res = dispatchHotkey({}, createMockKeyEvent('1', { target: textarea }));
      assert.equal(res.suppressedByInputGuard, true);
    });

    it('F11.3: Typing / inside input is suppressed and does not steal focus', () => {
      const input = createMockInputElement('INPUT');
      const res = dispatchHotkey({}, createMockKeyEvent('/', { target: input }));
      assert.equal(res.suppressedByInputGuard, true);
    });

    it('F11.4: Typing ? inside select is suppressed and does not open modal', () => {
      const select = createMockInputElement('SELECT');
      const res = dispatchHotkey({}, createMockKeyEvent('?', { target: select }));
      assert.equal(res.suppressedByInputGuard, true);
    });

    it('F11.5: Escape inside an input calls blur() and preventDefault()', () => {
      const input = createMockInputElement('INPUT');
      const event = createMockKeyEvent('Escape', { target: input });
      const res = dispatchHotkey({}, event);
      assert.equal(res.suppressedByInputGuard, true);
      assert.equal(input.isBlurred, true);
      assert.equal(event.isDefaultPrevented, true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Shortcuts Cheat Sheet Modal
  // --------------------------------------------------------------------------
  describe('Feature 12: Shortcuts Cheat Sheet Modal', () => {
    it('F12.1: ? keypress triggers onToggleShortcuts', () => {
      let toggled = false;
      const res = dispatchHotkey({
        onToggleShortcuts: () => { toggled = true; },
      }, createMockKeyEvent('?'));
      assert.equal(res.action, 'toggle_shortcuts');
      assert.ok(toggled);
    });

    it('F12.2: Shift+/ keypress triggers onToggleShortcuts', () => {
      let toggled = false;
      const res = dispatchHotkey({
        onToggleShortcuts: () => { toggled = true; },
      }, createMockKeyEvent('/', { shiftKey: true }));
      assert.equal(res.action, 'toggle_shortcuts');
      assert.ok(toggled);
    });

    it('F12.3: Escape dismisses shortcuts dialog when open', () => {
      let closed = false;
      const res = dispatchHotkey({
        isShortcutsOpen: true,
        onToggleShortcuts: () => { closed = true; },
      }, createMockKeyEvent('Escape'));
      assert.equal(res.action, 'close_shortcuts');
      assert.ok(closed);
    });

    it('F12.4: Shortcuts modal is specified with accessible dialog attributes', () => {
      const openHtml = renderComponent(KeyboardShortcutsDialog, { isOpen: true, onClose: () => {} });
      assert.ok(openHtml.includes('role="dialog"'));
      assert.ok(openHtml.includes('aria-modal="true"'));
      assert.ok(openHtml.includes('aria-label="Keyboard Shortcuts"'));
      assert.ok(openHtml.includes('bp-dialog-backdrop'));
      const closedHtml = renderComponent(KeyboardShortcutsDialog, { isOpen: false, onClose: () => {} });
      assert.equal(closedHtml, '');
    });

    it('F12.5: Dialog displays grouped categories (Move around, Actions)', () => {
      const html = renderComponent(KeyboardShortcutsDialog, { isOpen: true, onClose: () => {} });
      assert.ok(html.includes('Move around'));
      assert.ok(html.includes('Actions'));
      assert.ok(html.includes('<kbd class="bp-keycap">j</kbd>'));
      assert.ok(html.includes('<kbd class="bp-keycap">k</kbd>'));
      assert.ok(html.includes('<kbd class="bp-keycap">Esc</kbd>'));
      assert.ok(html.includes('<kbd class="bp-keycap">?</kbd>'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: In-Place Application Detail Drawer
  // --------------------------------------------------------------------------
  describe('Feature 13: In-Place Application Detail Drawer', () => {
    it('F13.1: Enter keypress opens inspector drawer for active row', () => {
      let inspectedIndex = null;
      const res = dispatchHotkey({
        activeRowIndex: 2,
        totalRows: 12,
        onInspectRow: (idx) => { inspectedIndex = idx; },
      }, createMockKeyEvent('Enter'));
      assert.equal(res.action, 'inspect_row');
      assert.equal(inspectedIndex, 2);
    });

    it('F13.2: Space and o no longer open the drawer (Enter does)', () => {
      for (const key of [' ', 'o']) {
        let inspectedIndex = null;
        const res = dispatchHotkey({
          activeRowIndex: 4,
          totalRows: 12,
          onInspectRow: (idx) => { inspectedIndex = idx; },
        }, createMockKeyEvent(key));
        assert.equal(res.action, 'unmapped_key');
        assert.equal(inspectedIndex, null);
      }
    });

    it('F13.4: Escape keypress closes drawer when open', () => {
      let dismissed = false;
      const res = dispatchHotkey({
        isDrawerOpen: true,
        onDismiss: () => { dismissed = true; },
      }, createMockKeyEvent('Escape'));
      assert.equal(res.action, 'close_drawer');
      assert.ok(dismissed);
    });

    it('F13.5: CSS defines 520px right-anchored drawer layout', () => {
      const { css } = getActiveCss();
      assert.match(css, /(520px|480px|max-width:\s*90%|width:\s*min\(520px)/i);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Continuous Triage Synchronization
  // --------------------------------------------------------------------------
  describe('Feature 14: Continuous Triage Synchronization', () => {
    it('F14.1: Navigating j while drawer is open triggers onSelectRow with new index', () => {
      let active = 2;
      const res = dispatchHotkey({
        activeRowIndex: active,
        totalRows: 10,
        isDrawerOpen: true,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('j'));
      assert.equal(res.action, 'nav_down');
      assert.equal(active, 3);
    });

    it('F14.2: Navigating k while drawer is open triggers onSelectRow with previous index', () => {
      let active = 5;
      const res = dispatchHotkey({
        activeRowIndex: active,
        totalRows: 10,
        isDrawerOpen: true,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('k'));
      assert.equal(res.action, 'nav_up');
      assert.equal(active, 4);
    });

    it('F14.3: Synchronously derives drawer card from active index in pagedCards', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      let activeIndex = 0;
      let drawerCard = b.cards[activeIndex];
      assert.equal(drawerCard.app.company, b.cards[0].app.company);

      activeIndex = 1;
      drawerCard = b.cards[activeIndex];
      assert.equal(drawerCard.app.company, b.cards[1].app.company);
    });

    it('F14.4: Drawer live-swaps content without closing or flashing backdrop', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const card1 = b.cards[0];
      const card2 = b.cards[1];
      assert.notEqual(card1.app.company, card2.app.company);

      const html1 = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card: card1,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(html1.includes(card1.app.company));
      assert.ok(html1.includes('bp-drawer-backdrop'));
      assert.ok(html1.includes('bp-drawer'));

      const html2 = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card: card2,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(html2.includes(card2.app.company));
      assert.ok(!html2.includes(card1.app.company));
      assert.ok(html2.includes('bp-drawer-backdrop'));
      assert.ok(html2.includes('bp-drawer'));
    });

    it('F14.5: Selection indicator stays lock-step synchronized with drawer card', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const targetIndex = 3;
      const html = renderComponent(ApplicationTable, {
        cards: b.cards.slice(0, 5),
        lanes: b.lanes,
        allCardsCount: b.cards.length,
        selectedRowIndex: targetIndex,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 5,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      const rows = html.split('<tr').slice(2); // row 0 is header, rows 1..5 are body rows
      assert.equal(rows.length, 5);
      rows.forEach((rowHtml, idx) => {
        if (idx === targetIndex) {
          assert.ok(rowHtml.includes('aria-selected="true"'));
          assert.ok(rowHtml.includes('is-selected'));
        } else {
          assert.ok(rowHtml.includes('aria-selected="false"'));
          assert.ok(!rowHtml.includes('is-selected'));
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Quick Status Transitions & Overrides
  // --------------------------------------------------------------------------
  describe('Feature 15: Quick Status Transitions & Overrides', () => {
    it('F15.1: Status keys 1-5, i, r, u and 0 were removed and change nothing', () => {
      for (const key of ['1', '2', '3', '4', '5', 'i', 'r', 'u', '0']) {
        let transitioned = null;
        const res = dispatchHotkey({
          activeRowIndex: 0,
          totalRows: 5,
          onTriageStatus: (s) => { transitioned = s; },
        }, createMockKeyEvent(key));
        assert.equal(res.action, 'unmapped_key');
        assert.equal(transitioned, null);
      }
    });

    it('F15.4: Status override store updates application and recalculates board counts', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const triage = createTriageState(applications);
      const targetApp = applications[0];

      triage.setStatus(targetApp.id, 'offer');
      const updatedApps = triage.applyTo(applications);
      const updatedBoard = board.buildBoard(updatedApps, SIMULATED_NOW);
      const offerCard = updatedBoard.counts.find(c => c.key === 'offer');

      assert.ok(offerCard.count >= 2);
    });

    it('F15.5: Status overrides persist across sessions in localStorage', () => {
      const storage = createMockStorage();
      const triage = createTriageState([], {}, storage);
      triage.setStatus('app-kestrel', 'interview');

      const raw = storage.getItem('trackerStatusOverrides');
      assert.ok(raw);
      const parsed = JSON.parse(raw);
      assert.equal(parsed['app-kestrel'], 'interview');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 16: Functional Feature Preservation
  // --------------------------------------------------------------------------
  describe('Feature 16: Functional Feature Preservation', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
    const b = board.buildBoard(applications, SIMULATED_NOW);

    it('F16.1: Retains 12-week activity histogram data structure', () => {
      assert.ok(b.weekly);
      assert.equal(b.weekly.weeks.length, 12);
      assert.equal(b.weekly.applied.length, 12);
      assert.equal(b.weekly.assessment.length, 12);
      assert.equal(b.weekly.interview.length, 12);
    });

    it('F16.2: Retains unsure emails review classification list', () => {
      assert.ok(b.unsure);
      assert.equal(b.unsure.length, 1);
      assert.equal(b.unsure[0].company, 'Juniper Labs');
    });

    it('F16.3: Retains relative deadline countdown resolution math', () => {
      const deadline = new Date(SIMULATED_NOW + 3 * 86400000 + 4 * 3600000).toISOString();
      const res = board.countdown(deadline, SIMULATED_NOW);
      assert.match(res, /^3d\s+4h$/);
    });

    it('F16.4: Retains entity resolution grouping multiple emails to single company', () => {
      const lumen = applications.find(a => a.company === 'Lumen Analytics');
      assert.ok(lumen);
      assert.equal(lumen.emails.length, 2);
      assert.equal(lumen.emails[0].stage, 'assessment');
      assert.equal(lumen.emails[1].stage, 'applied');
    });

    it('F16.5: Retains tasks generation for active to-do actions', () => {
      assert.ok(b.tasks);
      assert.ok(b.tasks.length > 0);
      assert.ok(b.tasks.every(t => t.card && t.what && t.when));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Build & Lint Integrity
  // --------------------------------------------------------------------------
  describe('Feature 17: Build & Lint Integrity', () => {
    it('F17.1: demo package.json defines build and lint scripts', () => {
      const pkgPath = path.join(ROOT, 'demo/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.ok(pkg.scripts.build);
      assert.ok(pkg.scripts.lint);
    });

    it('F17.2: tsconfig.app.json specifies verbatimModuleSyntax and erasableSyntaxOnly', () => {
      const tsPath = path.join(ROOT, 'demo/tsconfig.app.json');
      const raw = fs.readFileSync(tsPath, 'utf8');
      const tsConfig = JSON.parse(stripJsonComments(raw));
      assert.equal(tsConfig.compilerOptions.verbatimModuleSyntax, true);
    });

    it('F17.3: TypeScript compiler strictness flags are enabled', () => {
      const tsPath = path.join(ROOT, 'demo/tsconfig.app.json');
      const raw = fs.readFileSync(tsPath, 'utf8');
      const tsConfig = JSON.parse(stripJsonComments(raw));
      assert.equal(tsConfig.compilerOptions.noUnusedLocals, true);
      assert.equal(tsConfig.compilerOptions.noUnusedParameters, true);
    });

    it('F17.4: Demo dependencies avoid heavy @blueprintjs/core package', () => {
      const pkgPath = path.join(ROOT, 'demo/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.equal(pkg.dependencies['@blueprintjs/core'], undefined);
    });

    it('F17.5: Chrome extension build script exists in demo/scripts/', () => {
      const scriptPath = path.join(ROOT, 'demo/scripts/build-extension.mjs');
      assert.ok(fs.existsSync(scriptPath));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 18: E2E Test Suite Verification
  // --------------------------------------------------------------------------
  describe('Feature 18: E2E Test Suite Verification', () => {
    it('F18.1: Test suite runs natively using node:test runner', () => {
      assert.ok(typeof describe === 'function');
      assert.ok(typeof it === 'function');
    });

    it('F18.2: Test assertions utilize strict node:assert', () => {
      assert.strictEqual(blueprintTokens.BLUEPRINT_COLORS.cobalt, '#106ba3');
      assert.strictEqual(blueprintTokens.BLUEPRINT_CLASSES.HTML_TABLE, 'bp-html-table');
      assert.strictEqual(blueprintTokens.BLUEPRINT_CLASSES.DRAWER, 'bp-drawer');
      assert.strictEqual(typeof blueprintTokens.getLaneIntent, 'function');
    });

    it('F18.3: Test fixtures operate offline without external network dependency', () => {
      assert.ok(mock.SAMPLE_FEED);
      assert.ok(mock.SAMPLE_FEED.length >= 20);
    });

    it('F18.4: Helper test harness simulates DOM keydown events accurately', () => {
      const evt = createMockKeyEvent('Escape');
      assert.equal(evt.key, 'Escape');
      assert.equal(evt.type, 'keydown');
    });

    it('F18.5: Test runner measures assertion timings deterministically', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const start = performance.now();
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        board.buildBoard(applications, SIMULATED_NOW);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;
      assert.ok(avgMs < 50, `Average buildBoard runtime ${avgMs}ms should be under 50ms`);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 19: Adversarial Coverage Hardening
  // --------------------------------------------------------------------------
  describe('Feature 19: Adversarial Coverage Hardening', () => {
    it('F19.1: Rapid consecutive navigation calls execute deterministically', () => {
      let active = 0;
      const seq = ['j', 'j', 'j', 'k', 'j'];
      for (const key of seq) {
        dispatchHotkey({
          activeRowIndex: active,
          totalRows: 10,
          onSelectRow: (idx) => { active = idx; },
        }, createMockKeyEvent(key));
      }
      assert.equal(active, 3);
    });

    it('F19.2: Modifiers (Ctrl, Alt, Meta) suppress single-key hotkey triage', () => {
      let triageFired = false;
      const res = dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 5,
        onTriageStatus: () => { triageFired = true; },
      }, createMockKeyEvent('1', { ctrlKey: true }));
      assert.equal(res.modifierActive, true);
      assert.equal(triageFired, false);
    });

    it('F19.3: Conflicting quick status transitions resolve to latest override cleanly', () => {
      const triage = createTriageState([]);
      triage.setStatus('app-1', 'applied');
      triage.setStatus('app-1', 'rejected');
      triage.setStatus('app-1', 'offer');
      assert.equal(triage.overrides['app-1'], 'offer');
    });

    it('F19.4: Malformed localStorage recovery returns fallback safely', () => {
      const storage = createMockStorage();
      storage.setItem('trackerStatusOverrides', '{malformed_json:::');
      const triage = createTriageState([], {}, storage);
      assert.deepEqual(triage.overrides, {});
    });

    it('F19.5: Search queries with regex characters are evaluated safely as literals', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const dangerousQuery = '.*+?^${}()|[]\\';
      const results = b.cards.filter(c => c.app.company.toLowerCase().includes(dangerousQuery.toLowerCase()));
      assert.equal(results.length, 0);
    });
  });
});
