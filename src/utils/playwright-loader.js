/**
 * Playwright Loader Helpers
 *
 * Chrome path detection and playwright module loading utilities.
 * Extracted from playwright.js to keep each file under 200 lines.
 */

import fs from 'fs';

/**
 * Detect Chrome executable path by platform
 * Used for playwright-core fallback when full playwright is not installed
 * @returns {string|null} Chrome path or null if not found
 */
export function detectChromePath() {
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
      ...(process.env.LOCALAPPDATA
        ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`]
        : [])
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

/** @type {typeof import('playwright')|null} */
let playwright = null;

/**
 * Load playwright module (try playwright first, then playwright-core)
 * @returns {Promise<Object>} Playwright module with chromium browser type
 * @throws {Error} If neither playwright nor playwright-core is installed
 */
export async function loadPlaywright() {
  if (playwright) return playwright;

  try {
    playwright = await import('playwright');
    return playwright;
  } catch (e1) {
    try {
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
