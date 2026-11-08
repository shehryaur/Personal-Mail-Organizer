# Project: Personal Mail Organizer - Palantir Blueprint Redesign

## Architecture
A desktop-first, data-dense React dashboard redesign reflecting Palantir Blueprint design principles (Foundry / Gotham / Gaia), structured into modular, single-responsibility components under `demo/src/components/dashboard/`:
- **Design System & Tokens**: Scoped Blueprint tokens, semantic Intent colors (`Primary`, `Success`, `Warning`, `Danger`), crisp 1px outline elevation rings, 3px corner radii, and tabular typography.
- **Data Table & Metrics**: 32px high-density HTML table with sticky headers, subtle zebra striping, Cobalt left-border selection bar (`#106ba3`), compact summary metric cards with intent accents, and responsive date controls.
- **Progressive Disclosure**: In-place right-side slide-over Application Detail Drawer (520px) allowing deep inspection of application email threads and triage provenance without leaving the table view.
- **Keyboard Ergonomics Engine**: High-velocity hotkey workflow (`j`/`k` navigation, `Enter`/`Space` inspection, `1`–`5` status triage, `/` search focus, `?` cheat sheet modal) protected by an immutable Input Guard.
- **Status Triage State**: Reactive status override layer (`trackerStatusOverrides`) supporting instant real-time stage transitions and count recalculations.

```
demo/src/components/dashboard/
├── TrackerDashboard.tsx          # Main dashboard coordinator, layout, and integration
├── blueprintTokens.ts            # Blueprint color constants, Intent types, badge helpers
├── tracker.css                   # Scoped Blueprint CSS (.bp-dashboard, .bp-drawer, tokens)
├── StageMetricsBar.tsx           # Compact summary metric cards with Intent accents
├── ApplicationTable.tsx          # High-density data table with tabular numbers & selection
├── ApplicationDetailDrawer.tsx   # Progressive disclosure drawer for in-place inspection & triage
├── KeyboardShortcutsDialog.tsx   # Modal cheat sheet (opened via '?')
├── DateRangeControls.tsx         # Compact segmented controls & Blueprint date inputs
└── useTrackerHotkeys.ts          # Keyboard navigation, input guard & triage hotkey hook
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Blueprint Semantic Intent Tokens | Primary (`#106ba3`), Success (`#0d8050`), Warning (`#bf7300`), Danger (`#c23030`), and neutral slates with solid/tonal variants | M1 | Survey 1, 2 |
| 2 | Typography & Tabular Numerals | Base 13px/17px, table 12px/16px, strict `font-variant-numeric: tabular-nums` for all metrics, dates, and counts | M1 | Survey 2 |
| 3 | Blueprint Elevation & Outlines | Elevation levels 0–4 with omnipresent 1px outline rings (`rgba(17, 20, 24, 0.1)`) | M1 | Survey 2 |
| 4 | Component Primitives | Compact Buttons, Tags (`.bp-tag`), and Keycap badges (`<kbd>` / `.bp-keycap`) with 3px radii | M1 | Survey 2, 3 |
| 5 | Compact Header Bar & Date Controls | 36px header bar with presets (1w, 1m, 3m, 1y, All, Custom), bounds validation, and action buttons | M2 | Survey 1, 3 |
| 6 | Stage Summary Metric Cards | 5 compact cards with 24–26px tabular counts, uppercase labels, and 3px intent-colored left accents | M2 | Survey 1, 2 |
| 7 | Data-Dense Desktop Table | 32px compact rows, sticky header, zebra striping, subtle borders, hover highlight, and empty state | M2 | Survey 1, 2 |
| 8 | Table Search & Stage Filtering | Case-insensitive company/role search, stage pill filters with counts, and 12-item pagination | M2 | Survey 1, 3 |
| 9 | Row Selection & Focus Highlighting | Cobalt left-accent indicator (`3px solid #106ba3`) and keyboard focus ring on active table row | M2 | Survey 2, 3 |
| 10 | Keyboard Hotkeys & Navigation | `j`/`k` & ArrowDown/ArrowUp row cycling with boundary clamping, `[`/`]` pagination, `/` search focus | M2 | Survey 3 |
| 11 | Hotkey Safety Input Guard | Suppresses single-key shortcuts while typing in `<input>`, `<textarea>`, `<select>`, blurring on Escape | M2 | Survey 3 |
| 12 | Shortcuts Cheat Sheet Modal | Accessible modal overlay displaying categorized keyboard shortcuts, opened via `?` or `Shift+/` | M2 | Survey 2, 3 |
| 13 | In-Place Application Detail Drawer | 520px right-docked drawer displaying application info, email thread list, and full snippet details without leaving table | M3 | Survey 1, 2, 3 |
| 14 | Continuous Triage Synchronization | Navigating with `j`/`k` while the drawer is open immediately live-swaps the drawer content to the active record | M3 | Survey 3 |
| 15 | Quick Status Transitions & Overrides | Hotkeys `1`–`5`, `i`, `r`, `u` and drawer button group transition application stages with instant reactive updates | M3 | Survey 3 |
| 16 | Functional Feature Preservation | Retain timeline drawer, unsure emails collapsible list, `localStorage` keys, and `onOpenEmail` Gmail action | M3 | Survey 1, 3 |
| 17 | Build & Lint Integrity | Zero compiler errors, zero oxlint errors, elimination of existing React Compiler warnings in dashboard | M3 | Survey 1 |
| 18 | E2E Test Suite Verification | Automated tests covering Tiers 1–4: feature tests, boundaries, pairwise combinations, and real-world triage workloads | E2E Track / M4 | Dual Track Spec |
| 19 | Adversarial Coverage Hardening | White-box stress testing (Tier 5): rapid keystroke sequences, edge case inputs, filter boundaries | M4 | Dual Track Spec |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Blueprint Design System Foundations | Tokens, CSS variables, typography, elevation, Intent color classes, Button/Tag/Keycap primitives | none | DONE |
| M2 | Data-Dense Table, Stage Metrics & Keyboard Engine | `StageMetricsBar`, `ApplicationTable`, `DateRangeControls`, `useTrackerHotkeys`, `KeyboardShortcutsDialog`, table search & pagination | M1 | IN_PROGRESS |
| M3 | Progressive Disclosure Drawer, Triage State & Integration | `ApplicationDetailDrawer`, status overrides store, thread inspection, in-place triage actions, `TrackerDashboard` integration | M2 | PLANNED |
| M4 | Final Milestone: 100% E2E Test Pass & Hardening | Run full E2E test suite (Tiers 1–4), resolve any defects, execute Tier 5 adversarial hardening | M3, TEST_READY | PLANNED |

