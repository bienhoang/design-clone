/**
 * Screenshot Helpers
 *
 * CLI argument parsing, browser lifecycle management, and image compression
 * utilities used by the screenshot capture pipeline.
 *
 * @module screenshot-helpers
 */

import fs from 'fs/promises';

import { filterCssFile } from '../css/filter-css.js';
import { getBrowser, getPage, closeBrowser, parseArgs, outputError } from '../../utils/browser.js';
import { waitForPageReady } from '../page-prep/page-readiness.js';
import { dismissCookieBanner } from '../page-prep/cookie-handler.js';
import { VIEWPORTS } from '../../shared/viewports.js';
import { TIMING } from '../../shared/config.js';

export { filterCssFile, VIEWPORTS };

export const VIEWPORT_SETTLE_DELAY = TIMING.VIEWPORT_SETTLE_DELAY;
export const NETWORK_IDLE_TIMEOUT = TIMING.NETWORK_IDLE_TIMEOUT;
export const DEFAULT_SCROLL_DELAY = 1500;

// Try to import Sharp for compression
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  // Sharp not available
}

/**
 * Parse and validate screenshot command arguments
 * @param {string[]} argv - Raw CLI arguments
 * @returns {Object} Parsed and validated options
 */
export function parseScreenshotArgs(argv) {
  const args = parseArgs(argv);
  const { url, output } = args;

  if (!url) {
    outputError(new Error('--url is required'));
    process.exit(1);
  }
  if (!output) {
    outputError(new Error('--output directory is required'));
    process.exit(1);
  }

  const requestedViewports = args.viewports
    ? args.viewports.split(',').map(v => v.trim().toLowerCase())
    : ['desktop', 'tablet', 'mobile'];

  for (const vp of requestedViewports) {
    if (!VIEWPORTS[vp]) {
      outputError(new Error(`Invalid viewport: ${vp}. Valid: desktop, tablet, mobile`));
      process.exit(1);
    }
  }

  return {
    url: url,
    output: output,
    viewports: requestedViewports,
    fullPage: args['full-page'] !== 'false',
    maxSize: args['max-size'] ? parseFloat(args['max-size']) : 5,
    scrollDelay: args['scroll-delay'] ? parseInt(args['scroll-delay'], 10) : DEFAULT_SCROLL_DELAY,
    extractHtml: args['extract-html'] === 'true',
    extractCss: args['extract-css'] === 'true',
    filterUnused: args['filter-unused'] !== 'false',
    captureHover: args['capture-hover'] === 'true',
    captureVideo: args['video'] === 'true',
    videoFormat: args['video-format'] || 'webm',
    videoDuration: args['video-duration'] ? parseInt(args['video-duration'], 10) : 12000,
    sectionMode: args['section-mode'] === 'true',
    enhanceSemantic: args['no-semantic'] !== 'true',
    extractAnimations: args['extract-animations'] !== 'false',
    headless: args.headless === 'true',
    close: args.close === 'true'
  };
}

/**
 * Create browser manager for handling browser lifecycle
 * @param {boolean} cliHeadless - CLI headless flag
 * @returns {Object} Browser manager with init/cleanup methods
 */
export function createBrowserManager(cliHeadless) {
  let browser = null;
  let page = null;
  let currentHeadless = null;
  let cookieResult = null;

  const getHeadlessForViewport = (viewport) => viewport === 'desktop' ? true : cliHeadless;

  const init = async (headless, navigateUrl = null) => {
    if (browser && currentHeadless !== headless) {
      await closeBrowser();
      browser = null;
      page = null;
    }

    if (!browser) {
      browser = await getBrowser({
        headless,
        args: headless ? [] : ['--start-maximized', '--window-position=0,0']
      });
      page = await getPage(browser);
      currentHeadless = headless;

      if (navigateUrl) {
        await page.setViewportSize(VIEWPORTS.desktop);
        await page.goto(navigateUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await new Promise(r => setTimeout(r, 3000));
        cookieResult = await dismissCookieBanner(page);
        await waitForPageReady(page);
      }
    }
    return { browser, page };
  };

  return {
    init,
    getHeadlessForViewport,
    getPage: () => page,
    getCookieResult: () => cookieResult,
    getCurrentHeadless: () => currentHeadless,
    setCurrentHeadless: (val) => { currentHeadless = val; }
  };
}

/**
 * Compress image if it exceeds max size
 * @param {string} filePath - Path to the image file
 * @param {number} [maxSizeMB=5] - Max size in MB
 * @returns {Promise<Object>} Compression result
 */
export async function compressIfNeeded(filePath, maxSizeMB = 5) {
  const stats = await fs.stat(filePath);
  const originalSize = stats.size;
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (originalSize <= maxBytes || !sharp) {
    return { compressed: false, originalSize, finalSize: originalSize };
  }

  try {
    const buffer = await fs.readFile(filePath);
    const meta = await sharp(buffer).metadata();

    const newWidth = Math.round(meta.width * 0.85);
    let output = await sharp(buffer)
      .resize(newWidth)
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();

    if (output.length > maxBytes) {
      const smallerWidth = Math.round(meta.width * 0.7);
      output = await sharp(buffer)
        .resize(smallerWidth)
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer();
    }

    await fs.writeFile(filePath, output);
    return { compressed: true, originalSize, finalSize: output.length };
  } catch (err) {
    return { compressed: false, originalSize, finalSize: originalSize, error: err.message };
  }
}
