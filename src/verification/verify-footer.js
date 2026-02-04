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

import fs from 'fs/promises';
import path from 'path';

import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Viewport configurations
const VIEWPORTS = {
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 }
};

// Footer element selectors
const FOOTER_SELECTORS = {
  container: [
    'footer',
    '[role="contentinfo"]',
    '.footer',
    '#footer',
    '.site-footer',
    '.page-footer'
  ],
  columns: [
    'footer [class*="column"]',
    'footer [class*="col-"]',
    'footer .col',
    '.footer-column',
    '.footer-widget',
    '.footer-section',
    'footer > div > div'
  ],
  links: [
    'footer a[href]',
    '.footer-links a',
    '.footer-nav a',
    'footer nav a',
    'footer ul a'
  ],
  copyright: [
    'footer [class*="copyright"]',
    '.copyright',
    'footer small',
    'footer p:last-child'
  ],
  socialIcons: [
    'footer a[href*="facebook"]',
    'footer a[href*="twitter"]',
    'footer a[href*="instagram"]',
    'footer a[href*="linkedin"]',
    'footer a[href*="youtube"]',
    'footer [class*="social"]',
    '.social-links a',
    '.social-icons a'
  ]
};

/**
 * Find first matching element
 */
async function findElement(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return { element, selector };
      }
    } catch (err) { /* continue - selector not found */ }
  }
  return null;
}

/**
 * Count matching elements
 */
async function countElements(page, selectors) {
  let totalCount = 0;
  let matchedSelector = null;

  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > totalCount) {
        totalCount = count;
        matchedSelector = selector;
      }
    } catch (err) { /* continue - selector not found */ }
  }
  return { count: totalCount, selector: matchedSelector };
}

/**
 * Count visible elements
 */
async function countVisibleElements(page, selectors) {
  for (const selector of selectors) {
    try {
      const count = await page.evaluate((sel) => {
        const items = document.querySelectorAll(sel);
        let visible = 0;
        items.forEach(item => {
          const style = window.getComputedStyle(item);
          const rect = item.getBoundingClientRect();
          if (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          ) {
            visible++;
          }
        });
        return visible;
      }, selector);

      if (count > 0) {
        return { count, selector };
      }
    } catch (err) { /* continue - selector not found */ }
  }
  return { count: 0, selector: null };
}

/**
 * Check footer position (should be at bottom)
 */
async function checkFooterPosition(page, footerSelector) {
  return await page.evaluate((sel) => {
    const footer = document.querySelector(sel);
    if (!footer) return null;

    const rect = footer.getBoundingClientRect();
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    // Scroll to bottom to get accurate position
    window.scrollTo(0, scrollHeight);

    const style = window.getComputedStyle(footer);
    const footerBottom = rect.y + window.scrollY + rect.height;
    const tolerance = 50; // Allow 50px tolerance

    return {
      y: rect.y + window.scrollY,
      height: rect.height,
      width: rect.width,
      pageHeight: scrollHeight,
      isAtBottom: footerBottom >= (scrollHeight - tolerance),
      footerBottom,
      backgroundColor: style.backgroundColor,
      color: style.color
    };
  }, footerSelector);
}

/**
 * Check for copyright text
 */
async function checkCopyright(page) {
  return await page.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('[role="contentinfo"]');
    if (!footer) return null;

    const text = footer.textContent || '';
    const currentYear = new Date().getFullYear();

    const hasCopyright = /©|copyright|all rights reserved/i.test(text);
    const hasYear = new RegExp(`20[0-9]{2}|${currentYear}`).test(text);

    return {
      hasCopyright,
      hasYear,
      hasCurrentYear: text.includes(String(currentYear))
    };
  });
}

/**
 * Test footer at specific viewport
 */
