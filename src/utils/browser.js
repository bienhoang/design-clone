/**
 * Browser abstraction facade for design-clone scripts
 *
 * Auto-detects and uses:
 * 1. chrome-devtools skill (if installed) - Preferred
 * 2. Standalone puppeteer wrapper - Fallback
 *
 * Exports same API regardless of provider:
 * - getBrowser(options)
 * - getPage(browser)
 * - closeBrowser()
 * - disconnectBrowser()
 * - parseArgs(argv)
 * - outputJSON(data)
 * - outputError(error)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chrome DevTools skill path
const CHROME_DEVTOOLS_PATH = path.join(
  process.env.HOME,
  '.claude/skills/chrome-devtools/scripts/lib/browser.js'
);

let browserModule = null;
let providerName = 'unknown';

/**
 * Initialize browser provider (lazy-loaded)
 */
async function initProvider() {
  if (browserModule) return;

  // Check for chrome-devtools skill
  if (fs.existsSync(CHROME_DEVTOOLS_PATH)) {
    try {
      browserModule = await import(CHROME_DEVTOOLS_PATH);
      providerName = 'chrome-devtools';
      console.error('[browser] Using chrome-devtools skill');
      return;
    } catch (e) {
      console.error('[browser] chrome-devtools found but failed to load:', e.message);
    }
  }

  // Fall back to standalone puppeteer wrapper
  browserModule = await import('./puppeteer.js');
  providerName = 'standalone';
  console.error('[browser] Using standalone puppeteer wrapper');
}

// Import utilities (always use local helpers)
import { parseArgs, outputJSON, outputError } from './helpers.js';
export { parseArgs, outputJSON, outputError };

/**
 * Get current browser provider name
 * @returns {string} 'chrome-devtools' or 'standalone'
 */
export function getProviderName() {
  return providerName;
}

/**
 * Launch or connect to browser
 * @param {Object} options - Browser options
 * @returns {Promise<Browser>} Browser instance
 */
export async function getBrowser(options = {}) {
  await initProvider();
  return browserModule.getBrowser(options);
}

/**
 * Get page from browser
 * @param {Browser} browser - Browser instance
 * @returns {Promise<Page>} Page instance
 */
export async function getPage(browser) {
  await initProvider();
  return browserModule.getPage(browser);
}

/**
 * Close browser and clear session
 */
export async function closeBrowser() {
  await initProvider();
  return browserModule.closeBrowser();
}

/**
 * Disconnect from browser without closing
 */
export async function disconnectBrowser() {
  await initProvider();
  return browserModule.disconnectBrowser();
}
