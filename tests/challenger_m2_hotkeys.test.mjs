/**
 * ============================================================================
 * CHALLENGER M2: KEYBOARD NAVIGATION & HOTKEY ENGINE EMPIRICAL STRESS SUITE
 * Targets: demo/src/components/dashboard/useTrackerHotkeys.ts
 *          demo/src/components/dashboard/ApplicationTable.tsx
 *
 * Verifies:
 * 1. Dispatch across all valid keys (j, k, ArrowDown, ArrowUp, Enter, Space,
 *    o, [, ], p, n, /, ?, Shift+/, 1–5, i, r, 0, u, t, Home, End, Escape)
 *    and unmapped key rejection.
 * 2. Boundary clamping: j/ArrowDown at last row stays at last row;
 *    k/ArrowUp at index 0 stays at 0; Home/End jumps to boundaries.
 * 3. Total rows = 0 edge case: does not throw, does not set negative index,
 *    safe fallback defaults, out-of-bounds index resilience.
 * 4. Modifier guard: ctrlKey, metaKey, altKey return handled: false, modifierActive: true
 *    without triggering callbacks or preventDefault.
 * 5. Input guard: simulated events with target tagName 'INPUT', 'TEXTAREA', 'SELECT',
 *    and isContentEditable: true suppress single-key hotkeys, but Escape blurs and preventDefaults.
 * 6. Escape priority stack: exhaustive verification of 8 state combinations
 *    (Shortcuts -> Drawer -> Timeline -> Selection clear).
 * 7. Rapid sequence fuzzing: 10,000+ randomized keystrokes verifying zero exceptions,
 *    invariants maintenance, and high throughput.
 * 8. ApplicationTable structural & keyboard ergonomics verification.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dispatchTrackerHotkey } from '../demo/src/components/dashboard/useTrackerHotkeys.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

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

function createMockEvent(key, overrides = {}) {
  let defaultPrevented = false;
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
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

console.log('================================================================');
console.log('CHALLENGER M2: KEYBOARD NAVIGATION & HOTKEY ENGINE EMPIRICAL SUITE');
console.log('================================================================\n');

const suiteStartTime = performance.now();

// -----------------------------------------------------------------------------
// Suite 1: Exhaustive Hotkey Mapping & Action Verification
// -----------------------------------------------------------------------------
console.log('--- Suite 1: Exhaustive Hotkey Mapping & Action Verification ---');

{
  let selectedIdx = null;
  let inspectedIdx = null;
  let triagedStage = null;
  let searchFocused = false;
  let shortcutsToggled = false;
  let timelineToggled = false;
  let nextPaged = false;
  let prevPaged = false;
  let dismissed = false;

  const baseOptions = {
    activeRowIndex: 2,
    totalRows: 10,
    onSelectRow: (idx) => { selectedIdx = idx; },
    onInspectRow: (idx) => { inspectedIdx = idx; },
    onTriageStatus: (stage) => { triagedStage = stage; },
    onFocusSearch: () => { searchFocused = true; },
    onToggleShortcuts: () => { shortcutsToggled = true; },
    onToggleTimeline: () => { timelineToggled = true; },
    onNextPage: () => { nextPaged = true; },
    onPrevPage: () => { prevPaged = true; },
    onDismiss: () => { dismissed = true; },
    isDrawerOpen: false,
    isShortcutsOpen: false,
    isTimelineOpen: false,
  };

  function resetTrackers() {
    selectedIdx = null;
    inspectedIdx = null;
    triagedStage = null;
    searchFocused = false;
    shortcutsToggled = false;
    timelineToggled = false;
    nextPaged = false;
    prevPaged = false;
    dismissed = false;
  }

  // 1. Navigation keys
  resetTrackers();
  let ev = createMockEvent('j');
  let res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.handled, true, 'Hotkey "j" handled flag');
  assertEqual(res.action, 'nav_down', 'Hotkey "j" action');
  assertEqual(res.nextIndex, 3, 'Hotkey "j" nextIndex');
  assertEqual(selectedIdx, 3, 'Hotkey "j" onSelectRow callback');
  assertEqual(ev.isDefaultPrevented, true, 'Hotkey "j" preventDefault');

  resetTrackers();
  ev = createMockEvent('ArrowDown');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.handled, true, 'Hotkey "ArrowDown" handled flag');
  assertEqual(res.action, 'nav_down', 'Hotkey "ArrowDown" action');
  assertEqual(res.nextIndex, 3, 'Hotkey "ArrowDown" nextIndex');
  assertEqual(selectedIdx, 3, 'Hotkey "ArrowDown" onSelectRow callback');

  resetTrackers();
  ev = createMockEvent('k');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.handled, true, 'Hotkey "k" handled flag');
  assertEqual(res.action, 'nav_up', 'Hotkey "k" action');
  assertEqual(res.prevIndex, 1, 'Hotkey "k" prevIndex');
  assertEqual(selectedIdx, 1, 'Hotkey "k" onSelectRow callback');
  assertEqual(ev.isDefaultPrevented, true, 'Hotkey "k" preventDefault');

  resetTrackers();
  ev = createMockEvent('ArrowUp');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.handled, true, 'Hotkey "ArrowUp" handled flag');
  assertEqual(res.action, 'nav_up', 'Hotkey "ArrowUp" action');
  assertEqual(res.prevIndex, 1, 'Hotkey "ArrowUp" prevIndex');
  assertEqual(selectedIdx, 1, 'Hotkey "ArrowUp" onSelectRow callback');

  resetTrackers();
  ev = createMockEvent('Home');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'nav_home', 'Hotkey "Home" action');
  assertEqual(res.nextIndex, 0, 'Hotkey "Home" nextIndex');
  assertEqual(selectedIdx, 0, 'Hotkey "Home" onSelectRow callback');

  resetTrackers();
  ev = createMockEvent('End');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'nav_end', 'Hotkey "End" action');
  assertEqual(res.nextIndex, 9, 'Hotkey "End" nextIndex');
  assertEqual(selectedIdx, 9, 'Hotkey "End" onSelectRow callback');

  // 2. Inspection keys
  resetTrackers();
  ev = createMockEvent('Enter');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'inspect_row', 'Hotkey "Enter" action');
  assertEqual(res.index, 2, 'Hotkey "Enter" index');
  assertEqual(inspectedIdx, 2, 'Hotkey "Enter" onInspectRow callback');
  assertEqual(ev.isDefaultPrevented, true, 'Hotkey "Enter" preventDefault');

  resetTrackers();
  ev = createMockEvent(' ');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'inspect_row', 'Hotkey "Space" action');
  assertEqual(res.index, 2, 'Hotkey "Space" index');
  assertEqual(inspectedIdx, 2, 'Hotkey "Space" onInspectRow callback');

  resetTrackers();
  ev = createMockEvent('o');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'inspect_row', 'Hotkey "o" action');
  assertEqual(res.index, 2, 'Hotkey "o" index');
  assertEqual(inspectedIdx, 2, 'Hotkey "o" onInspectRow callback');

  // 3. Pagination keys
  resetTrackers();
  ev = createMockEvent(']');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'next_page', 'Hotkey "]" action');
  assertEqual(nextPaged, true, 'Hotkey "]" onNextPage callback');

  resetTrackers();
  ev = createMockEvent('n');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'next_page', 'Hotkey "n" action');
  assertEqual(nextPaged, true, 'Hotkey "n" onNextPage callback');

  resetTrackers();
  ev = createMockEvent('[');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'prev_page', 'Hotkey "[" action');
  assertEqual(prevPaged, true, 'Hotkey "[" onPrevPage callback');

  resetTrackers();
  ev = createMockEvent('p');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'prev_page', 'Hotkey "p" action');
  assertEqual(prevPaged, true, 'Hotkey "p" onPrevPage callback');

  // 4. Search and Cheat Sheet
  resetTrackers();
  ev = createMockEvent('/');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'focus_search', 'Hotkey "/" action');
  assertEqual(searchFocused, true, 'Hotkey "/" onFocusSearch callback');

  resetTrackers();
  ev = createMockEvent('?');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'toggle_shortcuts', 'Hotkey "?" action');
  assertEqual(shortcutsToggled, true, 'Hotkey "?" onToggleShortcuts callback');

  resetTrackers();
  ev = createMockEvent('/', { shiftKey: true });
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'toggle_shortcuts', 'Hotkey "Shift+/" action');
  assertEqual(shortcutsToggled, true, 'Hotkey "Shift+/" onToggleShortcuts callback');

  // 5. Timeline toggle
  resetTrackers();
  ev = createMockEvent('t');
  res = dispatchTrackerHotkey(baseOptions, ev);
  assertEqual(res.action, 'toggle_timeline', 'Hotkey "t" action');
  assertEqual(timelineToggled, true, 'Hotkey "t" onToggleTimeline callback');

  // 6. Quick Status Triage keys
  const expectedTriage = [
    { key: '1', stage: 'applied' },
    { key: '2', stage: 'assessment' },
    { key: '3', stage: 'interview' },
    { key: 'i', stage: 'interview' },
    { key: '4', stage: 'offer' },
    { key: '5', stage: 'rejected' },
    { key: 'r', stage: 'rejected' },
    { key: '0', stage: 'reset' },
    { key: 'u', stage: 'reset' },
  ];

  for (const item of expectedTriage) {
    resetTrackers();
    ev = createMockEvent(item.key);
    res = dispatchTrackerHotkey(baseOptions, ev);
    assertEqual(res.handled, true, `Triage key "${item.key}" handled flag`);
    assertEqual(res.action, 'triage_status', `Triage key "${item.key}" action`);
    assertEqual(res.stage, item.stage, `Triage key "${item.key}" mapped stage`);
    assertEqual(triagedStage, item.stage, `Triage key "${item.key}" onTriageStatus callback`);
    assertEqual(ev.isDefaultPrevented, true, `Triage key "${item.key}" preventDefault`);
  }

  // 7. Unmapped keys rejection
  const unmappedKeys = ['a', 'b', 'c', 'e', 'f', 'g', 'h', 'm', 'q', 's', 'v', 'w', 'x', 'y', 'z', 'F1', 'Tab', 'Backspace', 'Delete', 'PageUp', 'PageDown', 'Control', 'Shift', 'Alt'];
  for (const key of unmappedKeys) {
    resetTrackers();
    ev = createMockEvent(key);
    res = dispatchTrackerHotkey(baseOptions, ev);
    assertEqual(res.handled, false, `Unmapped key "${key}" handled must be false`);
    assertEqual(res.action, 'unmapped_key', `Unmapped key "${key}" action must be unmapped_key`);
    assertEqual(ev.isDefaultPrevented, false, `Unmapped key "${key}" must NOT preventDefault`);
  }
}

// -----------------------------------------------------------------------------
// Suite 2: Boundary Clamping & Navigation Limits
// -----------------------------------------------------------------------------
console.log('--- Suite 2: Boundary Clamping & Navigation Limits ---');

{
  let selected = 0;
  const testOptions = (active, total) => ({
    activeRowIndex: active,
    totalRows: total,
    onSelectRow: (idx) => { selected = idx; },
  });

  // Clamping at bottom boundary (last row stays at last row)
  for (const total of [1, 2, 5, 12, 50, 100]) {
    const last = total - 1;
    selected = -999;
    const resJ = dispatchTrackerHotkey(testOptions(last, total), createMockEvent('j'));
    assertEqual(resJ.nextIndex, last, `Bottom boundary j clamp for totalRows=${total}`);
    assertEqual(selected, last, `Bottom boundary j selected callback for totalRows=${total}`);

    selected = -999;
    const resDown = dispatchTrackerHotkey(testOptions(last, total), createMockEvent('ArrowDown'));
    assertEqual(resDown.nextIndex, last, `Bottom boundary ArrowDown clamp for totalRows=${total}`);
    assertEqual(selected, last, `Bottom boundary ArrowDown selected callback for totalRows=${total}`);
  }

  // Clamping at top boundary (row 0 stays at 0)
  for (const total of [1, 2, 5, 12, 50, 100]) {
    selected = -999;
    const resK = dispatchTrackerHotkey(testOptions(0, total), createMockEvent('k'));
    assertEqual(resK.prevIndex, 0, `Top boundary k clamp for totalRows=${total}`);
    assertEqual(selected, 0, `Top boundary k selected callback for totalRows=${total}`);

    selected = -999;
    const resUp = dispatchTrackerHotkey(testOptions(0, total), createMockEvent('ArrowUp'));
    assertEqual(resUp.prevIndex, 0, `Top boundary ArrowUp clamp for totalRows=${total}`);
    assertEqual(selected, 0, `Top boundary ArrowUp selected callback for totalRows=${total}`);
  }

  // Repeated 50 down presses from last row stay clamped
  let currentActive = 11;
  const total = 12;
  for (let i = 0; i < 50; i++) {
    const res = dispatchTrackerHotkey(testOptions(currentActive, total), createMockEvent('j'));
    currentActive = res.nextIndex;
    assert(currentActive === 11, `Repeated j press ${i + 1} stays clamped at index 11`);
  }

  // Repeated 50 up presses from row 0 stay clamped
  currentActive = 0;
  for (let i = 0; i < 50; i++) {
    const res = dispatchTrackerHotkey(testOptions(currentActive, total), createMockEvent('k'));
    currentActive = res.prevIndex;
    assert(currentActive === 0, `Repeated k press ${i + 1} stays clamped at index 0`);
  }

  // Home key from intermediate or last row jumps directly to 0
  for (const startIdx of [1, 5, 11]) {
    const res = dispatchTrackerHotkey(testOptions(startIdx, 12), createMockEvent('Home'));
    assertEqual(res.nextIndex, 0, `Home key from index ${startIdx} jumps to 0`);
  }

  // End key from intermediate or first row jumps directly to totalRows - 1
  for (const startIdx of [0, 4, 10]) {
    const res = dispatchTrackerHotkey(testOptions(startIdx, 12), createMockEvent('End'));
    assertEqual(res.nextIndex, 11, `End key from index ${startIdx} jumps to 11`);
  }
}

// -----------------------------------------------------------------------------
// Suite 3: Total Rows = 0 Edge Case & Malformed State Resilience
// -----------------------------------------------------------------------------
console.log('--- Suite 3: Total Rows = 0 Edge Case & Malformed State Resilience ---');

{
  let selectCalled = false;
  let inspectCalled = false;
  let triageCalled = false;

  const zeroRowsOptions = {
    activeRowIndex: 0,
    totalRows: 0,
    onSelectRow: () => { selectCalled = true; },
    onInspectRow: () => { inspectCalled = true; },
    onTriageStatus: () => { triageCalled = true; },
  };

  function resetZeroTrackers() {
    selectCalled = false;
    inspectCalled = false;
    triageCalled = false;
  }

  // Navigation on totalRows = 0
  const navKeys = ['j', 'k', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
  for (const key of navKeys) {
    resetZeroTrackers();
    let res;
    let threw = false;
    try {
      res = dispatchTrackerHotkey(zeroRowsOptions, createMockEvent(key));
    } catch (e) {
      threw = true;
    }
    assertEqual(threw, false, `Hotkey "${key}" does not throw on totalRows=0`);
    assertEqual(res.action, 'navigate_noop', `Hotkey "${key}" returns navigate_noop on totalRows=0`);
    assertEqual(selectCalled, false, `Hotkey "${key}" does NOT call onSelectRow on totalRows=0`);
  }

  // Inspection on totalRows = 0
  const inspectKeys = ['Enter', ' ', 'o'];
  for (const key of inspectKeys) {
    resetZeroTrackers();
    let res;
    let threw = false;
    try {
      res = dispatchTrackerHotkey(zeroRowsOptions, createMockEvent(key));
    } catch (e) {
      threw = true;
    }
    assertEqual(threw, false, `Inspect key "${key}" does not throw on totalRows=0`);
    assertEqual(res.action, 'inspect_noop', `Inspect key "${key}" returns inspect_noop on totalRows=0`);
    assertEqual(inspectCalled, false, `Inspect key "${key}" does NOT call onInspectRow on totalRows=0`);
  }

  // Triage on totalRows = 0
  const triageKeys = ['1', '2', '3', '4', '5', 'i', 'r', '0', 'u'];
  for (const key of triageKeys) {
    resetZeroTrackers();
    let res;
    let threw = false;
    try {
      res = dispatchTrackerHotkey(zeroRowsOptions, createMockEvent(key));
    } catch (e) {
      threw = true;
    }
    assertEqual(threw, false, `Triage key "${key}" does not throw on totalRows=0`);
    assertEqual(res.action, 'triage_noop', `Triage key "${key}" returns triage_noop on totalRows=0`);
    assertEqual(triageCalled, false, `Triage key "${key}" does NOT call onTriageStatus on totalRows=0`);
  }

  // Negative totalRows resilience (e.g. totalRows = -5)
  const negRowsOptions = {
    activeRowIndex: 0,
    totalRows: -5,
    onSelectRow: () => { selectCalled = true; },
  };
  resetZeroTrackers();
  const resNeg = dispatchTrackerHotkey(negRowsOptions, createMockEvent('j'));
  assertEqual(resNeg.action, 'navigate_noop', 'Negative totalRows gracefully returns navigate_noop');
  assertEqual(selectCalled, false, 'Negative totalRows does NOT call onSelectRow');

  // Out of bounds activeRowIndex (e.g. activeRowIndex = 999 with totalRows = 5)
  const outOfBoundsOptions = {
    activeRowIndex: 999,
    totalRows: 5,
    onInspectRow: () => { inspectCalled = true; },
    onTriageStatus: () => { triageCalled = true; },
  };
  resetZeroTrackers();
  const resOobInspect = dispatchTrackerHotkey(outOfBoundsOptions, createMockEvent('Enter'));
  assertEqual(resOobInspect.action, 'inspect_noop', 'Out of bounds activeRowIndex returns inspect_noop');
  assertEqual(inspectCalled, false, 'Out of bounds activeRowIndex does NOT call onInspectRow');

  resetZeroTrackers();
  const resOobTriage = dispatchTrackerHotkey(outOfBoundsOptions, createMockEvent('1'));
  assertEqual(resOobTriage.action, 'triage_noop', 'Out of bounds activeRowIndex returns triage_noop');
  assertEqual(triageCalled, false, 'Out of bounds activeRowIndex does NOT call onTriageStatus');

  // Empty options object resilience (testing default parameter fallbacks)
  let threwDefaults = false;
  try {
    const resDef = dispatchTrackerHotkey({}, createMockEvent('j'));
    assertEqual(resDef.action, 'navigate_noop', 'Empty options default fallback handles j gracefully');
  } catch (err) {
    threwDefaults = true;
  }
  assertEqual(threwDefaults, false, 'dispatchTrackerHotkey does not throw on empty options object');
}

// -----------------------------------------------------------------------------
// Suite 4: Modifier Guard Verification (ctrlKey, metaKey, altKey)
// -----------------------------------------------------------------------------
console.log('--- Suite 4: Modifier Guard Verification (ctrlKey, metaKey, altKey) ---');

{
  let actionTriggered = false;
  const guardedOptions = {
    activeRowIndex: 1,
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
    isDrawerOpen: true,
  };

  const testModifiers = [
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { ctrlKey: true, altKey: true },
    { metaKey: true, altKey: true },
    { ctrlKey: true, metaKey: true },
  ];

  const keysToTest = ['j', 'k', 'Enter', ' ', '1', '2', '3', 'i', 'r', '0', 'u', '/', '?', 't', '[', ']', 'Escape', 'Home', 'End'];

  for (const mod of testModifiers) {
    const modName = Object.keys(mod).join('+');
    for (const key of keysToTest) {
      actionTriggered = false;
      const ev = createMockEvent(key, mod);
      const res = dispatchTrackerHotkey(guardedOptions, ev);

      assertEqual(res.handled, false, `${modName} + "${key}" handled must be false`);
      assertEqual(res.modifierActive, true, `${modName} + "${key}" modifierActive must be true`);
      assertEqual(actionTriggered, false, `${modName} + "${key}" must NOT invoke any action callbacks`);
      assertEqual(ev.isDefaultPrevented, false, `${modName} + "${key}" must NOT call preventDefault`);
    }
  }

  // Crucial test: shiftKey ALONE must NOT trigger modifierActive!
  const shiftEv = createMockEvent('?', { shiftKey: true });
  actionTriggered = false;
  const resShift = dispatchTrackerHotkey(guardedOptions, shiftEv);
  assertEqual(resShift.handled, true, 'shiftKey alone must NOT be blocked by modifier guard');
  assertEqual(resShift.action, 'toggle_shortcuts', 'Shift+? correctly opens shortcuts modal');
}

// -----------------------------------------------------------------------------
// Suite 5: Input Guard Verification (INPUT, TEXTAREA, SELECT, contentEditable)
// -----------------------------------------------------------------------------
console.log('--- Suite 5: Input Guard Verification ---');

{
  let actionTriggered = false;
  const inputGuardOptions = {
    activeRowIndex: 0,
    totalRows: 10,
    onSelectRow: () => { actionTriggered = true; },
    onInspectRow: () => { actionTriggered = true; },
    onTriageStatus: () => { actionTriggered = true; },
    onFocusSearch: () => { actionTriggered = true; },
    onToggleShortcuts: () => { actionTriggered = true; },
    onToggleTimeline: () => { actionTriggered = true; },
    onNextPage: () => { actionTriggered = true; },
    onPrevPage: () => { actionTriggered = true; },
    onDismiss: () => { actionTriggered = true; },
    isDrawerOpen: true,
    isShortcutsOpen: true,
  };

  const editableElements = [
    { desc: '<input>', el: createMockElement('INPUT') },
    { desc: '<textarea>', el: createMockElement('TEXTAREA') },
    { desc: '<select>', el: createMockElement('SELECT') },
    { desc: '<div contenteditable="true">', el: createMockElement('DIV', true) },
  ];

  const singleKeysToTest = ['j', 'k', 'ArrowDown', 'ArrowUp', '1', '2', '3', 'i', 'r', '0', 'u', '/', '?', 't', '[', ']', 'Enter', ' ', 'o', 'Home', 'End'];

  for (const { desc, el } of editableElements) {
    for (const key of singleKeysToTest) {
      actionTriggered = false;
      const ev = createMockEvent(key, { target: el });
      const res = dispatchTrackerHotkey(inputGuardOptions, ev);

      assertEqual(res.handled, false, `${desc} typing "${key}" handled must be false`);
      assertEqual(res.suppressedByInputGuard, true, `${desc} typing "${key}" suppressedByInputGuard must be true`);
      assertEqual(actionTriggered, false, `${desc} typing "${key}" must NOT trigger hotkey action`);
      assertEqual(ev.isDefaultPrevented, false, `${desc} typing "${key}" must NOT call preventDefault`);
    }

    // Escape while focused inside an input element MUST blur and preventDefault, but NOT close modals
    actionTriggered = false;
    const escapeEv = createMockEvent('Escape', { target: el });
    const escapeRes = dispatchTrackerHotkey(inputGuardOptions, escapeEv);

    assertEqual(escapeRes.handled, false, `${desc} pressing Escape handled must be false`);
    assertEqual(escapeRes.suppressedByInputGuard, true, `${desc} pressing Escape suppressedByInputGuard must be true`);
    assertEqual(el.isBlurred, true, `${desc} pressing Escape MUST blur target element`);
    assertEqual(escapeEv.isDefaultPrevented, true, `${desc} pressing Escape MUST call preventDefault`);
    assertEqual(actionTriggered, false, `${desc} pressing Escape must NOT trigger shortcuts or drawer close`);
  }

  // Non-editable elements (e.g. <div>, <table>, <tr>, <body>) must NOT trigger Input Guard
  const nonEditableEl = createMockElement('DIV', false);
  actionTriggered = false;
  const resDiv = dispatchTrackerHotkey(inputGuardOptions, createMockEvent('j', { target: nonEditableEl }));
  assertEqual(resDiv.handled, true, 'Non-editable <div> must dispatch hotkeys normally');
  assertEqual(resDiv.action, 'nav_down', 'Non-editable <div> performs nav_down');
  assertEqual(actionTriggered, true, 'Non-editable <div> triggers onSelectRow callback');

  // Target element without blur() or preventDefault() does not throw TypeError
  const plainTarget = { tagName: 'INPUT' };
  let threwNullBlur = false;
  try {
    const resNoBlur = dispatchTrackerHotkey(inputGuardOptions, { key: 'Escape', target: plainTarget });
    assertEqual(resNoBlur.suppressedByInputGuard, true, 'Target without blur method handles Escape safely');
  } catch (e) {
    threwNullBlur = true;
  }
  assertEqual(threwNullBlur, false, 'Target without blur method does not throw');
}

// -----------------------------------------------------------------------------
// Suite 6: Escape Priority Dismissal Stack Hierarchy
// -----------------------------------------------------------------------------
console.log('--- Suite 6: Escape Priority Dismissal Stack Hierarchy ---');

{
  let shortcutsClosed = 0;
  let drawerClosed = 0;
  let timelineClosed = 0;
  let selectionCleared = 0;

  function makeEscapeOptions(isShortcuts, isDrawer, isTimeline) {
    return {
      activeRowIndex: 3,
      totalRows: 10,
      isShortcutsOpen: isShortcuts,
      isDrawerOpen: isDrawer,
      isTimelineOpen: isTimeline,
      onToggleShortcuts: () => { shortcutsClosed++; },
      onDismiss: () => {
        if (isDrawer) {
          drawerClosed++;
        } else {
          selectionCleared++;
        }
      },
      onToggleTimeline: () => { timelineClosed++; },
    };
  }

  function resetEscapeCounts() {
    shortcutsClosed = 0;
    drawerClosed = 0;
    timelineClosed = 0;
    selectionCleared = 0;
  }

  // Test full sequential cascade from all open down to clear selection
  // Step 1: All 3 open -> Shortcuts closes first
  resetEscapeCounts();
  let ev = createMockEvent('Escape');
  let res = dispatchTrackerHotkey(makeEscapeOptions(true, true, true), ev);
  assertEqual(res.handled, true, 'Escape with all open handled flag');
  assertEqual(res.action, 'close_shortcuts', 'Priority 1: Shortcuts closes first');
  assertEqual(shortcutsClosed, 1, 'onToggleShortcuts called exactly once');
  assertEqual(drawerClosed, 0, 'Drawer not closed when shortcuts open');
  assertEqual(timelineClosed, 0, 'Timeline not closed when shortcuts open');
  assertEqual(selectionCleared, 0, 'Selection not cleared when shortcuts open');
  assertEqual(ev.isDefaultPrevented, true, 'Escape calls preventDefault');

  // Step 2: Shortcuts closed, Drawer & Timeline open -> Drawer closes second
  resetEscapeCounts();
  ev = createMockEvent('Escape');
  res = dispatchTrackerHotkey(makeEscapeOptions(false, true, true), ev);
  assertEqual(res.action, 'close_drawer', 'Priority 2: Detail Drawer closes second');
  assertEqual(drawerClosed, 1, 'onDismiss called exactly once for drawer');
  assertEqual(shortcutsClosed, 0, 'Shortcuts callback not called');
  assertEqual(timelineClosed, 0, 'Timeline not closed when drawer open');
  assertEqual(selectionCleared, 0, 'Selection not cleared when drawer open');

  // Step 3: Drawer closed, Timeline open -> Timeline closes third
  resetEscapeCounts();
  ev = createMockEvent('Escape');
  res = dispatchTrackerHotkey(makeEscapeOptions(false, false, true), ev);
  assertEqual(res.action, 'close_timeline', 'Priority 3: Timeline Drawer closes third');
  assertEqual(timelineClosed, 1, 'onToggleTimeline called exactly once');
  assertEqual(shortcutsClosed, 0, 'Shortcuts callback not called');
  assertEqual(drawerClosed, 0, 'Drawer callback not called');
  assertEqual(selectionCleared, 0, 'Selection not cleared when timeline open');

  // Step 4: All modals/drawers closed -> Selection clear / dismiss base action
  resetEscapeCounts();
  ev = createMockEvent('Escape');
  res = dispatchTrackerHotkey(makeEscapeOptions(false, false, false), ev);
  assertEqual(res.action, 'clear_selection', 'Priority 4: Base selection cleared fourth');
  assertEqual(selectionCleared, 1, 'onDismiss called for clear selection');
  assertEqual(shortcutsClosed, 0, 'Shortcuts callback not called');
  assertEqual(drawerClosed, 0, 'Drawer callback not called');
  assertEqual(timelineClosed, 0, 'Timeline callback not called');

  // Exhaustively test all remaining combinations
  // (true, false, false) -> close_shortcuts
  resetEscapeCounts();
  res = dispatchTrackerHotkey(makeEscapeOptions(true, false, false), createMockEvent('Escape'));
  assertEqual(res.action, 'close_shortcuts', 'Shortcuts only -> close_shortcuts');
  assertEqual(shortcutsClosed, 1, 'Shortcuts only count');

  // (true, true, false) -> close_shortcuts
  resetEscapeCounts();
  res = dispatchTrackerHotkey(makeEscapeOptions(true, true, false), createMockEvent('Escape'));
  assertEqual(res.action, 'close_shortcuts', 'Shortcuts + Drawer -> close_shortcuts');

  // (true, false, true) -> close_shortcuts
  resetEscapeCounts();
  res = dispatchTrackerHotkey(makeEscapeOptions(true, false, true), createMockEvent('Escape'));
  assertEqual(res.action, 'close_shortcuts', 'Shortcuts + Timeline -> close_shortcuts');

  // (false, true, false) -> close_drawer
  resetEscapeCounts();
  res = dispatchTrackerHotkey(makeEscapeOptions(false, true, false), createMockEvent('Escape'));
  assertEqual(res.action, 'close_drawer', 'Drawer only -> close_drawer');
  assertEqual(drawerClosed, 1, 'Drawer only count');
}

// -----------------------------------------------------------------------------
// Suite 7: 10,000+ Keystroke Fuzzing & High-Throughput Stress
// -----------------------------------------------------------------------------
console.log('--- Suite 7: 10,000+ Randomized Keystroke Fuzzing & Invariant Check ---');

{
  const POOL_OF_KEYS = [
    'j', 'k', 'ArrowDown', 'ArrowUp', 'Home', 'End',
    'Enter', ' ', 'o',
    '[', ']', 'p', 'n',
    '1', '2', '3', '4', '5', 'i', 'r', '0', 'u',
    '/', '?', 't', 'Escape',
    'a', 'z', 'F5', 'Tab', 'Delete', 'Backquote', 'Unidentified'
  ];

  let simActiveRow = 0;
  let simTotalRows = 25;
  let simDrawerOpen = false;
  let simShortcutsOpen = false;
  let simTimelineOpen = false;
  let simPage = 0;
  const maxPages = 5;

  const fuzzOptions = {
    get activeRowIndex() { return simActiveRow; },
    get totalRows() { return simTotalRows; },
    get isDrawerOpen() { return simDrawerOpen; },
    get isShortcutsOpen() { return simShortcutsOpen; },
    get isTimelineOpen() { return simTimelineOpen; },
    onSelectRow: (idx) => { simActiveRow = idx; },
    onInspectRow: () => { simDrawerOpen = true; },
    onTriageStatus: () => {},
    onFocusSearch: () => {},
    onToggleShortcuts: () => { simShortcutsOpen = !simShortcutsOpen; },
    onToggleTimeline: () => { simTimelineOpen = !simTimelineOpen; },
    onNextPage: () => { simPage = Math.min(simPage + 1, maxPages - 1); },
    onPrevPage: () => { simPage = Math.max(simPage - 1, 0); },
    onDismiss: () => {
      if (simDrawerOpen) simDrawerOpen = false;
    },
  };

  const STRESS_ITERATIONS = 10000;
  let exceptionsCount = 0;
  let outOfBoundsCount = 0;

  const fuzzStartTime = performance.now();

  for (let i = 0; i < STRESS_ITERATIONS; i++) {
    const key = POOL_OF_KEYS[Math.floor(Math.random() * POOL_OF_KEYS.length)];
    const roll = Math.random();

    let ev;
    if (roll < 0.15) {
      // 15% modifier events
      const modType = Math.random();
      ev = createMockEvent(key, {
        ctrlKey: modType < 0.33,
        metaKey: modType >= 0.33 && modType < 0.66,
        altKey: modType >= 0.66,
      });
    } else if (roll < 0.25) {
      // 10% input element events
      const inputEl = createMockElement(Math.random() > 0.5 ? 'INPUT' : 'TEXTAREA');
      ev = createMockEvent(key, { target: inputEl });
    } else if (roll < 0.30) {
      // 5% Shift key events
      ev = createMockEvent(key, { shiftKey: true });
    } else {
      // 70% normal keystroke events
      ev = createMockEvent(key);
    }

    // Dynamic row count jitter (occasionally simulate empty dataset or small page)
    if (i % 1000 === 0) {
      simTotalRows = (i / 1000) % 2 === 0 ? 0 : Math.floor(Math.random() * 50) + 1;
      if (simTotalRows === 0) {
        simActiveRow = 0;
      } else if (simActiveRow >= simTotalRows) {
        simActiveRow = simTotalRows - 1;
      }
    }

    try {
      dispatchTrackerHotkey(fuzzOptions, ev);
    } catch (err) {
      exceptionsCount++;
    }

    // Invariant check: activeRowIndex must ALWAYS be in bounds
    if (simTotalRows > 0) {
      if (simActiveRow < 0 || simActiveRow >= simTotalRows) {
        outOfBoundsCount++;
      }
    } else {
      if (simActiveRow !== 0) {
        outOfBoundsCount++;
      }
    }
  }

  const fuzzDuration = performance.now() - fuzzStartTime;
  const opsPerSec = Math.round((STRESS_ITERATIONS / fuzzDuration) * 1000);

  assertEqual(exceptionsCount, 0, `10,000 Keystroke Fuzzing: Zero uncaught exceptions (Actual: ${exceptionsCount})`);
  assertEqual(outOfBoundsCount, 0, `10,000 Keystroke Fuzzing: Active row invariant preserved (Actual violations: ${outOfBoundsCount})`);
  console.log(`  ⚡ Executed ${STRESS_ITERATIONS} randomized keystrokes in ${fuzzDuration.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
}

// -----------------------------------------------------------------------------
// Suite 8: ApplicationTable Structural & Keyboard Ergonomics Verification
// -----------------------------------------------------------------------------
console.log('--- Suite 8: ApplicationTable Structural & Keyboard Ergonomics Verification ---');

{
  const tableFilePath = path.join(ROOT, 'demo/src/components/dashboard/ApplicationTable.tsx');
  assert(fs.existsSync(tableFilePath), 'ApplicationTable.tsx must exist');

  const content = fs.readFileSync(tableFilePath, 'utf8');

  // Verify keyboard navigation attributes and scroll into view
  assert(content.includes('scrollIntoView'), 'ApplicationTable implements scrollIntoView for active row selection');
  assert(content.includes('is-selected has-focus'), 'ApplicationTable applies "is-selected has-focus" CSS classes on active row');
  assert(content.includes('aria-selected={isSelected}'), 'ApplicationTable binds aria-selected={isSelected} on table rows');
  assert(content.includes('tabIndex={0}'), 'ApplicationTable sets tabIndex={0} for keyboard accessibility');

  // Verify visual keyboard hints on controls
  assert(content.includes('<kbd>/</kbd>'), 'Search input displays key hint <kbd>/</kbd>');
  assert(content.includes('<kbd className="bp-keycap" style={{ marginLeft: 4 }}>[</kbd>'), 'Previous page button displays keycap [');
  assert(content.includes('<kbd className="bp-keycap" style={{ marginLeft: 4 }}>]</kbd>'), 'Next page button displays keycap ]');

  // Verify empty filter state handling
  assert(content.includes('No applications found matching your filter'), 'ApplicationTable renders empty filter state message');
  assert(content.includes('colSpan={6}'), 'Empty filter row spans all 6 table columns');

  // Verify row click triggers selection and card inspection
  assert(content.includes('onSelectRow(index)'), 'Row click handler executes onSelectRow(index)');
  assert(content.includes('onInspectCard(c, index)'), 'Row click handler executes onInspectCard(c, index)');
}

const totalDuration = performance.now() - suiteStartTime;

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log(`DURATION: ${totalDuration.toFixed(2)}ms`);
console.log('================================================================\n');

if (failedTests > 0) {
  console.error(`💥 SUITE FAILED WITH ${failedTests} FAILURES!`);
  process.exit(1);
} else {
  console.log('🎉 ALL EMPIRICAL HOTKEY TESTS PASSED! ZERO DEFECTS FOUND.');
  process.exit(0);
}
