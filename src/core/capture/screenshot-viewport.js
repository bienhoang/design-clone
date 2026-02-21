/**
 * Screenshot Viewport Capture
 *
 * Single-viewport screenshot: sets viewport size, waits for DOM stability,
 * triggers lazy-load, forces animated elements visible, then takes the screenshot.
 *
 * @module screenshot-viewport
 */

import path from 'path';

import { waitForDomStable, waitForFontsLoaded, waitForStylesStable } from '../page-prep/page-readiness.js';
import { forceLazyImages, forceAnimatedElementsVisible, triggerLazyLoad, waitForAllImages, LAZY_LOAD_MAX_ITERATIONS } from '../page-prep/lazy-loader.js';
import { extractComponentDimensions } from '../dimension/dimension-extractor.js';
import { extractDOMHierarchy } from '../dimension/dom-tree-analyzer.js';
import { compressIfNeeded, VIEWPORT_SETTLE_DELAY, NETWORK_IDLE_TIMEOUT, DEFAULT_SCROLL_DELAY } from './screenshot-helpers.js';
import { VIEWPORTS } from '../../shared/viewports.js';

/**
 * Capture screenshot for a single viewport.
 * Handles DOM stability, lazy images, animations, and optional compression.
 *
 * @param {{page, viewport, outputPath, fullPage?, maxSize?, scrollDelay?}} options
 * @returns {Promise<{viewport, path, dimensions, componentDimensions, domHierarchy, scrollInfo, imageStats, size, compressed}>}
 */
export async function captureViewport(options) {
  const {
    page,
    viewport,
    outputPath,
    fullPage = true,
    maxSize = 5,
    scrollDelay = DEFAULT_SCROLL_DELAY
  } = options;

  await page.setViewportSize(VIEWPORTS[viewport]);
  await new Promise(r => setTimeout(r, VIEWPORT_SETTLE_DELAY));
  await waitForDomStable(page, 300, 5000);
  await waitForFontsLoaded(page, 3000);
  await waitForStylesStable(page, 200, 2000);

  const componentDimensions = await extractComponentDimensions(page, viewport);

  // Extract DOM hierarchy on desktop only (perf: skip on tablet/mobile)
  let domHierarchy = null;
  if (viewport === 'desktop') {
    try {
      domHierarchy = await extractDOMHierarchy(page, { maxDepth: 8 });
    } catch (err) {
      console.error(`[WARN] DOM hierarchy extraction failed: ${err.message}`);
    }
  }

  await forceLazyImages(page);
  const scrollInfo = await triggerLazyLoad(page, LAZY_LOAD_MAX_ITERATIONS, scrollDelay);
  await forceLazyImages(page);
  const imageStats = await waitForAllImages(page, 15000);

  try {
    await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT });
  } catch {
    // Acceptable: page may have long-polling connections
  }

  await new Promise(r => setTimeout(r, 2000));
  await waitForDomStable(page, 300, 3000);
  await waitForFontsLoaded(page, 2000);
  await forceAnimatedElementsVisible(page);
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: outputPath, type: 'png', fullPage });
  const compression = await compressIfNeeded(outputPath, maxSize);

  return {
    viewport,
    path: path.resolve(outputPath),
    dimensions: VIEWPORTS[viewport],
    componentDimensions,
    domHierarchy,
    scrollInfo,
    imageStats,
    size: compression.finalSize,
    compressed: compression.compressed
  };
}
