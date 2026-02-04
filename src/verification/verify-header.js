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

import fs from 'fs/promises';
import path from 'path';

import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Viewport configurations
const VIEWPORTS = {
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 }
};

// Header element selectors
const HEADER_SELECTORS = {
  container: [
    'header',
    '[role="banner"]',
    '.header',
    '#header',
    '.site-header',
    '.page-header',
    '.masthead'
  ],
  logo: [
    'header img[alt*="logo" i]',
    '[role="banner"] img',
    '.logo img',
    '.site-logo img',
    '.logo',
    '.site-logo',
    'header a[href="/"] img',
    '.brand img',
    '.navbar-brand img'
  ],
  nav: [
    'header nav',
    'header [role="navigation"]',
    '.header-nav',
    '.main-navigation',
    '.primary-nav',
    '.site-nav',
    '.navbar-nav'
  ],
  cta: [
    'header button.cta',
    'header a[class*="button"]',
    'header a[class*="btn"]',
    '.header-action',
    '.nav-cta',
    'header .btn-primary',
    'header a[href*="contact"]',
    'header a[href*="signup"]',
    'header a[href*="login"]'
  ],
  navLinks: [
    'header nav a',
    'header [role="navigation"] a',
    '.main-navigation a',
    '.nav-item a',
    '.menu-item a'
  ]
};

/**
 * Find first matching element from selectors
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
 * Check header position properties
 */
async function checkHeaderPosition(page, headerSelector) {
  return await page.evaluate((sel) => {
    const header = document.querySelector(sel);
    if (!header) return null;

    const style = window.getComputedStyle(header);
    const rect = header.getBoundingClientRect();

    return {
      position: style.position,
      isSticky: style.position === 'sticky',
      isFixed: style.position === 'fixed',
      zIndex: parseInt(style.zIndex) || 'auto',
      top: rect.top,
      height: rect.height,
      width: rect.width
    };
  }, headerSelector);
}

/**
 * Check logo position (typically left or center)
 */
