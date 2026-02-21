#!/usr/bin/env node
/**
 * Header Verification Script
 *
 * Tests header components across viewports:
 * - Logo presence and positioning
 * - Navigation links visibility
 * - CTA buttons
 * - Sticky/fixed behavior
 * - Z-index layering
 * - Height consistency
 *
 * Usage:
 *   node verify-header.js --html <path> [--verbose]
 *   node verify-header.js --url <url> [--verbose]
 *
 * Options:
 *   --html      Path to local HTML file
 *   --url       URL to test
 *   --output    Output directory for screenshots
 *   --verbose   Show detailed progress
 */

import path from 'path';

import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';
import { VIEWPORTS_HD as VIEWPORTS } from '../shared/viewports.js';
import { testHeaderViewport } from './verify-header-checks.js';

/**
 * Validate HTML file path (security: prevent path traversal)
 */
function validateHtmlPath(htmlPath) {
  const absolutePath = path.resolve(htmlPath);
  const allowedPrefixes = [
    process.cwd(),
    path.join(process.env.HOME || '', '.claude'),
    '/tmp',
    path.join(process.env.HOME || '', 'cloned-designs')
  ];
  const isAllowed = allowedPrefixes.some(prefix => absolutePath.startsWith(prefix));
  if (!isAllowed) throw new Error(`Path "${htmlPath}" is outside allowed directories`);
  return absolutePath;
}

/**
 * Capture header screenshot
 */
async function captureHeaderScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;
  const screenshotPath = path.join(outputDir, `header-test-${viewportName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

/**
 * Main verification function
 */
async function verifyHeader() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.html && !args.url) {
    outputError(new Error('Either --html or --url is required'));
    process.exit(1);
  }

  const verbose = args.verbose === 'true';
  const outputDir = args.output;

  try {
    const browser = await getBrowser({ headless: args.headless !== 'false' });
    const page = await getPage(browser);

    let targetUrl;
    if (args.html) {
      targetUrl = `file://${validateHtmlPath(args.html)}`;
    } else {
      targetUrl = args.url;
    }

    if (verbose) console.error(`\n🔍 Verifying header: ${targetUrl}\n`);

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const results = {
      success: true,
      component: 'header',
      url: targetUrl,
      viewports: {},
      summary: { totalTests: 0, passed: 0, failed: 0, warnings: [] },
      screenshots: [],
      heightConsistency: {}
    };

    for (const viewportName of ['mobile', 'tablet', 'desktop']) {
      const viewportResult = await testHeaderViewport(page, viewportName, VIEWPORTS, verbose);
      results.viewports[viewportName] = viewportResult;

      results.summary.totalTests += viewportResult.tests.length;
      results.summary.passed += viewportResult.passed;
      results.summary.failed += viewportResult.failed;
      results.summary.warnings.push(...viewportResult.warnings);

      if (viewportResult.headerHeight) {
        results.heightConsistency[viewportName] = viewportResult.headerHeight;
      }

      if (outputDir) {
        const screenshotPath = await captureHeaderScreenshot(page, outputDir, viewportName);
        if (screenshotPath) results.screenshots.push(screenshotPath);
      }
    }

    // Height consistency check
    const heights = Object.values(results.heightConsistency);
    if (heights.length >= 2) {
      const maxDiff = Math.max(...heights) - Math.min(...heights);
      if (maxDiff > 20) {
        results.summary.warnings.push(`Header height varies by ${maxDiff}px across viewports`);
      }
    }

    results.success = results.summary.failed === 0;

    if (args.close === 'true') { await closeBrowser(); } else { await disconnectBrowser(); }

    if (verbose) {
      console.error('\n📊 Summary:');
      console.error(`   Tests: ${results.summary.passed}/${results.summary.totalTests} passed`);
      if (results.summary.warnings.length > 0) console.error(`   Warnings: ${results.summary.warnings.length}`);
      console.error(`   Status: ${results.success ? '✓ PASS' : '✗ FAIL'}\n`);
    }

    outputJSON(results);
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

verifyHeader();
