/**
 * Tests for clone-site functionality
 *
 * Tests the pure functions without browser dependency.
 * Run: node tests/test-clone-site.js
 */

import { normalizeUrl, isSameDomain, extractPageName } from '../src/core/discovery/discover-pages.js';
import { pathToFilename } from '../src/core/capture/multi-page-screenshot.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) {
    throw new Error(msg || 'Expected true but got false');
  }
}

// ============================================
// discover-pages.js tests
// ============================================
console.log('\n=== discover-pages.js ===\n');

test('normalizeUrl: basic path', () => {
  const result = normalizeUrl('https://example.com', '/about');
  assertEqual(result, 'https://example.com/about');
});

test('normalizeUrl: removes trailing slash', () => {
  const result = normalizeUrl('https://example.com', '/about/');
  assertEqual(result, 'https://example.com/about');
});

test('normalizeUrl: removes fragment', () => {
  const result = normalizeUrl('https://example.com', '/about#section');
  assertEqual(result, 'https://example.com/about');
});

test('normalizeUrl: handles root path', () => {
  const result = normalizeUrl('https://example.com', '/');
  assertEqual(result, 'https://example.com/');
});

test('normalizeUrl: rejects mailto', () => {
  const result = normalizeUrl('https://example.com', 'mailto:test@test.com');
  assertEqual(result, null);
});

test('isSameDomain: same domain', () => {
  const result = isSameDomain('https://example.com/page', 'example.com');
  assertTrue(result);
});

test('isSameDomain: different domain', () => {
  const result = isSameDomain('https://other.com/page', 'example.com');
  assertTrue(!result);
});

test('isSameDomain: subdomain without flag', () => {
  const result = isSameDomain('https://sub.example.com', 'example.com', false);
  assertTrue(!result);
});

test('isSameDomain: subdomain with flag', () => {
  const result = isSameDomain('https://sub.example.com', 'example.com', true);
  assertTrue(result);
});

test('extractPageName: from text', () => {
  const result = extractPageName('About Us', '/about');
  assertEqual(result, 'About Us');
});

test('extractPageName: from path', () => {
  const result = extractPageName('', '/services/consulting');
  assertEqual(result, 'Consulting');
});

test('extractPageName: root path', () => {
  const result = extractPageName('', '/');
  assertEqual(result, 'Home');
});

// ============================================
// multi-page-screenshot.js tests
// ============================================
console.log('\n=== multi-page-screenshot.js ===\n');

test('pathToFilename: root', () => {
  const result = pathToFilename('/');
  assertEqual(result, 'index');
});

test('pathToFilename: simple path', () => {
  const result = pathToFilename('/about');
  assertEqual(result, 'about');
});

test('pathToFilename: nested path', () => {
  const result = pathToFilename('/services/consulting');
  assertEqual(result, 'services-consulting');
});

test('pathToFilename: deep path', () => {
  const result = pathToFilename('/blog/2026/01/post');
  assertEqual(result, 'blog-2026-01-post');
});

// ============================================
// Summary
// ============================================
console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