async function checkLogoPosition(page, logoSelector, headerWidth) {
  return await page.evaluate((sel, width) => {
    const logo = document.querySelector(sel);
    if (!logo) return null;

    const rect = logo.getBoundingClientRect();
    const centerThreshold = width * 0.35;

    let position = 'unknown';
    if (rect.left < centerThreshold) {
      position = 'left';
    } else if (rect.left > width - centerThreshold) {
      position = 'right';
    } else {
      position = 'center';
    }

    return {
      position,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }, logoSelector, headerWidth);
}

/**
 * Test header at specific viewport
 */
async function testViewport(page, viewportName, verbose = false) {
  const viewport = VIEWPORTS[viewportName];
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));

  const result = {
    viewport: viewportName,
    dimensions: viewport,
    tests: [],
    passed: 0,
    failed: 0,
    warnings: []
  };

  if (verbose) console.error(`\n📱 Testing ${viewportName} (${viewport.width}x${viewport.height})...`);

  // Test 1: Header container exists
  const headerResult = await findElement(page, HEADER_SELECTORS.container);
  if (headerResult) {
    result.tests.push({
      name: 'Header container exists',
      passed: true,
      selector: headerResult.selector
    });
    result.passed++;
    if (verbose) console.error(`  ✓ Header found: ${headerResult.selector}`);

    // Get header position info
    const positionInfo = await checkHeaderPosition(page, headerResult.selector);

    // Test 2: Logo presence
    const logoResult = await findElement(page, HEADER_SELECTORS.logo);
    if (logoResult) {
      const logoPosition = await checkLogoPosition(page, logoResult.selector, viewport.width);
      result.tests.push({
        name: 'Logo present',
        passed: true,
        selector: logoResult.selector,
        position: logoPosition?.position || 'unknown'
      });
      result.passed++;
      if (verbose) console.error(`  ✓ Logo found: ${logoResult.selector} (${logoPosition?.position})`);
    } else {
      result.tests.push({
        name: 'Logo present',
        passed: false,
        error: 'No logo found'
      });
      result.failed++;
      if (verbose) console.error(`  ✗ Logo not found`);
    }

    // Test 3: Navigation links
    const navLinks = await countVisibleElements(page, HEADER_SELECTORS.navLinks);
    const expectedLinks = viewportName === 'desktop' ? 2 : 0;

    if (navLinks.count >= expectedLinks) {
      result.tests.push({
        name: 'Navigation links visible',
        passed: true,
        count: navLinks.count,
        selector: navLinks.selector
      });
      result.passed++;
      if (verbose) console.error(`  ✓ ${navLinks.count} nav links visible`);
    } else if (viewportName !== 'desktop' && navLinks.count === 0) {
      // Mobile/tablet may hide links behind hamburger
      result.tests.push({
        name: 'Navigation links (may be in hamburger)',
        passed: true,
        count: navLinks.count,
        note: 'Links may be hidden in mobile menu'
      });
      result.passed++;
      if (verbose) console.error(`  ✓ Nav links hidden (expected on ${viewportName})`);
    } else {
      result.tests.push({
        name: 'Navigation links visible',
        passed: false,
        count: navLinks.count,
        error: `Expected at least ${expectedLinks} links on ${viewportName}`
      });
      result.failed++;
      if (verbose) console.error(`  ✗ Only ${navLinks.count} nav links (expected >= ${expectedLinks})`);
    }

    // Test 4: CTA buttons (desktop only)
    if (viewportName === 'desktop') {
      const ctaResult = await findElement(page, HEADER_SELECTORS.cta);
      if (ctaResult) {
        result.tests.push({
          name: 'CTA button present',
          passed: true,
          selector: ctaResult.selector
        });
        result.passed++;
        if (verbose) console.error(`  ✓ CTA found: ${ctaResult.selector}`);
      } else {
        result.warnings.push('No CTA button found in header');
        if (verbose) console.error(`  ⚠ No CTA button found`);
      }
    }

    // Test 5: Sticky/fixed behavior
    if (positionInfo) {
      if (positionInfo.isSticky || positionInfo.isFixed) {
        result.tests.push({
          name: 'Header sticky/fixed behavior',
          passed: true,
          position: positionInfo.position
        });
        result.passed++;
        if (verbose) console.error(`  ✓ Header is ${positionInfo.position}`);
      } else {
        result.tests.push({
          name: 'Header sticky/fixed behavior',
          passed: true,
          position: positionInfo.position,
          note: 'Header uses static/relative positioning'
        });
        result.passed++;
        if (verbose) console.error(`  ✓ Header position: ${positionInfo.position}`);
      }

      // Test 6: Z-index check (should be high for sticky/fixed)
      if ((positionInfo.isSticky || positionInfo.isFixed) && positionInfo.zIndex !== 'auto') {
        const zIndexOk = positionInfo.zIndex >= 100;
        result.tests.push({
          name: 'Z-index layering',
          passed: zIndexOk,
          zIndex: positionInfo.zIndex,
          note: zIndexOk ? 'Header on top layer' : 'Z-index may be too low'
        });
        if (zIndexOk) result.passed++;
        else result.warnings.push(`Header z-index (${positionInfo.zIndex}) may be too low`);
        if (verbose) console.error(`  ${zIndexOk ? '✓' : '⚠'} Z-index: ${positionInfo.zIndex}`);
      }

      // Store height for consistency check
      result.headerHeight = positionInfo.height;
    }

  } else {
    result.tests.push({
      name: 'Header container exists',
      passed: false,
      error: 'No header container found'
    });
    result.failed++;
    if (verbose) console.error(`  ✗ Header not found`);
  }

  return result;
}

/**
 * Capture component screenshot
 */
async function captureHeaderScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;

  const screenshotPath = path.join(outputDir, `header-test-${viewportName}.png`);
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

  // Allow paths within CWD or common output directories
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
      const absolutePath = validateHtmlPath(args.html);
      targetUrl = `file://${absolutePath}`;
    } else {
      targetUrl = args.url;
    }

    if (verbose) console.error(`\n🔍 Verifying header: ${targetUrl}\n`);

    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const results = {
      success: true,
      component: 'header',
      url: targetUrl,
      viewports: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: []
      },
      screenshots: [],
      heightConsistency: {}
    };

    // Test all viewports
    for (const viewportName of ['mobile', 'tablet', 'desktop']) {
      const viewportResult = await testViewport(page, viewportName, verbose);
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

    // Check height consistency
    const heights = Object.values(results.heightConsistency);
    if (heights.length >= 2) {
      const maxDiff = Math.max(...heights) - Math.min(...heights);
      if (maxDiff > 20) {
        results.summary.warnings.push(`Header height varies by ${maxDiff}px across viewports`);
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

verifyHeader();
