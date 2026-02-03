/**
 * Browser abstraction facade for design-clone scripts
 *
 * Uses Playwright wrapper for browser automation.
 *
 * Exports same API:
 * - getBrowser(options)
 * - getPage(browser)
 * - closeBrowser()
 * - disconnectBrowser()
 * - parseArgs(argv)
 * - outputJSON(data)
 * - outputError(error)
 */

let browserModule = null;
let providerName = 'unknown';

/**
 * Initialize browser provider (lazy-loaded)
 */
async function initProvider() {
  if (browserModule) return;

  browserModule = await import('./playwright.js');
  providerName = 'playwright';
  console.error('[browser] Using Playwright wrapper');
}

// Import utilities (always use local helpers)
import { parseArgs, outputJSON, outputError } from './helpers.js';
export { parseArgs, outputJSON, outputError };

/**
 * Get current browser provider name
 * @returns {string} 'playwright'
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
 * @param {Object} [options] - Page options
 * @returns {Promise<Page>} Page instance
 */
export async function getPage(browser, options = {}) {
  await initProvider();
  return browserModule.getPage(browser, options);
}

/**
 * Close browser
 */
export async function closeBrowser() {
  await initProvider();
  return browserModule.closeBrowser();
}

/**
 * Disconnect from browser (alias for close in Playwright)
 */
export async function disconnectBrowser() {
  await initProvider();
  return browserModule.disconnectBrowser();
}
