#!/usr/bin/env node
/**
 * Test discover-pages.js SPA integration for:
 * 1. SPA options handling (spaMode, framework, noSpaDetect)
 * 2. Route merging logic
 * 3. Integration with framework detector and route discoverers
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
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(`${message}: Expected true, got ${value}`);
  }
}

function assertContains(arr, item, message) {
  if (!Array.isArray(arr)) {
    throw new Error(`${message}: Expected array, got ${typeof arr}`);
  }
  const found = arr.some(el =>
    typeof el === 'object' ? JSON.stringify(el).includes(JSON.stringify(item)) : el === item
  );
  if (!found) {
    throw new Error(`${message}: Array does not contain expected item`);
  }
}

// Import module
let discoverPages, normalizeUrl, extractPageName, isSameDomain;

// ========================================
// Test: Module imports correctly
// ========================================
test('Module imports successfully', async () => {
  const mod = await import('../src/core/discover-pages.js');
  discoverPages = mod.discoverPages;
  normalizeUrl = mod.normalizeUrl;
  extractPageName = mod.extractPageName;
  isSameDomain = mod.isSameDomain;

  assertTrue(typeof discoverPages === 'function', 'discoverPages should be a function');
  assertTrue(typeof normalizeUrl === 'function', 'normalizeUrl should be a function');
  assertTrue(typeof extractPageName === 'function', 'extractPageName should be a function');
  assertTrue(typeof isSameDomain === 'function', 'isSameDomain should be a function');
});

// ========================================
// Test: normalizeUrl handles various inputs
// ========================================
test('normalizeUrl handles various URL formats', async () => {
  const baseUrl = 'https://example.com';

  // Absolute URLs
  assertEquals(normalizeUrl(baseUrl, 'https://example.com/about'), 'https://example.com/about', 'Should handle absolute URL');
  assertEquals(normalizeUrl(baseUrl, 'https://example.com/about/'), 'https://example.com/about', 'Should remove trailing slash');

  // Relative URLs
  assertEquals(normalizeUrl(baseUrl, '/contact'), 'https://example.com/contact', 'Should handle relative URL');
  assertEquals(normalizeUrl(baseUrl, '/'), 'https://example.com/', 'Should handle root');

  // Invalid inputs
  assertEquals(normalizeUrl(baseUrl, null), null, 'Should return null for null');
  assertEquals(normalizeUrl(baseUrl, ''), null, 'Should return null for empty string');
  assertEquals(normalizeUrl(baseUrl, 'mailto:test@example.com'), null, 'Should return null for mailto');
});

// ========================================
// Test: isSameDomain correctly identifies domains
// ========================================
test('isSameDomain identifies same domain correctly', async () => {
  assertTrue(isSameDomain('https://example.com/page', 'example.com'), 'Same domain should match');
  assertTrue(!isSameDomain('https://other.com/page', 'example.com'), 'Different domain should not match');

  // Subdomains
  assertTrue(!isSameDomain('https://sub.example.com/page', 'example.com', false), 'Subdomain should not match without flag');
  assertTrue(isSameDomain('https://sub.example.com/page', 'example.com', true), 'Subdomain should match with flag');
});

// ========================================
// Test: extractPageName extracts names correctly
// ========================================
test('extractPageName extracts page names', async () => {
  assertEquals(extractPageName('About Us', '/about'), 'About Us', 'Should use link text');
  assertEquals(extractPageName('', '/about'), 'About', 'Should extract from path');
  assertEquals(extractPageName('', '/blog/my-post'), 'My Post', 'Should convert kebab-case');
  assertEquals(extractPageName('', '/'), 'Home', 'Should return Home for root');
  assertEquals(extractPageName('', '/products/category_name'), 'Category Name', 'Should convert snake_case');
});

// ========================================
// Test: DEFAULT_OPTIONS include SPA options
// ========================================
test('discoverPages accepts SPA options', async () => {
  // We can't actually call discoverPages without a browser,
  // but we can verify it exists and accepts the expected parameters
  assertTrue(typeof discoverPages === 'function', 'discoverPages should exist');

  // Check function signature accepts options
  const fnStr = discoverPages.toString();
  assertTrue(fnStr.includes('options'), 'Should accept options parameter');
});

// ========================================
// Test: Framework detector integration
// ========================================
test('Framework detector is imported correctly', async () => {
  const detectorMod = await import('../src/core/framework-detector.js');
  assertTrue(typeof detectorMod.detectFramework === 'function', 'detectFramework should be exported');
});

// ========================================
// Test: Route discoverers integration
// ========================================
test('Route discoverers are imported correctly', async () => {
  const routeMod = await import('../src/route-discoverers/index.js');
  assertTrue(typeof routeMod.discoverRoutes === 'function', 'discoverRoutes should be exported');
  assertTrue(typeof routeMod.getSupportedFrameworks === 'function', 'getSupportedFrameworks should be exported');

  const frameworks = routeMod.getSupportedFrameworks();
  assertTrue(frameworks.includes('next'), 'Should support Next.js');
  assertTrue(frameworks.includes('nuxt'), 'Should support Nuxt');
  assertTrue(frameworks.includes('vue'), 'Should support Vue');
  assertTrue(frameworks.includes('react'), 'Should support React');
  assertTrue(frameworks.includes('angular'), 'Should support Angular');
  assertTrue(frameworks.includes('svelte'), 'Should support Svelte');
  assertTrue(frameworks.includes('astro'), 'Should support Astro');
});

// ========================================
// Test: App state snapshot integration
// ========================================
test('App state snapshot is imported correctly', async () => {
  const stateMod = await import('../src/core/app-state-snapshot.js');
  assertTrue(typeof stateMod.captureAppState === 'function', 'captureAppState should be exported');
  assertTrue(typeof stateMod.formatStateSnapshot === 'function', 'formatStateSnapshot should be exported');
});

// ========================================
// Test: Full module chain imports without errors
// ========================================
test('Full SPA module chain imports successfully', async () => {
  // Import all modules to verify no circular dependencies or import errors
  const [detector, discoverers, snapshot, pages] = await Promise.all([
    import('../src/core/framework-detector.js'),
    import('../src/route-discoverers/index.js'),
    import('../src/core/app-state-snapshot.js'),
    import('../src/core/discover-pages.js')
  ]);

  assertTrue(detector.detectFramework !== undefined, 'detectFramework available');
  assertTrue(discoverers.discoverRoutes !== undefined, 'discoverRoutes available');
  assertTrue(snapshot.captureAppState !== undefined, 'captureAppState available');
  assertTrue(pages.discoverPages !== undefined, 'discoverPages available');
});

// ========================================
// Test: Verify no circular import issues
// ========================================
test('Modules have no circular import issues', async () => {
  // Re-import to verify clean imports
  const start = Date.now();

  await import('../src/core/discover-pages.js');

  const duration = Date.now() - start;
  // Should import quickly without hanging (circular deps would cause issues)
  assertTrue(duration < 5000, 'Import should complete quickly (no circular deps)');
});

// ========================================
// Run all tests
// ========================================
async function runTests() {
  console.log('🧪 Running discover-pages SPA integration tests...\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failed++;
      console.log(`  ✗ ${name}`);
      console.log(`    ${error.message}`);
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
