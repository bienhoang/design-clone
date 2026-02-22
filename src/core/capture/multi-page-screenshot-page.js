/**
 * Multi-Page Screenshot: Per-Page Capture
 *
 * Single-page capture logic: navigate and take viewport screenshots.
 * Called once per page by captureMultiplePages.
 *
 * @module multi-page-screenshot-page
 */

import path from 'path';
import fs from 'fs/promises';

import { captureViewport } from './screenshot-viewport.js';
import { VIEWPORTS, DEFAULT_SCROLL_DELAY } from './screenshot-helpers.js';
import { waitForDomStable, waitForPageReady } from '../page-prep/page-readiness.js';
import { dismissCookieBanner } from '../page-prep/cookie-handler.js';

export const DEFAULT_OPTIONS = {
  viewports: ['desktop', 'tablet', 'mobile'],
  fullPage: true,
  maxSize: 5,
  scrollDelay: DEFAULT_SCROLL_DELAY,
  timeout: 60000,
  onProgress: null
};

/** Convert URL path to kebab-case filename ('/about' → 'about', '/' → 'index'). */
export function pathToFilename(pagePath) {
  if (!pagePath || pagePath === '/') return 'index';
  return pagePath
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

/** Create outputDir + analysis/{viewport}/ subdirectories. */
export async function createOutputStructure(outputDir, viewports) {
  const dirs = [
    outputDir,
    ...viewports.map(vp => path.join(outputDir, 'analysis', vp))
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/** Capture all configured viewport screenshots for one page. Returns {screenshots, warnings}. */
async function capturePageViewports(page, outputDir, filename, options) {
  const screenshots = {};
  const warnings = [];

  for (const viewport of options.viewports) {
    if (!VIEWPORTS[viewport]) {
      warnings.push(`Invalid viewport: ${viewport}`);
      continue;
    }
    try {
      const screenshotPath = path.join(outputDir, 'analysis', viewport, `${filename}.png`);
      const vpResult = await captureViewport({
        page,
        viewport,
        outputPath: screenshotPath,
        fullPage: options.fullPage,
        maxSize: options.maxSize,
        scrollDelay: options.scrollDelay
      });
      screenshots[viewport] = {
        path: vpResult.path,
        size: vpResult.size,
        compressed: vpResult.compressed
      };
    } catch (err) {
      warnings.push(`${viewport} capture failed: ${err.message}`);
      screenshots[viewport] = { error: err.message, failed: true };
    }
  }

  return { screenshots, warnings };
}

/**
 * Navigate to one page and take viewport screenshots.
 * @param {import('playwright').Page} page
 * @param {{path, name, url}} pageInfo
 * @param {string} outputDir
 * @param {Object} options
 * @returns {Promise<{path, name, url, filename, screenshots, warnings, success, error?}>}
 */
export async function captureSinglePage(page, pageInfo, outputDir, options) {
  const filename = pathToFilename(pageInfo.path);
  const result = { path: pageInfo.path, name: pageInfo.name, url: pageInfo.url, filename, screenshots: {}, warnings: [] };

  try {
    await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: options.timeout });
    await waitForPageReady(page);
    await dismissCookieBanner(page).catch(() => {});
    await waitForDomStable(page, 300, 3000);

    const { screenshots, warnings: vpW } = await capturePageViewports(page, outputDir, filename, options);
    result.screenshots = screenshots; result.warnings.push(...vpW);
    result.success = true;
  } catch (err) {
    result.success = false; result.error = err.message;
    result.warnings.push(`Page capture failed: ${err.message}`);
  }
  return result;
}
