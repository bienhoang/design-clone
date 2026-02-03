#!/usr/bin/env node
/**
 * Test route-discoverers module for:
 * 1. Registry exports and functions
 * 2. Base discoverer utility methods
 * 3. Individual discoverer instantiation
 * 4. Mock route discovery
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

function assertInstanceOf(obj, cls, message) {
  if (!(obj instanceof cls)) {
    throw new Error(`${message}: Expected instance of ${cls.name}`);
  }
}

// Import targets
let registry, BaseDiscoverer, NextDiscoverer, UniversalDiscoverer;

// ========================================
// Test: Module imports correctly
// ========================================
test('Registry module imports successfully', async () => {
  registry = await import('../src/route-discoverers/index.js');
  assertTrue(typeof registry.getDiscovererClass === 'function', 'getDiscovererClass should be a function');
  assertTrue(typeof registry.createDiscoverer === 'function', 'createDiscoverer should be a function');
  assertTrue(typeof registry.discoverRoutes === 'function', 'discoverRoutes should be a function');
  assertTrue(typeof registry.getSupportedFrameworks === 'function', 'getSupportedFrameworks should be a function');
});

// ========================================
// Test: Base discoverer imports
// ========================================
test('BaseDiscoverer imports successfully', async () => {
  const mod = await import('../src/route-discoverers/base-discoverer.js');
  BaseDiscoverer = mod.BaseDiscoverer;
  assertTrue(typeof BaseDiscoverer === 'function', 'BaseDiscoverer should be a class');
});

// ========================================
// Test: All discoverer classes exported
// ========================================
test('All discoverer classes are exported', async () => {
  assertTrue(registry.NextDiscoverer !== undefined, 'NextDiscoverer should be exported');
  assertTrue(registry.NuxtDiscoverer !== undefined, 'NuxtDiscoverer should be exported');
  assertTrue(registry.VueDiscoverer !== undefined, 'VueDiscoverer should be exported');
  assertTrue(registry.ReactDiscoverer !== undefined, 'ReactDiscoverer should be exported');
  assertTrue(registry.AngularDiscoverer !== undefined, 'AngularDiscoverer should be exported');
  assertTrue(registry.SvelteDiscoverer !== undefined, 'SvelteDiscoverer should be exported');
  assertTrue(registry.AstroDiscoverer !== undefined, 'AstroDiscoverer should be exported');
  assertTrue(registry.UniversalDiscoverer !== undefined, 'UniversalDiscoverer should be exported');
});

// ========================================
// Test: getSupportedFrameworks returns expected list
// ========================================
test('getSupportedFrameworks returns all frameworks', async () => {
  const frameworks = registry.getSupportedFrameworks();
  assertTrue(frameworks.includes('next'), 'Should include next');
  assertTrue(frameworks.includes('nuxt'), 'Should include nuxt');
  assertTrue(frameworks.includes('vue'), 'Should include vue');
  assertTrue(frameworks.includes('react'), 'Should include react');
  assertTrue(frameworks.includes('angular'), 'Should include angular');
  assertTrue(frameworks.includes('svelte'), 'Should include svelte');
  assertTrue(frameworks.includes('astro'), 'Should include astro');
  assertTrue(!frameworks.includes('unknown'), 'Should NOT include unknown');
});

// ========================================
// Test: getDiscovererClass returns correct class
// ========================================
test('getDiscovererClass returns correct class for each framework', async () => {
  assertEquals(registry.getDiscovererClass('next'), registry.NextDiscoverer, 'Should return NextDiscoverer for next');
  assertEquals(registry.getDiscovererClass('nuxt'), registry.NuxtDiscoverer, 'Should return NuxtDiscoverer for nuxt');
  assertEquals(registry.getDiscovererClass('vue'), registry.VueDiscoverer, 'Should return VueDiscoverer for vue');
  assertEquals(registry.getDiscovererClass('react'), registry.ReactDiscoverer, 'Should return ReactDiscoverer for react');
  assertEquals(registry.getDiscovererClass('angular'), registry.AngularDiscoverer, 'Should return AngularDiscoverer for angular');
  assertEquals(registry.getDiscovererClass('svelte'), registry.SvelteDiscoverer, 'Should return SvelteDiscoverer for svelte');
  assertEquals(registry.getDiscovererClass('astro'), registry.AstroDiscoverer, 'Should return AstroDiscoverer for astro');
});

// ========================================
// Test: getDiscovererClass falls back to universal
// ========================================
test('getDiscovererClass falls back to UniversalDiscoverer for unknown', async () => {
  assertEquals(registry.getDiscovererClass('unknown'), registry.UniversalDiscoverer, 'Should return UniversalDiscoverer for unknown');
  assertEquals(registry.getDiscovererClass('wordpress'), registry.UniversalDiscoverer, 'Should return UniversalDiscoverer for unsupported');
  assertEquals(registry.getDiscovererClass(null), registry.UniversalDiscoverer, 'Should return UniversalDiscoverer for null');
  assertEquals(registry.getDiscovererClass(undefined), registry.UniversalDiscoverer, 'Should return UniversalDiscoverer for undefined');
});

// ========================================
// Test: createDiscoverer instantiates correctly
// ========================================
test('createDiscoverer creates instances with correct properties', async () => {
  const mockPage = { evaluate: async () => [] };
  const baseUrl = 'https://example.com';

  const nextDiscoverer = registry.createDiscoverer('next', mockPage, baseUrl);
  assertInstanceOf(nextDiscoverer, registry.NextDiscoverer, 'Should create NextDiscoverer instance');
  assertEquals(nextDiscoverer.baseUrl, baseUrl, 'Should set baseUrl');

  const universalDiscoverer = registry.createDiscoverer('unknown', mockPage, baseUrl);
  assertInstanceOf(universalDiscoverer, registry.UniversalDiscoverer, 'Should create UniversalDiscoverer instance');
});

// ========================================
// Test: BaseDiscoverer normalizeRoute method
// ========================================
test('BaseDiscoverer.normalizeRoute normalizes paths correctly', async () => {
  const mockPage = { evaluate: async () => [] };
  const discoverer = new BaseDiscoverer(mockPage, 'https://example.com');

  assertEquals(discoverer.normalizeRoute('/about'), '/about', 'Should keep simple paths');
  assertEquals(discoverer.normalizeRoute('/about/'), '/about', 'Should remove trailing slash');
  assertEquals(discoverer.normalizeRoute('/about?foo=bar'), '/about', 'Should remove query string');
  assertEquals(discoverer.normalizeRoute('/about#section'), '/about', 'Should remove hash');
  assertEquals(discoverer.normalizeRoute('/about/?foo=bar#section'), '/about', 'Should remove all extras');
  assertEquals(discoverer.normalizeRoute(''), '/', 'Should convert empty to root');
});

// ========================================
// Test: BaseDiscoverer isDynamicRoute method
// ========================================
test('BaseDiscoverer.isDynamicRoute detects dynamic segments', async () => {
  const mockPage = { evaluate: async () => [] };
  const discoverer = new BaseDiscoverer(mockPage, 'https://example.com');

  assertTrue(discoverer.isDynamicRoute('/posts/[id]'), 'Should detect [id]');
  assertTrue(discoverer.isDynamicRoute('/posts/[...slug]'), 'Should detect [...slug]');
  assertTrue(discoverer.isDynamicRoute('/users/:userId'), 'Should detect :userId');
  assertTrue(discoverer.isDynamicRoute('/items/{itemId}'), 'Should detect {itemId}');
  assertTrue(!discoverer.isDynamicRoute('/about'), 'Should not detect static paths');
  assertTrue(!discoverer.isDynamicRoute('/posts/my-post'), 'Should not detect normal paths');
});

// ========================================
// Test: BaseDiscoverer extractPageName method
// ========================================
test('BaseDiscoverer.extractPageName extracts names from paths', async () => {
  const mockPage = { evaluate: async () => [] };
  const discoverer = new BaseDiscoverer(mockPage, 'https://example.com');

  assertEquals(discoverer.extractPageName('/about'), 'About', 'Should capitalize');
  assertEquals(discoverer.extractPageName('/contact-us'), 'Contact Us', 'Should convert dashes');
  assertEquals(discoverer.extractPageName('/blog/my-post'), 'My Post', 'Should use last segment');
  assertEquals(discoverer.extractPageName('/'), 'Home', 'Should return Home for root');
  // Component names are converted from camelCase to Title Case
  assertEquals(discoverer.extractPageName('/about', 'AboutPage'), 'About Page', 'Should convert component name to title case');
});

// ========================================
// Test: BaseDiscoverer deduplicateRoutes method
// ========================================
test('BaseDiscoverer.deduplicateRoutes removes duplicates and prefers framework source', async () => {
  const mockPage = { evaluate: async () => [] };
  const discoverer = new BaseDiscoverer(mockPage, 'https://example.com');

  const routes = [
    { path: '/about', name: 'About', source: 'link-scrape' },
    { path: '/about', name: 'About Us', source: 'framework' },
    { path: '/contact', name: 'Contact', source: 'framework' },
    { path: '/contact', name: '', source: 'link-scrape' }
  ];

  const deduped = discoverer.deduplicateRoutes(routes);
  assertEquals(deduped.length, 2, 'Should have 2 unique routes');

  const aboutRoute = deduped.find(r => r.path === '/about');
  assertEquals(aboutRoute.source, 'framework', 'Should prefer framework source');
  assertEquals(aboutRoute.name, 'About Us', 'Should keep framework name');
});

// ========================================
// Test: BaseDiscoverer buildFullUrl method
// ========================================
test('BaseDiscoverer.buildFullUrl builds correct URLs', async () => {
  const mockPage = { evaluate: async () => [] };
  const discoverer = new BaseDiscoverer(mockPage, 'https://example.com');

  assertEquals(discoverer.buildFullUrl('/about'), 'https://example.com/about', 'Should build full URL');
  // buildFullUrl normalizes paths (removes trailing slashes)
  assertEquals(discoverer.buildFullUrl('/contact/'), 'https://example.com/contact', 'Should normalize trailing slash');
});

// ========================================
// Test: NextDiscoverer discover with mock data
// ========================================
test('NextDiscoverer discovers routes from mock __NEXT_DATA__', async () => {
  const mockPage = {
    evaluate: async (fn) => {
      // Simulate Next.js page with __NEXT_DATA__ and _buildManifest
      return [
        { path: '/', name: '', source: 'framework' },
        { path: '/about', name: '', source: 'framework' },
        { path: '/blog/[slug]', name: '', source: 'framework' }
      ];
    }
  };

  const discoverer = registry.createDiscoverer('next', mockPage, 'https://example.com');
  const routes = await discoverer.discover();

  assertTrue(routes.length >= 3, 'Should discover at least 3 routes');
  assertTrue(routes.some(r => r.path === '/'), 'Should include root');
  assertTrue(routes.some(r => r.path === '/about'), 'Should include /about');
});

// ========================================
// Test: UniversalDiscoverer with mock page
// ========================================
test('UniversalDiscoverer discovers routes from links', async () => {
  let historyInjected = false;
  let sitemapFetched = false;

  const mockPage = {
    evaluate: async (fn, ...args) => {
      // Check what function is being called
      const fnStr = fn.toString();

      if (fnStr.includes('__UNIVERSAL_INTERCEPTION_ACTIVE__')) {
        historyInjected = true;
        return;
      }

      if (fnStr.includes('fetch(url)')) {
        sitemapFetched = true;
        return null; // No sitemap
      }

      // Main discovery function
      return [
        { path: '/', name: 'Home', source: 'link-scrape' },
        { path: '/about', name: 'About', source: 'link-scrape' },
        { path: '/contact', name: 'Contact', source: 'link-scrape' }
      ];
    }
  };

  const discoverer = registry.createDiscoverer('unknown', mockPage, 'https://example.com');
  const routes = await discoverer.discover();

  assertTrue(historyInjected, 'Should inject history interception');
  assertTrue(routes.length >= 3, 'Should discover routes from links');
  assertTrue(routes.some(r => r.path === '/about'), 'Should include /about');
});

// ========================================
// Test: discoverRoutes integration function
// ========================================
test('discoverRoutes returns expected structure', async () => {
  const mockPage = {
    evaluate: async (fn) => {
      const fnStr = fn.toString();

      // If it's framework detection (checking for DETECTION_SIGNALS)
      if (fnStr.includes('DETECTION_SIGNALS') || fnStr.includes('results[framework]')) {
        return {
          next: { weight: 0, signals: [], version: null },
          nuxt: { weight: 0, signals: [], version: null },
          vue: { weight: 0, signals: [], version: null },
          react: { weight: 0, signals: [], version: null },
          angular: { weight: 0, signals: [], version: null },
          svelte: { weight: 0, signals: [], version: null },
          astro: { weight: 0, signals: [], version: null }
        };
      }

      // History interception
      if (fnStr.includes('__UNIVERSAL_INTERCEPTION_ACTIVE__') || fnStr.includes('__ROUTE_INTERCEPTION_ACTIVE__')) {
        return;
      }

      // Route discovery
      return [
        { path: '/', name: 'Home', source: 'link-scrape' },
        { path: '/products', name: 'Products', source: 'link-scrape' }
      ];
    }
  };

  const result = await registry.discoverRoutes(mockPage, 'https://example.com');

  assertTrue(result.routes !== undefined, 'Should have routes array');
  assertTrue(result.framework !== undefined, 'Should have framework');
  assertTrue(result.discoverer !== undefined, 'Should have discoverer name');
  assertEquals(result.discoverer, 'UniversalDiscoverer', 'Should use UniversalDiscoverer for unknown');
});

// ========================================
// Test: discoverRoutes with pre-detected framework
// ========================================
test('discoverRoutes uses provided frameworkInfo', async () => {
  const mockPage = {
    evaluate: async (fn) => {
      const fnStr = fn.toString();
      if (fnStr.includes('__ROUTE_INTERCEPTION_ACTIVE__')) return;
      return [{ path: '/dashboard', name: 'Dashboard', source: 'framework' }];
    }
  };

  const result = await registry.discoverRoutes(mockPage, 'https://example.com', { framework: 'react' });

  assertEquals(result.framework, 'react', 'Should use provided framework');
  assertEquals(result.discoverer, 'ReactDiscoverer', 'Should use ReactDiscoverer');
});

// ========================================
// Run all tests
// ========================================
async function runTests() {
  console.log('🧪 Running route-discoverers tests...\n');

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
