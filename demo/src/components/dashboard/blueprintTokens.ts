/**
 * Palantir Blueprint Design System Tokens & Utility Helpers
 * Scoped for the Personal Mail Organizer (Gmail Job Application Tracker) Dashboard.
 *
 * Implements:
 * - Exact Palantir Blueprint color tokens (Cobalt, Green, Orange, Red, Slates)
 * - Semantic BlueprintIntent types and IntentColorDef interface
 * - Mapping functions: getLaneIntent, getChipIntent, getStageBadgeProps
 * - Tabular numbers utility classes and typography constants
 * - Scoped CSS class name constants for components and elevations
 *
 * Adheres strictly to:
 * - verbatimModuleSyntax: true (all type imports/exports explicit)
 * - erasableSyntaxOnly: true (no enums, no namespaces)
 * - strict null checks & no unused locals/params
 */

import type { CSSProperties } from 'react';
import type { Stage } from '../../types';
import type { Lane, ChipKind } from '../../utils/board';

// ============================================================================
// 1. Palantir Blueprint Color Tokens
// ============================================================================

export const BLUEPRINT_COLORS = {
  // Semantic Intent Solid Primaries (Level 3 standard)
  cobalt: '#106ba3',         // Primary (Blueprint Blue)
  cobaltHover: '#0e5a8a',
  cobaltActive: '#0c4b73',
  cobaltLight: '#ebf1f5',    // Minimal/Tonal background
  cobaltBorder: '#2b95d6',   // Outline / focus accent

  green: '#0d8050',          // Success (Blueprint Green)
  greenHover: '#0a6640',
  greenActive: '#085132',
  greenLight: '#edf8f2',
  greenBorder: '#32a467',

  orange: '#bf7300',         // Warning (Blueprint Ochre/Orange)
  orangeHover: '#a66321',
  orangeActive: '#8c521a',
  orangeLight: '#fdf5ea',
  orangeBorder: '#ec9a3c',

  red: '#c23030',            // Danger (Blueprint Crimson/Red)
  redHover: '#a82222',
  redActive: '#8f1b1b',
  redLight: '#fdf2f2',
  redBorder: '#e76a6e',

  // Named intent aliases
  primarySolid: '#106ba3',
  primaryHover: '#0e5a8a',
  primaryActive: '#0c4b73',
  primaryBg: '#ebf1f5',
  primaryText: '#106ba3',
  primaryBorder: '#2b95d6',

  successSolid: '#0d8050',
  successHover: '#0a6640',
  successActive: '#085132',
  successBg: '#edf8f2',
  successText: '#0d8050',
  successBorder: '#32a467',

  warningSolid: '#bf7300',
  warningHover: '#a66321',
  warningActive: '#8c521a',
  warningBg: '#fdf5ea',
  warningText: '#bf7300',
  warningBorder: '#ec9a3c',

  dangerSolid: '#c23030',
  dangerHover: '#a82222',
  dangerActive: '#8f1b1b',
  dangerBg: '#fdf2f2',
  dangerText: '#c23030',
  dangerBorder: '#e76a6e',

  // Enterprise Grays & Neutral Slates (Light Theme)
  slateDark: '#182026',      // Primary text, headings, dark ink
  slateMuted: '#5c7080',     // Secondary text, table headers, captions
  slateDisabled: '#8a9ba8',  // Disabled text, placeholders, neutral tags
  slateBorder: '#d3d8de',    // Standard 1px table & panel borders
  slateBorderLight: '#e5e8eb',
  slatePanel: '#f5f8fa',     // Dashboard panel background, table header fill
  white: '#ffffff',          // Card surface, elevated elements

  // Blueprint Grayscale Scale Aliases
  darkGray1: '#1c2127',
  darkGray2: '#252a31',
  darkGray3: '#2f343c',
  darkGray4: '#383e47',
  darkGray5: '#404854',
  gray1: '#5f6b7c',
  gray2: '#738091',
  gray3: '#8f99a8',
  gray4: '#abb3bf',
  gray5: '#c5cbd3',
  lightGray1: '#d3d8de',
  lightGray2: '#dce0e5',
  lightGray3: '#e5e8eb',
  lightGray4: '#edeff2',
  lightGray5: '#f6f7f9',

  // Focus & Selection Accents
  selectionBar: '#106ba3',   // 3px solid Cobalt selection indicator on table rows
  focusRing: '#2b95d6',      // 2px Cerulean keyboard focus ring
  tableHover: '#ebf1f5',     // Table row hover background
  tableSelected: '#ebf1f5',  // Selected table row background
  tableZebra: '#fafbfd',     // Alternating zebra striping
  divider: 'rgba(17, 20, 24, 0.15)',
  outlineRing: 'rgba(17, 20, 24, 0.10)',
  outlineRingStrong: 'rgba(17, 20, 24, 0.15)',
} as const;

