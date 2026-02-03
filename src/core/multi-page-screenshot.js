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
import { captureViewport, VIEWPORTS, DEFAULT_SCROLL_DELAY } from './screenshot.js';
import { waitForDomStable, waitForPageReady } from './page-readiness.js';
import { dismissCookieBanner } from './cookie-handler.js';
import { extractCleanHtml, JS_FRAMEWORK_PATTERNS, MAX_HTML_SIZE } from './html-extractor.js';
import { extractAllCss, MAX_CSS_SIZE } from './css-extractor.js';
import { filterCssFile } from './filter-css.js';

// Default options
const DEFAULT_OPTIONS = {
  viewports: ['desktop', 'tablet', 'mobile'],
  fullPage: true,
  extractHtml: true,
  extractCss: true,
  filterUnused: true,
  maxSize: 5,  // MB for screenshots
  scrollDelay: DEFAULT_SCROLL_DELAY,
  timeout: 60000,
  onProgress: null  // (current, total, pageInfo) => {}
};

/**
 * Convert page path to safe filename
 * @param {string} pagePath - URL path (e.g., '/about', '/services/consulting')
 * @returns {string} Safe filename (e.g., 'about', 'services-consulting')
 */
export function pathToFilename(pagePath) {
  if (!pagePath || pagePath === '/') return 'index';
  return pagePath
    .replace(/^\//, '')      // Remove leading slash
    .replace(/\/$/, '')      // Remove trailing slash
    .replace(/\//g, '-')     // Replace slashes with dashes
    .replace(/[^a-z0-9-]/gi, '-')  // Replace special chars
    .replace(/-+/g, '-')     // Collapse multiple dashes
    .toLowerCase();
}

/**
 * Create output directory structure
 * @param {string} outputDir - Base output directory
 * @param {string[]} viewports - Viewport names
 */
async function createOutputStructure(outputDir, viewports) {
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

/**
 * Capture a single page (all viewports + HTML/CSS extraction)
 * @param {Page} page - Playwright page instance
 * @param {Object} pageInfo - Page info { path, name, url }
 * @param {string} outputDir - Output directory
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Capture result for this page
 */
async function captureSinglePage(page, pageInfo, outputDir, options) {
  const filename = pathToFilename(pageInfo.path);
  const result = {
    path: pageInfo.path,
    name: pageInfo.name,
    url: pageInfo.url,
    filename,
    screenshots: {},
    html: null,
    css: null,
    warnings: []
  };

  try {
    // Navigate to page
    await page.goto(pageInfo.url, {
      waitUntil: 'networkidle',
      timeout: options.timeout
    });

    // Wait for page ready
    await waitForPageReady(page);

    // Dismiss cookie banner (may already be dismissed)
    await dismissCookieBanner(page).catch(() => {});

    // Extra stabilization
    await waitForDomStable(page, 300, 3000);

    // Extract HTML
    if (options.extractHtml) {
      try {
        const htmlResult = await extractCleanHtml(page, JS_FRAMEWORK_PATTERNS);
        const htmlSize = Buffer.byteLength(htmlResult.html, 'utf-8');

        if (htmlSize > MAX_HTML_SIZE) {
          result.warnings.push(`HTML size exceeds limit: ${(htmlSize / 1024 / 1024).toFixed(1)}MB`);
        } else {
          const htmlPath = path.join(outputDir, 'html', `${filename}.html`);
          await fs.writeFile(htmlPath, htmlResult.html, 'utf-8');
          result.html = {
            path: htmlPath,
            size: htmlSize,
            elementCount: htmlResult.elementCount
          };
          if (htmlResult.warnings.length > 0) {
            result.warnings.push(...htmlResult.warnings);
          }
        }
      } catch (err) {
        result.warnings.push(`HTML extraction failed: ${err.message}`);
        result.html = { error: err.message, failed: true };
      }
    }

    // Extract CSS
    if (options.extractCss) {
      try {
        const cssData = await extractAllCss(page, pageInfo.url);
        const rawCss = cssData.cssBlocks
          .map(b => `/* Source: ${b.source} */\n${b.css}`)
          .join('\n\n');
        const cssSize = Buffer.byteLength(rawCss, 'utf-8');

        if (cssSize > MAX_CSS_SIZE) {
          result.warnings.push(`CSS size exceeds limit: ${(cssSize / 1024 / 1024).toFixed(1)}MB`);
        } else {
          const cssPath = path.join(outputDir, 'css', `${filename}-raw.css`);
          await fs.writeFile(cssPath, rawCss, 'utf-8');
          result.css = {
            path: cssPath,
            size: cssSize,
            ruleCount: cssData.totalRules,
            corsBlocked: cssData.corsBlocked.length
          };
          if (cssData.warnings.length > 0) {
            result.warnings.push(...cssData.warnings);
          }
        }
      } catch (err) {
        result.warnings.push(`CSS extraction failed: ${err.message}`);
        result.css = { error: err.message, failed: true };
      }
    }

    // Filter CSS if both HTML and CSS extracted successfully
    if (options.filterUnused && result.html?.path && result.css?.path &&
        !result.html.failed && !result.css.failed) {
      try {
        const filteredPath = path.join(outputDir, 'css', `${filename}.css`);
        const filterResult = await filterCssFile(
          result.html.path,
          result.css.path,
          filteredPath,
          false,
          outputDir
        );
        result.cssFiltered = {
          path: filteredPath,
          size: filterResult.output.size,
          reduction: filterResult.stats.reduction
        };
      } catch (err) {
        result.warnings.push(`CSS filtering failed: ${err.message}`);
      }
    }

    // Capture viewports
    for (const viewport of options.viewports) {
      if (!VIEWPORTS[viewport]) {
        result.warnings.push(`Invalid viewport: ${viewport}`);
        continue;
      }

      try {
        const screenshotPath = path.join(outputDir, 'analysis', viewport, `${filename}.png`);
        const vpResult = await captureViewport(
          page,
          viewport,
          screenshotPath,
          options.fullPage,
          options.maxSize,
          options.scrollDelay
        );
        result.screenshots[viewport] = {
          path: vpResult.path,
          size: vpResult.size,
          compressed: vpResult.compressed
        };
      } catch (err) {
        result.warnings.push(`${viewport} capture failed: ${err.message}`);
        result.screenshots[viewport] = { error: err.message, failed: true };
      }
    }

    result.success = true;
  } catch (err) {
    result.success = false;
    result.error = err.message;
    result.warnings.push(`Page capture failed: ${err.message}`);
  }

  return result;
}

/**
 * Capture multiple pages with shared browser session
 * @param {Array} pages - Array of { path, name, url }
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Complete capture result
 */
export async function captureMultiplePages(pages, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  if (!opts.outputDir) {
    throw new Error('outputDir is required');
  }

  // Create output directory structure
  await createOutputStructure(opts.outputDir, opts.viewports);

  let browser = null;
  const results = {
    success: true,
    baseUrl: pages[0]?.url ? new URL(pages[0].url).origin : null,
    outputDir: path.resolve(opts.outputDir),
    pages: [],
    cssFiles: [],           // Raw CSS paths
    cssFilesFiltered: [],   // Filtered CSS paths
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
    // Launch browser once
    browser = await getBrowser({ headless: true });

    for (let i = 0; i < pages.length; i++) {
      const pageInfo = pages[i];

      // Progress callback
      if (opts.onProgress) {
        opts.onProgress(i + 1, pages.length, {
          path: pageInfo.path,
          name: pageInfo.name,
          status: 'capturing'
        });
      }

      // Get a new page tab
      const page = await getPage(browser);

      try {
        // Capture this page
        const pageResult = await captureSinglePage(page, pageInfo, opts.outputDir, opts);
        results.pages.push(pageResult);

        // Track CSS files for merging
        if (pageResult.css?.path && !pageResult.css.failed) {
          results.cssFiles.push(pageResult.css.path);
        }

        // Track filtered CSS files
        if (pageResult.cssFiltered?.path) {
          results.cssFilesFiltered.push(pageResult.cssFiltered.path);
        }

        // Update stats
        if (pageResult.success) {
          results.stats.successfulPages++;
          results.stats.totalScreenshots += Object.keys(pageResult.screenshots)
            .filter(vp => !pageResult.screenshots[vp].failed).length;
        } else {
          results.stats.failedPages++;
        }
        results.stats.totalWarnings += pageResult.warnings.length;

        // Progress callback - done
        if (opts.onProgress) {
          opts.onProgress(i + 1, pages.length, {
            path: pageInfo.path,
            name: pageInfo.name,
            status: 'done'
          });
        }
      } finally {
        // Close tab, keep browser
        await page.close().catch(() => {});
      }
    }
  } catch (err) {
    results.success = false;
    results.error = err.message;
  } finally {
    // Disconnect browser
    if (browser) {
      await disconnectBrowser().catch(() => {});
    }
  }

  // Calculate total time
  results.stats.totalTimeMs = Date.now() - startTime;

  // Write results JSON
  const resultsPath = path.join(opts.outputDir, 'capture-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  results.resultsFile = resultsPath;

  return results;
}

// CLI support
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('multi-page-screenshot.js') ||
  process.argv[1].includes('multi-page-screenshot')
);

if (isMainModule) {
  // Simple CLI: node multi-page-screenshot.js <url> <outputDir>
  const url = process.argv[2];
  const outputDir = process.argv[3] || './multi-capture-output';

  if (!url) {
    console.error('Usage: node multi-page-screenshot.js <url> [outputDir]');
    process.exit(1);
  }

  // Import discoverPages for CLI mode
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
