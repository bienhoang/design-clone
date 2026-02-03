#!/usr/bin/env node
/**
 * Test animation-extractor.js for:
 * 1. @keyframes extraction (standard + vendor prefixed)
 * 2. Transition properties extraction
 * 3. Animation properties extraction
 * 4. CSS generation from extracted data
 * 5. Token generation
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
const TEST_CSS_KEYFRAMES = `
@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

@-webkit-keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
`;

const TEST_CSS_TRANSITIONS = `
.btn {
  transition: background-color 200ms ease, transform 100ms ease;
}

.card {
  transition-property: all;
  transition-duration: 300ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.link {
  transition: color 150ms ease-in-out;
}
`;

const TEST_CSS_ANIMATIONS = `
.hero {
  animation: fadeIn 300ms ease-in-out forwards;
}

.loader {
  animation-name: spin;
  animation-duration: 1s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}

.badge {
  animation: pulse 2s ease-in-out infinite;
}
`;

const COMBINED_CSS = TEST_CSS_KEYFRAMES + TEST_CSS_TRANSITIONS + TEST_CSS_ANIMATIONS;

// Import the module
let extractAnimations, generateAnimationsCss, generateAnimationTokens;
let extractKeyframes, extractTransitions, extractAnimationProps;

test('animation-extractor.js module loads successfully', async () => {
  const module = await import('../src/core/animation-extractor.js');
  extractAnimations = module.extractAnimations;
  generateAnimationsCss = module.generateAnimationsCss;
  generateAnimationTokens = module.generateAnimationTokens;
  extractKeyframes = module.extractKeyframes;
  extractTransitions = module.extractTransitions;
  extractAnimationProps = module.extractAnimationProps;

  assertTrue(typeof extractAnimations === 'function', 'extractAnimations should be a function');
  assertTrue(typeof generateAnimationsCss === 'function', 'generateAnimationsCss should be a function');
  assertTrue(typeof generateAnimationTokens === 'function', 'generateAnimationTokens should be a function');
});

test('extractAnimations returns correct structure', async () => {
  const result = await extractAnimations(COMBINED_CSS);

  assertTrue(result.keyframes !== undefined, 'Should have keyframes');
  assertTrue(result.transitions !== undefined, 'Should have transitions');
  assertTrue(result.animatedElements !== undefined, 'Should have animatedElements');
  assertTrue(result.error === undefined, 'Should not have error');
});

test('extracts @keyframes fadeIn correctly', async () => {
  const result = await extractAnimations(TEST_CSS_KEYFRAMES);

  assertTrue(result.keyframes.fadeIn !== undefined, 'Should extract fadeIn keyframes');
  assertEquals(result.keyframes.fadeIn.frames.length, 2, 'fadeIn should have 2 frames');
  assertEquals(result.keyframes.fadeIn.vendorPrefixed, false, 'fadeIn should not be vendor prefixed');
});

test('extracts @-webkit-keyframes spin correctly', async () => {
  const result = await extractAnimations(TEST_CSS_KEYFRAMES);

  assertTrue(result.keyframes.spin !== undefined, 'Should extract spin keyframes');
  assertEquals(result.keyframes.spin.vendorPrefixed, true, 'spin should be vendor prefixed');
});

test('extracts @keyframes pulse with multiple offsets', async () => {
  const result = await extractAnimations(TEST_CSS_KEYFRAMES);

  assertTrue(result.keyframes.pulse !== undefined, 'Should extract pulse keyframes');
  assertTrue(result.keyframes.pulse.frames.length >= 2, 'pulse should have at least 2 frames');
});

test('extracts transition properties', async () => {
  const result = await extractAnimations(TEST_CSS_TRANSITIONS);

  assertTrue(result.transitions.length >= 3, 'Should extract at least 3 transition rules');

  const btnTransition = result.transitions.find(t => t.selector === '.btn');
  assertTrue(btnTransition !== undefined, 'Should find .btn transition');
  assertTrue(btnTransition.transition !== undefined, 'Should have transition property');

  const cardTransition = result.transitions.find(t => t.selector === '.card');
  assertTrue(cardTransition !== undefined, 'Should find .card transition');
  assertTrue(cardTransition['transition-property'] !== undefined, 'Should have transition-property');
  assertTrue(cardTransition['transition-duration'] !== undefined, 'Should have transition-duration');
});

test('extracts animation properties', async () => {
  const result = await extractAnimations(TEST_CSS_ANIMATIONS);

  assertTrue(result.animatedElements.length >= 3, 'Should extract at least 3 animated elements');

  const heroAnim = result.animatedElements.find(a => a.selector === '.hero');
  assertTrue(heroAnim !== undefined, 'Should find .hero animation');
  assertTrue(heroAnim.animation !== undefined, 'Should have animation shorthand');

  const loaderAnim = result.animatedElements.find(a => a.selector === '.loader');
  assertTrue(loaderAnim !== undefined, 'Should find .loader animation');
  assertTrue(loaderAnim['animation-name'] !== undefined, 'Should have animation-name');
  assertTrue(loaderAnim['animation-duration'] !== undefined, 'Should have animation-duration');
});

test('generates animations.css from keyframes', async () => {
  const result = await extractAnimations(TEST_CSS_KEYFRAMES);
  const css = generateAnimationsCss(result);

  assertContains(css, '@keyframes fadeIn', 'Should contain fadeIn keyframes');
  // spin was defined with @-webkit-keyframes, so it preserves the vendor prefix
  assertContains(css, 'keyframes spin', 'Should contain spin keyframes');
  assertContains(css, '@keyframes pulse', 'Should contain pulse keyframes');
  assertContains(css, 'Extracted CSS Animations', 'Should have header comment');
});

test('generateAnimationsCss handles empty keyframes', async () => {
  const emptyResult = { keyframes: {}, transitions: [], animatedElements: [] };
  const css = generateAnimationsCss(emptyResult);

  assertContains(css, 'No @keyframes found', 'Should handle empty keyframes');
});

test('generates animation tokens correctly', async () => {
  const result = await extractAnimations(COMBINED_CSS);
  const tokens = generateAnimationTokens(result);

  assertEquals(tokens.keyframeCount, 3, 'Should have 3 keyframes');
  assertTrue(tokens.keyframes.includes('fadeIn'), 'Should list fadeIn in keyframes');
  assertTrue(tokens.keyframes.includes('spin'), 'Should list spin in keyframes');
  assertTrue(tokens.keyframes.includes('pulse'), 'Should list pulse in keyframes');
  assertTrue(tokens.transitions >= 3, 'Should have at least 3 transitions');
  assertTrue(tokens.animatedElements >= 3, 'Should have at least 3 animated elements');
  assertTrue(tokens.durations.length > 0, 'Should extract durations');
  assertTrue(tokens.timingFunctions.length > 0, 'Should extract timing functions');
});

test('handles CSS parse errors gracefully', async () => {
  const badCss = '@keyframes { invalid';
  const result = await extractAnimations(badCss);

  // Should not throw, might return empty or with error
  assertTrue(result !== undefined, 'Should return a result even for bad CSS');
});

test('handles empty CSS', async () => {
  const result = await extractAnimations('');

  assertEquals(Object.keys(result.keyframes).length, 0, 'Should have no keyframes');
  assertEquals(result.transitions.length, 0, 'Should have no transitions');
  assertEquals(result.animatedElements.length, 0, 'Should have no animated elements');
});

test('preserves raw CSS for keyframes regeneration', async () => {
  const result = await extractAnimations(TEST_CSS_KEYFRAMES);

  assertTrue(result.keyframes.fadeIn.raw !== undefined, 'fadeIn should have raw CSS');
  assertContains(result.keyframes.fadeIn.raw, 'opacity', 'raw CSS should contain opacity');
  assertContains(result.keyframes.fadeIn.raw, 'transform', 'raw CSS should contain transform');
});

// Run all tests
async function runTests() {
  console.log('Running animation-extractor.js tests...\n');

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
