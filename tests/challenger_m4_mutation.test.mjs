import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/**
 * Executes a test command synchronously and captures exit code and combined stdout/stderr.
 */
function runTestCommand(cmd) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env });
    return { exitCode: 0, output };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      output: (err.stdout || '') + '\n' + (err.stderr || ''),
    };
  }
}

/**
 * Safely runs a mutation test against a target file.
 * Restores original content in try/finally regardless of assertion outcome.
 */
function withMutation(filePath, mutateFn, testBlock) {
  const original = fs.readFileSync(filePath, 'utf8');
  const mutated = mutateFn(original);
  assert.notEqual(mutated, original, `Mutation function did not change ${filePath}`);

  try {
    fs.writeFileSync(filePath, mutated, 'utf8');
    testBlock();
  } finally {
    fs.writeFileSync(filePath, original, 'utf8');
  }
}

describe('Challenger M4: E2E Mutation Sensitivity & Authentic Component Verification', () => {

  it('Baseline check: unmutated Tier 1 and Tier 2 suites pass completely', () => {
    const res1 = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
    assert.equal(res1.exitCode, 0, `Tier 1 baseline failed:\n${res1.output}`);

    const res2 = runTestCommand('node --test tests/e2e/tier2_boundaries.test.mjs');
    assert.equal(res2.exitCode, 0, `Tier 2 baseline failed:\n${res2.output}`);
  });

  it('Sequential empirical verification of 9 targeted mutations across tokens, CSS, TSX, and hotkeys', () => {
    // Mutation 1: Blueprint Token Cobalt Palette
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts'),
      code => code.replace("cobalt: '#106ba3'", "cobalt: '#ff0000'"),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when cobalt token is mutated');
        assert.ok(
          res.output.includes('F1.1: Primary Intent defines exact Blueprint Cobalt palette') ||
          res.output.includes('F18.2: Test assertions utilize strict node:assert'),
          `Failure output should name F1.1 or F18.2. Output:\n${res.output}`
        );
      }
    );

    // Mutation 2: getLaneIntent Mapping
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/blueprintTokens.ts'),
      code => code.replace("case 'interview':\n      return 'primary';", "case 'interview':\n      return 'danger';"),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when lane mapping is mutated');
        assert.ok(
          res.output.includes('F1.5: getLaneIntent accurately maps all 5 operational lanes'),
          `Failure output should name F1.5. Output:\n${res.output}`
        );
      }
    );

    // Mutation 3: Hotkey j Navigation
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/useTrackerHotkeys.ts'),
      code => code.replace('onSelectRow(nextIdx);', 'onSelectRow(nextIdx + 100);'),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when j navigation is mutated');
        assert.ok(
          res.output.includes('F10.1: j increments active row index by 1'),
          `Failure output should name F10.1. Output:\n${res.output}`
        );
      }
    );

    // Mutation 4: Hotkey Input Guard
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/useTrackerHotkeys.ts'),
      code => code.replace('if (isEditing) {', 'if (false && isEditing) {'),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when input guard is disabled');
        assert.ok(
          res.output.includes('F11.1: Typing j inside an input element is suppressed by Input Guard'),
          `Failure output should name F11.1. Output:\n${res.output}`
        );
      }
    );

    // Mutation 5: Row Selection CSS Class
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/ApplicationTable.tsx'),
      code => code.replace("isSelected ? 'is-selected has-focus' : ''", "isSelected ? 'is-corrupted has-focus' : ''"),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when is-selected row class is mutated');
        assert.ok(
          res.output.includes('F9.4: Active row selection state initializes safely at index 0') ||
          res.output.includes('F14.5: Selection indicator stays lock-step synchronized with drawer card'),
          `Failure output should name F9.4 or F14.5. Output:\n${res.output}`
        );
      }
    );

    // Mutation 6: Dialog Accessibility Attribute
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/KeyboardShortcutsDialog.tsx'),
      code => code.replace('role="dialog"', 'role="alertdialog"'),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when role="dialog" is removed');
        assert.ok(
          res.output.includes('F12.4: Shortcuts modal is specified with accessible dialog attributes'),
          `Failure output should name F12.4. Output:\n${res.output}`
        );
      }
    );

    // Mutation 7: Stage Metric Bar Highlight
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/StageMetricsBar.tsx'),
      code => code.replace("const isHot = c.key === 'offer' && c.count > 0;", "const isHot = c.key === 'offer' && c.count > 999;"),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier2_boundaries.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 2 to fail when isHot metric condition is mutated');
        assert.ok(
          res.output.includes('T2.F6.3: Offer count == 1 applies hot highlight class'),
          `Failure output should name T2.F6.3. Output:\n${res.output}`
        );
      }
    );

    // Mutation 8: Detail Drawer Thread History
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/ApplicationDetailDrawer.tsx'),
      code => code.replace('Email Thread History ({sortedEmails.length})', 'Messages ({sortedEmails.length})'),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier2_boundaries.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 2 to fail when drawer thread label is mutated');
        assert.ok(
          res.output.includes('T2.F13.2: Detail drawer with application having 0 emails renders empty thread placeholder'),
          `Failure output should name T2.F13.2. Output:\n${res.output}`
        );
      }
    );

    // Mutation 9: Right Drawer CSS Width
    withMutation(
      path.join(ROOT, 'demo/src/components/dashboard/tracker.css'),
      code => code.replaceAll('520px', '240px'),
      () => {
        const res = runTestCommand('node --test tests/e2e/tier1_features.test.mjs');
        assert.notEqual(res.exitCode, 0, 'Expected Tier 1 to fail when drawer width CSS is mutated');
        assert.ok(
          res.output.includes('F13.5: CSS defines 520px right-anchored drawer layout'),
          `Failure output should name F13.5. Output:\n${res.output}`
        );
      }
    );
  });

  it('Post-mutation verification: All source files are restored and master E2E suite passes 100%', () => {
    const res = runTestCommand('node --test tests/e2e_tracker_test.mjs');
    assert.equal(res.exitCode, 0, `Post-mutation master E2E suite failed:\n${res.output}`);
  });
});
