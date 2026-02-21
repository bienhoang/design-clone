#!/usr/bin/env node
/**
 * Footer Verification Script
 *
 * Tests footer components across viewports:
 * - Position at bottom of page
 * - Multi-column layout detection
 * - Link sections completeness
 * - Copyright text presence
 * - Social icons
 * - Background contrast
 *
 * Usage:
 *   node verify-footer.js --html <path> [--verbose]
 *   node verify-footer.js --url <url> [--verbose]
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
import { testFooterViewport } from './verify-footer-checks.js';

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
 * Capture footer screenshot
 */
async function captureFooterScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;
  await page.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('[role="contentinfo"]');
    if (footer) footer.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 200));
  const screenshotPath = path.join(outputDir, `footer-test-${viewportName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

/**
 * Main verification function
 */
async function verifyFooter() {
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

    if (verbose) console.error(`\n🔍 Verifying footer: ${targetUrl}\n`);

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const results = {
      success: true,
      component: 'footer',
      url: targetUrl,
      viewports: {},
      summary: { totalTests: 0, passed: 0, failed: 0, warnings: [] },
      screenshots: []
    };

    for (const viewportName of ['mobile', 'tablet', 'desktop']) {
      const viewportResult = await testFooterViewport(page, viewportName, VIEWPORTS, verbose);
      results.viewports[viewportName] = viewportResult;

      results.summary.totalTests += viewportResult.tests.length;
      results.summary.passed += viewportResult.passed;
      results.summary.failed += viewportResult.failed;
      results.summary.warnings.push(...viewportResult.warnings);

      if (outputDir) {
        const screenshotPath = await captureFooterScreenshot(page, outputDir, viewportName);
        if (screenshotPath) results.screenshots.push(screenshotPath);
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

verifyFooter();
