#!/usr/bin/env node
/**
 * Integration test for the 5-file architecture
 * Tests that all modules can be imported and export the expected functions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs, outputJSON, outputError } from '../src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../src');

const tests = { passed: 0, failed: 0, tests: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('\n=== Integration Test Suite ===\n');

// Test 1: parseArgs integration
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
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Test 2: utils.js exports
try {
  console.log('Test 2: utils.js exports validation');
  const utils = await import('../src/utils.js');

  assert(typeof utils.getBrowser === 'function', 'getBrowser not function');
  assert(typeof utils.getPage === 'function', 'getPage not function');
  assert(typeof utils.closeBrowser === 'function', 'closeBrowser not function');
  assert(typeof utils.disconnectBrowser === 'function', 'disconnectBrowser not function');
  assert(typeof utils.parseArgs === 'function', 'parseArgs not function');
  assert(typeof utils.outputJSON === 'function', 'outputJSON not function');
  assert(typeof utils.outputError === 'function', 'outputError not function');
  assert(typeof utils.loadEnv === 'function', 'loadEnv not function');
  assert(typeof utils.getEnv === 'function', 'getEnv not function');
  assert(typeof utils.getSkillDir === 'function', 'getSkillDir not function');
  assert(utils.VIEWPORTS !== undefined, 'VIEWPORTS not exported');
  assert(utils.SIZE_LIMITS !== undefined, 'SIZE_LIMITS not exported');

  console.log('  ✓ PASSED\n');
  tests.passed++;
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Test 3: filter-css.js exports
try {
  console.log('Test 3: filter-css.js exports validation');
  const filterCss = await import('../src/filter-css.js');

  assert(typeof filterCss.filterCssFile === 'function', 'filterCssFile not function');
  assert(typeof filterCss.analyzeHtml === 'function', 'analyzeHtml not function');
  assert(typeof filterCss.validatePath === 'function', 'validatePath not function');
  assert(typeof filterCss.sanitizeCss === 'function', 'sanitizeCss not function');

  console.log('  ✓ PASSED\n');
  tests.passed++;
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Test 4: extract-assets.js exports
try {
  console.log('Test 4: extract-assets.js exports validation');
  const extractAssets = await import('../src/extract-assets.js');

  assert(typeof extractAssets.extractAssets === 'function', 'extractAssets not function');
  assert(typeof extractAssets.extractCssUrls === 'function', 'extractCssUrls not function');
  assert(typeof extractAssets.downloadFile === 'function', 'downloadFile not function');
  assert(typeof extractAssets.getSafeFilename === 'function', 'getSafeFilename not function');
  assert(typeof extractAssets.getAssetType === 'function', 'getAssetType not function');

  console.log('  ✓ PASSED\n');
  tests.passed++;
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Test 5: clone-site.js exports
try {
  console.log('Test 5: clone-site.js exports validation');
  const cloneSite = await import('../src/clone-site.js');

  assert(typeof cloneSite.cloneSite === 'function', 'cloneSite not function');
  assert(typeof cloneSite.normalizeUrl === 'function', 'normalizeUrl not function');
  assert(typeof cloneSite.isSameDomain === 'function', 'isSameDomain not function');
  assert(typeof cloneSite.pathToFilename === 'function', 'pathToFilename not function');

  console.log('  ✓ PASSED\n');
  tests.passed++;
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Test 6: Argument edge cases
try {
  console.log('Test 6: Argument parsing edge cases');

  let args = parseArgs(['--url', 'https://example.com', '--headless']);
  assert(args.url === 'https://example.com', 'Trailing flag not handled');
  assert(args.headless === true, 'Boolean flag not handled');

  args = parseArgs(['--headless', '--url', 'https://example.com']);
  assert(args.headless === true, 'Flag before value');
  assert(args.url === 'https://example.com', 'Value after flag');

  args = parseArgs(['--headless', '--disable-gpu', '--no-sandbox']);
  assert(args.headless === true, 'First flag failed');
  assert(args['disable-gpu'] === true, 'Second flag failed');
  assert(args['no-sandbox'] === true, 'Third flag failed');

  console.log('  ✓ PASSED\n');
  tests.passed++;
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Test 7: File structure validation (new 5-file architecture)
try {
  console.log('Test 7: File structure validation');

  const coreFiles = ['utils.js', 'capture.js', 'filter-css.js', 'extract-assets.js', 'clone-site.js'];
  for (const file of coreFiles) {
    const filePath = path.join(SRC_DIR, file);
    assert(fs.existsSync(filePath), `${file} missing`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.length > 100, `${file} too small`);
    assert(content.includes('export'), `${file} missing export statements`);
  }

  // Check AI prompt templates exist
  const aiDir = path.join(SRC_DIR, 'ai');
  assert(fs.existsSync(aiDir), 'src/ai directory missing');
  assert(fs.existsSync(path.join(aiDir, 'prompts', 'structure-analysis', 'basic.md')), 'structure-analysis/basic.md missing');
  assert(fs.existsSync(path.join(aiDir, 'prompts', 'design-tokens', 'basic.md')), 'design-tokens/basic.md missing');
  assert(fs.existsSync(path.join(aiDir, 'prompts', 'ux-audit', 'desktop.md')), 'ux-audit/desktop.md missing');

  // Verify old directories are removed
  assert(!fs.existsSync(path.join(SRC_DIR, 'core')), 'src/core should be removed');
  assert(!fs.existsSync(path.join(SRC_DIR, 'verification')), 'src/verification should be removed');
  assert(!fs.existsSync(path.join(SRC_DIR, 'route-discoverers')), 'src/route-discoverers should be removed');
  assert(!fs.existsSync(path.join(SRC_DIR, 'post-process')), 'src/post-process should be removed');
  assert(!fs.existsSync(path.join(SRC_DIR, 'shared')), 'src/shared should be removed');
  assert(!fs.existsSync(path.join(SRC_DIR, 'utils')), 'src/utils should be removed');

  console.log('  ✓ PASSED\n');
  tests.passed++;
} catch (e) {
  console.error('  ✗ FAILED:', e.message, '\n');
  tests.failed++;
}

// Summary
console.log('\n=== INTEGRATION TEST RESULTS ===\n');
console.log(`${tests.passed}/${tests.passed + tests.failed} tests passed`);
process.exit(tests.failed > 0 ? 1 : 0);
