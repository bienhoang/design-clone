#!/usr/bin/env node
/**
 * Test app-state-snapshot.js for:
 * 1. Sensitive key filtering
 * 2. Safe serialization (circular refs, functions, symbols)
 * 3. Size limit enforcement
 * 4. Framework data capture
 * 5. Store state capture
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

function assertContains(str, substr, message) {
  if (!str.includes(substr)) {
    throw new Error(`${message}: "${str}" does not contain "${substr}"`);
  }
}

// Import targets
let captureAppState, formatStateSnapshot;
let filterSensitive, safeSerialize, enforceStateLimit, isSensitiveKey;
let SENSITIVE_PATTERNS, MAX_STATE_SIZE, FILTERED_MARKER, CIRCULAR_MARKER;

// ========================================
// Test: Module imports correctly
// ========================================
test('Module imports successfully', async () => {
  const mod = await import('../src/core/app-state-snapshot.js');
  captureAppState = mod.captureAppState;
  formatStateSnapshot = mod.formatStateSnapshot;
  filterSensitive = mod.filterSensitive;
  safeSerialize = mod.safeSerialize;
  enforceStateLimit = mod.enforceStateLimit;
  isSensitiveKey = mod.isSensitiveKey;
  SENSITIVE_PATTERNS = mod.SENSITIVE_PATTERNS;
  MAX_STATE_SIZE = mod.MAX_STATE_SIZE;
  FILTERED_MARKER = mod.FILTERED_MARKER;
  CIRCULAR_MARKER = mod.CIRCULAR_MARKER;

  assertTrue(typeof captureAppState === 'function', 'captureAppState should be a function');
  assertTrue(typeof formatStateSnapshot === 'function', 'formatStateSnapshot should be a function');
  assertTrue(typeof filterSensitive === 'function', 'filterSensitive should be a function');
  assertTrue(typeof safeSerialize === 'function', 'safeSerialize should be a function');
});

// ========================================
// Test: isSensitiveKey detects sensitive patterns
// ========================================
test('isSensitiveKey detects sensitive patterns', async () => {
  assertTrue(isSensitiveKey('token'), 'Should detect "token"');
  assertTrue(isSensitiveKey('accessToken'), 'Should detect "accessToken"');
  assertTrue(isSensitiveKey('password'), 'Should detect "password"');
  assertTrue(isSensitiveKey('apiKey'), 'Should detect "apiKey"');
  assertTrue(isSensitiveKey('api_key'), 'Should detect "api_key"');
  assertTrue(isSensitiveKey('secretKey'), 'Should detect "secretKey"');
  assertTrue(isSensitiveKey('authHeader'), 'Should detect "authHeader"');
  assertTrue(isSensitiveKey('sessionId'), 'Should detect "sessionId"');
  assertTrue(isSensitiveKey('jwt'), 'Should detect "jwt"');
  assertTrue(isSensitiveKey('bearerToken'), 'Should detect "bearerToken"');

  assertTrue(!isSensitiveKey('username'), 'Should NOT detect "username"');
  assertTrue(!isSensitiveKey('email'), 'Should NOT detect "email"');
  assertTrue(!isSensitiveKey('name'), 'Should NOT detect "name"');
  assertTrue(!isSensitiveKey('data'), 'Should NOT detect "data"');
});

// ========================================
// Test: filterSensitive filters sensitive keys
// ========================================
test('filterSensitive filters sensitive keys', async () => {
  const warnings = [];
  const input = {
    name: 'John',
    email: 'john@example.com',
    token: 'secret123',
    password: 'pass123',
    nested: {
      apiKey: 'key456',
      data: 'safe'
    }
  };

  const result = filterSensitive(input, warnings);

  assertEquals(result.name, 'John', 'Should keep name');
  assertEquals(result.email, 'john@example.com', 'Should keep email');
  assertEquals(result.token, FILTERED_MARKER, 'Should filter token');
  assertEquals(result.password, FILTERED_MARKER, 'Should filter password');
  assertEquals(result.nested.apiKey, FILTERED_MARKER, 'Should filter nested apiKey');
  assertEquals(result.nested.data, 'safe', 'Should keep nested data');
  assertTrue(warnings.length === 3, 'Should have 3 warnings');
});

// ========================================
// Test: filterSensitive handles arrays
// ========================================
test('filterSensitive handles arrays', async () => {
  const warnings = [];
  const input = {
    items: [
      { id: 1, token: 'abc' },
      { id: 2, data: 'safe' }
    ]
  };

  const result = filterSensitive(input, warnings);

  assertEquals(result.items[0].id, 1, 'Should keep array item id');
  assertEquals(result.items[0].token, FILTERED_MARKER, 'Should filter array item token');
  assertEquals(result.items[1].data, 'safe', 'Should keep array item data');
});

// ========================================
// Test: safeSerialize handles circular references
// ========================================
test('safeSerialize handles circular references', async () => {
  const obj = { name: 'test' };
  obj.self = obj; // Create circular reference

  const result = safeSerialize(obj);

  assertEquals(result.name, 'test', 'Should keep name');
  assertEquals(result.self, CIRCULAR_MARKER, 'Should mark circular ref');
});

// ========================================
// Test: safeSerialize handles functions
// ========================================
test('safeSerialize handles functions', async () => {
  const obj = {
    name: 'test',
    method: function() { return 1; },
    arrow: () => 2
  };

  const result = safeSerialize(obj);

  assertEquals(result.name, 'test', 'Should keep name');
  assertEquals(result.method, '[Function]', 'Should serialize function');
  assertEquals(result.arrow, '[Function]', 'Should serialize arrow function');
});

// ========================================
// Test: safeSerialize handles symbols and special types
// ========================================
test('safeSerialize handles special types', async () => {
  const obj = {
    sym: Symbol('test'),
    date: new Date('2024-01-01'),
    regex: /test/gi,
    map: new Map([['a', 1]]),
    set: new Set([1, 2, 3]),
    bigint: BigInt(123)
  };

  const result = safeSerialize(obj);

  assertEquals(result.sym, 'Symbol(test)', 'Should serialize symbol');
  assertEquals(result.date, '2024-01-01T00:00:00.000Z', 'Should serialize date');
  assertEquals(result.regex, '/test/gi', 'Should serialize regex');
  assertEquals(result.map, { a: 1 }, 'Should serialize map');
  assertTrue(Array.isArray(result.set), 'Should serialize set to array');
  assertEquals(result.bigint, '123', 'Should serialize bigint');
});

// ========================================
// Test: safeSerialize handles primitives
// ========================================
test('safeSerialize handles primitives', async () => {
  assertEquals(safeSerialize(null), null, 'Should handle null');
  assertEquals(safeSerialize(undefined), undefined, 'Should handle undefined');
  assertEquals(safeSerialize(42), 42, 'Should handle number');
  assertEquals(safeSerialize('hello'), 'hello', 'Should handle string');
  assertEquals(safeSerialize(true), true, 'Should handle boolean');
});

// ========================================
// Test: enforceStateLimit with small state
// ========================================
test('enforceStateLimit allows small state', async () => {
  const warnings = [];
  const snapshot = {
    frameworkData: { page: '/' },
    storeState: { count: 1 },
    framework: 'next',
    storeType: 'redux',
    warnings,
    capturedAt: Date.now(),
    sizeBytes: 0
  };

  const result = enforceStateLimit(snapshot, warnings);

  assertTrue(result.sizeBytes > 0, 'Should calculate size');
  assertTrue(result.sizeBytes < MAX_STATE_SIZE, 'Should be under limit');
  assertEquals(result.storeState, { count: 1 }, 'Should keep store state');
  assertEquals(warnings.length, 0, 'Should have no warnings');
});

// ========================================
// Test: enforceStateLimit truncates large state
// ========================================
test('enforceStateLimit truncates large state', async () => {
  const warnings = [];
  // Create a large state (~2MB)
  const largeArray = new Array(50000).fill('x'.repeat(50));
  const snapshot = {
    frameworkData: null,
    storeState: { data: largeArray },
    framework: 'react',
    storeType: 'redux',
    warnings,
    capturedAt: Date.now(),
    sizeBytes: 0
  };

  const result = enforceStateLimit(snapshot, warnings);

  assertTrue(result.storeState._truncated === true, 'Should be truncated');
  assertTrue(warnings.length > 0, 'Should have warning');
  assertContains(warnings[0], 'exceeded 1MB limit', 'Warning should mention limit');
});

// ========================================
// Test: captureAppState with mock page (Next.js)
// ========================================
test('captureAppState captures Next.js data', async () => {
  const mockPage = {
    evaluate: async (fn, arg) => {
      // Simulate browser context with __NEXT_DATA__
      if (typeof fn === 'function') {
        const fnStr = fn.toString();

        // Framework data capture
        if (fnStr.includes('switch (fw)') || fnStr.includes('__NEXT_DATA__')) {
          if (arg === 'next') {
            return {
              props: { pageProps: { user: 'test' } },
              page: '/dashboard',
              query: {},
              buildId: 'abc123'
            };
          }
          return null;
        }

        // Store state capture
        if (fnStr.includes('__REDUX_DEVTOOLS_EXTENSION__') || fnStr.includes('getState')) {
          return { type: 'redux', state: { user: { name: 'Test' } } };
        }
      }
      return null;
    }
  };

  const result = await captureAppState(mockPage, { framework: 'next' });

  assertEquals(result.framework, 'next', 'Should have framework');
  assertTrue(result.frameworkData !== null, 'Should have framework data');
  assertEquals(result.frameworkData.page, '/dashboard', 'Should have page path');
  assertEquals(result.storeType, 'redux', 'Should detect Redux');
  assertTrue(result.storeState !== null, 'Should have store state');
  assertTrue(result.capturedAt > 0, 'Should have timestamp');
});

// ========================================
// Test: captureAppState handles no framework
// ========================================
test('captureAppState handles no framework', async () => {
  const mockPage = {
    evaluate: async (fn, arg) => {
      const fnStr = fn.toString();
      // Framework data capture - return null for unknown framework
      if (fnStr.includes('switch (fw)')) {
        return null;
      }
      // Store state capture - return no store
      return { type: 'none', state: null };
    }
  };

  const result = await captureAppState(mockPage, null);

  assertEquals(result.framework, null, 'Should have null framework');
  assertEquals(result.storeType, 'none', 'Should have no store type');
  assertEquals(result.frameworkData, null, 'Should have no framework data');
});

// ========================================
// Test: captureAppState handles errors gracefully
// ========================================
test('captureAppState handles errors gracefully', async () => {
  let callCount = 0;
  const mockPage = {
    evaluate: async () => {
      callCount++;
      // First call for framework data - throw error
      if (callCount === 1) {
        throw new Error('Page crashed');
      }
      // Second call would also throw
      throw new Error('Page crashed again');
    }
  };

  const result = await captureAppState(mockPage, { framework: 'react' });

  // The function should catch errors and continue, frameworkData capture failed
  // so frameworkData is null, storeState capture also failed
  assertEquals(result.frameworkData, null, 'Should have null framework data on error');
  assertEquals(result.storeState, null, 'Should have null store state on error');
});

// ========================================
// Test: formatStateSnapshot generates readable output
// ========================================
test('formatStateSnapshot generates readable output', async () => {
  const snapshot = {
    frameworkData: { page: '/' },
    storeState: { count: 1 },
    framework: 'next',
    storeType: 'redux',
    warnings: ['Test warning'],
    capturedAt: Date.now(),
    sizeBytes: 1024
  };

  const output = formatStateSnapshot(snapshot);

  assertContains(output, 'Framework: next', 'Should include framework');
  assertContains(output, 'Store Type: redux', 'Should include store type');
  assertContains(output, 'captured', 'Should show captured status');
  assertContains(output, 'Test warning', 'Should include warnings');
});

// ========================================
// Test: Deep filtering with nested sensitive keys
// ========================================
test('filterSensitive handles deeply nested sensitive keys', async () => {
  const warnings = [];
  const input = {
    level1: {
      level2: {
        level3: {
          secretKey: 'hidden',
          normalData: 'visible'
        }
      }
    }
  };

  const result = filterSensitive(input, warnings);

  assertEquals(result.level1.level2.level3.secretKey, FILTERED_MARKER, 'Should filter deeply nested');
  assertEquals(result.level1.level2.level3.normalData, 'visible', 'Should keep normal data');
  assertTrue(warnings.length === 1, 'Should have 1 warning');
});

// ========================================
// Run all tests
// ========================================
async function runTests() {
  console.log('🧪 Running app-state-snapshot tests...\n');

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
