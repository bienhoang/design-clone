/**
 * Menu Viewport Checks
 *
 * Desktop/mobile menu test orchestration using helpers.
 * Separated from verify-menu-helpers.js to keep each file under 200 lines.
 */

import {
  MENU_SELECTORS,
  isElementVisible,
  findElement,
  countVisibleMenuItems
} from './verify-menu-helpers.js';

/**
 * Test desktop menu — requires at least 2 visible items
 * @param {import('playwright').Page} page
 * @param {Object} result - Viewport result object (mutated)
 * @param {{count: number, selector: string|null}} menuItems
 * @param {boolean} verbose
 */
export async function testDesktopMenu(page, result, menuItems, verbose) {
  if (menuItems.count >= 2) {
    result.tests.push({ name: 'Desktop menu items visible', passed: true, count: menuItems.count, selector: menuItems.selector });
    result.passed++;
    if (verbose) console.error(`  ✓ ${menuItems.count} menu items visible`);
  } else {
    result.tests.push({ name: 'Desktop menu items visible', passed: false, count: menuItems.count, error: 'Expected at least 2 visible menu items on desktop' });
    result.failed++;
    if (verbose) console.error(`  ✗ Only ${menuItems.count} menu items visible (expected >= 2)`);
  }
}

/**
 * Test toggle button click and resulting state change
 * @param {import('playwright').Page} page
 * @param {ElementHandle} toggleElement
 * @param {Object} result - Viewport result object (mutated)
 * @param {boolean} verbose
 */
export async function testToggleFunctionality(page, toggleElement, result, verbose) {
  try {
    const initialMenuItems = await countVisibleMenuItems(page);
    await toggleElement.click();
    await new Promise(r => setTimeout(r, 500));
    const afterClickItems = await countVisibleMenuItems(page);

    const stateChanged = afterClickItems.count !== initialMenuItems.count;
    const hasEnoughItems = afterClickItems.count >= 2;

    if (stateChanged || hasEnoughItems) {
      result.tests.push({ name: 'Menu toggle functionality', passed: true, before: initialMenuItems.count, after: afterClickItems.count });
      result.passed++;
      if (verbose) console.error(`  ✓ Toggle works: ${initialMenuItems.count} -> ${afterClickItems.count} items`);
      await toggleElement.click();
      await new Promise(r => setTimeout(r, 300));
    } else {
      result.tests.push({ name: 'Menu toggle functionality', passed: false, before: initialMenuItems.count, after: afterClickItems.count, warning: 'Toggle may not be functional - no state change detected' });
      result.warnings.push('Menu toggle click did not change visible items');
      if (verbose) console.error(`  ⚠ Toggle click had no effect`);
    }
  } catch (err) {
    result.tests.push({ name: 'Menu toggle functionality', passed: false, error: err.message });
    result.failed++;
    if (verbose) console.error(`  ✗ Toggle click failed: ${err.message}`);
  }
}

/**
 * Test mobile/tablet hamburger menu behaviour
 * @param {import('playwright').Page} page
 * @param {Object} result - Viewport result object (mutated)
 * @param {{count: number, selector: string|null}} menuItems
 * @param {boolean} verbose
 */
export async function testMobileMenu(page, result, menuItems, verbose) {
  const toggleResult = await findElement(page, MENU_SELECTORS.toggleButtons);

  if (!toggleResult) {
    if (menuItems.count >= 2) {
      result.tests.push({ name: 'Mobile menu visible without toggle', passed: true, count: menuItems.count, note: 'Menu shows items without hamburger toggle' });
      result.passed++;
      if (verbose) console.error(`  ✓ ${menuItems.count} menu items visible (no toggle needed)`);
    } else {
      result.tests.push({ name: 'Mobile menu accessibility', passed: false, error: 'No hamburger toggle found and menu items hidden' });
      result.failed++;
      if (verbose) console.error(`  ✗ No hamburger toggle and menu items hidden`);
    }
    return;
  }

  const isToggleVisible = await isElementVisible(page, toggleResult.selector);
  if (!isToggleVisible) {
    result.warnings.push('Menu toggle found but not visible');
    if (verbose) console.error(`  ⚠ Menu toggle found but not visible`);
    return;
  }

  result.tests.push({ name: 'Mobile menu toggle visible', passed: true, selector: toggleResult.selector });
  result.passed++;
  if (verbose) console.error(`  ✓ Menu toggle visible: ${toggleResult.selector}`);

  await testToggleFunctionality(page, toggleResult.element, result, verbose);
}
