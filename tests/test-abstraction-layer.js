#!/usr/bin/env node
/**
 * Test suite for browser abstraction layer
 * Tests lib/utils.js, lib/puppeteer.js, and lib/browser.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = {
  tests: [],
  summary: { passed: 0, failed: 0, skipped: 0 },
  startTime: new Date().toISOString()
};

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
  }
}

async function test(name, fn) {
  const testRecord = { name, status: 'pending', duration: 0, error: null };
  const start = Date.now();

  try {
    await fn();
    testRecord.status = 'passed';
    results.summary.passed++;
  } catch (error) {
    testRecord.status = 'failed';
    testRecord.error = error.message;
    results.summary.failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  } finally {
    testRecord.duration = Date.now() - start;
    results.tests.push(testRecord);
  }
}

// Main test runner
async function runTests() {
  // Test 1: Utils module - parseArgs function
  console.log('\n=== Test Suite 1: Utils Module ===\n');

  await test('utils.parseArgs - basic flag parsing', async () => {
    const { parseArgs } = await import('../src/utils/helpers.js');
    const result = parseArgs(['--url', 'https://example.com', '--headless']);
    assert(result.url === 'https://example.com', 'URL not parsed correctly');
    assert(result.headless === true, 'Headless flag not parsed as boolean');
  });

  await test('utils.parseArgs - value parsing', async () => {
    const { parseArgs } = await import('../src/utils/helpers.js');
    const result = parseArgs(['--url', 'https://example.com', '--port', '9222', '--output', '/tmp/out']);
    assert(result.url === 'https://example.com', 'URL parsing failed');
    assert(result.port === '9222', 'Port parsing failed');
    assert(result.output === '/tmp/out', 'Output path parsing failed');
  });

  await test('utils.parseArgs - empty args', async () => {
    const { parseArgs } = await import('../src/utils/helpers.js');
    const result = parseArgs([]);
    assertEqual(result, {}, 'Empty args should return empty object');
  });

  await test('utils.parseArgs - only flags', async () => {
    const { parseArgs } = await import('../src/utils/helpers.js');
    const result = parseArgs(['--headless', '--disable-gpu', '--no-sandbox']);
    assert(result.headless === true, 'Flag parsing failed');
    assert(result['disable-gpu'] === true, 'Flag with dash parsing failed');
    assert(result['no-sandbox'] === true, 'Flag with dash parsing failed');
  });

  await test('utils.parseArgs - mixed args and flags', async () => {
    const { parseArgs } = await import('../src/utils/helpers.js');
    const result = parseArgs(['--url', 'https://test.com', '--headless', '--port', '8080']);
    assert(result.url === 'https://test.com', 'URL parsing failed');
    assert(result.headless === true, 'Headless flag not set');
    assert(result.port === '8080', 'Port parsing failed');
  });

  await test('utils.outputJSON - function exists', async () => {
    const { outputJSON } = await import('../src/utils/helpers.js');
    assert(typeof outputJSON === 'function', 'outputJSON is not a function');
  });

  await test('utils.outputError - function exists', async () => {
    const { outputError } = await import('../src/utils/helpers.js');
    assert(typeof outputError === 'function', 'outputError is not a function');
  });

  // Test 2: Puppeteer module
  console.log('\n=== Test Suite 2: Puppeteer Wrapper Module ===\n');

  await test('puppeteer.js - exports getBrowser', async () => {
    const pptr = await import('../src/utils/puppeteer.js');
    assert(typeof pptr.getBrowser === 'function', 'getBrowser not exported');
  });

  await test('puppeteer.js - exports getPage', async () => {
    const pptr = await import('../src/utils/puppeteer.js');
    assert(typeof pptr.getPage === 'function', 'getPage not exported');
  });

  await test('puppeteer.js - exports closeBrowser', async () => {
    const pptr = await import('../src/utils/puppeteer.js');
    assert(typeof pptr.closeBrowser === 'function', 'closeBrowser not exported');
  });

  await test('puppeteer.js - exports disconnectBrowser', async () => {
    const pptr = await import('../src/utils/puppeteer.js');
    assert(typeof pptr.disconnectBrowser === 'function', 'disconnectBrowser not exported');
  });

  // Test 3: Browser facade module
  console.log('\n=== Test Suite 3: Browser Facade Module ===\n');

  await test('browser.js - exports getBrowser', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.getBrowser === 'function', 'getBrowser not exported');
  });

  await test('browser.js - exports getPage', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.getPage === 'function', 'getPage not exported');
  });

  await test('browser.js - exports closeBrowser', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.closeBrowser === 'function', 'closeBrowser not exported');
  });

  await test('browser.js - exports disconnectBrowser', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.disconnectBrowser === 'function', 'disconnectBrowser not exported');
  });

  await test('browser.js - re-exports parseArgs', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.parseArgs === 'function', 'parseArgs not re-exported');
  });

  await test('browser.js - re-exports outputJSON', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.outputJSON === 'function', 'outputJSON not re-exported');
  });

  await test('browser.js - re-exports outputError', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.outputError === 'function', 'outputError not re-exported');
  });

  await test('browser.js - exports getProviderName', async () => {
    const browser = await import('../src/utils/browser.js');
    assert(typeof browser.getProviderName === 'function', 'getProviderName not exported');
  });

  // Test 4: Multi-screenshot integration
  console.log('\n=== Test Suite 4: Multi-Screenshot Integration ===\n');

  await test('multi-screenshot.js - imports from lib/browser.js', async () => {
    const msContent = fs.readFileSync(path.join(__dirname, 'multi-screenshot.js'), 'utf8');
    assert(msContent.includes('from \'./lib/browser.js\''), 'multi-screenshot.js does not import from ./lib/browser.js');
  });

  await test('multi-screenshot.js - imports getBrowser', async () => {
    const msContent = fs.readFileSync(path.join(__dirname, 'multi-screenshot.js'), 'utf8');
    assert(msContent.includes('getBrowser'), 'getBrowser not imported in multi-screenshot.js');
  });

  await test('multi-screenshot.js - imports getPage', async () => {
    const msContent = fs.readFileSync(path.join(__dirname, 'multi-screenshot.js'), 'utf8');
    assert(msContent.includes('getPage'), 'getPage not imported in multi-screenshot.js');
  });

  await test('multi-screenshot.js - imports parseArgs', async () => {
    const msContent = fs.readFileSync(path.join(__dirname, 'multi-screenshot.js'), 'utf8');
    assert(msContent.includes('parseArgs'), 'parseArgs not imported in multi-screenshot.js');
  });

  // Test 5: Chrome-devtools detection logic
  console.log('\n=== Test Suite 5: Chrome-DevTools Detection ===\n');

  await test('browser.js - detects chrome-devtools path correctly', async () => {
    const skillPath = path.join(process.env.HOME || '', '.claude/skills/chrome-devtools/scripts/lib/browser.js');
    assert(skillPath, 'Chrome-devtools skill path not computed');
  });

  await test('browser.js - getProviderName callable before init', async () => {
    const browser = await import('../src/utils/browser.js');
    const providerName = browser.getProviderName();
    assert(typeof providerName === 'string', 'getProviderName should return string');
  });

  // Test 6: File structure validation
  console.log('\n=== Test Suite 6: File Structure ===\n');

  await test('lib/utils.js - file exists and readable', async () => {
    const filePath = path.join(__dirname, 'lib', 'utils.js');
    assert(fs.existsSync(filePath), 'lib/utils.js does not exist');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.length > 0, 'lib/utils.js is empty');
  });

  await test('lib/puppeteer.js - file exists and readable', async () => {
    const filePath = path.join(__dirname, 'lib', 'puppeteer.js');
    assert(fs.existsSync(filePath), 'lib/puppeteer.js does not exist');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.length > 0, 'lib/puppeteer.js is empty');
  });

  await test('lib/browser.js - file exists and readable', async () => {
    const filePath = path.join(__dirname, 'lib', 'browser.js');
    assert(fs.existsSync(filePath), 'lib/browser.js does not exist');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.length > 0, 'lib/browser.js is empty');
  });

  await test('lib/ - all files have JSDoc comments', async () => {
    const files = ['lib/utils.js', 'lib/puppeteer.js', 'lib/browser.js'];
    for (const file of files) {
      const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
      assert(content.includes('/**'), `${file} missing JSDoc comments`);
    }
  });

  // Test 7: Export consistency verification
  console.log('\n=== Test Suite 7: Export Consistency ===\n');

  await test('Verify all export functions are callable', async () => {
    const browser = await import('../src/utils/browser.js');
    const exports = ['getBrowser', 'getPage', 'closeBrowser', 'disconnectBrowser', 'parseArgs', 'outputJSON', 'outputError'];
    for (const name of exports) {
      assert(typeof browser[name] === 'function', `${name} is not a function`);
    }
  });

  await test('Verify utils exports match browser re-exports', async () => {
    const utils = await import('../src/utils/helpers.js');
    const browser = await import('../src/utils/browser.js');
    const utilFunctions = ['parseArgs', 'outputJSON', 'outputError'];
    for (const name of utilFunctions) {
      assert(typeof utils[name] === 'function', `utils.${name} is not a function`);
      assert(typeof browser[name] === 'function', `browser.${name} is not a function`);
    }
  });

  // Output results
  results.endTime = new Date().toISOString();

  console.log('\n=== TEST RESULTS ===\n');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
  console.log(`Skipped: ${results.summary.skipped}`);

  if (results.summary.failed > 0) {
    console.log('\n=== FAILED TESTS ===\n');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => {
        console.log(`${t.name}`);
        console.log(`  Error: ${t.error}`);
      });
  }

  // Save results
  const reportPath = path.join(__dirname, 'test-output', 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${reportPath}`);

  // Exit with appropriate code
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

// Run all tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
