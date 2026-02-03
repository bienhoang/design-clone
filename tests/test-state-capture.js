#!/usr/bin/env node
/**
 * Test state-capture.js for:
 * 1. CSS-based :hover selector detection
 * 2. Interactive element detection
 * 3. CSS generation from style diffs
 * 4. Module structure and exports
 */

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

function assertContains(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(`${message}\n  Expected to find: "${substring}"\n  In: "${str.slice(0, 200)}..."`);
  }
}

// Test CSS samples
const TEST_CSS_HOVER = `
.btn:hover { background: red; }
a:hover { color: blue; }
.card:hover { transform: scale(1.05); }
.nav-item:hover .dropdown { display: block; }
button:hover, button:focus { outline: 2px solid blue; }
`;

const TEST_CSS_NO_HOVER = `
.btn { background: blue; }
a { color: black; }
.card { transform: none; }
`;

// Import the module
let detectInteractiveElements, generateHoverCss;
let extractHoverSelectorsFromCss;

test('state-capture.js module loads successfully', async () => {
  const module = await import('../src/core/state-capture.js');
  detectInteractiveElements = module.detectInteractiveElements;
  generateHoverCss = module.generateHoverCss;
  extractHoverSelectorsFromCss = module.extractHoverSelectorsFromCss;

  assertTrue(typeof detectInteractiveElements === 'function', 'detectInteractiveElements should be a function');
  assertTrue(typeof generateHoverCss === 'function', 'generateHoverCss should be a function');
  assertTrue(typeof extractHoverSelectorsFromCss === 'function', 'extractHoverSelectorsFromCss should be a function');
});

test('extractHoverSelectorsFromCss extracts :hover selectors', async () => {
  const result = extractHoverSelectorsFromCss(TEST_CSS_HOVER);

  assertTrue(result instanceof Set, 'Should return a Set');
  assertTrue(result.size >= 4, `Should find at least 4 hover selectors, found ${result.size}`);
  assertTrue(result.has('.btn'), 'Should find .btn');
  assertTrue(result.has('a'), 'Should find a');
  assertTrue(result.has('.card'), 'Should find .card');
  assertTrue(result.has('.nav-item .dropdown'), 'Should find .nav-item .dropdown');
});

test('extractHoverSelectorsFromCss handles CSS without :hover', async () => {
  const result = extractHoverSelectorsFromCss(TEST_CSS_NO_HOVER);

  assertEquals(result.size, 0, 'Should find no hover selectors');
});

test('extractHoverSelectorsFromCss handles null/empty CSS', async () => {
  const resultNull = extractHoverSelectorsFromCss(null);
  const resultEmpty = extractHoverSelectorsFromCss('');

  assertEquals(resultNull.size, 0, 'Should handle null CSS');
  assertEquals(resultEmpty.size, 0, 'Should handle empty CSS');
});

test('extractHoverSelectorsFromCss removes :hover from selectors', async () => {
  const result = extractHoverSelectorsFromCss(TEST_CSS_HOVER);

  // Should have base selectors without :hover
  const selectors = Array.from(result);
  assertTrue(!selectors.some(s => s.includes(':hover')), 'Should not contain :hover in extracted selectors');
});

test('generateHoverCss creates valid CSS from style diffs', async () => {
  const mockResults = [
    {
      selector: '.btn',
      success: true,
      styleDiff: {
        backgroundColor: { from: 'rgb(0, 0, 255)', to: 'rgb(255, 0, 0)' },
        transform: { from: 'none', to: 'scale(1.05)' }
      }
    },
    {
      selector: 'a',
      success: true,
      styleDiff: {
        color: { from: 'rgb(0, 0, 0)', to: 'rgb(0, 0, 255)' }
      }
    }
  ];

  const css = generateHoverCss(mockResults);

  assertContains(css, '.btn:hover', 'Should contain .btn:hover selector');
  assertContains(css, 'a:hover', 'Should contain a:hover selector');
  assertContains(css, 'background-color:', 'Should contain background-color property');
  assertContains(css, 'transform:', 'Should contain transform property');
  assertContains(css, 'color:', 'Should contain color property');
  assertContains(css, 'rgb(255, 0, 0)', 'Should contain hover value');
});

test('generateHoverCss handles empty results', async () => {
  const css = generateHoverCss([]);

  assertContains(css, 'No hover style changes detected', 'Should indicate no changes');
});

test('generateHoverCss filters unsuccessful results', async () => {
  const mockResults = [
    {
      selector: '.btn',
      success: false,
      styleDiff: {},
      error: 'Element not found'
    },
    {
      selector: 'a',
      success: true,
      styleDiff: {
        color: { from: 'black', to: 'blue' }
      }
    }
  ];

  const css = generateHoverCss(mockResults);

  assertTrue(!css.includes('.btn:hover'), 'Should not include failed element');
  assertContains(css, 'a:hover', 'Should include successful element');
});

test('generateHoverCss converts camelCase to kebab-case', async () => {
  const mockResults = [
    {
      selector: '.card',
      success: true,
      styleDiff: {
        backgroundColor: { from: 'white', to: 'gray' },
        borderColor: { from: 'black', to: 'blue' },
        boxShadow: { from: 'none', to: '0 4px 8px rgba(0,0,0,0.1)' }
      }
    }
  ];

  const css = generateHoverCss(mockResults);

  assertContains(css, 'background-color:', 'Should convert backgroundColor');
  assertContains(css, 'border-color:', 'Should convert borderColor');
  assertContains(css, 'box-shadow:', 'Should convert boxShadow');
});

test('generateHoverCss adds header comment', async () => {
  const mockResults = [
    {
      selector: '.btn',
      success: true,
      styleDiff: { color: { from: 'black', to: 'blue' } }
    }
  ];

  const css = generateHoverCss(mockResults);

  assertContains(css, 'Generated :hover Styles', 'Should have header comment');
  assertContains(css, 'design-clone', 'Should reference design-clone');
});

test('generateHoverCss handles elements with no style changes', async () => {
  const mockResults = [
    {
      selector: '.btn',
      success: true,
      styleDiff: {} // No changes
    },
    {
      selector: 'a',
      success: true,
      styleDiff: { color: { from: 'black', to: 'blue' } }
    }
  ];

  const css = generateHoverCss(mockResults);

  // .btn should not appear since no style diff
  assertTrue(!css.includes('.btn:hover {'), 'Should not include element with no style changes');
  assertContains(css, 'a:hover', 'Should include element with changes');
});

// Run all tests
async function runTests() {
  console.log('Running state-capture.js tests...\n');

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
