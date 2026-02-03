#!/usr/bin/env node
/**
 * Test filter-css.js for:
 * 1. css-tree dependency resolution
 * 2. Module structure verification
 * 3. Export functions availability
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test utilities
let tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(`${message}: Expected true, got ${value}`);
  }
}

function assertFalse(value, message) {
  if (value) {
    throw new Error(`${message}: Expected false, got ${value}`);
  }
}

function assertContains(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(`${message}\n  Expected to find: "${substring}"\n  In: "${str}"`);
  }
}

function assertNotContains(str, substring, message) {
  if (str.includes(substring)) {
    throw new Error(`${message}\n  Should not find: "${substring}"\n  In: "${str}"`);
  }
}

// Test suite
test('filter-css.js file exists', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  assertTrue(fs.existsSync(filterCssPath), 'filter-css.js should exist');
});

test('filter-css.js imports css-tree dependency', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, "import('css-tree')", 'Should try to import css-tree');
});

test('filter-css.js has dependency check error handling', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'css-tree not installed', 'Should have css-tree error message');
  assertContains(content, 'npm install css-tree', 'Should provide install hint');
});

test('filter-css.js exports required functions', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'export { filterCssFile', 'Should export filterCssFile');
  assertContains(content, 'analyzeHtml', 'Should export analyzeHtml');
  assertContains(content, 'validatePath', 'Should export validatePath');
  assertContains(content, 'sanitizeCss', 'Should export sanitizeCss');
});

test('filter-css.js has analyzeHtml function', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'function analyzeHtml(html)', 'Should define analyzeHtml function');
  assertContains(content, 'tags.add', 'analyzeHtml should extract tags');
  assertContains(content, 'ids.add', 'analyzeHtml should extract IDs');
  assertContains(content, 'classes.add', 'analyzeHtml should extract classes');
});

test('filter-css.js has validatePath function', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'function validatePath(filePath', 'Should define validatePath function');
  assertContains(content, 'outside allowed directory', 'Should check path traversal');
});

test('filter-css.js has sanitizeCss function', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'function sanitizeCss(css)', 'Should define sanitizeCss function');
  assertContains(content, 'CSS_INJECTION_PATTERNS', 'Should have XSS pattern checks');
  assertContains(content, 'javascript:', 'Should check for javascript: URLs');
});

test('filter-css.js has sanitization patterns', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'moz-binding', 'Should sanitize Firefox XBL binding');
  assertContains(content, 'expression', 'Should sanitize IE expression()');
  assertContains(content, 'behavior', 'Should sanitize IE behavior');
});

test('filter-css.js has filterCssFile main function', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'async function filterCssFile', 'Should define async filterCssFile function');
  assertContains(content, 'htmlPath', 'Should accept htmlPath parameter');
  assertContains(content, 'cssPath', 'Should accept cssPath parameter');
  assertContains(content, 'outputPath', 'Should accept outputPath parameter');
});

test('filter-css.js has memory limit', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'MAX_CSS_INPUT_SIZE', 'Should define MAX_CSS_INPUT_SIZE');
  assertContains(content, '10 * 1024 * 1024', 'Should set 10MB limit');
});

test('filter-css.js has keep patterns for critical selectors', () => {
  const filterCssPath = path.join(__dirname, '../src/core/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'ALWAYS_KEEP_PATTERNS', 'Should have ALWAYS_KEEP_PATTERNS');
  assertContains(content, 'html', 'Should keep html selector');
  assertContains(content, 'body', 'Should keep body selector');
  assertContains(content, 'root', 'Should keep :root selector');
});

test('css-tree is installed', async () => {
  try {
    const csstree = await import('css-tree');
    assertTrue(csstree !== null, 'css-tree should be importable');
    assertTrue(typeof csstree.parse === 'function', 'css-tree should have parse function');
    assertTrue(typeof csstree.generate === 'function', 'css-tree should have generate function');
    assertTrue(typeof csstree.walk === 'function', 'css-tree should have walk function');
  } catch (e) {
    throw new Error(`css-tree dependency not installed: ${e.message}`);
  }
});

// Run all tests
async function runTests() {
  console.log('Running filter-css.js dependency & structure tests...\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${tests.length} tests passed`);

  if (failed > 0) {
    console.log(`${failed} tests failed`);
    process.exit(1);
  } else {
    console.log('All tests passed!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
