/**
 * Environment validation utilities
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

/**
 * Check Node.js version
 * @returns {Promise<{ok: boolean, version: string, message: string}>}
 */
export async function checkNode() {
  try {
    const { stdout } = await exec('node --version');
    const version = stdout.trim();
    const major = parseInt(version.slice(1).split('.')[0], 10);

    if (major >= 18) {
      return { ok: true, version, message: `Node.js ${version}` };
    }
    return { ok: false, version, message: `Node.js ${version} (requires >=18)` };
  } catch {
    return { ok: false, version: 'unknown', message: 'Node.js not found' };
  }
}

/**
 * Check Python version
 * @returns {Promise<{ok: boolean, version: string, message: string}>}
 */
export async function checkPython() {
  try {
    const { stdout } = await exec('python3 --version');
    const version = stdout.trim().replace('Python ', '');
    const [major, minor] = version.split('.').map(Number);

    if (major >= 3 && minor >= 9) {
      return { ok: true, version, message: `Python ${version}` };
    }
    return { ok: false, version, message: `Python ${version} (requires >=3.9)` };
  } catch {
    return { ok: false, version: 'unknown', message: 'Python 3 not found' };
  }
}

/**
 * Check Chrome/Chromium
 * @returns {Promise<{ok: boolean, path: string, message: string}>}
 */
export async function checkChrome() {
  const paths = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ]
  };

  const platformPaths = paths[process.platform] || [];

  for (const chromePath of platformPaths) {
    try {
      const fs = await import('fs/promises');
      await fs.access(chromePath);
      return { ok: true, path: chromePath, message: 'Chrome found' };
    } catch {
      // Continue to next path
    }
  }

  // Try which/where command
  try {
    const cmd = process.platform === 'win32' ? 'where chrome' : 'which google-chrome || which chromium';
    const { stdout } = await exec(cmd);
    const found = stdout.trim().split('\n')[0];
    if (found) {
      return { ok: true, path: found, message: 'Chrome found' };
    }
  } catch {
    // Not found
  }

  return { ok: false, path: '', message: 'Chrome/Chromium not found' };
}

/**
 * Check Playwright
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function checkPlaywright() {
  try {
    const playwright = await import('playwright');
    // Check if browsers are installed by checking chromium executable
    if (playwright.chromium?.executablePath) {
      try {
        const fs = await import('fs/promises');
        await fs.access(playwright.chromium.executablePath());
        return { ok: true, message: 'Playwright installed with browsers' };
      } catch {
        return { ok: true, message: 'Playwright installed (browsers may need install)' };
      }
    }
    return { ok: true, message: 'Playwright installed' };
  } catch {
    // Try playwright-core
    try {
      await import('playwright-core');
      return { ok: true, message: 'playwright-core installed (needs Chrome)' };
    } catch {
      return { ok: false, message: 'Playwright not installed' };
    }
  }
}

/**
 * Run all checks
 * @returns {Promise<Object>}
 */
export async function runAllChecks() {
  const [node, python, chrome, playwright] = await Promise.all([
    checkNode(),
    checkPython(),
    checkChrome(),
    checkPlaywright()
  ]);

  return { node, python, chrome, playwright };
}
