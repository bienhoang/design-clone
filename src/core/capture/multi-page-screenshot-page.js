/**
 * Multi-Page Screenshot: Per-Page Capture
 *
 * Single-page capture logic: navigate, extract HTML/CSS, filter, and
 * take viewport screenshots. Called once per page by captureMultiplePages.
 *
 * @module multi-page-screenshot-page
 */

import path from 'path';
import fs from 'fs/promises';

import { captureViewport } from './screenshot-viewport.js';
import { VIEWPORTS, DEFAULT_SCROLL_DELAY } from './screenshot-helpers.js';
import { waitForDomStable, waitForPageReady } from '../page-prep/page-readiness.js';
import { dismissCookieBanner } from '../page-prep/cookie-handler.js';
import { extractAndEnhanceHtml, MAX_HTML_SIZE } from '../html/html-extractor.js';
import { extractAllCss, MAX_CSS_SIZE } from '../css/css-extractor.js';
import { filterCssFile } from '../css/filter-css.js';

export const DEFAULT_OPTIONS = {
  viewports: ['desktop', 'tablet', 'mobile'],
  fullPage: true,
  extractHtml: true,
  extractCss: true,
  filterUnused: true,
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

/** Create outputDir + html/, css/, analysis/{viewport}/ subdirectories. */
export async function createOutputStructure(outputDir, viewports) {
  const dirs = [
    outputDir,
    path.join(outputDir, 'html'),
    path.join(outputDir, 'css'),
    ...viewports.map(vp => path.join(outputDir, 'analysis', vp))
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/** Extract + write HTML for one page. Returns {result, warnings}. */
async function extractPageHtml(page, outputDir, filename, options) {
  const warnings = [];
  try {
    const enhanceSemantic = options.enhanceSemantic !== false;
    const htmlResult = await extractAndEnhanceHtml(page, { enhanceSemantic });
    const htmlSize = Buffer.byteLength(htmlResult.html, 'utf-8');
    if (htmlSize > MAX_HTML_SIZE) {
      warnings.push(`HTML size exceeds limit: ${(htmlSize / 1024 / 1024).toFixed(1)}MB`);
      return { result: null, warnings };
    }
    const htmlPath = path.join(outputDir, 'html', `${filename}.html`);
    await fs.writeFile(htmlPath, htmlResult.html, 'utf-8');
    if (htmlResult.warnings.length > 0) warnings.push(...htmlResult.warnings);
    return { result: { path: htmlPath, size: htmlSize, elementCount: htmlResult.elementCount, semanticEnhanced: enhanceSemantic, semanticStats: htmlResult.semanticStats || null }, warnings };
  } catch (err) {
    warnings.push(`HTML extraction failed: ${err.message}`);
    return { result: { error: err.message, failed: true }, warnings };
  }
}

/** Extract + write raw CSS for one page. Returns {result, warnings}. */
async function extractPageCss(page, pageUrl, outputDir, filename) {
  const warnings = [];
  try {
    const cssData = await extractAllCss(page, pageUrl);
    const rawCss = cssData.cssBlocks.map(b => `/* Source: ${b.source} */\n${b.css}`).join('\n\n');
    const cssSize = Buffer.byteLength(rawCss, 'utf-8');
    if (cssSize > MAX_CSS_SIZE) {
      warnings.push(`CSS size exceeds limit: ${(cssSize / 1024 / 1024).toFixed(1)}MB`);
      return { result: null, warnings };
    }
    const cssPath = path.join(outputDir, 'css', `${filename}-raw.css`);
    await fs.writeFile(cssPath, rawCss, 'utf-8');
    if (cssData.warnings.length > 0) warnings.push(...cssData.warnings);
    return { result: { path: cssPath, size: cssSize, ruleCount: cssData.totalRules, corsBlocked: cssData.corsBlocked.length }, warnings };
  } catch (err) {
    warnings.push(`CSS extraction failed: ${err.message}`);
    return { result: { error: err.message, failed: true }, warnings };
  }
}

/** Filter CSS against HTML; returns {result, warning}. */
async function filterPageCss(htmlPath, cssPath, outputDir, filename) {
  try {
    const filteredPath = path.join(outputDir, 'css', `${filename}.css`);
    const fr = await filterCssFile(htmlPath, cssPath, filteredPath, false, outputDir);
    return { result: { path: filteredPath, size: fr.output.size, reduction: fr.stats.reduction }, warning: null };
  } catch (err) {
    return { result: null, warning: `CSS filtering failed: ${err.message}` };
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
 * Navigate to one page, extract HTML/CSS, filter, take viewport screenshots.
 * @param {import('playwright').Page} page
 * @param {{path, name, url}} pageInfo
 * @param {string} outputDir
 * @param {Object} options
 * @returns {Promise<{path, name, url, filename, screenshots, html, css, cssFiltered?, warnings, success, error?}>}
 */
export async function captureSinglePage(page, pageInfo, outputDir, options) {
  const filename = pathToFilename(pageInfo.path);
  const result = { path: pageInfo.path, name: pageInfo.name, url: pageInfo.url, filename, screenshots: {}, html: null, css: null, warnings: [] };

  try {
    await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: options.timeout });
    await waitForPageReady(page);
    await dismissCookieBanner(page).catch(() => {});
    await waitForDomStable(page, 300, 3000);

    if (options.extractHtml) {
      const { result: r, warnings: w } = await extractPageHtml(page, outputDir, filename, options);
      result.html = r; result.warnings.push(...w);
    }
    if (options.extractCss) {
      const { result: r, warnings: w } = await extractPageCss(page, pageInfo.url, outputDir, filename);
      result.css = r; result.warnings.push(...w);
    }
    if (options.filterUnused && result.html?.path && result.css?.path && !result.html.failed && !result.css.failed) {
      const { result: r, warning: w } = await filterPageCss(result.html.path, result.css.path, outputDir, filename);
      if (r) result.cssFiltered = r;
      if (w) result.warnings.push(w);
    }
    const { screenshots, warnings: vpW } = await capturePageViewports(page, outputDir, filename, options);
    result.screenshots = screenshots; result.warnings.push(...vpW);
    result.success = true;
  } catch (err) {
    result.success = false; result.error = err.message;
    result.warnings.push(`Page capture failed: ${err.message}`);
  }
  return result;
}
