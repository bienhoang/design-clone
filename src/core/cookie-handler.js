/**
 * Cookie Banner Handler
 *
 * Utilities for dismissing cookie consent banners.
 * Tries clicking accept buttons first, then removes elements as fallback.
 */

// Cookie banner accept button selectors (priority order)
export const COOKIE_SELECTORS = [
  // Common accept buttons
  '[aria-label*="accept" i]',
  '[aria-label*="Accept" i]',
  'button[class*="accept" i]',
  'button[id*="accept" i]',
  '[data-testid*="accept" i]',
  // Specific CMPs
  '#onetrust-accept-btn-handler',
  '.cc-accept',
  '.cookie-accept',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  // Generic patterns
  '.cookie-banner button:first-of-type',
  '.cookie-consent button:first-of-type',
  '[class*="cookie"] button[class*="primary"]'
];

// Elements to remove as fallback
export const COOKIE_REMOVE_SELECTORS = [
  '[class*="cookie-banner"]',
  '[class*="cookie-consent"]',
  '[class*="cookie-notice"]',
  '[id*="cookie-banner"]',
  '[id*="cookie-consent"]',
  '#onetrust-banner-sdk',
  '.cc-banner',
  '[class*="gdpr"]'
];

/**
 * Dismiss cookie banners by clicking accept or removing elements
 * @param {Page} page - Puppeteer page
 * @returns {Promise<{method: string, selector?: string, count?: number}>}
 */
export async function dismissCookieBanner(page) {
  // Try clicking accept buttons first
  for (const selector of COOKIE_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        await new Promise(r => setTimeout(r, 500));
        return { method: 'click', selector };
      }
    } catch {
      continue;
    }
  }

  // Fallback: remove cookie elements from DOM
  const removed = await page.evaluate((selectors) => {
    let count = 0;
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        el.remove();
        count++;
      });
    }
    return count;
  }, COOKIE_REMOVE_SELECTORS);

  if (removed > 0) {
    return { method: 'remove', count: removed };
  }

  return { method: 'none' };
}
