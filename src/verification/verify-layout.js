#!/usr/bin/env node
/**
 * Layout Verification Script
 *
 * Compares generated HTML against original website screenshots
 * to identify layout discrepancies.
 *
 * Usage:
 *   node verify-layout.js --html <path> --original <dir> [--output <dir>] [--verbose]
 *
 * Options:
 *   --html      Path to generated HTML file
 *   --original  Directory containing original screenshots (desktop.png, tablet.png, mobile.png)
 *   --output    Output directory for comparison screenshots and report
 *   --verbose   Show detailed progress
 */

import fs from 'fs/promises';
import path from 'path';

import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';
import { VIEWPORTS_HD as VIEWPORTS } from '../shared/viewports.js';
import { generateCSSFixes, writeReport } from './verify-layout-report.js';

/**
 * Capture screenshot of generated HTML at specific viewport
 */
async function captureGeneratedScreenshot(page, viewport, outputPath) {
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

/**
 * Basic image comparison by file size difference.
 * For accurate comparison, use Claude Code vision directly.
 */
async function basicImageCompare(originalPath, generatedPath) {
  try {
    const originalStats = await fs.stat(originalPath);
    const generatedStats = await fs.stat(generatedPath);

    const sizeDiff = Math.abs(originalStats.size - generatedStats.size) / originalStats.size;
    const similarity = Math.max(0, 100 - (sizeDiff * 100));

    return {
      success: true,
      method: 'basic',
      similarity_score: Math.round(similarity),
      note: 'Basic comparison - use Claude Code vision for accurate analysis'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Main verification function
 */
async function verifyLayout() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.html) {
    outputError(new Error('--html is required'));
    process.exit(1);
  }

  if (!args.original) {
    outputError(new Error('--original directory is required'));
    process.exit(1);
  }

  const verbose = args.verbose === 'true';
  const outputDir = args.output || path.dirname(args.html);

  await fs.mkdir(outputDir, { recursive: true });

  try {
    if (verbose) console.error('\n🔍 Starting layout verification...\n');

    // Check original screenshots exist
    const originalScreenshots = {};
    for (const viewport of ['desktop', 'tablet', 'mobile']) {
      const screenshotPath = path.join(args.original, `${viewport}.png`);
      try {
        await fs.access(screenshotPath);
        originalScreenshots[viewport] = screenshotPath;
        if (verbose) console.error(`  ✓ Found ${viewport}.png`);
      } catch {
        if (verbose) console.error(`  ⚠ Missing ${viewport}.png`);
      }
    }

    if (Object.keys(originalScreenshots).length === 0) {
      outputError(new Error('No original screenshots found'));
      process.exit(1);
    }

    if (verbose) console.error('\n📸 Capturing generated screenshots...\n');

    const browser = await getBrowser({ headless: args.headless !== 'false' });
    const page = await getPage(browser);

    const absolutePath = path.resolve(args.html);
    await page.goto(`file://${absolutePath}`, { waitUntil: 'networkidle', timeout: 30000 });

    const generatedScreenshots = {};
    for (const [viewport, config] of Object.entries(VIEWPORTS)) {
      if (originalScreenshots[viewport]) {
        const outputPath = path.join(outputDir, `generated-${viewport}.png`);
        await captureGeneratedScreenshot(page, config, outputPath);
        generatedScreenshots[viewport] = outputPath;
        if (verbose) console.error(`  ✓ Captured ${viewport}`);
      }
    }

    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    if (verbose) console.error('\n🔬 Comparing layouts...\n');

    const results = { success: true, html: args.html, viewports: {}, overall_score: 0, all_fixes: [] };
    let totalScore = 0;
    let viewportCount = 0;

    for (const [viewport, originalPath] of Object.entries(originalScreenshots)) {
      const generatedPath = generatedScreenshots[viewport];
      if (!generatedPath) continue;

      if (verbose) console.error(`  Comparing ${viewport}...`);

      const comparison = await basicImageCompare(originalPath, generatedPath);
      results.viewports[viewport] = comparison;

      if (comparison.success && comparison.similarity_score !== undefined) {
        totalScore += comparison.similarity_score;
        viewportCount++;

        const icon = comparison.similarity_score >= 90 ? '✅' : comparison.similarity_score >= 70 ? '⚠️' : '❌';
        if (verbose) console.error(`    ${icon} Similarity: ${comparison.similarity_score}%`);

        if (comparison.discrepancies?.length > 0) {
          if (verbose) console.error(`    Found ${comparison.discrepancies.length} discrepancies`);
          results.all_fixes.push(...generateCSSFixes(comparison.discrepancies));
        }
      } else if (!comparison.success) {
        if (verbose) console.error(`    ❌ Error: ${comparison.error}`);
      }
    }

    results.overall_score = viewportCount > 0 ? Math.round(totalScore / viewportCount) : 0;
    results.success = results.overall_score >= 70;

    const reportPath = await writeReport(outputDir, results);
    results.report = reportPath;

    if (verbose) {
      console.error('\n📊 Summary:');
      console.error(`   Overall Score: ${results.overall_score}%`);
      console.error(`   Status: ${results.success ? '✓ PASS' : '✗ NEEDS FIXES'}`);
      console.error(`   Report: ${reportPath}\n`);
    }

    outputJSON(results);
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

verifyLayout();
