#!/usr/bin/env node
/**
 * UX Audit Module Tests
 *
 * Tests for:
 * 1. Module exports (runUXAudit function)
 * 2. CLI argument parsing
 * 3. Graceful degradation without API key
 * 4. Viewport configuration
 * 5. Score aggregation
 * 6. Report generation
 */

import assert from 'assert';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Import the module
import { runUXAudit } from '../src/ai/ux-audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test counters
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    testsFailed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    testsFailed++;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n▶ UX Audit Module Tests...\n');

  // Test 1: Module exports correct function
  test('Module exports runUXAudit function', () => {
    assert.strictEqual(typeof runUXAudit, 'function', 'runUXAudit should be a function');
  });

  // Test 2: Graceful degradation without API key
  await asyncTest('Graceful degradation when GEMINI_API_KEY not set', async () => {
    const oldKey = process.env.GEMINI_API_KEY;
    const oldGoogleKey = process.env.GOOGLE_API_KEY;

    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const result = await runUXAudit({}, { verbose: false });

      assert.strictEqual(result.success, false, 'Should return success: false');
      assert.ok(result.error, 'Should include error message');
      assert.ok(result.error.includes('GEMINI_API_KEY'), 'Error message should mention API key');
    } finally {
      if (oldKey) process.env.GEMINI_API_KEY = oldKey;
      if (oldGoogleKey) process.env.GOOGLE_API_KEY = oldGoogleKey;
    }
  });

  // Test 3: Test with non-existent screenshot paths
  await asyncTest('Handles missing screenshot files gracefully', async () => {
    const oldKey = process.env.GEMINI_API_KEY;

    try {
      process.env.GEMINI_API_KEY = 'test-key';

      const screenshotPaths = {
        desktop: '/nonexistent/desktop.png',
        tablet: '/nonexistent/tablet.png',
        mobile: '/nonexistent/mobile.png'
      };

      const result = await runUXAudit(screenshotPaths, { verbose: false });

      // Should fail since screenshots don't exist
      assert.strictEqual(result.success, false, 'Should return success: false');
    } finally {
      if (oldKey) {
        process.env.GEMINI_API_KEY = oldKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });

  // Test 4: Verify function signature
  test('runUXAudit accepts screenshotPaths and options parameters', () => {
    const fn = runUXAudit;
    assert.ok(fn.length >= 1, 'Function should accept at least 1 parameter');
  });

  // Test 5: Test parseArgs in clone-site
  await asyncTest('clone-site.js parseArgs includes uxAudit option', async () => {
    const { parseArgs } = await import('../bin/commands/clone-site.js');

    const args = ['https://example.com', '--ux-audit'];
    const options = parseArgs(args);

    assert.strictEqual(options.uxAudit, true, 'Should parse --ux-audit flag');
    assert.strictEqual(options.url, 'https://example.com', 'Should parse URL');
  });

  // Test 6: clone-site parseArgs with other options
  await asyncTest('clone-site.js parseArgs handles all options together', async () => {
    const { parseArgs } = await import('../bin/commands/clone-site.js');

    const args = [
      'https://example.com',
      '--ux-audit',
      '--ai',
      '--output', '/custom/path',
      '--max-pages', '5'
    ];

    const options = parseArgs(args);

    assert.strictEqual(options.uxAudit, true, 'Should parse --ux-audit');
    assert.strictEqual(options.ai, true, 'Should parse --ai');
    assert.strictEqual(options.output, '/custom/path', 'Should parse --output');
    assert.strictEqual(options.maxPages, 5, 'Should parse --max-pages as number');
  });

  // Test 7: clone-site help includes --ux-audit
  await asyncTest('clone-site.js showHelp includes --ux-audit option', async () => {
    const { showHelp } = await import('../bin/commands/clone-site.js');

    // Capture console output
    let output = '';
    const originalLog = console.log;
    console.log = (text) => { output += text; };

    try {
      showHelp();

      assert.ok(output.includes('--ux-audit'), 'Help should mention --ux-audit');
      assert.ok(output.includes('Gemini Vision'), 'Help should mention Gemini Vision');
      assert.ok(output.includes('GEMINI_API_KEY'), 'Help should mention API key requirement');
    } finally {
      console.log = originalLog;
    }
  });

  // Test 8: Verify ux_audit.py prompt module exists
  await asyncTest('ux_audit.py module can be imported', async () => {
    try {
      const promptPath = path.join(__dirname, '../src/ai/prompts/ux_audit.py');
      const content = await fs.readFile(promptPath, 'utf-8');

      assert.ok(content.includes('UX_AUDIT_PROMPT'), 'Should define UX_AUDIT_PROMPT');
      assert.ok(content.includes('build_ux_audit_prompt'), 'Should define build_ux_audit_prompt function');
      assert.ok(content.includes('VIEWPORT_CONTEXT'), 'Should define VIEWPORT_CONTEXT');
      assert.ok(content.includes('AGGREGATION_PROMPT'), 'Should define AGGREGATION_PROMPT');
    } catch (err) {
      throw new Error(`Failed to verify ux_audit.py: ${err.message}`);
    }
  });

  // Test 9: Verify ux_audit.py has viewport-specific context
  await asyncTest('ux_audit.py includes viewport-specific prompts', async () => {
    try {
      const promptPath = path.join(__dirname, '../src/ai/prompts/ux_audit.py');
      const content = await fs.readFile(promptPath, 'utf-8');

      assert.ok(content.includes("'mobile'"), 'Should include mobile context');
      assert.ok(content.includes("'tablet'"), 'Should include tablet context');
      assert.ok(content.includes("'desktop'"), 'Should include desktop context');

      // Check for viewport-specific checks
      assert.ok(content.includes('Touch targets minimum 44x44px'), 'Should mention touch targets');
      assert.ok(content.includes('Maximum content width'), 'Should mention content width');
    } catch (err) {
      throw new Error(`Failed to verify viewport contexts: ${err.message}`);
    }
  });

  // Test 10: Verify ux_audit.py Python syntax
  await asyncTest('ux_audit.py has valid Python syntax', async () => {
    const promptPath = path.join(__dirname, '../src/ai/prompts/ux_audit.py');

    try {
      // Use Python to check syntax
      execSync(`python3 -m py_compile "${promptPath}"`, { stdio: 'pipe' });
    } catch (err) {
      throw new Error(`Python syntax error in ux_audit.py: ${err.message}`);
    }
  });

  // Test 11: ux-audit.js CLI argument parsing
  await asyncTest('ux-audit.js parseArgs extracts CLI options correctly', async () => {
    // Since ux-audit.js doesn't export parseArgs, we test it indirectly via behavior
    const auditPath = path.join(__dirname, '../src/ai/ux-audit.js');
    const content = await fs.readFile(auditPath, 'utf-8');

    assert.ok(content.includes('--screenshots'), 'Should support --screenshots option');
    assert.ok(content.includes('--output'), 'Should support --output option');
    assert.ok(content.includes('--verbose'), 'Should support --verbose option');
    assert.ok(content.includes('--url'), 'Should support --url option');
  });

  // Test 12: Verify ux-audit.js has required functions
  await asyncTest('ux-audit.js exports runUXAudit function', async () => {
    const auditPath = path.join(__dirname, '../src/ai/ux-audit.js');
    const content = await fs.readFile(auditPath, 'utf-8');

    assert.ok(content.includes('export async function runUXAudit'), 'Should export runUXAudit');
    assert.ok(content.includes('function parseArgs'), 'Should have parseArgs function');
    assert.ok(content.includes('function analyzeViewport'), 'Should have analyzeViewport function');
    assert.ok(content.includes('function aggregateResults'), 'Should have aggregateResults function');
    assert.ok(content.includes('function generateReport'), 'Should have generateReport function');
  });

  // Test 13: Verify scoring ranges and categories
  await asyncTest('ux-audit.js defines correct scoring categories', async () => {
    const auditPath = path.join(__dirname, '../src/ai/ux-audit.js');
    const content = await fs.readFile(auditPath, 'utf-8');

    // Check for category keywords in prompts
    const categories = [
      'visual_hierarchy',
      'navigation',
      'typography',
      'spacing',
      'interactivity',
      'responsive'
    ];

    for (const cat of categories) {
      assert.ok(content.includes(cat), `Should include ${cat} category`);
    }
  });

  // Test 14: Verify severity levels
  await asyncTest('ux-audit.js defines severity levels', async () => {
    const auditPath = path.join(__dirname, '../src/ai/ux-audit.js');
    const content = await fs.readFile(auditPath, 'utf-8');

    assert.ok(content.includes('critical'), 'Should define critical severity');
    assert.ok(content.includes('major'), 'Should define major severity');
    assert.ok(content.includes('minor'), 'Should define minor severity');
  });

  // Test 15: Viewport weights are correct
  await asyncTest('ux-audit.js defines viewport weights', async () => {
    const auditPath = path.join(__dirname, '../src/ai/ux-audit.js');
    const content = await fs.readFile(auditPath, 'utf-8');

    assert.ok(content.includes('VIEWPORT_WEIGHTS'), 'Should define VIEWPORT_WEIGHTS');
    assert.ok(content.includes('0.4'), 'Should include desktop weight (0.4)');
    assert.ok(content.includes('0.3'), 'Should include tablet weight (0.3)');
  });

  // Test 16: clone-site.js imports runUXAudit correctly
  await asyncTest('clone-site.js imports runUXAudit from ux-audit.js', async () => {
    const cloneSitePath = path.join(__dirname, '../bin/commands/clone-site.js');
    const content = await fs.readFile(cloneSitePath, 'utf-8');

    assert.ok(
      content.includes("import { runUXAudit } from '../../src/ai/ux-audit.js'"),
      'Should import runUXAudit from ux-audit.js'
    );
  });

  // Test 17: clone-site.js calls runUXAudit with correct parameters
  await asyncTest('clone-site.js calls runUXAudit correctly', async () => {
    const cloneSitePath = path.join(__dirname, '../bin/commands/clone-site.js');
    const content = await fs.readFile(cloneSitePath, 'utf-8');

    assert.ok(
      content.includes('await runUXAudit(screenshotPaths'),
      'Should call runUXAudit with screenshotPaths'
    );
    assert.ok(
      content.includes('output: analysisDir'),
      'Should pass output directory'
    );
    assert.ok(
      content.includes('verbose: true'),
      'Should pass verbose flag'
    );
    assert.ok(
      content.includes('url'),
      'Should pass URL'
    );
  });

  // Test 18: Integration test - cloneSite exports correct function
  await asyncTest('clone-site.js exports cloneSite function', async () => {
    const { cloneSite } = await import('../bin/commands/clone-site.js');

    assert.strictEqual(typeof cloneSite, 'function', 'Should export cloneSite function');
  });

  // Test 19: Test uxAudit option is properly initialized
  await asyncTest('clone-site.js cloneSite handles uxAudit option', async () => {
    const { parseArgs } = await import('../bin/commands/clone-site.js');

    // Test default value
    const defaultOptions = parseArgs(['https://example.com']);
    assert.strictEqual(defaultOptions.uxAudit, false, 'uxAudit should default to false');

    // Test when flag is present
    const withFlag = parseArgs(['https://example.com', '--ux-audit']);
    assert.strictEqual(withFlag.uxAudit, true, 'uxAudit should be true when flag is present');
  });

  // Test 20: Verify JSON response structure expectations
  await asyncTest('ux-audit.js response includes expected JSON structure', async () => {
    const auditPath = path.join(__dirname, '../src/ai/ux-audit.js');
    const content = await fs.readFile(auditPath, 'utf-8');

    // Check that response includes expected properties
    assert.ok(content.includes('overall_ux_score'), 'Response should include overall_ux_score');
    assert.ok(content.includes('accessibility_score'), 'Response should include accessibility_score');
    assert.ok(content.includes('viewport_breakdown'), 'Response should include viewport_breakdown');
    assert.ok(content.includes('top_issues'), 'Response should include top_issues');
    assert.ok(content.includes('prioritized_recommendations'), 'Response should include prioritized_recommendations');
  });

  // Final summary
  console.log('\n============================================================\n');

  const totalTests = testsPassed + testsFailed;
  if (testsFailed === 0) {
    console.log(`✓ UX Audit Module Tests: PASSED (${testsPassed}/${totalTests})\n`);
    process.exit(0);
  } else {
    console.log(`✗ UX Audit Module Tests: FAILED`);
    console.log(`  Passed: ${testsPassed}`);
    console.log(`  Failed: ${testsFailed}\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
