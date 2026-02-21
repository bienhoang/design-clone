/**
 * Menu Verification Helpers
 *
 * Selectors and DOM query utilities for verify-menu.js.
 * Includes toggle button/nav container selectors and visible item counting.
 */

// Common menu element selectors
export const MENU_SELECTORS = {
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
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function isElementVisible(page, selector) {
  try {
    return await page.locator(selector).isVisible();
  } catch {
    return false;
  }
}

/**
 * Find first matching selector from a list
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<{element: ElementHandle, selector: string}|null>}
 */
export async function findElement(page, selectors) {
  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element) return { element, selector };
  }
  return null;
}

/**
 * Count visible menu items across MENU_SELECTORS.menuItems
 * Returns count from first selector that yields visible items
 * @param {import('playwright').Page} page
 * @returns {Promise<{count: number, selector: string|null}>}
 */
export async function countVisibleMenuItems(page) {
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
          ) visible++;
        });
        return visible;
      }, selector);

      if (count > 0) return { count, selector };
    } catch { /* continue */ }
  }
  return { count: 0, selector: null };
}

