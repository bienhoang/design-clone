/**
 * Tests for clone-site functionality
 *
 * Tests the pure functions without browser dependency.
 * Run: node tests/test-clone-site.js
 */

import { normalizeUrl, isSameDomain, extractPageName } from '../src/core/discover-pages.js';
import { pathToFilename } from '../src/core/multi-page-screenshot.js';
import { rewriteLinks, createPageManifest, pathToFilename as linkPathToFilename } from '../src/core/rewrite-links.js';
import { mergeStylesheets } from '../src/core/merge-css.js';

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
// rewrite-links.js tests
// ============================================
console.log('\n=== rewrite-links.js ===\n');

test('linkPathToFilename: root', () => {
  const result = linkPathToFilename('/');
  assertEqual(result, 'index.html');
});

test('linkPathToFilename: simple', () => {
  const result = linkPathToFilename('/about');
  assertEqual(result, 'about.html');
});

test('rewriteLinks: internal link', () => {
  const html = '<a href="/about">About</a>';
  const manifest = {
    pages: [{ path: '/about', file: 'about.html', originalUrl: 'https://example.com/about' }]
  };
  const result = rewriteLinks(html, manifest, { baseUrl: 'https://example.com' });
  assertTrue(result.includes('href="about.html"'), 'Should rewrite to about.html');
});

test('rewriteLinks: external link preserved', () => {
  const html = '<a href="https://external.com">External</a>';
  const manifest = { pages: [] };
  const result = rewriteLinks(html, manifest, { baseUrl: 'https://example.com' });
  assertTrue(result.includes('https://external.com'), 'Should preserve external link');
});

test('rewriteLinks: fragment preserved', () => {
  const html = '<a href="/contact#form">Contact</a>';
  const manifest = {
    pages: [{ path: '/contact', file: 'contact.html', originalUrl: 'https://example.com/contact' }]
  };
  const result = rewriteLinks(html, manifest, { baseUrl: 'https://example.com' });
  assertTrue(result.includes('href="contact.html#form"'), 'Should preserve fragment');
});

test('rewriteLinks: mailto preserved', () => {
  const html = '<a href="mailto:test@test.com">Email</a>';
  const manifest = { pages: [] };
  const result = rewriteLinks(html, manifest, {});
  assertTrue(result.includes('mailto:test@test.com'), 'Should preserve mailto');
});

test('createPageManifest: basic', () => {
  const pages = [
    { path: '/', name: 'Home', url: 'https://example.com/' },
    { path: '/about', name: 'About', url: 'https://example.com/about' }
  ];
  const manifest = createPageManifest(pages);
  assertEqual(manifest.pages.length, 2);
  assertEqual(manifest.pages[0].file, 'index.html');
  assertEqual(manifest.pages[1].file, 'about.html');
});

// ============================================
// merge-css.js tests
// ============================================
console.log('\n=== merge-css.js ===\n');

test('mergeStylesheets: deduplicates identical rules', () => {
  const css1 = '.header { color: red; }';
  const css2 = '.header { color: red; }';
  const { css, stats } = mergeStylesheets([css1, css2]);
  assertEqual(stats.duplicateRulesRemoved, 1);
});

test('mergeStylesheets: keeps different rules', () => {
  const css1 = '.header { color: red; }';
  const css2 = '.footer { color: blue; }';
  const { css, stats } = mergeStylesheets([css1, css2]);
  assertEqual(stats.duplicateRulesRemoved, 0);
  assertTrue(css.includes('.header'));
  assertTrue(css.includes('.footer'));
});

test('mergeStylesheets: deduplicates @font-face', () => {
  const css1 = "@font-face { font-family: 'Test'; src: url(test.woff); }";
  const css2 = "@font-face { font-family: 'Test'; src: url(test.woff); }";
  const { stats } = mergeStylesheets([css1, css2]);
  assertEqual(stats.fontFacesDeduped, 1);
});

test('mergeStylesheets: deduplicates @keyframes', () => {
  const css1 = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }';
  const css2 = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }';
  const { stats } = mergeStylesheets([css1, css2]);
  assertEqual(stats.keyframesDeduped, 1);
});

// ============================================
// Summary
// ============================================
console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
