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

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import browser abstraction (auto-detects chrome-devtools or standalone)
import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';
import { VIEWPORTS_HD as VIEWPORTS } from '../shared/viewports.js';

// Common menu element selectors
const MENU_SELECTORS = {
  // Hamburger/toggle buttons
  toggleButtons: [
    '[aria-label*="menu" i]',
    '[aria-label*="nav" i]',
    'button.hamburger',
    '.hamburger',
    '.menu-toggle',
    '.nav-toggle',
    '.mobile-menu-toggle',
    'button[class*="hamburger"]',
    'button[class*="menu"]',
    '[data-toggle="nav"]',
    '[data-menu-toggle]',
    '.header__toggle',
    '.header-toggle',
    '#menu-toggle',
    '.burger',
    '.burger-menu'
  ],
  // Navigation containers
  navContainers: [
    'nav',
    '[role="navigation"]',
    '.nav',
    '.navigation',
    '.main-nav',
    '.site-nav',
    '.header-nav',
    '.primary-nav',
    '#nav',
    '#navigation',
    '.menu',
    '.main-menu'
  ],
  // Menu items
  menuItems: [
    'nav a',
    'nav li',
    '.nav-item',
    '.menu-item',
    '.nav-link',
    '.menu-link',
    '[role="navigation"] a'
  ]
};

/**
 * Check if element is visible using Playwright locator API
 */
async function isElementVisible(page, selector) {
  try {
    return await page.locator(selector).isVisible();
  } catch {
    return false;
  }
}

/**
 * Find first matching selector
 */
async function findElement(page, selectors) {
  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element) {
      return { element, selector };
    }
  }
  return null;
}

/**
 * Count visible menu items
 */
async function countVisibleMenuItems(page) {
  for (const selector of MENU_SELECTORS.menuItems) {
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
    } catch { /* continue */ }
  }
  return { count: 0, selector: null };
}

/**
 * Test desktop menu visibility
 */
async function testDesktopMenu(page, result, menuItems, verbose) {
  if (menuItems.count >= 2) {
    result.tests.push({
      name: 'Desktop menu items visible',
      passed: true,
      count: menuItems.count,
      selector: menuItems.selector
    });
    result.passed++;
    if (verbose) console.error(`  ✓ ${menuItems.count} menu items visible`);
  } else {
    result.tests.push({
      name: 'Desktop menu items visible',
      passed: false,
      count: menuItems.count,
      error: 'Expected at least 2 visible menu items on desktop'
    });
    result.failed++;
    if (verbose) console.error(`  ✗ Only ${menuItems.count} menu items visible (expected >= 2)`);
  }
}

/**
 * Test toggle button functionality
 */
async function testToggleFunctionality(page, toggleElement, result, verbose) {
  try {
    const initialMenuItems = await countVisibleMenuItems(page);
    await toggleElement.click();
    await new Promise(r => setTimeout(r, 500));
    const afterClickItems = await countVisibleMenuItems(page);

    const stateChanged = afterClickItems.count !== initialMenuItems.count;
    const hasEnoughItems = afterClickItems.count >= 2;

    if (stateChanged || hasEnoughItems) {
      result.tests.push({
        name: 'Menu toggle functionality',
        passed: true,
        before: initialMenuItems.count,
        after: afterClickItems.count
      });
      result.passed++;
      if (verbose) console.error(`  ✓ Toggle works: ${initialMenuItems.count} -> ${afterClickItems.count} items`);
      await toggleElement.click();
      await new Promise(r => setTimeout(r, 300));
    } else {
      result.tests.push({
        name: 'Menu toggle functionality',
        passed: false,
        before: initialMenuItems.count,
        after: afterClickItems.count,
        warning: 'Toggle may not be functional - no state change detected'
      });
      result.warnings.push('Menu toggle click did not change visible items');
      if (verbose) console.error(`  ⚠ Toggle click had no effect`);
    }
  } catch (err) {
    result.tests.push({
      name: 'Menu toggle functionality',
      passed: false,
      error: err.message
    });
    result.failed++;
    if (verbose) console.error(`  ✗ Toggle click failed: ${err.message}`);
  }
}

/**
 * Test mobile/tablet hamburger menu
 */
async function testMobileMenu(page, result, menuItems, verbose) {
  const toggleResult = await findElement(page, MENU_SELECTORS.toggleButtons);

  // No toggle found - check if menu is visible anyway
  if (!toggleResult) {
    if (menuItems.count >= 2) {
      result.tests.push({
        name: 'Mobile menu visible without toggle',
        passed: true,
        count: menuItems.count,
        note: 'Menu shows items without hamburger toggle'
      });
      result.passed++;
      if (verbose) console.error(`  ✓ ${menuItems.count} menu items visible (no toggle needed)`);
    } else {
      result.tests.push({
        name: 'Mobile menu accessibility',
        passed: false,
        error: 'No hamburger toggle found and menu items hidden'
      });
      result.failed++;
      if (verbose) console.error(`  ✗ No hamburger toggle and menu items hidden`);
    }
    return;
  }

  // Toggle found - test visibility and functionality
  const isToggleVisible = await isElementVisible(page, toggleResult.selector);
  if (!isToggleVisible) {
    result.warnings.push('Menu toggle found but not visible');
    if (verbose) console.error(`  ⚠ Menu toggle found but not visible`);
    return;
  }

  result.tests.push({
    name: 'Mobile menu toggle visible',
    passed: true,
    selector: toggleResult.selector
  });
  result.passed++;
  if (verbose) console.error(`  ✓ Menu toggle visible: ${toggleResult.selector}`);

  await testToggleFunctionality(page, toggleResult.element, result, verbose);
}

/**
 * Test menu at specific viewport
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

  // Test navigation container
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

  // Get menu items count
  const menuItems = await countVisibleMenuItems(page);

  // Delegate to viewport-specific tests
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
  await page.screenshot({
    path: screenshotPath,
    fullPage: false
  });
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
    // Launch browser
    const browser = await getBrowser({ headless: args.headless !== 'false' });
    const page = await getPage(browser);

    // Navigate to page
    let targetUrl;
    if (args.html) {
      // Local file
      const absolutePath = path.resolve(args.html);
      targetUrl = `file://${absolutePath}`;
    } else {
      targetUrl = args.url;
    }

    if (verbose) console.error(`\n🔍 Verifying responsive menu: ${targetUrl}\n`);

    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Test all viewports
    const results = {
      success: true,
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

      // Capture debug screenshot if output dir provided
      if (outputDir) {
        const screenshotPath = await captureDebugScreenshot(page, outputDir, viewportName);
        if (screenshotPath) results.screenshots.push(screenshotPath);
      }
    }

    // Determine overall success
    results.success = results.summary.failed === 0;

    // Close browser
    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    // Final summary
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

// Run
verifyMenu();
