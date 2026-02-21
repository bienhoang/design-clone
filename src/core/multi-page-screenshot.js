/**
 * Multi-page Screenshot Capture
 *
 * Capture screenshots + extract HTML/CSS for multiple pages
 * using a shared browser session for efficiency.
 *
 * Usage:
 *   import { captureMultiplePages } from './multi-page-screenshot.js';
 *   const result = await captureMultiplePages(pages, { outputDir: './output' });
 */

import path from 'path';
import fs from 'fs/promises';

import { getBrowser, getPage, disconnectBrowser } from '../utils/browser.js';
import {
  captureSinglePage,
  createOutputStructure,
  pathToFilename,
  DEFAULT_OPTIONS
} from './multi-page-screenshot-page.js';

// ============================================================================
// Batch Capture
// ============================================================================

/**
 * Capture multiple pages with shared browser session
 * @param {Array<{path: string, name: string, url: string}>} pages - Pages to capture
 * @param {Object} options - Capture options (merged with DEFAULT_OPTIONS)
 * @returns {Promise<Object>} Complete capture result with per-page results and stats
 */
export async function captureMultiplePages(pages, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  if (!opts.outputDir) throw new Error('outputDir is required');

  await createOutputStructure(opts.outputDir, opts.viewports);

  let browser = null;
  const results = {
    success: true,
    baseUrl: pages[0]?.url ? new URL(pages[0].url).origin : null,
    outputDir: path.resolve(opts.outputDir),
    pages: [],
    cssFiles: [],
    cssFilesFiltered: [],
    stats: {
      totalPages: pages.length,
      successfulPages: 0,
      failedPages: 0,
      totalScreenshots: 0,
      totalWarnings: 0
    },
    capturedAt: new Date().toISOString()
  };

  try {
    browser = await getBrowser({ headless: true });

    for (let i = 0; i < pages.length; i++) {
      const pageInfo = pages[i];

      if (opts.onProgress) {
        opts.onProgress(i + 1, pages.length, {
          path: pageInfo.path,
          name: pageInfo.name,
          status: 'capturing'
        });
      }

      const page = await getPage(browser);

      try {
        const pageResult = await captureSinglePage(page, pageInfo, opts.outputDir, opts);
        results.pages.push(pageResult);

        if (pageResult.css?.path && !pageResult.css.failed) {
          results.cssFiles.push(pageResult.css.path);
        }
        if (pageResult.cssFiltered?.path) {
          results.cssFilesFiltered.push(pageResult.cssFiltered.path);
        }

        if (pageResult.success) {
          results.stats.successfulPages++;
          results.stats.totalScreenshots += Object.keys(pageResult.screenshots)
            .filter(vp => !pageResult.screenshots[vp].failed).length;
        } else {
          results.stats.failedPages++;
        }
        results.stats.totalWarnings += pageResult.warnings.length;

        if (opts.onProgress) {
          opts.onProgress(i + 1, pages.length, {
            path: pageInfo.path,
            name: pageInfo.name,
            status: 'done'
          });
        }
      } finally {
        await page.close().catch(() => {});
      }
    }
  } catch (err) {
    results.success = false;
    results.error = err.message;
  } finally {
    if (browser) await disconnectBrowser().catch(() => {});
  }

  results.stats.totalTimeMs = Date.now() - startTime;

  const resultsPath = path.join(opts.outputDir, 'capture-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  results.resultsFile = resultsPath;

  return results;
}

// ============================================================================
// Re-exports (backward-compatible)
// ============================================================================

export { pathToFilename };

// ============================================================================
// CLI Entry Point
// ============================================================================

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('multi-page-screenshot.js') ||
  process.argv[1].includes('multi-page-screenshot')
);

if (isMainModule) {
  const url = process.argv[2];
  const outputDir = process.argv[3] || './multi-capture-output';

  if (!url) {
    console.error('Usage: node multi-page-screenshot.js <url> [outputDir]');
    process.exit(1);
  }

  import('./discover-pages.js').then(async ({ discoverPages }) => {
    console.error(`[INFO] Discovering pages from ${url}...`);
    const discovery = await discoverPages(url, { maxPages: 5 });

    if (!discovery.success) {
      console.error(`[ERROR] Discovery failed: ${discovery.error}`);
      process.exit(1);
    }

    console.error(`[INFO] Found ${discovery.pages.length} pages`);

    const result = await captureMultiplePages(discovery.pages, {
      outputDir,
      onProgress: (current, total, info) => {
        console.error(`[${current}/${total}] ${info.status}: ${info.name} (${info.path})`);
      }
    });

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  }).catch(err => {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  });
}
