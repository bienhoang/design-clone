/**
 * Slider Verification Helpers
 *
 * DOM inspection utilities for verify-slider.js:
 * element visibility checks, slide index detection, and autoplay monitoring.
 * Constants live in verify-slider-constants.js.
 */

export { SLIDER_PATTERNS, AUTOPLAY_CONFIG } from './verify-slider-constants.js';
import { SLIDER_PATTERNS, AUTOPLAY_CONFIG } from './verify-slider-constants.js';

/**
 * Detect which slider library is used on the page
 * @param {import('playwright').Page} page
 * @returns {Promise<{library: string, patterns: Object}|null>}
 */
export async function detectSliderLibrary(page) {
  for (const [name, patterns] of Object.entries(SLIDER_PATTERNS)) {
    try {
      const count = await page.locator(patterns.container).count();
      if (count > 0) {
        return { library: name, patterns };
      }
    } catch (err) { /* continue - selector not found */ }
  }
  return null;
}

/**
 * Check element visibility via computed style and bounding rect
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function isElementVisible(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return false;

    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }, selector);
  } catch {
    return false;
  }
}

/**
 * Count visible elements matching a selector
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @returns {Promise<number>}
 */
export async function countVisibleElements(page, selector) {
  try {
    return await page.evaluate((sel) => {
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
  } catch {
    return 0;
  }
}

/**
 * Get the index of the currently active slide
 * @param {import('playwright').Page} page
 * @param {Object} patterns - Slider patterns object
 * @returns {Promise<number>} Active slide index or -1
 */
export async function getActiveSlideIndex(page, patterns) {
  try {
    return await page.evaluate((selectors) => {
      const active = document.querySelector(selectors.active);
      if (active) {
        const slides = document.querySelectorAll(selectors.slide);
        for (let i = 0; i < slides.length; i++) {
          if (slides[i] === active || slides[i].contains(active)) return i;
        }
      }

      const container = document.querySelector(selectors.container);
      if (container) {
        const slides = container.querySelectorAll(selectors.slide);
        for (let i = 0; i < slides.length; i++) {
          const rect = slides[i].getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (rect.left >= containerRect.left - 10 && rect.left < containerRect.right) return i;
        }
      }

      return -1;
    }, patterns);
  } catch {
    return -1;
  }
}

/**
 * Check autoplay by monitoring slide changes over AUTOPLAY_CONFIG.waitTime.
 * Exits early when requiredChanges are detected.
 * @param {import('playwright').Page} page
 * @param {Object} patterns - Slider patterns
 * @param {boolean} verbose
 * @returns {Promise<{hasAutoplay: boolean, changes: number, slideIndices: Array, duration: number}>}
 */
export async function checkAutoplay(page, patterns, verbose) {
  const slideIndices = [];
  const startTime = Date.now();

  const initialIndex = await getActiveSlideIndex(page, patterns);
  slideIndices.push({ time: 0, index: initialIndex });

  if (verbose) console.error(`    Starting autoplay detection (max ${AUTOPLAY_CONFIG.waitTime / 1000}s)...`);

  while (Date.now() - startTime < AUTOPLAY_CONFIG.waitTime) {
    await new Promise(r => setTimeout(r, AUTOPLAY_CONFIG.checkInterval));

    const currentIndex = await getActiveSlideIndex(page, patterns);
    const elapsed = Date.now() - startTime;

    if (currentIndex !== slideIndices[slideIndices.length - 1].index) {
      slideIndices.push({ time: elapsed, index: currentIndex });
      if (verbose) console.error(`    Slide changed to ${currentIndex} at ${elapsed}ms`);

      if (slideIndices.length - 1 >= AUTOPLAY_CONFIG.requiredChanges) {
        if (verbose) console.error(`    Early exit: ${AUTOPLAY_CONFIG.requiredChanges} changes detected`);
        break;
      }
    }
  }

  const changes = slideIndices.length - 1;
  return {
    hasAutoplay: changes >= AUTOPLAY_CONFIG.requiredChanges,
    changes,
    slideIndices,
    duration: Date.now() - startTime
  };
}