// ============================================================================
// 2. Blueprint Intent Types & Color Definitions
// ============================================================================

export type BlueprintIntent = 'primary' | 'success' | 'warning' | 'danger' | 'none';

export interface IntentColorDef {
  solid: string;
  hover: string;
  active?: string;
  bg: string;
  text: string;
  border: string;
}

export const BLUEPRINT_INTENTS: Record<Exclude<BlueprintIntent, 'none'>, IntentColorDef> = {
  primary: {
    solid: BLUEPRINT_COLORS.cobalt,
    hover: BLUEPRINT_COLORS.cobaltHover,
    active: BLUEPRINT_COLORS.cobaltActive,
    bg: BLUEPRINT_COLORS.cobaltLight,
    text: BLUEPRINT_COLORS.cobalt,
    border: BLUEPRINT_COLORS.cobaltBorder,
  },
  success: {
    solid: BLUEPRINT_COLORS.green,
    hover: BLUEPRINT_COLORS.greenHover,
    active: BLUEPRINT_COLORS.greenActive,
    bg: BLUEPRINT_COLORS.greenLight,
    text: BLUEPRINT_COLORS.green,
    border: BLUEPRINT_COLORS.greenBorder,
  },
  warning: {
    solid: BLUEPRINT_COLORS.orange,
    hover: BLUEPRINT_COLORS.orangeHover,
    active: BLUEPRINT_COLORS.orangeActive,
    bg: BLUEPRINT_COLORS.orangeLight,
    text: BLUEPRINT_COLORS.orange,
    border: BLUEPRINT_COLORS.orangeBorder,
  },
  danger: {
    solid: BLUEPRINT_COLORS.red,
    hover: BLUEPRINT_COLORS.redHover,
    active: BLUEPRINT_COLORS.redActive,
    bg: BLUEPRINT_COLORS.redLight,
    text: BLUEPRINT_COLORS.red,
    border: BLUEPRINT_COLORS.redBorder,
  },
} as const;

export const BLUEPRINT_NEUTRAL: IntentColorDef = {
  solid: BLUEPRINT_COLORS.slateMuted,
  hover: '#404854',
  active: '#2f343c',
  bg: '#f0f2f5',
  text: BLUEPRINT_COLORS.slateDark,
  border: BLUEPRINT_COLORS.slateBorder,
} as const;

/**
 * Returns the IntentColorDef for any BlueprintIntent (including 'none').
 */
export function getIntentColors(intent: BlueprintIntent): IntentColorDef {
  if (intent === 'none') {
    return BLUEPRINT_NEUTRAL;
  }
  return BLUEPRINT_INTENTS[intent];
}

/**
 * Accent border color mapping for StageMetricsBar summary cards.
 */
export const STAGE_INTENT_BORDER_COLOR: Record<string, string> = {
  applied: BLUEPRINT_COLORS.slateDisabled,
  assessment: BLUEPRINT_COLORS.orange,
  interview: BLUEPRINT_COLORS.cobalt,
  offer: BLUEPRINT_COLORS.green,
  rejected: BLUEPRINT_COLORS.red,
  review: BLUEPRINT_COLORS.orange,
} as const;

// ============================================================================
// 3. Mapping Functions
// ============================================================================

/**
 * Maps a pipeline Lane (or arbitrary stage string) to a BlueprintIntent.
 *
 * Mappings:
 * - offer      -> 'success' (positive milestone)
 * - interview  -> 'primary' (operational focus)
 * - assessment -> 'warning' (pending test/action)
 * - rejected   -> 'danger'  (closed / negative outcome)
 * - review     -> 'warning' (classifier unsure, human review needed)
 * - applied    -> 'none'    (baseline / neutral slate)
 */
export function getLaneIntent(lane?: Lane | string | null): BlueprintIntent {
  const normalized = String(lane || '').toLowerCase().trim();
  switch (normalized) {
    case 'offer':
      return 'success';
    case 'interview':
      return 'primary';
    case 'assessment':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'review':
      return 'warning';
    case 'applied':
    default:
      return 'none';
  }
}

/**
 * Maps a status chip kind to a BlueprintIntent.
 *
 * Mappings:
 * - due    -> 'warning' (action/deadline approaching, e.g. "Due in 3d", "Decide by Oct 24")
 * - warn   -> 'warning' (ghosted warning, e.g. "No reply in 18 days")
 * - info   -> 'primary' (informational / prompt, e.g. "Reply to schedule", "Needs a look")
 * - closed -> 'danger'  (terminal state, e.g. "Rejected after interview")
 * - wait   -> 'none'    (standard waiting state, e.g. "Waiting since Oct 24")
 */
