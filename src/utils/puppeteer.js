/**
 * Standalone Puppeteer browser wrapper for design-clone scripts
 * Provides browser automation without requiring chrome-devtools skill
 *
 * Features:
 * - Auto-detects Chrome installation path (macOS, Linux, Windows)
 * - Session persistence via WebSocket endpoint file
 * - Graceful connect/disconnect lifecycle
 *
 * @note Session file may have race conditions in concurrent execution scenarios.
 *       For production use with multiple parallel scripts, consider external lock.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session file for browser reuse across script invocations
const SESSION_FILE = path.join(__dirname, '..', '.browser-session.json');
const SESSION_MAX_AGE = 3600000; // 1 hour

let browserInstance = null;
let pageInstance = null;
let puppeteer = null;

/**
 * Detect Chrome executable path by platform
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
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
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
 * Load puppeteer module (try puppeteer first, then puppeteer-core)
 * @returns {Promise<Object>} Puppeteer module
 * @throws {Error} If neither puppeteer nor puppeteer-core is installed
 */
async function loadPuppeteer() {
  if (puppeteer) return puppeteer;

  try {
    // Try full puppeteer first (includes bundled Chrome)
    puppeteer = (await import('puppeteer')).default;
    return puppeteer;
  } catch (e1) {
    try {
      // Fall back to puppeteer-core (requires Chrome)
      puppeteer = (await import('puppeteer-core')).default;
      return puppeteer;
    } catch (e2) {
      throw new Error(
        'Puppeteer not found. Install with: npm install puppeteer\n' +
        'Or for smaller install: npm install puppeteer-core\n' +
        `Details: puppeteer: ${e1.message}, puppeteer-core: ${e2.message}`
      );
    }
  }
}

/**
 * Read browser session from file
 * @returns {Object|null} Session data with wsEndpoint and timestamp, or null if invalid/missing
 */
function readSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Validate session age
      if (data.timestamp && Date.now() - data.timestamp < SESSION_MAX_AGE) {
        return data;
      }
      // Session expired, clean up
      clearSession();
    }
  } catch (err) {
    console.error(`[browser] Failed to read session: ${err.message}`);
  }
  return null;
}

/**
 * Write browser session to file with PID tracking
 * @param {string} wsEndpoint - WebSocket endpoint URL
 */
function writeSession(wsEndpoint) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({
      wsEndpoint,
      timestamp: Date.now(),
      pid: process.pid
    }));
  } catch (err) {
    console.error(`[browser] Failed to write session: ${err.message}`);
  }
}

/**
 * Clear browser session file
 */
function clearSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (err) {
    console.error(`[browser] Failed to clear session: ${err.message}`);
  }
}

/**
 * Launch or connect to browser instance
 * Reuses existing session if available and valid
 *
 * @param {Object} options - Browser options
 * @param {boolean} [options.headless=true] - Run in headless mode
 * @param {Object} [options.viewport] - Default viewport dimensions
 * @param {string} [options.executablePath] - Chrome executable path override
 * @param {string[]} [options.args] - Additional Chrome arguments
 * @returns {Promise<Browser>} Puppeteer browser instance
 * @throws {Error} If Chrome not found and no executablePath provided
 */
export async function getBrowser(options = {}) {
  const pptr = await loadPuppeteer();

  // Reuse existing browser in this process
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Try to connect to existing browser from session
  const session = readSession();
  if (session?.wsEndpoint) {
    try {
      browserInstance = await pptr.connect({
        browserWSEndpoint: session.wsEndpoint
      });
      console.error('[browser] Connected to existing session');
      return browserInstance;
    } catch (err) {
      console.error(`[browser] Failed to connect to existing session: ${err.message}`);
      clearSession();
    }
  }

  // Determine executable path
  let executablePath = options.executablePath;
  if (!executablePath && pptr.executablePath) {
    try {
      // Full puppeteer has built-in Chrome
      executablePath = pptr.executablePath();
    } catch {
      // puppeteer-core needs manual path
      executablePath = detectChromePath();
    }
  }

  if (!executablePath) {
    throw new Error(
      'Chrome not found. Either:\n' +
      '1. Install Google Chrome\n' +
      '2. Use full puppeteer (npm install puppeteer)\n' +
      '3. Set executablePath option'
    );
  }

  // Launch new browser
  const launchOptions = {
    headless: options.headless !== false,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      ...(options.args || [])
    ],
    defaultViewport: options.viewport || {
      width: 1920,
      height: 1080
    }
  };

  browserInstance = await pptr.launch(launchOptions);

  // Save session for reuse
  const wsEndpoint = browserInstance.wsEndpoint();
  writeSession(wsEndpoint);
  console.error('[browser] Launched new browser');

  return browserInstance;
}

/**
 * Get current page or create new one
 * Reuses existing page if available
 *
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<Page>} Puppeteer page instance
 * @throws {Error} If browser is null or disconnected
 */
export async function getPage(browser) {
  if (!browser || !browser.isConnected()) {
    throw new Error('Browser not connected. Call getBrowser() first.');
  }

  if (pageInstance && !pageInstance.isClosed()) {
    return pageInstance;
  }

  const pages = await browser.pages();
  pageInstance = pages.length > 0 ? pages[0] : await browser.newPage();

  return pageInstance;
}

/**
 * Close browser and clear session
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
    clearSession();
    console.error('[browser] Closed and cleared session');
  }
}

/**
 * Disconnect from browser without closing it
 * Use to keep browser running for future script executions
 */
export async function disconnectBrowser() {
  if (browserInstance) {
    try {
      browserInstance.disconnect();
    } catch (err) {
      console.error(`[browser] Error disconnecting: ${err.message}`);
    }
    browserInstance = null;
    pageInstance = null;
    console.error('[browser] Disconnected (browser still running)');
  }
}
