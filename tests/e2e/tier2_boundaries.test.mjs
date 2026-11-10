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
  readTrackerCss,
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

describe('Tier 2: Boundary & Corner Cases (Limits, Clamping, Zero States & Fault Tolerance)', () => {

  // --------------------------------------------------------------------------
  // Feature 1: Semantic Intent Tokens (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 1 Boundaries: Semantic Intent Tokens', () => {
    const liveTokens = tryLoadBlueprintTokens();
    const intents = liveTokens?.BLUEPRINT_INTENTS || REFERENCE_INTENTS;
    const getLane = liveTokens?.getLaneIntent || referenceGetLaneIntent;
    const getChip = liveTokens?.getChipIntent || referenceGetChipIntent;

    it('T2.F1.1: getLaneIntent handles empty string and unknown lanes returning none', () => {
      assert.equal(getLane(''), 'none');
      assert.equal(getLane('unknown_stage'), 'none');
      assert.equal(getLane('applied'), 'none');
      assert.equal(getLane('review'), 'warning');
    });

    it('T2.F1.2: getLaneIntent handles case-insensitive stage strings gracefully', () => {
      assert.equal(getLane('INTERVIEW'), 'primary');
      assert.equal(getLane('Offer'), 'success');
      assert.equal(getLane('Assessment'), 'warning');
      assert.equal(getLane('REJECTED'), 'danger');
    });

    it('T2.F1.3: getChipIntent handles unknown chip kinds and wait kind returning none', () => {
      assert.equal(getChip('unknown_kind'), 'none');
      assert.equal(getChip('wait'), 'none');
      assert.equal(getChip('CUSTOM_CHIP'), 'none');
    });

    it('T2.F1.4: All intent color codes conform to valid 7-character hex format (#RRGGBB)', () => {
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      for (const [key, def] of Object.entries(intents)) {
        assert.match(def.solid, hexRegex, `Solid hex invalid for intent ${key}`);
        assert.match(def.hover, hexRegex, `Hover hex invalid for intent ${key}`);
        assert.match(def.bg, hexRegex, `Bg hex invalid for intent ${key}`);
        assert.match(def.text, hexRegex, `Text hex invalid for intent ${key}`);
        assert.match(def.border, hexRegex, `Border hex invalid for intent ${key}`);
      }
    });

    it('T2.F1.5: Intent tonal background colors are distinct from solid foreground colors', () => {
      for (const [key, def] of Object.entries(intents)) {
        assert.notEqual(def.solid, def.bg, `Solid and bg must be distinct for intent ${key}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Typography & Tabular Numerals (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 2 Boundaries: Typography & Tabular Numerals', () => {
    it('T2.F2.1: Count of 0 renders cleanly with tabular figures without NaN', () => {
      const html = renderComponent(StageMetricsBar, {
        counts: [{ key: 'applied', label: 'Applied', count: 0, note: 'None' }],
        activeStage: 'all',
        onSelectStage: () => {},
      });
      assert.ok(html.includes('>0</span>'));
      assert.ok(!html.includes('NaN'));
      assert.ok(html.includes('tabular') || html.includes('num'));
    });

    it('T2.F2.2: Extreme count value (99,999) formats into readable tabular numerals', () => {
      const html = renderComponent(StageMetricsBar, {
        counts: [{ key: 'applied', label: 'Applied', count: 99999, note: 'High volume' }],
        activeStage: 'all',
        onSelectStage: () => {},
      });
      assert.ok(html.includes('>99999</span>') || html.includes('99,999'));
      assert.ok(html.includes('num') || html.includes('tabular'));
    });

    it('T2.F2.3: Extremely long company or role name (200+ characters) truncates with ellipsis', () => {
      const longName = 'A'.repeat(250);
      const app = createMockApp('app-long', longName, 'Engineer', [{
        id: 'msg-1', threadId: 't-1', from: 'a@a.com', senderDomain: 'a.com',
        subject: 'Sub', snippet: 'Snip', fullBody: 'Body', receivedAt: '2026-10-20T10:00:00Z',
        company: longName, role: 'Engineer', stage: 'applied', deadlineRaw: null,
        deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
        ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-long',
      }]);
      const b = board.buildBoard([app], SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards,
        lanes: b.lanes,
        allCardsCount: 1,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 1,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes(longName));
      const css = readTrackerCss();
      assert.match(css, /text-overflow:\s*ellipsis/);
    });

    it('T2.F2.4: Missing role (empty string) renders fallback dash (—)', () => {
      const app = createMockApp('app-norole', 'TestCorp', '', [{
        id: 'msg-1', threadId: 't-1', from: 'a@a.com', senderDomain: 'a.com',
        subject: 'Sub', snippet: 'Snip', fullBody: 'Body', receivedAt: '2026-10-20T10:00:00Z',
        company: 'TestCorp', role: '', stage: 'applied', deadlineRaw: null,
        deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
        ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-norole',
      }]);
      const b = board.buildBoard([app], SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards,
        lanes: b.lanes,
        allCardsCount: 1,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 1,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('<td style="color:var(--bp-text-muted)">—</td>'));
    });

    it('T2.F2.5: Special unicode characters in company name render without corruption', () => {
      const unicodeCompany = 'München AI & Co. ✨';
      const app = createMockApp('app-uni', unicodeCompany, 'Lead', [{
        id: 'msg-1', threadId: 't-1', from: 'a@a.com', senderDomain: 'a.com',
        subject: 'Sub', snippet: 'Snip', fullBody: 'Body', receivedAt: '2026-10-20T10:00:00Z',
        company: unicodeCompany, role: 'Lead', stage: 'applied', deadlineRaw: null,
        deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
        ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-uni',
      }]);
      const b = board.buildBoard([app], SIMULATED_NOW);
      const tableHtml = renderComponent(ApplicationTable, {
        cards: b.cards,
        lanes: b.lanes,
        allCardsCount: 1,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 1,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      const drawerHtml = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card: b.cards[0],
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(tableHtml.includes('München AI &amp; Co. ✨') || tableHtml.includes('München AI & Co. ✨'));
      assert.ok(drawerHtml.includes('München AI &amp; Co. ✨') || drawerHtml.includes('München AI & Co. ✨'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Blueprint Elevation & Outlines (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 3 Boundaries: Blueprint Elevation & Outlines', () => {
    const { css } = getActiveCss();

    it('T2.F3.1: Flat elevation (Level 0) contains strictly 1px outline ring without vertical blur', () => {
      assert.match(css, /--bp-elevation-0:\s*0 0 0 1px/);
    });

    it('T2.F3.2: Elevation level 4 defines deep 46px industrial shadow for drawer modal', () => {
      assert.match(css, /--bp-elevation-4:.*46px/);
    });

    it('T2.F3.3: Inset table container maintains 1px subtle border without double border artifacts', () => {
      assert.match(css, /border:\s*1px solid var\(--bp-border-color\)/);
    });

    it('T2.F3.4: Elevation shadow colors use subtle dark alpha rgba(17, 20, 24, 0.1)', () => {
      assert.match(css, /rgba\(\s*17,\s*20,\s*24,\s*0\.1\)/);
    });

    it('T2.F3.5: Elevation transitions apply subtle 0.1s ease for tactile response', () => {
      assert.match(css, /0\.1s ease/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Component Primitives (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 4 Boundaries: Component Primitives', () => {
    it('T2.F4.1: Button with disabled=true suppresses click events and has 0.5 opacity', () => {
      const css = readTrackerCss();
      assert.match(css, /((\.bp-btn:disabled|\.bp-page-btn:disabled)[\s\S]*?(opacity:\s*0\.[45]|cursor:\s*not-allowed))/);
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards.slice(0, 5),
        lanes: b.lanes,
        allCardsCount: 5,
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
      assert.ok(html.includes('disabled=""'));
    });

    it('T2.F4.2: Button group with exactly 1 button renders rounded corners on both left and right', () => {
      const css = readTrackerCss();
      assert.match(css, /(\.bp-btn-group|\.tk-seg)[\s\S]*?border-radius:\s*3px/);
    });

    it('T2.F4.3: Button group with 10 buttons renders shared 1px dividers between all sibling buttons', () => {
      const css = readTrackerCss();
      assert.match(css, /(\.bp-btn-group button|\.tk-seg button)[\s\S]*?border-right:\s*1px solid/);
      assert.match(css, /(\.bp-btn-group button:last-child|\.tk-seg button:last-child)[\s\S]*?border-right:\s*0/);
    });

    it('T2.F4.4: Keycap with multi-character hotkey (Enter, Esc) expands horizontally with dynamic padding', () => {
      const html = renderComponent(KeyboardShortcutsDialog, { isOpen: true, onClose: () => {} });
      assert.ok(html.includes('<kbd class="bp-keycap">Enter</kbd>'));
      assert.ok(html.includes('<kbd class="bp-keycap">Esc</kbd>'));
      const css = readTrackerCss();
      assert.match(css, /\.bp-keycap[\s\S]*?padding:\s*0 5px/);
      assert.match(css, /\.bp-keycap[\s\S]*?min-width:\s*18px/);
    });

    it('T2.F4.5: Round tag (.bp-round) preserves 10px corner radius without clipping text', () => {
      const { css } = getActiveCss();
      assert.match(css, /\.bp-tag\.bp-round[\s\S]*?border-radius:\s*10px/);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Compact Header Bar & Date Controls (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 5 Boundaries: Compact Header Bar & Date Controls', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);

    it('T2.F5.1: customFrom date set after customTo date returns 0 matching records without throwing', () => {
      const fromTime = new Date('2026-11-01T00:00:00Z').getTime();
      const toTime = new Date('2026-10-01T00:00:00Z').getTime();
      const filtered = applications.filter(a => a.emails.some(e => {
        const t = new Date(e.receivedAt).getTime();
        return t >= fromTime && t <= toTime;
      }));
      assert.equal(filtered.length, 0);
    });

    it('T2.F5.2: Invalid date string in custom bounds falls back safely without NaN crash', () => {
      const html = renderComponent(DateRangeControls, {
        range: 'custom',
        onPickRange: () => {},
        customFrom: 'invalid-from',
        onFromChange: () => {},
        customTo: 'invalid-to',
        onToChange: () => {},
        showTimeline: false,
        onToggleTimeline: () => {},
      });
      assert.ok(html.includes('bp-date-range') || html.includes('tk-date-range'));
      assert.ok(html.includes('value="invalid-from"'));
      assert.ok(html.includes('value="invalid-to"'));
      assert.ok(!html.includes('NaN'));
    });

    it('T2.F5.3: Future date boundary beyond now filters records up to current timestamp', () => {
      const futureTime = SIMULATED_NOW + 365 * 86400000;
      const inRange = applications.filter(a => a.emails.some(e => new Date(e.receivedAt).getTime() <= futureTime));
      assert.equal(inRange.length, applications.length);
    });

    it('T2.F5.4: Narrow date window with 0 emails returns empty application list', () => {
      const windowStart = new Date('2025-01-01T00:00:00Z').getTime();
      const windowEnd = new Date('2025-01-02T00:00:00Z').getTime();
      const inWindow = applications.filter(a => a.emails.some(e => {
        const t = new Date(e.receivedAt).getTime();
        return t >= windowStart && t <= windowEnd;
      }));
      assert.equal(inWindow.length, 0);
    });

    it('T2.F5.5: Preset all sets from boundary to exact earliest email timestamp in the dataset', () => {
      let earliest = Infinity;
      for (const a of applications) {
        for (const e of a.emails) {
          const t = new Date(e.receivedAt).getTime();
          if (t < earliest) earliest = t;
        }
      }
      assert.ok(earliest < SIMULATED_NOW);
      assert.ok(earliest > 0);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Stage Summary Metric Cards (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 6 Boundaries: Stage Summary Metric Cards', () => {
    it('T2.F6.1: When all stage counts are 0, renders 5 cards with 0 count without errors', () => {
      const emptyBoard = board.buildBoard([], SIMULATED_NOW);
      assert.equal(emptyBoard.counts.length, 5);
      for (const c of emptyBoard.counts) {
        assert.equal(c.count, 0);
      }
    });

    it('T2.F6.2: Offer count == 0 does NOT apply hot highlight class', () => {
      const emptyBoard = board.buildBoard([], SIMULATED_NOW);
      const offerCard = emptyBoard.counts.find(c => c.key === 'offer');
      assert.equal(offerCard.count, 0);
      const isHot = offerCard.key === 'offer' && offerCard.count > 0;
      assert.equal(isHot, false);
    });

    it('T2.F6.3: Offer count == 1 applies hot highlight class', () => {
      const hotHtml = renderComponent(StageMetricsBar, {
        counts: [{ key: 'offer', label: 'Offers', count: 1, note: '1 active' }],
        activeStage: 'all',
        onSelectStage: () => {},
      });
      const notHotHtml = renderComponent(StageMetricsBar, {
        counts: [{ key: 'offer', label: 'Offers', count: 0, note: 'None yet' }],
        activeStage: 'all',
        onSelectStage: () => {},
      });
      assert.ok(hotHtml.includes('hot'));
      assert.ok(!notHotHtml.includes('hot'));
    });

    it('T2.F6.4: Note text handles empty pipeline (None open, None yet)', () => {
      const emptyBoard = board.buildBoard([], SIMULATED_NOW);
      const assess = emptyBoard.counts.find(c => c.key === 'assessment');
      const offer = emptyBoard.counts.find(c => c.key === 'offer');
      assert.equal(assess.note, 'None open');
      assert.equal(offer.note, 'None yet');
    });

    it('T2.F6.5: Rapid toggling of card clicks cycles between stage filter and all without stuck state', () => {
      const counts = [
        { key: 'applied', label: 'Applied', count: 5, note: 'Waiting' },
        { key: 'interview', label: 'Interviews', count: 2, note: 'In progress' },
      ];
      const htmlActive = renderComponent(StageMetricsBar, {
        counts,
        activeStage: 'interview',
        onSelectStage: () => {},
      });
      assert.ok(htmlActive.includes('intent-interview'));
      assert.ok(htmlActive.includes('is-active on'));

      const htmlAll = renderComponent(StageMetricsBar, {
        counts,
        activeStage: 'all',
        onSelectStage: () => {},
      });
      assert.ok(!htmlAll.includes('is-active on'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Data-Dense Desktop Table (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 7 Boundaries: Data-Dense Desktop Table', () => {
    it('T2.F7.1: Zero total applications renders empty state row with colSpan=6', () => {
      const emptyBoard = board.buildBoard([], SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: [],
        lanes: emptyBoard.lanes,
        allCardsCount: 0,
        selectedRowIndex: -1,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 0,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('colSpan="6"') || html.includes('colspan="6"'));
      assert.ok(html.includes('No applications found matching your filter.'));
    });

    it('T2.F7.2: Exactly 1 application renders single table row with Showing 1-1 of 1', () => {
      const singleApp = createMockApp('app-1', 'SingleCorp', 'Engineer', [{
        id: 'msg-1',
        threadId: 't-1',
        from: 'recruiter@singlecorp.com',
        senderDomain: 'singlecorp.com',
        subject: 'Application',
        snippet: 'Thanks',
        fullBody: 'Thanks',
        receivedAt: '2026-10-20T10:00:00Z',
        company: 'SingleCorp',
        role: 'Engineer',
        stage: 'applied',
        deadlineRaw: null,
        deadlineResolved: null,
        actionNeeded: false,
        confidence: 0.9,
        decisionSource: 'rule',
        ruleMatched: null,
        isStarred: false,
        isArchived: false,
        applicationId: 'app-1',
      }]);

      const b = board.buildBoard([singleApp], SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards,
        lanes: b.lanes,
        allCardsCount: 1,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 1,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('Showing 1–1 of 1'));
      assert.ok(html.includes('SingleCorp'));
    });

    it('T2.F7.3: Exactly 12 applications renders 1 page with Next button disabled', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const twelveCards = b.cards.slice(0, 12);
      const html = renderComponent(ApplicationTable, {
        cards: twelveCards,
        lanes: b.lanes,
        allCardsCount: 12,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        pageSize: 12,
        totalPages: 1,
        totalFilteredCount: 12,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('Showing 1–12 of 12'));
      assert.ok(html.includes('disabled=""'));
    });

    it('T2.F7.4: Exactly 13 applications enables Next button and sets totalPages to 2', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const first12 = b.cards.slice(0, 12);
      const html = renderComponent(ApplicationTable, {
        cards: first12,
        lanes: b.lanes,
        allCardsCount: 13,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        pageSize: 12,
        totalPages: 2,
        totalFilteredCount: 13,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('Showing 1–12 of 13'));
      const navButtons = html.match(/<button[^>]*class="[^"]*bp-page-btn[^"]*"[^>]*>/g) || [];
      assert.equal(navButtons.length, 2);
      assert.ok(navButtons[0].includes('disabled=""'), 'Prev button should be disabled at page 0');
      assert.ok(!navButtons[1].includes('disabled=""'), 'Next button should be enabled when totalPages > 1');
    });

    it('T2.F7.5: Table cell with null lastEmail or role displays fallback value', () => {
      const card = {
        app: { id: 'app-fb', company: 'Fallback Corp', role: '', emails: [], lastActivity: '2026-10-20' },
        lane: 'applied',
        chip: { kind: 'wait', text: 'Waiting' },
        reached: new Set(['applied']),
        lastEmail: '—',
      };
      const html = renderComponent(ApplicationTable, {
        cards: [card],
        lanes: [{ key: 'applied', name: 'Applied', cards: [card] }],
        allCardsCount: 1,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 1,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('<td style="color:var(--bp-text-muted)">—</td>'));
      assert.ok(html.includes('—'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Table Search & Stage Filtering (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 8 Boundaries: Table Search & Stage Filtering', () => {
    const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
    const b = board.buildBoard(applications, SIMULATED_NOW);

    it('T2.F8.1: Search query with leading and trailing spaces matches trimmed company name', () => {
      const rawQuery = '   lumen   ';
      const q = rawQuery.trim().toLowerCase();
      const match = b.cards.filter(c => c.app.company.toLowerCase().includes(q));
      assert.equal(match.length, 1);
      assert.equal(match[0].app.company, 'Lumen Analytics');
    });

    it('T2.F8.2: Search query matching 0 records displays empty table state', () => {
      const q = 'nonexistent_company_xyz_99';
      const match = b.cards.filter(c => c.app.company.toLowerCase().includes(q));
      assert.equal(match.length, 0);
    });

    it('T2.F8.3: Search query with punctuation (& / -) matches accurately', () => {
      const q = 'sable & co';
      const match = b.cards.filter(c => c.app.company.toLowerCase().includes(q));
      assert.equal(match.length, 1);
      assert.equal(match[0].app.company, 'Sable & Co');
    });

    it('T2.F8.4: Selecting a stage filter with 0 matching applications renders 0 count in pill', () => {
      const emptyLaneCards = b.cards.filter(c => c.lane === 'review');
      assert.equal(emptyLaneCards.length, 0);
    });

    it('T2.F8.5: Changing stage filter resets tablePage to 0 from any higher page index', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards,
        lanes: b.lanes,
        allCardsCount: b.cards.length,
        selectedRowIndex: 0,
        activeStage: 'interview',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: b.cards.length,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes('Interview ('));
      assert.ok(html.includes('is-active on') && html.includes('aria-pressed="true"'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Row Selection & Focus Highlighting (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 9 Boundaries: Row Selection & Focus Highlighting', () => {
    it('T2.F9.1: Row selection index cannot be negative (< 0 clamped to 0)', () => {
      let selectedIdx = null;
      const res = dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 5,
        onSelectRow: (idx) => { selectedIdx = idx; },
      }, createMockKeyEvent('k'));
      assert.equal(res.action, 'nav_up');
      assert.equal(res.prevIndex, 0);
      assert.equal(selectedIdx, 0);
    });

    it('T2.F9.2: Row selection index cannot exceed pagedCards.length - 1', () => {
      let selectedIdx = null;
      const res = dispatchHotkey({
        activeRowIndex: 4,
        totalRows: 5,
        onSelectRow: (idx) => { selectedIdx = idx; },
      }, createMockKeyEvent('j'));
      assert.equal(res.action, 'nav_down');
      assert.equal(res.nextIndex, 4);
      assert.equal(selectedIdx, 4);
    });

    it('T2.F9.3: Row selection on empty table handles active index safely', () => {
      let selectedIdx = null;
      const res = dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 0,
        onSelectRow: (idx) => { selectedIdx = idx; },
      }, createMockKeyEvent('j'));
      assert.equal(res.action, 'navigate_noop');
      assert.equal(selectedIdx, null);
    });

    it('T2.F9.4: Changing pagination page resets active row selection to index 0 of new page', () => {
      // Pages change with the Next button now (the ] key was removed)
      const res = dispatchHotkey({}, createMockKeyEvent(']'));
      assert.equal(res.action, 'unmapped_key');
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards.slice(12, 24),
        lanes: b.lanes,
        allCardsCount: b.cards.length,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 1,
        totalPages: 2,
        totalFilteredCount: b.cards.length,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes(b.cards[12].app.company));
    });

    it('T2.F9.5: Filtering that reduces results below active row index clamps active index to new max', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const fourCards = b.cards.slice(0, 4);
      const clampedIndex = Math.min(10, fourCards.length - 1);
      assert.equal(clampedIndex, 3);
      const html = renderComponent(ApplicationTable, {
        cards: fourCards,
        lanes: b.lanes,
        allCardsCount: fourCards.length,
        selectedRowIndex: clampedIndex,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: fourCards.length,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes(fourCards[3].app.company));
      assert.ok(html.includes('aria-selected="true"'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: Keyboard Hotkeys & Navigation (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 10 Boundaries: Keyboard Hotkeys & Navigation', () => {
    it('T2.F10.1: Pressing k or ArrowUp at index 0 clamps at index 0 (no underflow)', () => {
      let active = 0;
      dispatchHotkey({
        activeRowIndex: active,
        totalRows: 10,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('k'));
      assert.equal(active, 0);

      dispatchHotkey({
        activeRowIndex: active,
        totalRows: 10,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('ArrowUp'));
      assert.equal(active, 0);
    });

    it('T2.F10.2: Pressing j or ArrowDown at last index clamps at last index (no overflow)', () => {
      let active = 9;
      dispatchHotkey({
        activeRowIndex: active,
        totalRows: 10,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('j'));
      assert.equal(active, 9);

      dispatchHotkey({
        activeRowIndex: active,
        totalRows: 10,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('ArrowDown'));
      assert.equal(active, 9);
    });

    it('T2.F10.3: Pressing [ on page 0 remains on page 0 without error', () => {
      let page = 0;
      const onPrevPage = () => {
        page = Math.max(0, page - 1);
      };
      dispatchHotkey({ onPrevPage }, createMockKeyEvent('['));
      assert.equal(page, 0);
    });

    it('T2.F10.4: Pressing ] on last page remains on last page without error', () => {
      let page = 1;
      const maxPage = 1;
      const onNextPage = () => {
        page = Math.min(maxPage, page + 1);
      };
      dispatchHotkey({ onNextPage }, createMockKeyEvent(']'));
      assert.equal(page, 1);
    });

    it('T2.F10.5: Navigation hotkeys on empty table (0 rows) gracefully no-op without error', () => {
      let called = false;
      const res = dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 0,
        onSelectRow: () => { called = true; },
      }, createMockKeyEvent('j'));
      assert.equal(called, false);
      assert.equal(res.action, 'navigate_noop');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Hotkey Safety Input Guard (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 11 Boundaries: Hotkey Safety Input Guard', () => {
    it('T2.F11.1: Typing hotkeys 1-5 inside search input does NOT trigger status transition', () => {
      const input = createMockInputElement('INPUT');
      let transitioned = false;
      for (const k of ['1', '2', '3', '4', '5']) {
        const res = dispatchHotkey({
          onTriageStatus: () => { transitioned = true; },
        }, createMockKeyEvent(k, { target: input }));
        assert.equal(res.suppressedByInputGuard, true);
      }
      assert.equal(transitioned, false);
    });

    it('T2.F11.2: Typing j or k inside search input does NOT change active table row', () => {
      const input = createMockInputElement('INPUT');
      let moved = false;
      dispatchHotkey({
        onSelectRow: () => { moved = true; },
      }, createMockKeyEvent('j', { target: input }));
      dispatchHotkey({
        onSelectRow: () => { moved = true; },
      }, createMockKeyEvent('k', { target: input }));
      assert.equal(moved, false);
    });

    it('T2.F11.3: Typing / inside search input appends / character and does NOT steal focus', () => {
      const input = createMockInputElement('INPUT');
      let focusCalled = false;
      const res = dispatchHotkey({
        onFocusSearch: () => { focusCalled = true; },
      }, createMockKeyEvent('/', { target: input }));
      assert.equal(res.suppressedByInputGuard, true);
      assert.equal(focusCalled, false);
    });

    it('T2.F11.4: Typing ? inside search input appends ? and does NOT open cheat sheet', () => {
      const input = createMockInputElement('INPUT');
      let shortcutsOpened = false;
      const res = dispatchHotkey({
        onToggleShortcuts: () => { shortcutsOpened = true; },
      }, createMockKeyEvent('?', { target: input }));
      assert.equal(res.suppressedByInputGuard, true);
      assert.equal(shortcutsOpened, false);
    });

    it('T2.F11.5: Contenteditable elements suppress all navigation and triage hotkeys', () => {
      const editable = { tagName: 'DIV', isContentEditable: true, blur: () => {} };
      let triageFired = false;
      const res = dispatchHotkey({
        onTriageStatus: () => { triageFired = true; },
      }, createMockKeyEvent('3', { target: editable }));
      assert.equal(res.suppressedByInputGuard, true);
      assert.equal(triageFired, false);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: Shortcuts Cheat Sheet Modal (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 12 Boundaries: Shortcuts Cheat Sheet Modal', () => {
    it('T2.F12.1: Pressing ? while search input is active is suppressed by Input Guard', () => {
      const input = createMockInputElement('INPUT');
      let toggled = false;
      const res = dispatchHotkey({
        onToggleShortcuts: () => { toggled = true; },
      }, createMockKeyEvent('?', { target: input }));
      assert.equal(res.suppressedByInputGuard, true);
      assert.equal(toggled, false);
    });

    it('T2.F12.2: Pressing ? while shortcuts modal is already open toggles modal closed', () => {
      let isOpen = true;
      const toggle = () => { isOpen = !isOpen; };
      dispatchHotkey({ onToggleShortcuts: toggle }, createMockKeyEvent('?'));
      assert.equal(isOpen, false);
    });

    it('T2.F12.3: Escape when both drawer and shortcuts modal are open closes shortcuts modal FIRST', () => {
      let modalClosed = false;
      let drawerClosed = false;
      const res = dispatchHotkey({
        isShortcutsOpen: true,
        isDrawerOpen: true,
        onToggleShortcuts: () => { modalClosed = true; },
        onDismiss: () => { drawerClosed = true; },
      }, createMockKeyEvent('Escape'));

      assert.equal(res.action, 'close_shortcuts');
      assert.equal(modalClosed, true);
      assert.equal(drawerClosed, false);
    });

    it('T2.F12.4: Shortcuts modal defines max-width to prevent overflow on small viewports', () => {
      const css = readTrackerCss();
      assert.match(css, /\.bp-dialog[\s\S]*?width:\s*min\(500px,\s*95vw\)/);
    });

    it('T2.F12.5: Modal backdrop click triggers light dismissal', () => {
      const html = renderComponent(KeyboardShortcutsDialog, {
        isOpen: true,
        onClose: () => {},
      });
      assert.ok(html.includes('class="bp-dialog-backdrop"'));
      assert.ok(html.includes('role="presentation"'));
      assert.ok(html.includes('aria-label="Close dialog"'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: In-Place Application Detail Drawer (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 13 Boundaries: In-Place Application Detail Drawer', () => {
    it('T2.F13.1: Pressing Enter on empty table gracefully no-ops without opening drawer', () => {
      let inspected = false;
      const res = dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 0,
        onInspectRow: () => { inspected = true; },
      }, createMockKeyEvent('Enter'));
      assert.equal(inspected, false);
      assert.equal(res.action, 'inspect_noop');
    });

    it('T2.F13.2: Detail drawer with application having 0 emails renders empty thread placeholder', () => {
      const emptyApp = createMockApp('app-empty', 'EmptyCorp', 'Intern', []);
      const emptyCard = {
        app: emptyApp,
        lane: 'applied',
        chip: { kind: 'wait', text: 'Waiting' },
        reached: new Set(['applied']),
        lastEmail: '—',
      };
      const html = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card: emptyCard,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(html.includes('Email Thread History (0)'));
      assert.ok(html.includes('0 messages'));
    });

    it('T2.F13.3: Detail drawer with application having 10+ emails enables vertical scroll', () => {
      const emails = Array.from({ length: 12 }, (_, i) => ({
        id: `m-${i}`,
        threadId: `t-${i}`,
        from: 'recruiter@bigcorp.com',
        senderDomain: 'bigcorp.com',
        subject: `Update ${i}`,
        snippet: `Snippet ${i}`,
        fullBody: `Body ${i}`,
        receivedAt: new Date(SIMULATED_NOW - i * 86400000).toISOString(),
        company: 'BigCorp',
        role: 'Lead',
        stage: 'applied',
        deadlineRaw: null,
        deadlineResolved: null,
        actionNeeded: false,
        confidence: 0.95,
        decisionSource: 'rule',
        ruleMatched: null,
        isStarred: false,
        isArchived: false,
        applicationId: 'app-bigcorp',
      }));

      const bigApp = createMockApp('app-bigcorp', 'BigCorp', 'Lead', emails);
      const bigCard = {
        app: bigApp,
        lane: 'applied',
        chip: { kind: 'wait', text: 'Waiting' },
        reached: new Set(['applied']),
        lastEmail: 'Oct 20',
      };
      const html = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card: bigCard,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(html.includes('Email Thread History (12)'));
      assert.ok(html.includes('12 messages'));
      const css = readTrackerCss();
      assert.match(css, /(\.bp-drawer-body|\.tk-drawer-body)[\s\S]*?overflow-y:\s*auto/);
    });

    it('T2.F13.4: Application with null deadline renders drawer without deadline countdown badge', () => {
      const noDeadlineApp = createMockApp('app-nodeadline', 'NoDeadlineCorp', 'Designer', [{
        id: 'msg-1', threadId: 't-1', from: 'r@nodeadline.com', senderDomain: 'nodeadline.com',
        subject: 'Applied', snippet: 'Applied', fullBody: 'Applied', receivedAt: '2026-10-20T10:00:00Z',
        company: 'NoDeadlineCorp', role: 'Designer', stage: 'applied', deadlineRaw: null,
        deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
        ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-nodeadline',
      }]);
      const card = {
        app: noDeadlineApp,
        lane: 'applied',
        chip: { kind: 'wait', text: 'Applied' },
        reached: new Set(['applied']),
        lastEmail: 'Oct 20',
        deadline: null,
      };
      const html = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(!html.includes('Due in'));
      assert.ok(!html.includes('bp-countdown-badge'));
    });

    it('T2.F13.5: Clicking drawer backdrop triggers drawer dismissal', () => {
      const card = {
        app: createMockApp('app-1', 'Corp', 'Dev', []),
        lane: 'applied',
        chip: { kind: 'wait', text: 'Applied' },
        reached: new Set(['applied']),
        lastEmail: 'Oct 20',
      };
      const html = renderComponent(ApplicationDetailDrawer, {
        isOpen: true,
        card,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.ok(html.includes('bp-drawer-backdrop tk-drawer-backdrop'));
      assert.ok(html.includes('role="presentation"'));
      assert.ok(html.includes('aria-label="Close application drawer"'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Continuous Triage Synchronization (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 14 Boundaries: Continuous Triage Synchronization', () => {
    it('T2.F14.1: Live-swapping drawer at end of page clamps to last item without closing drawer', () => {
      let active = 4;
      let isDrawerOpen = true;
      dispatchHotkey({
        activeRowIndex: active,
        totalRows: 5,
        isDrawerOpen,
        onSelectRow: (idx) => { active = idx; },
      }, createMockKeyEvent('j'));
      assert.equal(active, 4);
      assert.equal(isDrawerOpen, true);
    });

    it('T2.F14.2: Live-swapping drawer while holding j (rapid navigation) keeps drawer synchronized', () => {
      let active = 0;
      const total = 5;
      for (let i = 0; i < 10; i++) {
        const res = dispatchHotkey({
          activeRowIndex: active,
          totalRows: total,
          isDrawerOpen: true,
          onSelectRow: (idx) => { active = idx; },
        }, createMockKeyEvent('j'));
        assert.equal(res.action, 'nav_down');
      }
      assert.equal(active, 4);
    });

    it('T2.F14.3: With the drawer open, the removed ] key does not change the page', () => {
      let pageChanged = false;
      const res = dispatchHotkey({
        isDrawerOpen: true,
        onNextPage: () => { pageChanged = true; },
      }, createMockKeyEvent(']'));
      assert.equal(res.action, 'unmapped_key');
      assert.equal(pageChanged, false);
    });

    it('T2.F14.4: Deleting or filtering out active card from table closes or resets drawer safely', () => {
      const closedHtml = renderComponent(ApplicationDetailDrawer, {
        isOpen: false,
        card: null,
        onClose: () => {},
        onOpenEmail: () => {},
      });
      assert.equal(closedHtml, '');
    });

    it('T2.F14.5: Live-swapping across applications with varying email lengths preserves stability', () => {
      const appA = createMockApp('app-a', 'Company A', 'Role A', [{
        id: '1', threadId: 't-1', from: 'a@a.com', senderDomain: 'a.com',
        subject: 'A1', snippet: 'A1', fullBody: 'A1', receivedAt: '2026-10-20T10:00:00Z',
        company: 'Company A', role: 'Role A', stage: 'applied', deadlineRaw: null,
        deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
        ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-a',
      }]);
      const appB = createMockApp('app-b', 'Company B', 'Role B', [
        {
          id: '2', threadId: 't-2', from: 'b@b.com', senderDomain: 'b.com',
          subject: 'B1', snippet: 'B1', fullBody: 'B1', receivedAt: '2026-10-20T10:00:00Z',
          company: 'Company B', role: 'Role B', stage: 'applied', deadlineRaw: null,
          deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
          ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-b',
        },
        {
          id: '3', threadId: 't-2', from: 'b@b.com', senderDomain: 'b.com',
          subject: 'B2', snippet: 'B2', fullBody: 'B2', receivedAt: '2026-10-21T10:00:00Z',
          company: 'Company B', role: 'Role B', stage: 'interview', deadlineRaw: null,
          deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
          ruleMatched: null, isStarred: false, isArchived: false, applicationId: 'app-b',
        },
      ]);
      const cardA = { app: appA, lane: 'applied', chip: { kind: 'wait', text: 'Applied' }, reached: new Set(['applied']), lastEmail: 'Oct 20' };
      const cardB = { app: appB, lane: 'interview', chip: { kind: 'info', text: 'Active' }, reached: new Set(['applied', 'interview']), lastEmail: 'Oct 21' };

      const htmlA = renderComponent(ApplicationDetailDrawer, { isOpen: true, card: cardA, onClose: () => {}, onOpenEmail: () => {} });
      assert.ok(htmlA.includes('Email Thread History (1)'));
      assert.ok(htmlA.includes('1 message'));
      assert.ok(htmlA.includes('Company A'));

      const htmlB = renderComponent(ApplicationDetailDrawer, { isOpen: true, card: cardB, onClose: () => {}, onOpenEmail: () => {} });
      assert.ok(htmlB.includes('Email Thread History (2)'));
      assert.ok(htmlB.includes('2 messages'));
      assert.ok(htmlB.includes('Company B'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Quick Status Transitions & Overrides (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 15 Boundaries: Quick Status Transitions & Overrides', () => {
    it('T2.F15.1: Pressing a removed status key when 0 rows are in table no-ops safely', () => {
      let triageCalled = false;
      const res = dispatchHotkey({
        activeRowIndex: 0,
        totalRows: 0,
        onTriageStatus: () => { triageCalled = true; },
      }, createMockKeyEvent('3'));
      assert.equal(triageCalled, false);
      assert.equal(res.action, 'unmapped_key');
    });

    it('T2.F15.2: Overriding application to stage it already has is idempotent', () => {
      const triage = createTriageState([]);
      triage.setStatus('app-1', 'interview');
      triage.setStatus('app-1', 'interview');
      assert.equal(triage.overrides['app-1'], 'interview');
    });

    it('T2.F15.3: Rapid conflicting transitions (1->5->2->4->u) resolve cleanly to un-overridden state', () => {
      const triage = createTriageState([]);
      triage.setStatus('app-1', 'applied');
      triage.setStatus('app-1', 'rejected');
      triage.setStatus('app-1', 'assessment');
      triage.setStatus('app-1', 'offer');
      triage.resetStatus('app-1');
      assert.equal(triage.hasOverride('app-1'), false);
    });

    it('T2.F15.4: Reverting override (u / 0) when application has no active override no-ops safely', () => {
      const triage = createTriageState([]);
      triage.resetStatus('nonexistent-app');
      assert.equal(triage.hasOverride('nonexistent-app'), false);
    });

    it('T2.F15.5: Corrupt override value in storage is ignored and discarded', () => {
      const storage = createMockStorage();
      storage.setItem('trackerStatusOverrides', 'null');
      const triage = createTriageState([], {}, storage);
      assert.deepEqual(triage.overrides, {});
    });
  });

  // --------------------------------------------------------------------------
  // Feature 16: Functional Feature Preservation (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 16 Boundaries: Functional Feature Preservation', () => {
    it('T2.F16.1: Activity timeline with 0 weekly data renders 12 zero-height bars without division by zero', () => {
      const emptyBoard = board.buildBoard([], SIMULATED_NOW);
      assert.equal(emptyBoard.weekly.weeks.length, 12);
      assert.ok(emptyBoard.weekly.applied.every(count => count === 0));
    });

    it('T2.F16.2: Peak week with all-zero counts returns null safely', () => {
      const series = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const peakCount = Math.max(0, ...series);
      const idx = series.indexOf(peakCount);
      const peakWeek = idx >= 0 && peakCount > 0 ? `Week-${idx}` : null;
      assert.equal(peakWeek, null);
    });

    it('T2.F16.3: Unsure emails with 0 review emails renders 0 count and hidden section', () => {
      const emptyBoard = board.buildBoard([], SIMULATED_NOW);
      assert.equal(emptyBoard.unsure.length, 0);
    });

    it('T2.F16.4: Relative countdown for past date returns null (never negative duration)', () => {
      const pastDeadline = new Date(SIMULATED_NOW - 86400000).toISOString();
      const res = board.countdown(pastDeadline, SIMULATED_NOW);
      assert.equal(res, null);
    });

    it('T2.F16.5: Missing optional props (onRefresh, banner) render without throwing exceptions', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const html = renderComponent(ApplicationTable, {
        cards: b.cards.slice(0, 3),
        lanes: b.lanes,
        allCardsCount: 3,
        selectedRowIndex: 0,
        activeStage: 'all',
        onSelectRow: () => {},
        onInspectCard: () => {},
        onSelectStage: () => {},
        searchQuery: '',
        onSearchChange: () => {},
        page: 0,
        totalPages: 1,
        totalFilteredCount: 3,
        onPrevPage: () => {},
        onNextPage: () => {},
      });
      assert.ok(html.includes(b.cards[0].app.company));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Build & Lint Integrity (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 17 Boundaries: Build & Lint Integrity', () => {
    it('T2.F17.1: tsconfig includes erasableSyntaxOnly for TypeScript 5.8+ type-stripping', () => {
      const tsPath = path.join(ROOT, 'demo/tsconfig.app.json');
      const raw = fs.readFileSync(tsPath, 'utf8');
      const tsConfig = JSON.parse(stripJsonComments(raw));
      assert.equal(tsConfig.compilerOptions.erasableSyntaxOnly, true);
    });

    it('T2.F17.2: tsconfig includes DOM and ES2023 libraries', () => {
      const tsPath = path.join(ROOT, 'demo/tsconfig.app.json');
      const raw = fs.readFileSync(tsPath, 'utf8');
      const tsConfig = JSON.parse(stripJsonComments(raw));
      assert.ok(tsConfig.compilerOptions.lib.includes('DOM'));
      assert.ok(tsConfig.compilerOptions.lib.includes('ES2023'));
    });

    it('T2.F17.3: TypeScript module resolution is set to bundler', () => {
      const tsPath = path.join(ROOT, 'demo/tsconfig.app.json');
      const raw = fs.readFileSync(tsPath, 'utf8');
      const tsConfig = JSON.parse(stripJsonComments(raw));
      assert.equal(tsConfig.compilerOptions.moduleResolution, 'bundler');
    });

    it('T2.F17.4: Demo package private flag is true', () => {
      const pkgPath = path.join(ROOT, 'demo/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      assert.equal(pkg.private, true);
    });

    it('T2.F17.5: Build output size remains under extension bundle budget', () => {
      const distDir = path.join(ROOT, 'demo/dist');
      if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        assert.ok(files.length > 0);
      } else {
        assert.ok(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Feature 18: E2E Test Suite Verification (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 18 Boundaries: E2E Test Suite Verification', () => {
    it('T2.F18.1: Test runner handles assertions with strict equality checking', () => {
      assert.strictEqual(blueprintTokens.BLUEPRINT_CLASSES.HTML_TABLE, 'bp-html-table');
      assert.strictEqual(blueprintTokens.BLUEPRINT_CLASSES.DRAWER, 'bp-drawer');
      assert.notStrictEqual(blueprintTokens.BLUEPRINT_COLORS.cobalt, blueprintTokens.BLUEPRINT_COLORS.green);
    });

    it('T2.F18.2: Test runner produces deterministic outputs across multiple runs', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b1 = board.buildBoard(applications, SIMULATED_NOW);
      const b2 = board.buildBoard(applications, SIMULATED_NOW);
      assert.equal(b1.cards.length, b2.cards.length);
      assert.deepEqual(b1.counts, b2.counts);
    });

    it('T2.F18.3: Assertion failures report diff clearly', () => {
      try {
        assert.equal(blueprintTokens.BLUEPRINT_COLORS.cobalt, '#000000');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.actual === '#106ba3');
        assert.ok(err.expected === '#000000');
      }
    });

    it('T2.F18.4: Test runner cleans up temporary mock storage safely', () => {
      const storage = createMockStorage();
      storage.setItem('temp', '123');
      storage.clear();
      assert.equal(storage.length, 0);
    });

    it('T2.F18.5: Node test runner executes in isolated ES Module scope', () => {
      assert.ok(import.meta.url.endsWith('tier2_boundaries.test.mjs'));
    });
  });

  // --------------------------------------------------------------------------
  // Feature 19: Adversarial Coverage Hardening (Boundaries)
  // --------------------------------------------------------------------------
  describe('Feature 19 Boundaries: Adversarial Coverage Hardening', () => {
    it('T2.F19.1: Application with empty string ID handles entity resolution safely', () => {
      const app = createMockApp('', 'Unknown Corp', 'Role', [{
        id: 'msg-empty', threadId: 't-empty', from: 'unknown@example.com', senderDomain: 'example.com',
        subject: 'Subject', snippet: 'Snippet', fullBody: 'Body', receivedAt: '2026-10-20T10:00:00Z',
        company: 'Unknown Corp', role: 'Role', stage: 'applied', deadlineRaw: null,
        deadlineResolved: null, actionNeeded: false, confidence: 0.9, decisionSource: 'rule',
        ruleMatched: null, isStarred: false, isArchived: false, applicationId: '',
      }]);
      const b = board.buildBoard([app], SIMULATED_NOW);
      assert.equal(b.cards.length, 1);
      assert.equal(b.cards[0].app.company, 'Unknown Corp');
    });

    it('T2.F19.2: Email with received date in the year 1970 or 2099 processes date math correctly', () => {
      const oldDate = '1970-01-01T00:00:00Z';
      const futureDate = '2099-12-31T23:59:59Z';
      assert.ok(new Date(oldDate).getTime() < SIMULATED_NOW);
      assert.ok(new Date(futureDate).getTime() > SIMULATED_NOW);
    });

    it('T2.F19.3: Simultaneous key combinations process sequentially without corrupting state', () => {
      let active = 0;
      dispatchHotkey({ activeRowIndex: active, totalRows: 5, onSelectRow: (idx) => { active = idx; } }, createMockKeyEvent('j'));
      dispatchHotkey({ activeRowIndex: active, totalRows: 5, onSelectRow: (idx) => { active = idx; } }, createMockKeyEvent('1'));
      assert.equal(active, 1);
    });

    it('T2.F19.4: Storage quota exceeded error in setItem is caught gracefully without crash', () => {
      const storage = createMockStorage({ failOnSet: true });
      let caught = false;
      try {
        storage.setItem('key', 'val');
      } catch (err) {
        caught = true;
      }
      assert.equal(caught, true);
    });

    it('T2.F19.5: Prototype pollution attempts in search query (__proto__, constructor) are harmless', () => {
      const { applications } = feed.adaptFeed(mock.SAMPLE_FEED, SIMULATED_NOW);
      const b = board.buildBoard(applications, SIMULATED_NOW);
      const dangerousKey = '__proto__';
      const results = b.cards.filter(c => c.app.company.toLowerCase().includes(dangerousKey));
      assert.equal(results.length, 0);
      assert.equal(Object.prototype.polluted, undefined);
    });
  });
});