## Interface Contracts

### 1. `blueprintTokens.ts`
```typescript
export type BlueprintIntent = 'primary' | 'success' | 'warning' | 'danger' | 'none';

export interface IntentColorDef {
  solid: string;
  hover: string;
  bg: string;
  text: string;
  border: string;
}

export const BLUEPRINT_INTENTS: Record<Exclude<BlueprintIntent, 'none'>, IntentColorDef>;
export function getLaneIntent(lane: string): BlueprintIntent;
export function getChipIntent(kind: 'due' | 'info' | 'warn' | 'closed' | 'wait'): BlueprintIntent;
```

### 2. `useTrackerHotkeys.ts`
```typescript
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
}

export function useTrackerHotkeys(options: TrackerHotkeyOptions): void;
```

### 3. `ApplicationDetailDrawer.tsx`
```typescript
export interface ApplicationDetailDrawerProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEmailExternal?: (emailId: string) => void;
  onSetStatus: (appId: string, lane: Lane) => void;
  onResetStatus: (appId: string) => void;
  hasOverride: boolean;
}
```

### 4. `TrackerDashboard.tsx`
Preserves all original props without regression:
```typescript
export interface Props {
  applications: Application[];
  now: number;
  onOpenEmail: (emailId: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  updatedLabel?: string;
  banner?: React.ReactNode;
  onOpenSettings?: () => void;
}
```

## Code Layout
- Existing source files:
  - `demo/src/components/dashboard/TrackerDashboard.tsx`
  - `demo/src/components/dashboard/tracker.css`
- New modular components in `demo/src/components/dashboard/`:
  - `blueprintTokens.ts`
  - `StageMetricsBar.tsx`
  - `ApplicationTable.tsx`
  - `ApplicationDetailDrawer.tsx`
  - `KeyboardShortcutsDialog.tsx`
  - `DateRangeControls.tsx`
  - `useTrackerHotkeys.ts`
- E2E Tests:
  - `demo/src/tests/` or `tests/e2e/` (standalone test runner verifying dashboard requirements)
