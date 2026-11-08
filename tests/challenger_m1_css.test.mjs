/**
 * Empirical Challenger Verification Suite for Milestone 1 CSS Architecture
 * Target: demo/src/components/dashboard/tracker.css and compiled demo/dist/assets/*.css
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lightning = require('lightningcss');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cssPath = path.resolve(rootDir, 'demo/src/components/dashboard/tracker.css');
const distAssetsDir = path.resolve(rootDir, 'demo/dist/assets');

let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message, failureDetails = null) {
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
    if (failureDetails) {
      console.error(`         Details: ${JSON.stringify(failureDetails)}`);
    }
    failures.push({ message, details: failureDetails });
  }
}

console.log('================================================================');
console.log('CHALLENGER M1.2: TRACKER CSS ADVERSARIAL VERIFICATION SUITE');
console.log('================================================================\n');

const cssContent = fs.readFileSync(cssPath, 'utf8');

// -----------------------------------------------------------------------------
// Suite 1: CSS Custom Property Integrity (Defined vs Referenced)
// -----------------------------------------------------------------------------
console.log('--- Suite 1: CSS Custom Property Integrity ---');

const varDefs = new Set();
for (const m of cssContent.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
  varDefs.add(m[1]);
}
assert(varDefs.size >= 50, `Substantial token definition set present (${varDefs.size} tokens defined)`);

const varRefs = new Map();
for (const m of cssContent.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)(?:,\s*([^)]+))?\s*\)/g)) {
  const varName = m[1];
  const fallback = m[2] ? m[2].trim() : null;
  if (!varRefs.has(varName)) {
    varRefs.set(varName, []);
  }
  varRefs.get(varName).push(fallback);
}
assert(varRefs.size > 0, `Stylesheet consumes CSS variables (${varRefs.size} unique vars referenced across ${[...varRefs.values()].flat().length} call sites)`);

const undefinedWithoutFallback = [];
for (const [varName, fallbacks] of varRefs) {
  const isDefined = varDefs.has(varName);
  const allHaveFallback = fallbacks.every(f => f !== null);
  if (!isDefined && !allHaveFallback) {
    undefinedWithoutFallback.push({ varName, fallbacks });
  }
}
assert(
  undefinedWithoutFallback.length === 0,
  `All ${varRefs.size} referenced CSS variables are defined or have valid fallbacks`,
  undefinedWithoutFallback
);

// -----------------------------------------------------------------------------
// Suite 2: Elevation Shadows & Outline Rings
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Elevation Shadows & 1px Outline Rings ---');

for (let i = 0; i <= 4; i++) {
  const varName = `--bp-elevation-${i}`;
  assert(varDefs.has(varName), `Custom property ${varName} is defined`);
}

const elevationRingMatches = {};
for (let i = 0; i <= 4; i++) {
  const varName = `--bp-elevation-${i}`;
  const regex = new RegExp(`${varName}\\s*:\\s*([^;]+);`);
  const m = regex.exec(cssContent);
  if (m) {
    const val = m[1].trim();
    const has1pxRing = val.includes('0 0 0 1px');
    const ringOpacityMatch = /0\s+0\s+0\s+1px\s+rgba\(17,\s*20,\s*24,\s*([0-9.]+)\)/.exec(val);
    const ringOpacity = ringOpacityMatch ? parseFloat(ringOpacityMatch[1]) : null;
    elevationRingMatches[varName] = { val, has1pxRing, ringOpacity };
    
    assert(
      has1pxRing,
      `${varName} contains 1px outline ring ("0 0 0 1px ...")`,
      { val }
    );
    assert(
      ringOpacity === 0.1 || ringOpacity === 0.15,
      `${varName} outline ring uses Palantir Blueprint slate alpha 0.10 or 0.15 (found: ${ringOpacity})`,
      { val }
    );
  }
}

// Elevation Utility Classes (.bp-elevation-0 through .bp-elevation-4)
console.log('\n--- Suite 2b: Elevation Utility Classes Presence ---');
for (let i = 0; i <= 4; i++) {
  const className = `.bp-elevation-${i}`;
  const classRegex = new RegExp(`\\${className}\\b`);
  const hasClass = classRegex.test(cssContent);
  assert(
    hasClass,
    `Elevation utility class ${className} is defined in tracker.css`,
    { class: className, found: hasClass }
  );
}

// -----------------------------------------------------------------------------
// Suite 3: Blueprint Industrial Geometry (Border-Radius <= 4px)
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Border-Radius Limit (<= 4px on containers/cards/buttons/tables) ---');

const noComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
let ruleMatch;

const targetComponents = [
  { name: 'Dashboard Container (.bp-dashboard / .tk)', patterns: ['.bp-dashboard', '.tk'] },
  { name: 'Section Card (.bp-section-card / .tk-card)', patterns: ['.bp-section-card', '.tk-card'] },
  { name: 'Metric Card (.bp-metric-card / .tk-count)', patterns: ['.bp-metric-card', '.tk-count'] },
  { name: 'Button Primitive (.bp-btn / .tk-cta)', patterns: ['.bp-btn', '.tk-cta'] },
  { name: 'Button Group (.bp-btn-group / .tk-seg)', patterns: ['.bp-btn-group', '.tk-seg'] },
  { name: 'Table Container (.bp-table-container)', patterns: ['.bp-table-container'] },
  { name: 'Drawer Container (.bp-drawer)', patterns: ['.bp-drawer'] },
  { name: 'Dialog Container (.bp-dialog)', patterns: ['.bp-dialog'] },
];

while ((ruleMatch = ruleRegex.exec(noComments)) !== null) {
  const selGroup = ruleMatch[1].trim();
  const body = ruleMatch[2].trim();
  
  const radiusMatch = /border-radius\s*:\s*([^;]+);/.exec(body);
  if (!radiusMatch) continue;
  const radiusVal = radiusMatch[1].trim();

  for (const comp of targetComponents) {
    const matchesComp = selGroup.split(',').some(s => {
      const trimmed = s.trim();
      return comp.patterns.some(p => trimmed === p || trimmed.startsWith(p + ' ') || trimmed.startsWith(p + ':') || trimmed.startsWith(p + '.'));
    });
    
    if (matchesComp) {
      const pxMatch = /^(\d+)px$/.exec(radiusVal);
      const px = pxMatch ? parseInt(pxMatch[1], 10) : (radiusVal === '0' ? 0 : null);
      assert(
        px !== null && px <= 4,
        `${comp.name} border-radius is ${radiusVal} (<= 4px)`,
        { selector: selGroup, radius: radiusVal }
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Suite 4: Scope Isolation & Host Protection (Gmail Safety)
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Scope Isolation & Selector Containment ---');

const bareTagList = ['table', 'th', 'td', 'tr', 'thead', 'tbody', 'button', 'input', 'select', 'textarea', 'kbd', 'h1', 'h2', 'h3', 'p', 'span', 'div', 'a', 'ul', 'ol', 'li', 'svg'];
ruleRegex.lastIndex = 0;
const unqualifiedLeakingSelectors = [];

while ((ruleMatch = ruleRegex.exec(noComments)) !== null) {
  const selGroup = ruleMatch[1].trim();
  if (selGroup.startsWith('@')) continue;
  
  const selectors = selGroup.split(',').map(s => s.trim());
  for (const sel of selectors) {
    if (!sel) continue;
    const firstToken = sel.split(/\s+/)[0];
    if (bareTagList.includes(firstToken)) {
      if (!sel.includes('.bp-') && !sel.includes('.tk') && !sel.startsWith(':where(.bp-') && !sel.startsWith(':where(.tk-')) {
        unqualifiedLeakingSelectors.push({ selector: sel, fullRule: selGroup });
      }
    }
  }
}

assert(
  unqualifiedLeakingSelectors.length === 0,
  `Zero unqualified global element selectors that could corrupt host Gmail UI (found: ${unqualifiedLeakingSelectors.length})`,
  unqualifiedLeakingSelectors
);

// -----------------------------------------------------------------------------
// Suite 5: Root Token Scoping for Out-of-Tree Containers (Drawers & Dialogs)
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Token Scope Inclusivity ---');

const tokenDefSelectorMatch = /([^{}]+)\{[^{}]*--bp-font-family/.exec(noComments);
const tokenRootSelector = tokenDefSelectorMatch ? tokenDefSelectorMatch[1].trim() : '';

console.log(`  Token root selector: "${tokenRootSelector.replace(/\s+/g, ' ')}"`);
const includesDrawer = tokenRootSelector.includes('.bp-drawer');
const includesDialog = tokenRootSelector.includes('.bp-dialog');

assert(
  includesDrawer,
  `Token root selector includes .bp-drawer (for portal/docked drawer token inheritance)`,
  { selector: tokenRootSelector }
);
assert(
  includesDialog,
  `Token root selector includes .bp-dialog (for portal/modal dialog token inheritance)`,
  { selector: tokenRootSelector }
);

// -----------------------------------------------------------------------------
// Suite 6: Production Build & Minified CSS Chunk Integrity
// -----------------------------------------------------------------------------
console.log('\n--- Suite 6: CSS Syntax & Build Chunk Parsing via LightningCSS ---');

let trackerParsedOk = false;
try {
  lightning.transform({
    filename: 'tracker.css',
    code: Buffer.from(cssContent),
    minify: false,
  });
  trackerParsedOk = true;
} catch (e) {
  trackerParsedOk = false;
}
assert(trackerParsedOk, 'demo/src/components/dashboard/tracker.css parses with 0 syntax errors');

const distCssFiles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.css'));
assert(distCssFiles.length > 0, `Found compiled CSS chunk in demo/dist/assets/ (${distCssFiles.join(', ')})`);

for (const file of distCssFiles) {
  const filePath = path.join(distAssetsDir, file);
  const code = fs.readFileSync(filePath);
  let chunkOk = false;
  let chunkErr = null;
  try {
    lightning.transform({
      filename: file,
      code,
      minify: false,
    });
    chunkOk = true;
  } catch (e) {
    chunkOk = false;
    chunkErr = e.message;
  }
  assert(chunkOk, `Compiled CSS chunk ${file} parses with 0 syntax errors`, { error: chunkErr });
}

// -----------------------------------------------------------------------------
// Summary & Process Exit
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================\n');

if (failedTests > 0) {
  console.log('FAILURES SUMMARY:');
  failures.forEach((f, idx) => {
    console.log(`${idx + 1}. ${f.message}`);
    if (f.details) console.log(`   ${JSON.stringify(f.details)}`);
  });
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED EMPIRICALLY!');
  process.exit(0);
}