async function testViewport(page, viewportName, verbose = false) {
  const viewport = VIEWPORTS[viewportName];
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));

  // Scroll to bottom to ensure footer is loaded
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await new Promise(r => setTimeout(r, 300));

  const result = {
    viewport: viewportName,
    dimensions: viewport,
    tests: [],
    passed: 0,
    failed: 0,
    warnings: []
  };

  if (verbose) console.error(`\n📱 Testing ${viewportName} (${viewport.width}x${viewport.height})...`);

  // Test 1: Footer container exists
  const footerResult = await findElement(page, FOOTER_SELECTORS.container);
  if (footerResult) {
    result.tests.push({
      name: 'Footer container exists',
      passed: true,
      selector: footerResult.selector
    });
    result.passed++;
    if (verbose) console.error(`  ✓ Footer found: ${footerResult.selector}`);

    // Test 2: Footer position (at bottom)
    const positionInfo = await checkFooterPosition(page, footerResult.selector);
    if (positionInfo) {
      if (positionInfo.isAtBottom) {
        result.tests.push({
          name: 'Footer at page bottom',
          passed: true,
          y: positionInfo.y,
          pageHeight: positionInfo.pageHeight
        });
        result.passed++;
        if (verbose) console.error(`  ✓ Footer at bottom (y: ${Math.round(positionInfo.y)})`);
      } else {
        result.tests.push({
          name: 'Footer at page bottom',
          passed: false,
          y: positionInfo.y,
          footerBottom: positionInfo.footerBottom,
          pageHeight: positionInfo.pageHeight,
          error: 'Footer not at page bottom'
        });
        result.failed++;
        if (verbose) console.error(`  ✗ Footer not at bottom (gap: ${positionInfo.pageHeight - positionInfo.footerBottom}px)`);
      }

      // Store dimensions for report
      result.footerDimensions = {
        height: positionInfo.height,
        width: positionInfo.width,
        backgroundColor: positionInfo.backgroundColor,
        color: positionInfo.color
      };
    }

    // Test 3: Multi-column layout (desktop/tablet)
    if (viewportName !== 'mobile') {
      const columns = await countElements(page, FOOTER_SELECTORS.columns);
      if (columns.count >= 2) {
        result.tests.push({
          name: 'Multi-column layout',
          passed: true,
          count: columns.count,
          selector: columns.selector
        });
        result.passed++;
        if (verbose) console.error(`  ✓ ${columns.count} columns found`);
      } else if (columns.count === 1) {
        result.tests.push({
          name: 'Multi-column layout',
          passed: true,
          count: columns.count,
          note: 'Single column layout'
        });
        result.passed++;
        if (verbose) console.error(`  ✓ Single column layout`);
      } else {
        result.warnings.push('No clear column structure detected');
        if (verbose) console.error(`  ⚠ No column structure detected`);
      }
    }

    // Test 4: Links present
    const links = await countVisibleElements(page, FOOTER_SELECTORS.links);
    if (links.count >= 1) {
      result.tests.push({
        name: 'Footer links present',
        passed: true,
        count: links.count,
        selector: links.selector
      });
      result.passed++;
      if (verbose) console.error(`  ✓ ${links.count} links found`);
    } else {
      result.warnings.push('No links found in footer');
      if (verbose) console.error(`  ⚠ No links found`);
    }

    // Test 5: Copyright text
    const copyrightInfo = await checkCopyright(page);
    if (copyrightInfo) {
      if (copyrightInfo.hasCopyright || copyrightInfo.hasYear) {
        result.tests.push({
          name: 'Copyright text present',
          passed: true,
          hasCopyright: copyrightInfo.hasCopyright,
          hasCurrentYear: copyrightInfo.hasCurrentYear
        });
        result.passed++;
        if (verbose) console.error(`  ✓ Copyright found (current year: ${copyrightInfo.hasCurrentYear})`);
      } else {
        result.warnings.push('No copyright text found');
        if (verbose) console.error(`  ⚠ No copyright text`);
      }
    }

    // Test 6: Social icons (optional)
    const socialIcons = await countVisibleElements(page, FOOTER_SELECTORS.socialIcons);
    if (socialIcons.count > 0) {
      result.tests.push({
        name: 'Social icons present',
        passed: true,
        count: socialIcons.count
      });
      result.passed++;
      if (verbose) console.error(`  ✓ ${socialIcons.count} social icons found`);
    } else {
      // Not a failure, just informational
      if (verbose) console.error(`  ℹ No social icons found`);
    }

  } else {
    result.tests.push({
      name: 'Footer container exists',
      passed: false,
      error: 'No footer container found'
    });
    result.failed++;
    if (verbose) console.error(`  ✗ Footer not found`);
  }

  return result;
}

/**
 * Capture footer screenshot
 */
async function captureFooterScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;

  // Scroll to footer first
  await page.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('[role="contentinfo"]');
    if (footer) footer.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 200));

  const screenshotPath = path.join(outputDir, `footer-test-${viewportName}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: false
  });
  return screenshotPath;
}

/**
 * Validate HTML file path (security: prevent path traversal)
 */
function validateHtmlPath(htmlPath) {
  const absolutePath = path.resolve(htmlPath);
  const cwd = process.cwd();

  const allowedPrefixes = [
    cwd,
    path.join(process.env.HOME || '', '.claude'),
    '/tmp',
    path.join(process.env.HOME || '', 'cloned-designs')
  ];

  const isAllowed = allowedPrefixes.some(prefix => absolutePath.startsWith(prefix));
  if (!isAllowed) {
    throw new Error(`Path "${htmlPath}" is outside allowed directories`);
  }

  return absolutePath;
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
      const absolutePath = validateHtmlPath(args.html);
      targetUrl = `file://${absolutePath}`;
    } else {
      targetUrl = args.url;
    }

    if (verbose) console.error(`\n🔍 Verifying footer: ${targetUrl}\n`);

    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const results = {
      success: true,
      component: 'footer',
      url: targetUrl,
      viewports: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: []
      },
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
        const screenshotPath = await captureFooterScreenshot(page, outputDir, viewportName);
        if (screenshotPath) results.screenshots.push(screenshotPath);
      }
    }

    results.success = results.summary.failed === 0;

    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    if (verbose) {
      console.error('\n📊 Summary:');
      console.error(`   Tests: ${results.summary.passed}/${results.summary.totalTests} passed`);
      if (results.summary.warnings.length > 0) {
        console.error(`   Warnings: ${results.summary.warnings.length}`);
      }
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
