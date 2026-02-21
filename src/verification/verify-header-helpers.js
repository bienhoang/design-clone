/**
 * Header Verification Helpers
 *
 * Selectors, DOM query utilities, and header-specific checks extracted
 * from verify-header.js to keep each file under 200 lines.
 */

// Header element selectors
export const HEADER_SELECTORS = {
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
 * Find first matching element from a list of selectors
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<{element: ElementHandle, selector: string}|null>}
 */
export async function findElement(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) return { element, selector };
    } catch (err) { /* continue */ }
  }
  return null;
}

/**
 * Count visible elements (returns first non-zero match)
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<{count: number, selector: string|null}>}
 */
export async function countVisibleElements(page, selectors) {
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
          ) visible++;
        });
        return visible;
      }, selector);

      if (count > 0) return { count, selector };
    } catch (err) { /* continue */ }
  }
  return { count: 0, selector: null };
}

/**
 * Check header position/stickiness properties
 * @param {import('playwright').Page} page
 * @param {string} headerSelector
 * @returns {Promise<{position: string, isSticky: boolean, isFixed: boolean, zIndex: number|string, top: number, height: number, width: number}|null>}
 */
export async function checkHeaderPosition(page, headerSelector) {
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
 * Check logo position relative to header width
 * @param {import('playwright').Page} page
 * @param {string} logoSelector
 * @param {number} headerWidth
 * @returns {Promise<{position: string, x: number, y: number, width: number, height: number}|null>}
 */
export async function checkLogoPosition(page, logoSelector, headerWidth) {
  return await page.evaluate((sel, width) => {
    const logo = document.querySelector(sel);
    if (!logo) return null;

    const rect = logo.getBoundingClientRect();
    const centerThreshold = width * 0.35;

    let position = 'unknown';
    if (rect.left < centerThreshold) position = 'left';
    else if (rect.left > width - centerThreshold) position = 'right';
    else position = 'center';

    return { position, x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, logoSelector, headerWidth);
}