export function getChipIntent(kind?: ChipKind | string | null): BlueprintIntent {
  const normalized = String(kind || '').toLowerCase().trim();
  switch (normalized) {
    case 'due':
      return 'warning';
    case 'warn':
      return 'warning';
    case 'info':
      return 'primary';
    case 'closed':
      return 'danger';
    case 'wait':
    default:
      return 'none';
  }
}

export interface StageBadgeProps {
  stage: string;
  label: string;
  intent: BlueprintIntent;
  className: string;
  style: CSSProperties;
}

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  review: 'Review',
  other: 'Other',
};

/**
 * Returns comprehensive presentation properties for a stage badge.
 * Provides label, intent, CSS class names (supporting both .intent-* and .bp-intent-*),
 * and an inline CSSProperties object.
 */
export function getStageBadgeProps(stage?: Stage | string | null): StageBadgeProps {
  const normalized = String(stage || '').toLowerCase().trim();
  const intent = getLaneIntent(normalized);
  const colors = getIntentColors(intent);
  const label = STAGE_LABELS[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '—');
  const intentClass = intent === 'none' ? 'intent-neutral' : `intent-${intent}`;
  const bpIntentClass = intent === 'none' ? 'bp-intent-none' : `bp-intent-${intent}`;

  return {
    stage: normalized,
    label,
    intent,
    className: `bp-tag bp-round ${intentClass} ${bpIntentClass}`,
    style: {
      backgroundColor: colors.bg,
      color: colors.text,
      borderColor: colors.border,
    },
  };
}

// ============================================================================
// 4. Tabular Numbers & Typography Utility
// ============================================================================

export const BLUEPRINT_TYPOGRAPHY = {
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontMono: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  tabularNumsStyle: {
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  } as const satisfies CSSProperties,
} as const;

/**
 * Utility class string applying tabular figures and numeric alignment.
 */
export const TABULAR_NUMS_CLASS = 'bp-tabular-nums num';

// ============================================================================
// 5. Blueprint CSS Class Constants
// ============================================================================

export const BLUEPRINT_CLASSES = {
  // Surfaces & Base Containers
  DASHBOARD: 'bp-dashboard',
  SURFACE: 'bp-surface',
  SECTION_CARD: 'bp-section-card',
  CARD: 'bp-card',

  // Elevation Shadows (0 to 4)
  ELEVATION_0: 'bp-elevation-0',
  ELEVATION_1: 'bp-elevation-1',
  ELEVATION_2: 'bp-elevation-2',
  ELEVATION_3: 'bp-elevation-3',
  ELEVATION_4: 'bp-elevation-4',

  // Compact Header / Navbar
  NAVBAR: 'bp-navbar-compact',
  NAVBAR_TITLE_GROUP: 'bp-navbar-title-group',
  NAVBAR_DIVIDER: 'bp-navbar-divider',
  NAVBAR_ACTIONS: 'bp-navbar-actions',

  // Stage Metric Cards
  METRICS_GRID: 'bp-metrics-grid',
  METRIC_CARD: 'bp-metric-card',
  METRIC_VALUE: 'bp-metric-value',
  METRIC_LABEL: 'bp-metric-label',
  METRIC_NOTE: 'bp-metric-note',

  // Data Table & Rows
  TABLE_CONTAINER: 'bp-table-container',
  HTML_TABLE: 'bp-html-table',
  TABLE_ROW: 'bp-table-row',
  ROW_SELECTED: 'is-selected',
  ROW_FOCUSED: 'has-focus',
  TABLE_PAGINATION: 'bp-table-pagination',

  // Badges & Keycaps
  TAG: 'bp-tag',
  TAG_ROUND: 'bp-tag-round',
  KEYCAP: 'bp-keycap',

  // Buttons & Groups
  BUTTON: 'bp-btn',
  BUTTON_PRIMARY: 'bp-btn-primary',
  BUTTON_MINIMAL: 'bp-btn-minimal',
  BUTTON_GROUP: 'bp-btn-group',
  BUTTON_ACTIVE: 'is-active',

  // Progressive Disclosure: Drawer & Dialog
  DRAWER_BACKDROP: 'bp-drawer-backdrop',
  DRAWER: 'bp-drawer',
  DRAWER_HEADER: 'bp-drawer-header',
  DRAWER_BODY: 'bp-drawer-body',
  DRAWER_FOOTER: 'bp-drawer-footer',
  DIALOG: 'bp-dialog',

  // Typography & Utilities
  TABULAR_NUMS: 'bp-tabular-nums',
  TEXT_MUTED: 'bp-text-muted',
  TEXT_DARK: 'bp-text-dark',
} as const;
