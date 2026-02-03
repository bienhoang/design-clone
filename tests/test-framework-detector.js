#!/usr/bin/env node
/**
 * Test framework-detector.js for:
 * 1. Detection signal structure validation
 * 2. Confidence calculation
 * 3. Mock page.evaluate detection logic
 * 4. Format output utility
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
  if (!arr.includes(item)) {
    throw new Error(`${message}\n  Expected to contain: "${item}"\n  In: ${JSON.stringify(arr)}`);
  }
}

// Import after defining tests
let detectFramework, formatDetectionResult;

// ========================================
// Test: Module imports correctly
// ========================================
test('Module imports successfully', async () => {
  const mod = await import('../src/core/framework-detector.js');
  detectFramework = mod.detectFramework;
  formatDetectionResult = mod.formatDetectionResult;
  assertTrue(typeof detectFramework === 'function', 'detectFramework should be a function');
  assertTrue(typeof formatDetectionResult === 'function', 'formatDetectionResult should be a function');
});

// ========================================
// Test: formatDetectionResult for null framework
// ========================================
test('formatDetectionResult handles null framework', async () => {
  const result = formatDetectionResult({
    framework: null,
    version: null,
    routingType: 'unknown',
    confidence: 'low',
    signals: []
  });
  assertTrue(result.includes('No framework detected'), 'Should indicate no framework');
});

// ========================================
// Test: formatDetectionResult for Next.js
// ========================================
test('formatDetectionResult formats Next.js correctly', async () => {
  const result = formatDetectionResult({
    framework: 'next',
    version: '14.0.0',
    routingType: 'ssr',
    confidence: 'high',
    signals: ['__NEXT_DATA__', '#__next']
  });
  assertTrue(result.includes('Framework: next'), 'Should include framework name');
  assertTrue(result.includes('Version: 14.0.0'), 'Should include version');
  assertTrue(result.includes('Confidence: high'), 'Should include confidence');
  assertTrue(result.includes('__NEXT_DATA__'), 'Should include signals');
});

// ========================================
// Test: Mock page.evaluate for Next.js detection
// ========================================
test('Detects Next.js from mock page', async () => {
  // Create mock page that simulates a Next.js site
  const mockPage = {
    evaluate: async (fn, signals) => {
      // Simulate browser context with Next.js globals
      const mockWindow = {
        __NEXT_DATA__: { buildId: 'abc123', page: '/' },
        __BUILD_MANIFEST: {}
      };
      const mockDocument = {
        getElementById: (id) => id === '__next' ? {} : null,
        querySelector: (sel) => sel === '#__next' ? {} : null,
        querySelectorAll: (sel) => sel === 'script[src]' ? [{ src: '/_next/static/chunks/main.js' }] : []
      };

      // Execute detection logic with mocked globals
      // We need to simulate the detection manually
      return {
        next: { weight: 8, signals: ['__NEXT_DATA__', '__BUILD_MANIFEST', '#__next', 'script:/_next/'], version: 'abc123' },
        nuxt: { weight: 0, signals: [], version: null },
        vue: { weight: 0, signals: [], version: null },
        react: { weight: 0, signals: [], version: null },
        angular: { weight: 0, signals: [], version: null },
        svelte: { weight: 0, signals: [], version: null },
        astro: { weight: 0, signals: [], version: null }
      };
    }
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, 'next', 'Should detect Next.js');
  assertEquals(result.confidence, 'high', 'Should have high confidence');
  assertTrue(result.signals.includes('__NEXT_DATA__'), 'Should include __NEXT_DATA__ signal');
});

// ========================================
// Test: Mock page.evaluate for Nuxt detection
// ========================================
test('Detects Nuxt from mock page', async () => {
  const mockPage = {
    evaluate: async (fn, signals) => {
      return {
        next: { weight: 0, signals: [], version: null },
        nuxt: { weight: 6, signals: ['__NUXT__', '$nuxt', '#__nuxt'], version: null },
        vue: { weight: 2, signals: ['data-v-*'], version: null }, // Vue also detected (expected)
        react: { weight: 0, signals: [], version: null },
        angular: { weight: 0, signals: [], version: null },
        svelte: { weight: 0, signals: [], version: null },
        astro: { weight: 0, signals: [], version: null }
      };
    }
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, 'nuxt', 'Should detect Nuxt');
  assertEquals(result.confidence, 'high', 'Should have high confidence');
  assertTrue(result.signals.includes('__NUXT__'), 'Should include __NUXT__ signal');
});

// ========================================
// Test: Mock page.evaluate for static HTML
// ========================================
test('Returns null for static HTML page', async () => {
  const mockPage = {
    evaluate: async (fn, signals) => {
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
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, null, 'Should return null for static HTML');
  assertEquals(result.confidence, 'low', 'Should have low confidence');
  assertEquals(result.signals.length, 0, 'Should have no signals');
});

// ========================================
// Test: Mock page.evaluate for Angular detection
// ========================================
test('Detects Angular from mock page', async () => {
  const mockPage = {
    evaluate: async (fn, signals) => {
      return {
        next: { weight: 0, signals: [], version: null },
        nuxt: { weight: 0, signals: [], version: null },
        vue: { weight: 0, signals: [], version: null },
        react: { weight: 0, signals: [], version: null },
        angular: { weight: 7, signals: ['ng-version', 'app-root', '_nghost-*'], version: '16.0.0' },
        svelte: { weight: 0, signals: [], version: null },
        astro: { weight: 0, signals: [], version: null }
      };
    }
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, 'angular', 'Should detect Angular');
  assertEquals(result.version, '16.0.0', 'Should detect version');
  assertTrue(result.signals.includes('ng-version'), 'Should include ng-version signal');
});

// ========================================
// Test: Mock page.evaluate for Astro detection
// ========================================
test('Detects Astro from mock page', async () => {
  const mockPage = {
    evaluate: async (fn, signals) => {
      return {
        next: { weight: 0, signals: [], version: null },
        nuxt: { weight: 0, signals: [], version: null },
        vue: { weight: 0, signals: [], version: null },
        react: { weight: 0, signals: [], version: null },
        angular: { weight: 0, signals: [], version: null },
        svelte: { weight: 0, signals: [], version: null },
        astro: { weight: 5, signals: ['astro-island', 'meta:generator:Astro'], version: '4.0.0' }
      };
    }
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, 'astro', 'Should detect Astro');
  assertEquals(result.confidence, 'high', 'Should have high confidence');
  assertTrue(result.signals.includes('astro-island'), 'Should include astro-island signal');
});

// ========================================
// Test: Priority: SSR frameworks over base frameworks
// ========================================
test('Prioritizes Next.js over React when both detected', async () => {
  const mockPage = {
    evaluate: async (fn, signals) => {
      return {
        next: { weight: 5, signals: ['__NEXT_DATA__', '#__next'], version: null },
        nuxt: { weight: 0, signals: [], version: null },
        vue: { weight: 0, signals: [], version: null },
        react: { weight: 3, signals: ['data-reactroot', '__REACT_DEVTOOLS_GLOBAL_HOOK__'], version: null },
        angular: { weight: 0, signals: [], version: null },
        svelte: { weight: 0, signals: [], version: null },
        astro: { weight: 0, signals: [], version: null }
      };
    }
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, 'next', 'Should prioritize Next.js over React');
});

// ========================================
// Test: Low confidence detection
// ========================================
test('Returns low confidence for weak signals', async () => {
  const mockPage = {
    evaluate: async (fn, signals) => {
      return {
        next: { weight: 0, signals: [], version: null },
        nuxt: { weight: 0, signals: [], version: null },
        vue: { weight: 0, signals: [], version: null },
        react: { weight: 1, signals: ['__REACT_DEVTOOLS_GLOBAL_HOOK__'], version: null },
        angular: { weight: 0, signals: [], version: null },
        svelte: { weight: 0, signals: [], version: null },
        astro: { weight: 0, signals: [], version: null }
      };
    }
  };

  const result = await detectFramework(mockPage);
  assertEquals(result.framework, 'react', 'Should detect React');
  assertEquals(result.confidence, 'low', 'Should have low confidence for single weak signal');
});

// ========================================
// Run all tests
// ========================================
async function runTests() {
  console.log('🧪 Running framework-detector tests...\n');

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
