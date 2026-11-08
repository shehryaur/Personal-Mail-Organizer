/**
 * Adversarial Challenger Test Suite for Milestone 1: Blueprint Design System Foundations
 * Targets: demo/src/components/dashboard/blueprintTokens.ts
 *
 * Verifies:
 * 1. Valid lane mappings ('applied', 'assessment', 'interview', 'offer', 'rejected', 'review')
 * 2. Adversarial & unexpected inputs ('', uppercase, whitespace, non-existent stages, numeric strings, symbols)
 * 3. getChipIntent ('due', 'warn', 'info', 'closed', 'wait', unexpected strings)
 * 4. getStageBadgeProps (label, intent, className, style for standard and edge cases)
 * 5. getIntentColors (solid, hover, bg, text, border for all intents including 'none')
 * 6. STAGE_INTENT_BORDER_COLOR integrity
 * 7. Typography and class token constants
 * 8. High-throughput fuzzing and stress performance
 */

import {
  BLUEPRINT_COLORS,
  BLUEPRINT_INTENTS,
  BLUEPRINT_NEUTRAL,
  STAGE_INTENT_BORDER_COLOR,
  BLUEPRINT_TYPOGRAPHY,
  TABULAR_NUMS_CLASS,
  BLUEPRINT_CLASSES,
  getLaneIntent,
  getChipIntent,
  getIntentColors,
  getStageBadgeProps,
} from '../demo/src/components/dashboard/blueprintTokens.ts';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    const errMsg = `${message} - Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failures.push(errMsg);
    console.error(`  FAIL: ${errMsg}`);
  }
}

console.log('================================================================');
console.log('CHALLENGER M1: BLUEPRINT TOKENS ADVERSARIAL VERIFICATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: Valid Lane Mappings
// -----------------------------------------------------------------------------
console.log('--- Suite 1: Valid Lane Mappings ---');

assertEqual(getLaneIntent('offer'), 'success', "getLaneIntent('offer') -> 'success'");
assertEqual(getLaneIntent('interview'), 'primary', "getLaneIntent('interview') -> 'primary'");
assertEqual(getLaneIntent('assessment'), 'warning', "getLaneIntent('assessment') -> 'warning'");
assertEqual(getLaneIntent('rejected'), 'danger', "getLaneIntent('rejected') -> 'danger'");
assertEqual(getLaneIntent('review'), 'warning', "getLaneIntent('review') -> 'warning'");
assertEqual(getLaneIntent('applied'), 'none', "getLaneIntent('applied') -> 'none'");

// -----------------------------------------------------------------------------
// Suite 2: Adversarial & Unexpected Lane Inputs
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Adversarial & Unexpected Lane Inputs ---');

// Uppercase
assertEqual(getLaneIntent('OFFER'), 'success', "getLaneIntent('OFFER') -> 'success'");
assertEqual(getLaneIntent('INTERVIEW'), 'primary', "getLaneIntent('INTERVIEW') -> 'primary'");
assertEqual(getLaneIntent('ASSESSMENT'), 'warning', "getLaneIntent('ASSESSMENT') -> 'warning'");
assertEqual(getLaneIntent('REJECTED'), 'danger', "getLaneIntent('REJECTED') -> 'danger'");
assertEqual(getLaneIntent('REVIEW'), 'warning', "getLaneIntent('REVIEW') -> 'warning'");
assertEqual(getLaneIntent('APPLIED'), 'none', "getLaneIntent('APPLIED') -> 'none'");

// Mixed Case
assertEqual(getLaneIntent('InTerView'), 'primary', "getLaneIntent('InTerView') -> 'primary'");
assertEqual(getLaneIntent('oFfEr'), 'success', "getLaneIntent('oFfEr') -> 'success'");
assertEqual(getLaneIntent('AsSeSsMeNt'), 'warning', "getLaneIntent('AsSeSsMeNt') -> 'warning'");

// Whitespace Trimming
assertEqual(getLaneIntent('  offer  '), 'success', "getLaneIntent('  offer  ') -> 'success'");
assertEqual(getLaneIntent('\tinterview\n'), 'primary', "getLaneIntent('\\tinterview\\n') -> 'primary'");
assertEqual(getLaneIntent('   applied   '), 'none', "getLaneIntent('   applied   ') -> 'none'");

// Boundary / Empty / Unknown
assertEqual(getLaneIntent(''), 'none', "getLaneIntent('') -> 'none'");
assertEqual(getLaneIntent('   '), 'none', "getLaneIntent('   ') -> 'none'");
assertEqual(getLaneIntent('random_status'), 'none', "getLaneIntent('random_status') -> 'none'");
assertEqual(getLaneIntent('pending'), 'none', "getLaneIntent('pending') -> 'none'");
assertEqual(getLaneIntent('123'), 'none', "getLaneIntent('123') -> 'none'");
assertEqual(getLaneIntent('0'), 'none', "getLaneIntent('0') -> 'none'");
assertEqual(getLaneIntent('-1'), 'none', "getLaneIntent('-1') -> 'none'");
assertEqual(getLaneIntent('!@#$%^&*()'), 'none', "getLaneIntent('!@#$%^&*()') -> 'none'");
assertEqual(getLaneIntent('interview?'), 'none', "getLaneIntent('interview?') -> 'none'");
assertEqual(getLaneIntent('offer/accepted'), 'none', "getLaneIntent('offer/accepted') -> 'none'");
assertEqual(getLaneIntent('a'.repeat(500)), 'none', "getLaneIntent(500-char string) -> 'none'");
assertEqual(getLaneIntent('🎉 interview'), 'none', "getLaneIntent('🎉 interview') -> 'none'");

// -----------------------------------------------------------------------------
// Suite 3: Chip Intent Mappings
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Chip Intent Mappings ---');

// Standard valid chip kinds
assertEqual(getChipIntent('due'), 'warning', "getChipIntent('due') -> 'warning'");
assertEqual(getChipIntent('warn'), 'warning', "getChipIntent('warn') -> 'warning'");
assertEqual(getChipIntent('info'), 'primary', "getChipIntent('info') -> 'primary'");
assertEqual(getChipIntent('closed'), 'danger', "getChipIntent('closed') -> 'danger'");
assertEqual(getChipIntent('wait'), 'none', "getChipIntent('wait') -> 'none'");

// Adversarial chip inputs
assertEqual(getChipIntent('DUE'), 'warning', "getChipIntent('DUE') -> 'warning'");
assertEqual(getChipIntent('WARN'), 'warning', "getChipIntent('WARN') -> 'warning'");
assertEqual(getChipIntent('INFO'), 'primary', "getChipIntent('INFO') -> 'primary'");
assertEqual(getChipIntent('CLOSED'), 'danger', "getChipIntent('CLOSED') -> 'danger'");
assertEqual(getChipIntent('WAIT'), 'none', "getChipIntent('WAIT') -> 'none'");
assertEqual(getChipIntent('  due  '), 'warning', "getChipIntent('  due  ') -> 'warning'");
assertEqual(getChipIntent('\tclosed\n'), 'danger', "getChipIntent('\\tclosed\\n') -> 'danger'");
assertEqual(getChipIntent(''), 'none', "getChipIntent('') -> 'none'");
assertEqual(getChipIntent('critical'), 'none', "getChipIntent('critical') -> 'none'");
assertEqual(getChipIntent('urgent'), 'none', "getChipIntent('urgent') -> 'none'");
assertEqual(getChipIntent('unknown'), 'none', "getChipIntent('unknown') -> 'none'");
assertEqual(getChipIntent('999'), 'none', "getChipIntent('999') -> 'none'");

// -----------------------------------------------------------------------------
// Suite 4: Stage Badge Props
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Stage Badge Props ---');

const standardStages = [
  { stage: 'applied', expectedLabel: 'Applied', expectedIntent: 'none', expectedBpClass: 'bp-intent-none', expectedIntentClass: 'intent-neutral' },
  { stage: 'assessment', expectedLabel: 'Assessment', expectedIntent: 'warning', expectedBpClass: 'bp-intent-warning', expectedIntentClass: 'intent-warning' },
  { stage: 'interview', expectedLabel: 'Interview', expectedIntent: 'primary', expectedBpClass: 'bp-intent-primary', expectedIntentClass: 'intent-primary' },
  { stage: 'offer', expectedLabel: 'Offer', expectedIntent: 'success', expectedBpClass: 'bp-intent-success', expectedIntentClass: 'intent-success' },
  { stage: 'rejected', expectedLabel: 'Rejected', expectedIntent: 'danger', expectedBpClass: 'bp-intent-danger', expectedIntentClass: 'intent-danger' },
  { stage: 'review', expectedLabel: 'Review', expectedIntent: 'warning', expectedBpClass: 'bp-intent-warning', expectedIntentClass: 'intent-warning' },
  { stage: 'other', expectedLabel: 'Other', expectedIntent: 'none', expectedBpClass: 'bp-intent-none', expectedIntentClass: 'intent-neutral' },
];

for (const tc of standardStages) {
  const props = getStageBadgeProps(tc.stage);
  assertEqual(props.stage, tc.stage, `getStageBadgeProps('${tc.stage}').stage`);
  assertEqual(props.label, tc.expectedLabel, `getStageBadgeProps('${tc.stage}').label`);
  assertEqual(props.intent, tc.expectedIntent, `getStageBadgeProps('${tc.stage}').intent`);
  assert(props.className.includes('bp-tag'), `getStageBadgeProps('${tc.stage}').className includes 'bp-tag'`);
  assert(props.className.includes('bp-round'), `getStageBadgeProps('${tc.stage}').className includes 'bp-round'`);
  assert(props.className.includes(tc.expectedBpClass), `getStageBadgeProps('${tc.stage}').className includes '${tc.expectedBpClass}'`);
  assert(props.className.includes(tc.expectedIntentClass), `getStageBadgeProps('${tc.stage}').className includes '${tc.expectedIntentClass}'`);
  assert(typeof props.style === 'object' && props.style !== null, `getStageBadgeProps('${tc.stage}').style is object`);
  assert(typeof props.style.backgroundColor === 'string' && props.style.backgroundColor.length > 0, `getStageBadgeProps('${tc.stage}').style.backgroundColor is valid`);
  assert(typeof props.style.color === 'string' && props.style.color.length > 0, `getStageBadgeProps('${tc.stage}').style.color is valid`);
  assert(typeof props.style.borderColor === 'string' && props.style.borderColor.length > 0, `getStageBadgeProps('${tc.stage}').style.borderColor is valid`);
}

// Adversarial stage inputs for getStageBadgeProps
console.log('\n--- Suite 4b: getStageBadgeProps Adversarial Inputs ---');

// Empty string
const emptyProps = getStageBadgeProps('');
assertEqual(emptyProps.stage, '', "getStageBadgeProps('').stage is ''");
assertEqual(emptyProps.label, '—', "getStageBadgeProps('').label falls back to em-dash '—'");
assertEqual(emptyProps.intent, 'none', "getStageBadgeProps('').intent is 'none'");
assert(emptyProps.className.includes('intent-neutral'), "getStageBadgeProps('').className includes 'intent-neutral'");
assert(emptyProps.className.includes('bp-intent-none'), "getStageBadgeProps('').className includes 'bp-intent-none'");

// Whitespace string
const wsProps = getStageBadgeProps('   ');
assertEqual(wsProps.stage, '', "getStageBadgeProps('   ').stage is ''");
assertEqual(wsProps.label, '—', "getStageBadgeProps('   ').label is '—'");
assertEqual(wsProps.intent, 'none', "getStageBadgeProps('   ').intent is 'none'");

// Uppercase
const upperProps = getStageBadgeProps('INTERVIEW');
assertEqual(upperProps.stage, 'interview', "getStageBadgeProps('INTERVIEW').stage normalized");
assertEqual(upperProps.label, 'Interview', "getStageBadgeProps('INTERVIEW').label is 'Interview'");
assertEqual(upperProps.intent, 'primary', "getStageBadgeProps('INTERVIEW').intent is 'primary'");

// Whitespace around valid stage
const wsOfferProps = getStageBadgeProps('  offer  ');
assertEqual(wsOfferProps.stage, 'offer', "getStageBadgeProps('  offer  ').stage normalized");
assertEqual(wsOfferProps.label, 'Offer', "getStageBadgeProps('  offer  ').label is 'Offer'");
assertEqual(wsOfferProps.intent, 'success', "getStageBadgeProps('  offer  ').intent is 'success'");

// Unknown arbitrary stage
const customProps = getStageBadgeProps('custom_stage');
assertEqual(customProps.stage, 'custom_stage', "getStageBadgeProps('custom_stage').stage is 'custom_stage'");
assertEqual(customProps.label, 'Custom_stage', "getStageBadgeProps('custom_stage').label auto-capitalizes");
assertEqual(customProps.intent, 'none', "getStageBadgeProps('custom_stage').intent is 'none'");

// Numeric string
const numProps = getStageBadgeProps('404');
assertEqual(numProps.stage, '404', "getStageBadgeProps('404').stage is '404'");
assertEqual(numProps.label, '404', "getStageBadgeProps('404').label is '404'");
assertEqual(numProps.intent, 'none', "getStageBadgeProps('404').intent is 'none'");

// -----------------------------------------------------------------------------
// Suite 5: Intent Colors
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Intent Colors ---');

const intents = ['primary', 'success', 'warning', 'danger', 'none'];

for (const intent of intents) {
  const colors = getIntentColors(intent);
  assert(typeof colors === 'object' && colors !== null, `getIntentColors('${intent}') returns non-null object`);
  assert(typeof colors.solid === 'string' && colors.solid.startsWith('#'), `getIntentColors('${intent}').solid is valid hex: ${colors.solid}`);
  assert(typeof colors.hover === 'string' && colors.hover.startsWith('#'), `getIntentColors('${intent}').hover is valid hex: ${colors.hover}`);
  assert(typeof colors.bg === 'string' && colors.bg.startsWith('#'), `getIntentColors('${intent}').bg is valid hex: ${colors.bg}`);
  assert(typeof colors.text === 'string' && colors.text.startsWith('#'), `getIntentColors('${intent}').text is valid hex: ${colors.text}`);
  assert(typeof colors.border === 'string' && colors.border.startsWith('#'), `getIntentColors('${intent}').border is valid hex: ${colors.border}`);
}

// Exact Blueprint color values
assertEqual(BLUEPRINT_INTENTS.primary.solid, '#106ba3', "BLUEPRINT_INTENTS.primary.solid is Cobalt '#106ba3'");
assertEqual(BLUEPRINT_INTENTS.success.solid, '#0d8050', "BLUEPRINT_INTENTS.success.solid is Green '#0d8050'");
assertEqual(BLUEPRINT_INTENTS.warning.solid, '#bf7300', "BLUEPRINT_INTENTS.warning.solid is Orange '#bf7300'");
assertEqual(BLUEPRINT_INTENTS.danger.solid, '#c23030', "BLUEPRINT_INTENTS.danger.solid is Crimson '#c23030'");
assertEqual(BLUEPRINT_NEUTRAL.text, '#182026', "BLUEPRINT_NEUTRAL.text is slateDark '#182026'");

// -----------------------------------------------------------------------------
// Suite 6: STAGE_INTENT_BORDER_COLOR Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Suite 6: STAGE_INTENT_BORDER_COLOR Integrity ---');

const requiredBorderStages = ['applied', 'assessment', 'interview', 'offer', 'rejected', 'review'];
for (const stage of requiredBorderStages) {
  assert(Boolean(STAGE_INTENT_BORDER_COLOR[stage]), `STAGE_INTENT_BORDER_COLOR['${stage}'] exists`);
  assert(STAGE_INTENT_BORDER_COLOR[stage].startsWith('#'), `STAGE_INTENT_BORDER_COLOR['${stage}'] is hex color`);
}

assertEqual(STAGE_INTENT_BORDER_COLOR.applied, BLUEPRINT_COLORS.slateDisabled, 'STAGE_INTENT_BORDER_COLOR.applied matches slateDisabled');
assertEqual(STAGE_INTENT_BORDER_COLOR.assessment, BLUEPRINT_COLORS.orange, 'STAGE_INTENT_BORDER_COLOR.assessment matches orange');
assertEqual(STAGE_INTENT_BORDER_COLOR.interview, BLUEPRINT_COLORS.cobalt, 'STAGE_INTENT_BORDER_COLOR.interview matches cobalt');
assertEqual(STAGE_INTENT_BORDER_COLOR.offer, BLUEPRINT_COLORS.green, 'STAGE_INTENT_BORDER_COLOR.offer matches green');
assertEqual(STAGE_INTENT_BORDER_COLOR.rejected, BLUEPRINT_COLORS.red, 'STAGE_INTENT_BORDER_COLOR.rejected matches red');
assertEqual(STAGE_INTENT_BORDER_COLOR.review, BLUEPRINT_COLORS.orange, 'STAGE_INTENT_BORDER_COLOR.review matches orange');

// -----------------------------------------------------------------------------
// Suite 7: Typography & Class Token Constants
// -----------------------------------------------------------------------------
console.log('\n--- Suite 7: Typography & Class Token Constants ---');

assertEqual(BLUEPRINT_TYPOGRAPHY.tabularNumsStyle.fontVariantNumeric, 'tabular-nums', 'tabularNumsStyle.fontVariantNumeric is tabular-nums');
assertEqual(TABULAR_NUMS_CLASS, 'bp-tabular-nums num', 'TABULAR_NUMS_CLASS is bp-tabular-nums num');

const expectedClassKeys = [
  'DASHBOARD', 'SURFACE', 'SECTION_CARD', 'CARD',
  'ELEVATION_0', 'ELEVATION_1', 'ELEVATION_2', 'ELEVATION_3', 'ELEVATION_4',
  'NAVBAR', 'NAVBAR_TITLE_GROUP', 'NAVBAR_DIVIDER', 'NAVBAR_ACTIONS',
  'METRICS_GRID', 'METRIC_CARD', 'METRIC_VALUE', 'METRIC_LABEL', 'METRIC_NOTE',
  'TABLE_CONTAINER', 'HTML_TABLE', 'TABLE_ROW', 'ROW_SELECTED', 'ROW_FOCUSED', 'TABLE_PAGINATION',
  'TAG', 'TAG_ROUND', 'KEYCAP',
  'BUTTON', 'BUTTON_PRIMARY', 'BUTTON_MINIMAL', 'BUTTON_GROUP', 'BUTTON_ACTIVE',
  'DRAWER_BACKDROP', 'DRAWER', 'DRAWER_HEADER', 'DRAWER_BODY', 'DRAWER_FOOTER', 'DIALOG',
  'TABULAR_NUMS', 'TEXT_MUTED', 'TEXT_DARK',
];

for (const key of expectedClassKeys) {
  assert(Boolean(BLUEPRINT_CLASSES[key]), `BLUEPRINT_CLASSES.${key} is defined`);
  assert(typeof BLUEPRINT_CLASSES[key] === 'string' && BLUEPRINT_CLASSES[key].length > 0, `BLUEPRINT_CLASSES.${key} is non-empty string`);
}

// -----------------------------------------------------------------------------
// Suite 8: High-Throughput Fuzz & Stress Testing
// -----------------------------------------------------------------------------
console.log('\n--- Suite 8: High-Throughput Fuzz & Stress Testing ---');

const fuzzInputs = [
  '', '   ', 'INTERVIEW', 'offer', 'APPLIED', 'reJecTed', 'assessment', 'review',
  'due', 'WARN', 'info', 'CLOSED', 'wait', 'unknown', '12345', '!@#$',
  'null', 'undefined', 'NaN', '0', '-1', 'true', 'false', '   \t\n   ',
];

const startFuzz = performance.now();
const FUZZ_ITERATIONS = 20_000;

for (let i = 0; i < FUZZ_ITERATIONS; i++) {
  const input = fuzzInputs[i % fuzzInputs.length];
  // 1. getLaneIntent stress
  const laneIntent = getLaneIntent(input);
  if (!['primary', 'success', 'warning', 'danger', 'none'].includes(laneIntent)) {
    throw new Error(`Fuzz failure in getLaneIntent with input: ${input}`);
  }

  // 2. getChipIntent stress
  const chipIntent = getChipIntent(input);
  if (!['primary', 'success', 'warning', 'danger', 'none'].includes(chipIntent)) {
    throw new Error(`Fuzz failure in getChipIntent with input: ${input}`);
  }

  // 3. getStageBadgeProps stress
  const badgeProps = getStageBadgeProps(input);
  if (!badgeProps.label || !badgeProps.className || !badgeProps.style) {
    throw new Error(`Fuzz failure in getStageBadgeProps with input: ${input}`);
  }

  // 4. getIntentColors stress
  const intentColors = getIntentColors(laneIntent);
  if (!intentColors.solid || !intentColors.bg || !intentColors.border) {
    throw new Error(`Fuzz failure in getIntentColors with intent: ${laneIntent}`);
  }
}

const elapsedFuzz = performance.now() - startFuzz;
console.log(`  Executed ${FUZZ_ITERATIONS * 4} token calls in ${elapsedFuzz.toFixed(2)}ms (${((FUZZ_ITERATIONS * 4) / (elapsedFuzz / 1000)).toFixed(0)} ops/sec)`);
assert(elapsedFuzz < 1000, `High throughput fuzz completed in under 1000ms (took ${elapsedFuzz.toFixed(2)}ms)`);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  console.error(`Verification FAILED with ${failed} failure(s):`);
  failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED EMPIRICALLY! ZERO REGRESSIONS FOUND.');
  process.exit(0);
}
