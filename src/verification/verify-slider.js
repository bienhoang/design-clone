#!/usr/bin/env node
/**
 * Slider/Carousel Verification Script
 *
 * Tests slider components:
 * - Library detection (Swiper, Slick, Owl, native)
 * - Arrow/navigation visibility
 * - Pagination dots presence
 * - Autoplay detection (requires 2 slide changes in 6s)
 * - Current slide indicator
 *
 * Usage:
 *   node verify-slider.js --html <path> [--verbose]
 *   node verify-slider.js --url <url> [--verbose]
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
import { testSliderViewport } from './verify-slider-checks.js';

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
 * Capture slider screenshot
 */
async function captureSliderScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;
  await page.evaluate(() => {
    const slider = document.querySelector('[class*="swiper"], [class*="slick"], [class*="owl"], [class*="carousel"], [class*="slider"]');
    if (slider) slider.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 200));
  const screenshotPath = path.join(outputDir, `slider-test-${viewportName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return screenshotPath;
}

/**
 * Main verification function
 */
async function verifySlider() {
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

    if (verbose) console.error(`\n🔍 Verifying slider: ${targetUrl}\n`);

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const results = {
      success: true,
      component: 'slider',
      url: targetUrl,
      viewports: {},
      summary: { totalTests: 0, passed: 0, failed: 0, warnings: [] },
      screenshots: [],
      sliderDetected: false,
      sliderLibrary: null
    };

    for (const viewportName of ['mobile', 'tablet', 'desktop']) {
      const viewportResult = await testSliderViewport(page, viewportName, VIEWPORTS, verbose);
      results.viewports[viewportName] = viewportResult;

      results.summary.totalTests += viewportResult.tests.length;
      results.summary.passed += viewportResult.passed;
      results.summary.failed += viewportResult.failed;
      results.summary.warnings.push(...viewportResult.warnings);

      if (viewportResult.sliderInfo) {
        results.sliderDetected = true;
        results.sliderLibrary = viewportResult.sliderInfo.library;
      }

      if (outputDir) {
        const screenshotPath = await captureSliderScreenshot(page, outputDir, viewportName);
        if (screenshotPath) results.screenshots.push(screenshotPath);
      }
    }

    results.success = results.summary.failed === 0;

    if (args.close === 'true') { await closeBrowser(); } else { await disconnectBrowser(); }

    if (verbose) {
      console.error('\n📊 Summary:');
      console.error(`   Slider: ${results.sliderDetected ? results.sliderLibrary : 'Not detected'}`);
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

verifySlider();
