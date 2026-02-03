/**
 * Lazy Loading Utilities
 *
 * Functions to trigger lazy-loaded content including images,
 * animations, and IntersectionObserver-based content.
 */

// Constants
export const LAZY_LOAD_MAX_ITERATIONS = 15;
export const IMAGE_LOAD_TIMEOUT = 20000;

/**
 * Force all lazy images to load
 * - Sets loading="eager" on all images
 * - Copies data-src to src if exists
 * - Triggers IntersectionObserver by scrolling
 * @param {Page} page - Puppeteer page
 */
export async function forceLazyImages(page) {
  return await page.evaluate(async () => {
    const stats = { forced: 0, dataSrc: 0, eager: 0 };
    const images = document.querySelectorAll('img');

    for (const img of images) {
      if (img.loading === 'lazy') {
        img.loading = 'eager';
        stats.eager++;
      }

      const dataSrc = img.dataset.src || img.dataset.lazySrc || img.getAttribute('data-lazy-src');
      if (dataSrc && !img.src) {
        img.src = dataSrc;
        stats.dataSrc++;
      }

      img.scrollIntoView({ block: 'center', behavior: 'instant' });
      stats.forced++;
    }

    // Handle background images with data attributes
    document.querySelectorAll('[data-bg], [data-background]').forEach(el => {
      const bgUrl = el.dataset.bg || el.dataset.background;
      if (bgUrl) {
        el.style.backgroundImage = `url(${bgUrl})`;
      }
    });

    return stats;
  });
}

/**
 * Force all hidden animated elements to be visible
 * @param {Page} page - Puppeteer page
 */
export async function forceAnimatedElementsVisible(page) {
  return await page.evaluate(() => {
    let forcedCount = 0;

    document.querySelectorAll('[class*="appear"], [class*="fade"], [class*="animate"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;

      // Only force elements below the hero area (first 500px)
      if (absoluteTop > 500) {
        const style = getComputedStyle(el);
        if (style.opacity === '0' || parseFloat(style.opacity) < 0.5) {
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('visibility', 'visible', 'important');
          forcedCount++;
        }
      }
    });

    return { forcedCount };
  });
}

/**
 * Trigger lazy loading by scrolling through entire page
 * @param {Page} page - Puppeteer page
 * @param {number} maxIterations - Max scroll iterations
 * @param {number} scrollDelay - Pause time between scrolls
 */
export async function triggerLazyLoad(page, maxIterations = 20, scrollDelay = 1500) {
  return await page.evaluate(async (maxIter, pauseMs) => {
    return new Promise(async (resolve) => {
      const viewportHeight = window.innerHeight;
      const totalHeight = document.body.scrollHeight;
      const scrollStep = viewportHeight * 0.5;
      const pauseTime = pauseMs;

      let position = 0;
      let iterations = 0;

      // First pass: scroll through entire page
      while (position < totalHeight && iterations < maxIter) {
        window.scrollTo({ top: position, behavior: 'instant' });
        await new Promise(r => setTimeout(r, pauseTime));
        position += scrollStep;
        iterations++;
      }

      // Scroll to bottom
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 1000));

      // Second pass: scroll back up
      position = document.body.scrollHeight;
      while (position > 0) {
        position -= scrollStep;
        window.scrollTo({ top: Math.max(0, position), behavior: 'instant' });
        await new Promise(r => setTimeout(r, 300));
      }

      // Return to top
      window.scrollTo({ top: 0, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 1500));

      if (window.scrollY !== 0) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 500));
      }

      resolve({
        scrolled: iterations,
        height: document.body.scrollHeight,
        stableAt: iterations
      });
    });
  }, maxIterations, scrollDelay);
}

/**
 * Wait for all images to finish loading
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Max wait time
 */
export async function waitForAllImages(page, timeout = IMAGE_LOAD_TIMEOUT) {
  const imgStats = await page.evaluate(async (maxWait) => {
    const startTime = Date.now();
    const images = Array.from(document.querySelectorAll('img'));
    const pendingImages = images.filter(img => img.src && !img.complete);

    if (pendingImages.length === 0) {
      return { loaded: images.length, pending: 0, timedOut: false };
    }

    const loadPromises = pendingImages.map(img => {
      return new Promise((resolve) => {
        if (img.complete) {
          resolve(true);
          return;
        }

        const checkComplete = () => {
          if (img.complete || Date.now() - startTime > maxWait) {
            resolve(img.complete);
          } else {
            setTimeout(checkComplete, 100);
          }
        };

        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        setTimeout(checkComplete, 100);
      });
    });

    await Promise.all(loadPromises);

    const stillPending = images.filter(img => img.src && !img.complete).length;
    return {
      loaded: images.length - stillPending,
      pending: stillPending,
      timedOut: Date.now() - startTime >= maxWait
    };
  }, timeout);

  try {
    await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 10000) });
  } catch {
    // Network didn't become idle, continue anyway
  }

  await new Promise(r => setTimeout(r, 1500));
  return imgStats;
}
