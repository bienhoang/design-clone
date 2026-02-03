/**
 * Standalone Playwright browser wrapper for design-clone scripts
 * Provides browser automation with Playwright
 *
 * Features:
 * - Auto-detects Chrome installation path (macOS, Linux, Windows)
 * - Fast browser launch (no session persistence needed)
 * - Compatible API with previous Puppeteer wrapper
 */

import fs from 'fs';

/** @type {import('playwright').Browser|null} */
let browserInstance = null;
/** @type {import('playwright').Page|null} */
let pageInstance = null;
/** @type {typeof import('playwright')|null} */
let playwright = null;

/** Default viewport dimensions */
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Detect Chrome executable path by platform
 * Used for playwright-core fallback when full playwright is not installed
 * @returns {string|null} Chrome path or null if not found
 */
function detectChromePath() {
  const platform = process.platform;

  const paths = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ...(process.env.LOCALAPPDATA ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`] : [])
    ]
  };

  const candidates = paths[platform] || [];
  for (const chromePath of candidates) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  return null;
}

/**
 * Load playwright module (try playwright first, then playwright-core)
 * @returns {Promise<Object>} Playwright module with chromium browser type
 * @throws {Error} If neither playwright nor playwright-core is installed
 */
async function loadPlaywright() {
  if (playwright) return playwright;

  try {
    // Try full playwright first (includes bundled browsers)
    playwright = await import('playwright');
    return playwright;
  } catch (e1) {
    try {
      // Fall back to playwright-core (requires Chrome)
      playwright = await import('playwright-core');
      return playwright;
    } catch (e2) {
      throw new Error(
        'Playwright not found. Install with: npm install playwright\n' +
        'Or for smaller install: npm install playwright-core\n' +
        `Details: playwright: ${e1.message}, playwright-core: ${e2.message}`
      );
    }
  }
}

/**
 * Launch browser instance
 *
 * @param {Object} options - Browser options
 * @param {boolean} [options.headless=true] - Run in headless mode
 * @param {Object} [options.viewport] - Default viewport dimensions (applied per context)
 * @param {string} [options.executablePath] - Chrome executable path override
 * @param {string[]} [options.args] - Additional Chrome arguments
 * @returns {Promise<Browser>} Playwright browser instance
 * @throws {Error} If Chrome not found and no executablePath provided (playwright-core)
 */
export async function getBrowser(options = {}) {
  const pw = await loadPlaywright();

  // Reuse existing browser if connected
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Determine executable path for playwright-core
  let executablePath = options.executablePath;
  if (!executablePath) {
    // Check if we're using playwright-core (no bundled browser)
    const isCore = !pw.chromium?.executablePath;
    if (isCore) {
      executablePath = detectChromePath();
      if (!executablePath) {
        throw new Error(
          'Chrome not found. Either:\n' +
          '1. Install Google Chrome\n' +
          '2. Use full playwright (npm install playwright)\n' +
          '3. Set executablePath option'
        );
      }
    }
  }

  // Build launch options
  const launchOptions = {
    headless: options.headless !== false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      ...(options.args || [])
    ]
  };

  // Only set executablePath if needed (playwright-core or override)
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  // Launch browser
  browserInstance = await pw.chromium.launch(launchOptions);
  console.error('[browser] Launched Playwright browser');

  return browserInstance;
}

/**
 * Get current page or create new one
 * Reuses existing page if available
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @param {Object} [options] - Page options
 * @param {{width: number, height: number}} [options.viewport] - Viewport dimensions
 * @returns {Promise<import('playwright').Page>} Playwright page instance
 * @throws {Error} If browser is null or disconnected
 */
export async function getPage(browser, options = {}) {
  if (!browser || !browser.isConnected()) {
    throw new Error('Browser not connected. Call getBrowser() first.');
  }

  if (pageInstance && !pageInstance.isClosed()) {
    return pageInstance;
  }

  // Get existing pages or create new context + page
  const contexts = browser.contexts();
  if (contexts.length > 0) {
    const pages = contexts[0].pages();
    if (pages.length > 0) {
      pageInstance = pages[0];
      return pageInstance;
    }
  }

  // Create new context with default viewport
  const contextOptions = {
    viewport: options.viewport || DEFAULT_VIEWPORT
  };

  const context = await browser.newContext(contextOptions);
  pageInstance = await context.newPage();

  return pageInstance;
}

/**
 * Close browser
 * Use when completely done with browser
 */
export async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (err) {
      console.error(`[browser] Error closing browser: ${err.message}`);
    }
    browserInstance = null;
    pageInstance = null;
    console.error('[browser] Closed browser');
  }
}

/**
 * Disconnect from browser (alias for closeBrowser in Playwright)
 * Playwright doesn't support disconnect without close, so this is an alias
 */
export async function disconnectBrowser() {
  // Playwright doesn't have disconnect concept like Puppeteer
  // Just close the browser for API compatibility
  return closeBrowser();
}
