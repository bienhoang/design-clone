#!/usr/bin/env node
/**
 * Responsive Menu Verification Script
 *
 * Tests menu functionality across viewports:
 * - Mobile (375px) - hamburger menu toggle
 * - Tablet (768px) - responsive behavior
 * - Desktop (1920px) - full menu visibility
 *
 * Usage:
 *   node verify-menu.js --html <path> [--verbose]
 *   node verify-menu.js --url <url> [--verbose]
 *
 * Options:
 *   --html      Path to local HTML file (required if no --url)
 *   --url       URL to test (required if no --html)
 *   --output    Output directory for screenshots (optional)
 *   --verbose   Show detailed progress
 */

import path from 'path';

import { getBrowser, getPage, closeBrowser, disconnectBrowser } from '../utils/browser.js';
import { parseArgs, outputJSON, outputError } from '../utils/helpers.js';
import { VIEWPORTS_HD as VIEWPORTS } from '../shared/viewports.js';
import { MENU_SELECTORS, findElement, countVisibleMenuItems } from './verify-menu-helpers.js';
import { testDesktopMenu, testMobileMenu } from './verify-menu-checks.js';

/**
 * Test menu at specific viewport
 */
async function testViewport(page, viewportName, verbose = false) {
  const viewport = VIEWPORTS[viewportName];
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));

  const result = { viewport: viewportName, dimensions: viewport, tests: [], passed: 0, failed: 0, warnings: [] };
  if (verbose) console.error(`\n📱 Testing ${viewportName} (${viewport.width}x${viewport.height})...`);

  const navResult = await findElement(page, MENU_SELECTORS.navContainers);
  if (navResult) {
    result.tests.push({ name: 'Navigation container exists', passed: true, selector: navResult.selector });
    result.passed++;
    if (verbose) console.error(`  ✓ Navigation container found: ${navResult.selector}`);
  } else {
    result.tests.push({ name: 'Navigation container exists', passed: false, error: 'No navigation container found' });
    result.failed++;
    if (verbose) console.error(`  ✗ Navigation container not found`);
  }

  const menuItems = await countVisibleMenuItems(page);

  if (viewportName === 'desktop') {
    await testDesktopMenu(page, result, menuItems, verbose);
  } else {
    await testMobileMenu(page, result, menuItems, verbose);
  }

  return result;
}

/**
 * Capture screenshot for debugging
 */
async function captureDebugScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;
  const screenshotPath = path.join(outputDir, `menu-test-${viewportName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

/**
 * Main verification function
 */
async function verifyMenu() {
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

    const targetUrl = args.html ? `file://${path.resolve(args.html)}` : args.url;
    if (verbose) console.error(`\n🔍 Verifying responsive menu: ${targetUrl}\n`);

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const results = {
      success: true,
      url: targetUrl,
      viewports: {},
      summary: { totalTests: 0, passed: 0, failed: 0, warnings: [] },
      screenshots: []
    };

    for (const viewportName of ['mobile', 'tablet', 'desktop']) {
      const viewportResult = await testViewport(page, viewportName, verbose);
      results.viewports[viewportName] = viewportResult;

      results.summary.totalTests += viewportResult.tests.length;
      results.summary.passed += viewportResult.passed;
      results.summary.failed += viewportResult.failed;
      results.summary.warnings.push(...viewportResult.warnings);

      if (outputDir) {
        const screenshotPath = await captureDebugScreenshot(page, outputDir, viewportName);
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

verifyMenu();
