#!/usr/bin/env node
/**
 * Integration test for dimension extraction (Phase 5 validation)
 * Tests TC1-TC4 automatically
 *
 * Usage:
 *   node tests/test-dimension-extraction.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = path.resolve(__dirname, '..');

const TEST_URL = 'https://www.techno-concier.co.jp';
const OUTPUT_DIR = path.join(SCRIPT_DIR, 'test-output-dimensions');

// Expected values from techno-concier.co.jp (verified manually)
const EXPECTED = {
  h1FontSize: 48,
  h2FontSize: 40,
  containerWidthMin: 1000,
  typographyCount: 4, // h1, h2, h3, p minimum
};

const TOLERANCE = {
  fontSize: 2,      // ±2px
  containerWidth: 200,  // ±200px (sites vary)
};

async function runTest() {
  console.log('='.repeat(60));
  console.log('Dimension Extraction Integration Test');
  console.log('='.repeat(60));
  console.log(`URL: ${TEST_URL}\n`);

  // Clean previous output
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }

  // Run extraction
  console.log('Step 1: Running screenshot.js with extraction...');
  try {
    execSync(
      `node ${path.join(SCRIPT_DIR, 'src/core/screenshot.js')} ` +
      `--url "${TEST_URL}" ` +
      `--output "${OUTPUT_DIR}" ` +
      `--extract-html --extract-css ` +
      `--headless=true --close=true`,
      { stdio: 'pipe', timeout: 120000 }
    );
    console.log('✓ Extraction complete\n');
  } catch (err) {
    console.log('✗ Extraction failed');
    console.error(err.message);
    process.exit(1);
  }

  // Load results
  const dimensionsPath = path.join(OUTPUT_DIR, 'component-dimensions.json');
  const summaryPath = path.join(OUTPUT_DIR, 'dimensions-summary.json');

  if (!fs.existsSync(dimensionsPath)) {
    console.log('✗ component-dimensions.json not found');
    process.exit(1);
  }

  const dimensions = JSON.parse(fs.readFileSync(dimensionsPath, 'utf-8'));
  const summary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
    : null;

  const desktop = dimensions.viewports?.desktop;
  let passed = 0;
  let failed = 0;

  // TC1: Dimension Extraction Accuracy
  console.log('Step 2: TC1 - Dimension Extraction Accuracy');
  const h1 = desktop?.typography?.find(t => t.selector === 'h1');
  if (h1 && Math.abs(h1.fontSize - EXPECTED.h1FontSize) <= TOLERANCE.fontSize) {
    console.log(`  ✓ H1 font-size: ${h1.fontSize}px (expected ${EXPECTED.h1FontSize}±${TOLERANCE.fontSize}px)`);
    passed++;
  } else {
    console.log(`  ✗ H1 font-size: ${h1?.fontSize || 'N/A'}px (expected ${EXPECTED.h1FontSize}±${TOLERANCE.fontSize}px)`);
    failed++;
  }

  const h2 = desktop?.typography?.find(t => t.selector === 'h2');
  if (h2 && Math.abs(h2.fontSize - EXPECTED.h2FontSize) <= TOLERANCE.fontSize) {
    console.log(`  ✓ H2 font-size: ${h2.fontSize}px (expected ${EXPECTED.h2FontSize}±${TOLERANCE.fontSize}px)`);
    passed++;
  } else {
    console.log(`  ✗ H2 font-size: ${h2?.fontSize || 'N/A'}px (expected ${EXPECTED.h2FontSize}±${TOLERANCE.fontSize}px)`);
    failed++;
  }

  // TC2: Card Pattern Detection
  console.log('\nStep 3: TC2 - Card Pattern Detection');
  const cardCount = desktop?.cards?.length || 0;
  if (cardCount > 0) {
    console.log(`  ✓ Card groups detected: ${cardCount}`);
    passed++;
  } else {
    console.log(`  ✗ No card groups detected`);
    failed++;
  }

  // TC3: Multi-Viewport Consistency
  console.log('\nStep 4: TC3 - Multi-Viewport Consistency');
  const viewportCount = Object.keys(dimensions.viewports || {}).length;
  if (viewportCount >= 3) {
    console.log(`  ✓ Viewports captured: ${viewportCount} (desktop, tablet, mobile)`);
    passed++;
  } else {
    console.log(`  ✗ Viewports captured: ${viewportCount} (expected 3)`);
    failed++;
  }

  // Check typography scaling
  const typeSummary = dimensions.summary?.typography;
  if (typeSummary?.h1?.desktop && typeSummary?.h1?.mobile) {
    if (typeSummary.h1.desktop > typeSummary.h1.mobile) {
      console.log(`  ✓ Typography scales: H1 ${typeSummary.h1.desktop}px → ${typeSummary.h1.mobile}px`);
      passed++;
    } else {
      console.log(`  ✗ Typography scaling incorrect`);
      failed++;
    }
  } else {
    console.log(`  ✗ Typography summary missing`);
    failed++;
  }

  // TC4: AI Summary Format
  console.log('\nStep 5: TC4 - AI Summary Format');
  if (summary && summary.EXACT_DIMENSIONS && summary.EXACT_TYPOGRAPHY) {
    console.log(`  ✓ dimensions-summary.json has correct structure`);
    passed++;

    if (summary._comment?.includes('DO NOT ESTIMATE')) {
      console.log(`  ✓ Summary includes "DO NOT ESTIMATE" directive`);
      passed++;
    } else {
      console.log(`  ✗ Missing "DO NOT ESTIMATE" directive`);
      failed++;
    }
  } else {
    console.log(`  ✗ dimensions-summary.json missing or malformed`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  // Cleanup
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
    console.log('\nTest output cleaned up.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
