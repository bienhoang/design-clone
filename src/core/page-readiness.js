/**
 * Page Readiness Detection
 *
 * Utilities for detecting when a page has fully loaded and stabilized.
 * Handles SPA hydration, CSS-in-JS, fonts, and animations.
 */

// Page readiness constants
export const PAGE_READY_TIMEOUT = 45000;  // 45s max wait for slow SPAs
export const DOM_STABLE_THRESHOLD = 800;  // 800ms stability check
export const POST_READY_DELAY = 2000;     // Extra animation buffer
export const FONT_LOAD_TIMEOUT = 5000;    // Font loading timeout

// Loading indicator selectors
export const LOADING_SELECTORS = [
  '.loading',
  '[class*="loading"]',
  '[class*="spinner"]',
  '[class*="skeleton"]',
  '[class*="placeholder"]'
];

// Content presence selectors
export const CONTENT_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '.StudioCanvas',        // studio.site specific
  '.sd.appear',           // studio.site appeared elements
  'header nav a'          // typical nav links
];

/**
 * Wait for fonts to finish loading
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Max wait time in ms
 */
export async function waitForFontsLoaded(page, timeout = FONT_LOAD_TIMEOUT) {
  try {
    await page.evaluate(async (timeoutMs) => {
      if (!document.fonts) return;
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, timeoutMs))
      ]);
    }, timeout);
  } catch {
    // Font API not available or error, continue anyway
  }
}

/**
 * Wait for styles to stabilize (no new style mutations)
 * @param {Page} page - Puppeteer page
 * @param {number} stableMs - How long to wait without changes
 * @param {number} timeout - Max wait time in ms
 */
export async function waitForStylesStable(page, stableMs = 500, timeout = 5000) {
  try {
    await page.evaluate(async (stable, max) => {
      return new Promise((resolve) => {
        let lastChange = Date.now();
        let checkInterval;

        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.target.tagName === 'STYLE' ||
                m.target.tagName === 'LINK' ||
                m.addedNodes.length > 0) {
              lastChange = Date.now();
            }
          }
        });

        observer.observe(document.head, {
          childList: true,
          subtree: true,
          characterData: true
        });

        const startTime = Date.now();
        checkInterval = setInterval(() => {
          const now = Date.now();
          if (now - lastChange >= stable || now - startTime >= max) {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve();
          }
        }, 100);
      });
    }, stableMs, timeout);
  } catch {
    // Error in style stability check, continue anyway
  }
}

/**
 * Wait for DOM to stabilize (element count unchanged)
 * @param {Page} page - Puppeteer page
 * @param {number} threshold - Stability duration in ms
 * @param {number} timeout - Max wait time in ms
 */
export async function waitForDomStable(page, threshold = DOM_STABLE_THRESHOLD, timeout = 10000) {
  let lastCount = 0;
  let stableTime = 0;
  const checkInterval = 100;
  const startTime = Date.now();

  while (stableTime < threshold && (Date.now() - startTime) < timeout) {
    const count = await page.evaluate(() => document.querySelectorAll('*').length);
    stableTime = (count === lastCount) ? stableTime + checkInterval : 0;
    lastCount = count;
    await new Promise(r => setTimeout(r, checkInterval));
  }
}

/**
 * Wait for page to be ready (loading complete, content visible)
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Max wait time
 */
export async function waitForPageReady(page, timeout = PAGE_READY_TIMEOUT) {
  const startTime = Date.now();
  const initialCount = await page.evaluate(() => document.querySelectorAll('*').length);
  const minContentElements = Math.max(100, initialCount * 2);

  while (Date.now() - startTime < timeout) {
    const result = await page.evaluate((loadingSels, contentSels, minElements) => {
      const elementCount = document.querySelectorAll('*').length;

      const loadingGone = loadingSels.every(sel => {
        const el = document.querySelector(sel);
        if (!el) return true;
        const style = getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
      });

      const contentExists = contentSels.some(sel => {
        const el = document.querySelector(sel);
        return el && getComputedStyle(el).display !== 'none';
      });

      const hasEnoughElements = elementCount >= minElements;

      return {
        ready: (loadingGone && hasEnoughElements) || contentExists || hasEnoughElements,
        elementCount,
        loadingGone,
        contentExists
      };
    }, LOADING_SELECTORS, CONTENT_SELECTORS, minContentElements);

    if (result.ready) break;
    await new Promise(r => setTimeout(r, 200));
  }

  await waitForDomStable(page, 300);
  await waitForFontsLoaded(page);
  await waitForStylesStable(page, 300, 3000);
  await new Promise(r => setTimeout(r, POST_READY_DELAY));
}
