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

let tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assertTrue(value, message) {
  if (!value) throw new Error(`${message}: Expected true, got ${value}`);
}

function assertContains(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(`${message}\n  Expected to find: "${substring}"\n  In: "${str.slice(0, 200)}..."`);
  }
}

// Test suite
test('filter-css.js file exists', () => {
  const filterCssPath = path.join(__dirname, '../src/filter-css.js');
  assertTrue(fs.existsSync(filterCssPath), 'filter-css.js should exist');
});

test('filter-css.js imports css-tree dependency', () => {
  const filterCssPath = path.join(__dirname, '../src/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'css-tree', 'Should reference css-tree');
});

test('filter-css.js exports required functions', async () => {
  const mod = await import('../src/filter-css.js');
  assertTrue(typeof mod.filterCssFile === 'function', 'Should export filterCssFile');
  assertTrue(typeof mod.analyzeHtml === 'function', 'Should export analyzeHtml');
  assertTrue(typeof mod.validatePath === 'function', 'Should export validatePath');
  assertTrue(typeof mod.sanitizeCss === 'function', 'Should export sanitizeCss');
});

test('filter-css.js has filterCssFile main function', () => {
  const filterCssPath = path.join(__dirname, '../src/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'async function filterCssFile', 'Should define async filterCssFile function');
});

test('filter-css.js has analyzeHtml function', () => {
  const filterCssPath = path.join(__dirname, '../src/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'function analyzeHtml', 'Should define analyzeHtml function');
});

test('filter-css.js has sanitization patterns', () => {
  const filterCssPath = path.join(__dirname, '../src/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'sanitize', 'Should have sanitization');
});

test('filter-css.js enforces CSS input size limit', () => {
  const filterCssPath = path.join(__dirname, '../src/filter-css.js');
  const content = fs.readFileSync(filterCssPath, 'utf-8');
  assertContains(content, 'SIZE_LIMITS', 'Should check CSS size limit from shared config');
});

test('css-tree is installed', async () => {
  const csstree = await import('css-tree');
  assertTrue(csstree !== null, 'css-tree should be importable');
  assertTrue(typeof csstree.parse === 'function', 'css-tree should have parse function');
  assertTrue(typeof csstree.generate === 'function', 'css-tree should have generate function');
  assertTrue(typeof csstree.walk === 'function', 'css-tree should have walk function');
});

// Run all tests
async function runTests() {
  console.log('Running filter-css.js tests...\n');

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
