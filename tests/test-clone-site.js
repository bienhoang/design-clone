/**
 * Tests for clone-site.js functionality
 *
 * Tests the pure functions exported from clone-site.js without browser dependency.
 * Run: node tests/test-clone-site.js
 */

import { normalizeUrl, isSameDomain, extractPageName, pathToFilename } from '../src/clone-site.js';

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
  if (!value) throw new Error(msg || 'Expected true but got false');
}

// ============================================
// URL normalization tests
// ============================================
console.log('\n=== normalizeUrl ===\n');

test('normalizeUrl: basic path', () => {
  assertEqual(normalizeUrl('https://example.com', '/about'), 'https://example.com/about');
});

test('normalizeUrl: removes trailing slash', () => {
  assertEqual(normalizeUrl('https://example.com', '/about/'), 'https://example.com/about');
});

test('normalizeUrl: removes fragment', () => {
  assertEqual(normalizeUrl('https://example.com', '/about#section'), 'https://example.com/about');
});

test('normalizeUrl: handles root path', () => {
  assertEqual(normalizeUrl('https://example.com', '/'), 'https://example.com/');
});

test('normalizeUrl: rejects mailto', () => {
  assertEqual(normalizeUrl('https://example.com', 'mailto:test@test.com'), null);
});

// ============================================
// Domain comparison tests
// ============================================
console.log('\n=== isSameDomain ===\n');

test('isSameDomain: same domain', () => {
  assertTrue(isSameDomain('https://example.com/page', 'example.com'));
});

test('isSameDomain: different domain', () => {
  assertTrue(!isSameDomain('https://other.com/page', 'example.com'));
});

test('isSameDomain: subdomain without flag', () => {
  assertTrue(!isSameDomain('https://sub.example.com', 'example.com', false));
});

test('isSameDomain: subdomain with flag', () => {
  assertTrue(isSameDomain('https://sub.example.com', 'example.com', true));
});

// ============================================
// Page name extraction tests
// ============================================
console.log('\n=== extractPageName ===\n');

test('extractPageName: from text', () => {
  assertEqual(extractPageName('About Us', '/about'), 'About Us');
});

test('extractPageName: from path', () => {
  assertEqual(extractPageName('', '/services/consulting'), 'Consulting');
});

test('extractPageName: root path', () => {
  assertEqual(extractPageName('', '/'), 'Home');
});

// ============================================
// Path to filename tests
// ============================================
console.log('\n=== pathToFilename ===\n');

test('pathToFilename: root', () => {
  assertEqual(pathToFilename('/'), 'index.html');
});

test('pathToFilename: simple path', () => {
  assertEqual(pathToFilename('/about'), 'about.html');
});

test('pathToFilename: nested path', () => {
  assertEqual(pathToFilename('/services/consulting'), 'services-consulting.html');
});

test('pathToFilename: deep path', () => {
  assertEqual(pathToFilename('/blog/2026/01/post'), 'blog-2026-01-post.html');
});

// ============================================
// Summary
// ============================================
console.log('\n=== Summary ===\n');
console.log(`${passed}/${passed + failed} tests passed`);
process.exit(failed > 0 ? 1 : 0);
