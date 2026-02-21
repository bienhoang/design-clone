/**
 * Footer Verification Helpers
 *
 * Selectors, DOM query utilities, and footer-specific checks extracted
 * from verify-footer.js to keep each file under 200 lines.
 */

// Footer element selectors
export const FOOTER_SELECTORS = {
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
 * Count elements using the selector with the highest match count
 * @param {import('playwright').Page} page
 * @param {string[]} selectors
 * @returns {Promise<{count: number, selector: string|null}>}
 */
export async function countElements(page, selectors) {
  let totalCount = 0;
  let matchedSelector = null;

  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > totalCount) {
        totalCount = count;
        matchedSelector = selector;
      }
    } catch (err) { /* continue */ }
  }
  return { count: totalCount, selector: matchedSelector };
}

/**
 * Count visible elements from a list of selectors (returns first non-zero match)
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
 * Check footer position — should be at bottom of page
 * @param {import('playwright').Page} page
 * @param {string} footerSelector
 * @returns {Promise<Object|null>}
 */
export async function checkFooterPosition(page, footerSelector) {
  return await page.evaluate((sel) => {
    const footer = document.querySelector(sel);
    if (!footer) return null;

    const rect = footer.getBoundingClientRect();
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    window.scrollTo(0, scrollHeight);

    const style = window.getComputedStyle(footer);
    const footerBottom = rect.y + window.scrollY + rect.height;
    const tolerance = 50;

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
 * Check for copyright text in footer
 * @param {import('playwright').Page} page
 * @returns {Promise<{hasCopyright: boolean, hasYear: boolean, hasCurrentYear: boolean}|null>}
 */
export async function checkCopyright(page) {
  return await page.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('[role="contentinfo"]');
    if (!footer) return null;

    const text = footer.textContent || '';
    const currentYear = new Date().getFullYear();

    return {
      hasCopyright: /©|copyright|all rights reserved/i.test(text),
      hasYear: new RegExp(`20[0-9]{2}|${currentYear}`).test(text),
      hasCurrentYear: text.includes(String(currentYear))
    };
  });
}

