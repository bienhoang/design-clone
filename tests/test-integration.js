#!/usr/bin/env node
/**
 * Integration test for browser abstraction layer
 * Tests that screenshot.js can successfully import and parse arguments
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs, outputJSON, outputError } from '../src/utils/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../src');

const tests = {
  passed: 0,
  failed: 0,
  tests: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Test 1: parseArgs integration with real-world use case
console.log('\n=== Integration Test Suite ===\n');

try {
  console.log('Test 1: Real-world argument parsing');
  const args = parseArgs([
    '--url', 'https://example.com',
    '--output', './screenshots',
    '--viewports', 'desktop,tablet',
    '--full-page',
    '--extract-html',
    '--max-size', '5'
  ]);

  assert(args.url === 'https://example.com', 'URL not parsed');
  assert(args.output === './screenshots', 'Output path not parsed');
  assert(args.viewports === 'desktop,tablet', 'Viewports not parsed');
  assert(args['full-page'] === true, 'Full-page flag not parsed');
  assert(args['extract-html'] === true, 'Extract HTML flag not parsed');
  assert(args['max-size'] === '5', 'Max size not parsed');

  console.log('  ✓ PASSED\n');
  tests.passed++;
  tests.tests.push({ name: 'Real-world argument parsing', status: 'passed' });
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
  tests.tests.push({ name: 'Real-world argument parsing', status: 'failed', error: e.message });
}

// Test 2: Screenshot script can be parsed
try {
  console.log('Test 2: screenshot.js import validation');
  const msScript = fs.readFileSync(path.join(SRC_DIR, 'core/screenshot.js'), 'utf8');

  // Check imports
  assert(msScript.includes('from \'../utils/browser.js\''), 'Import not found');
  assert(msScript.includes('getBrowser'), 'getBrowser not imported');
  assert(msScript.includes('getPage'), 'getPage not imported');
  assert(msScript.includes('closeBrowser'), 'closeBrowser not imported');
  assert(msScript.includes('parseArgs'), 'parseArgs not imported');
  assert(msScript.includes('outputJSON'), 'outputJSON not imported');
  assert(msScript.includes('outputError'), 'outputError not imported');

  console.log('  ✓ PASSED\n');
  tests.passed++;
  tests.tests.push({ name: 'screenshot.js import validation', status: 'passed' });
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
  tests.tests.push({ name: 'screenshot.js import validation', status: 'failed', error: e.message });
}

// Test 3: Browser facade loads successfully
try {
  console.log('Test 3: Browser facade initialization');
  const browser = await import('../src/utils/browser.js');

  assert(typeof browser.getBrowser === 'function', 'getBrowser not function');
  assert(typeof browser.getPage === 'function', 'getPage not function');
  assert(typeof browser.closeBrowser === 'function', 'closeBrowser not function');
  assert(typeof browser.disconnectBrowser === 'function', 'disconnectBrowser not function');
  assert(typeof browser.parseArgs === 'function', 'parseArgs not re-exported');
  assert(typeof browser.outputJSON === 'function', 'outputJSON not re-exported');
  assert(typeof browser.outputError === 'function', 'outputError not re-exported');
  assert(typeof browser.getProviderName === 'function', 'getProviderName not exported');

  console.log('  ✓ PASSED\n');
  tests.passed++;
  tests.tests.push({ name: 'Browser facade initialization', status: 'passed' });
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
  tests.tests.push({ name: 'Browser facade initialization', status: 'failed', error: e.message });
}

// Test 4: Provider detection
try {
  console.log('Test 4: Provider auto-detection');
  const browser = await import('../src/utils/browser.js');
  const providerName = browser.getProviderName();

  assert(['unknown', 'playwright'].includes(providerName),
    `Invalid provider name: ${providerName}`);

  console.log(`  ✓ PASSED (Provider: ${providerName})\n`);
  tests.passed++;
  tests.tests.push({ name: 'Provider auto-detection', status: 'passed', provider: providerName });
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
  tests.tests.push({ name: 'Provider auto-detection', status: 'failed', error: e.message });
}

// Test 5: Argument edge cases
try {
  console.log('Test 5: Argument parsing edge cases');

  // Trailing argument
  let args = parseArgs(['--url', 'https://example.com', '--headless']);
  assert(args.url === 'https://example.com', 'Trailing flag not handled');
  assert(args.headless === true, 'Boolean flag not handled');

  // Args at end
  args = parseArgs(['--headless', '--url', 'https://example.com']);
  assert(args.headless === true, 'Flag before value');
  assert(args.url === 'https://example.com', 'Value after flag');

  // Multiple consecutive flags
  args = parseArgs(['--headless', '--disable-gpu', '--no-sandbox']);
  assert(args.headless === true, 'First flag failed');
  assert(args['disable-gpu'] === true, 'Second flag failed');
  assert(args['no-sandbox'] === true, 'Third flag failed');

  console.log('  ✓ PASSED\n');
  tests.passed++;
  tests.tests.push({ name: 'Argument parsing edge cases', status: 'passed' });
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
  tests.tests.push({ name: 'Argument parsing edge cases', status: 'failed', error: e.message });
}

// Test 6: File structure validation (new structure)
try {
  console.log('Test 6: File structure validation');

  const utilsDir = path.join(SRC_DIR, 'utils');
  assert(fs.existsSync(utilsDir), 'src/utils directory missing');

  const files = ['helpers.js', 'playwright.js', 'browser.js', 'env.js'];
  for (const file of files) {
    const filePath = path.join(utilsDir, file);
    assert(fs.existsSync(filePath), `${file} missing`);

    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.length > 100, `${file} too small`);
    assert(content.includes('export'), `${file} missing export statements`);
  }

  // Check core scripts exist
  const coreDir = path.join(SRC_DIR, 'core');
  assert(fs.existsSync(coreDir), 'src/core directory missing');
  assert(fs.existsSync(path.join(coreDir, 'screenshot.js')), 'screenshot.js missing');
  assert(fs.existsSync(path.join(coreDir, 'filter-css.js')), 'filter-css.js missing');
  assert(fs.existsSync(path.join(coreDir, 'extract-assets.js')), 'extract-assets.js missing');

  // Check AI scripts exist
  const aiDir = path.join(SRC_DIR, 'ai');
  assert(fs.existsSync(aiDir), 'src/ai directory missing');
  assert(fs.existsSync(path.join(aiDir, 'analyze-structure.py')), 'analyze-structure.py missing');
  assert(fs.existsSync(path.join(aiDir, 'extract-design-tokens.py')), 'extract-design-tokens.py missing');

  // Check verification scripts exist
  const verifyDir = path.join(SRC_DIR, 'verification');
  assert(fs.existsSync(verifyDir), 'src/verification directory missing');
  assert(fs.existsSync(path.join(verifyDir, 'verify-menu.js')), 'verify-menu.js missing');
  assert(fs.existsSync(path.join(verifyDir, 'verify-layout.js')), 'verify-layout.js missing');

  console.log('  ✓ PASSED\n');
  tests.passed++;
  tests.tests.push({ name: 'File structure validation', status: 'passed' });
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
  tests.tests.push({ name: 'File structure validation', status: 'failed', error: e.message });
}

// Summary
console.log('\n=== INTEGRATION TEST RESULTS ===\n');
console.log(`Total Tests: ${tests.passed + tests.failed}`);
console.log(`Passed: ${tests.passed}`);
console.log(`Failed: ${tests.failed}`);

process.exit(tests.failed > 0 ? 1 : 0);
