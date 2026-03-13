/**
 * Unified utilities for design-clone
 * Merges: browser, helpers, progress, log, env, playwright, playwright-loader, config, error-codes, viewports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Constants ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..');

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 },
};

export const VIEWPORTS_HD = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 },
};

export const VIEWPORT_NAMES = ['desktop', 'tablet', 'mobile'];

export const TIMING = {
  VIEWPORT_SETTLE_DELAY: 1500,
  NETWORK_IDLE_TIMEOUT: 8000,
  POST_NAVIGATION_DELAY: 3000,
  POST_RESIZE_DELAY: 2000,
  VERIFICATION_DELAY: 500,
};

export const SIZE_LIMITS = {
  MAX_CSS_INPUT: 50 * 1024 * 1024,
  MAX_STATE: 1024 * 1024,
  CSS_CHUNK_THRESHOLD: 2 * 1024 * 1024,
};

export const POOL = { MAX_BROWSER_CONTEXTS: 3, MIN_FREE_MEMORY_MB: 500 };

export const CDN = {
  FONT_AWESOME_VERSION: '6.5.1',
  FONT_AWESOME_CSS: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
};

export const LAYOUT = { SIDEBAR_MAX_WIDTH: 400 };

// ── Error Handling ─────────────────────────────────────────────────────────

export const ERROR_CODES = {
  CSS_SIZE_EXCEEDED: { message: 'CSS file exceeds size limit', suggestion: 'Split CSS or increase SIZE_LIMITS.MAX_CSS_INPUT' },
  CSS_PARSE_FAILED: { message: 'CSS parse failed', suggestion: 'Check for syntax errors in source CSS' },
  CSS_CORS_BLOCKED: { message: 'Stylesheet blocked by CORS', suggestion: 'Site restricts cross-origin CSS access. Inline styles still captured' },
  HTML_EXTRACTION_FAILED: { message: 'HTML extraction failed', suggestion: 'Page may use heavy JS rendering. Try increasing --scroll-delay' },
  ASSET_DOWNLOAD_FAILED: { message: 'Asset download failed', suggestion: 'Check network connectivity. CORS or auth may block downloads' },
  BROWSER_LAUNCH_FAILED: { message: 'Browser launch failed', suggestion: 'Run: npx playwright install chromium' },
  NAV_TIMEOUT: { message: 'Page navigation timeout', suggestion: 'Site may be slow. Try increasing timeout or check URL' },
  FILE_IO_FAILED: { message: 'File read/write failed', suggestion: 'Check file permissions and disk space' },
  DISCOVERY_FAILED: { message: 'Page discovery failed', suggestion: 'Site may block bots. Try with --no-spa-detect' },
  SCREENSHOT_FAILED: { message: 'Screenshot capture failed', suggestion: 'Page may have infinite scroll. Try --full-page false' },
  INVALID_ARGS: { message: 'Invalid arguments', suggestion: 'Run: design-clone help' },
};

export class DesignCloneError extends Error {
  constructor(code, context = {}) {
    const def = ERROR_CODES[code] || { message: 'Unknown error', suggestion: '' };
    super(def.message);
    this.code = code;
    this.suggestion = def.suggestion;
    this.context = context;
    this.name = 'DesignCloneError';
  }
}

export function createError(code, context) { return new DesignCloneError(code, context); }

// ── Logging ────────────────────────────────────────────────────────────────

export const isTTY = process.stderr.isTTY;

export function logInfo(msg) { if (isTTY) console.error(`[INFO] ${msg}`); }
export function logWarn(msg) { if (isTTY) console.error(`[WARN] ${msg}`); }
export function logError(msg) { if (isTTY) console.error(`[ERROR] ${msg}`); }

// ── CLI Helpers ────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError('argv must be an array');
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (typeof arg !== 'string') continue;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && typeof next === 'string' && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

export function outputJSON(data) { console.log(JSON.stringify(data, null, 2)); }

export function outputError(error) {
  const msg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const isDCE = error?.name === 'DesignCloneError';
  console.error(JSON.stringify({
    success: false,
    error: msg,
    code: isDCE ? error.code : undefined,
    suggestion: isDCE ? error.suggestion : undefined,
    context: isDCE ? error.context : undefined,
    stack: process.env.DEBUG ? stack : undefined,
  }, null, 2));
  process.exit(1);
}

// ── Progress Reporter ──────────────────────────────────────────────────────

export class ProgressReporter {
  #current = 0;
  #total = 0;
  #label = '';

  start(totalSteps, label = '') {
    this.#total = totalSteps;
    this.#current = 0;
    this.#label = label;
    if (isTTY) process.stderr.write(`[0/${totalSteps}] ${label}\n`);
  }

  step(label, details = '') {
    this.#current++;
    const d = details ? ` (${details})` : '';
    if (isTTY) process.stderr.write(`[${this.#current}/${this.#total}] ${label}${d}\n`);
  }

  complete(summary = '') {
    if (isTTY) process.stderr.write(`[done] ${summary}\n`);
  }
}

export function createProgress() { return new ProgressReporter(); }

// ── Environment ────────────────────────────────────────────────────────────

function getHomeDir() { return process.env.HOME || process.env.USERPROFILE || ''; }

function parseEnvContent(content) {
  const result = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    if (!key) return;
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2) {
      const f = value[0], l = value[value.length - 1];
      if ((f === '"' && l === '"') || (f === "'" && l === "'")) value = value.slice(1, -1);
    }
    result[key] = value;
  });
  return result;
}

export function loadEnv() {
  const home = getHomeDir();
  const paths = [
    process.cwd(),
    SKILL_DIR,
    home ? path.join(home, '.claude/skills') : null,
    home ? path.join(home, '.claude') : null,
  ].filter(Boolean);

  for (const dir of paths) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const parsed = parseEnvContent(fs.readFileSync(envPath, 'utf-8'));
        Object.entries(parsed).forEach(([k, v]) => { if (!process.env[k]) process.env[k] = v; });
        return envPath;
      } catch (err) {
        console.error(`[env] Failed to read ${envPath}: ${err.message}`);
      }
    }
  }
  return null;
}

export function getEnv(key, defaultValue = null) { return process.env[key] || defaultValue; }

export function requireEnv(key, hint = '') {
  const value = process.env[key];
  if (!value) throw new Error(`Required env var ${key} not set.${hint ? `\nHint: ${hint}` : ''}`);
  return value;
}

export function getSkillDir() { return SKILL_DIR; }

// ── Playwright Loader ──────────────────────────────────────────────────────

export function detectChromePath() {
  const paths = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ...(process.env.LOCALAPPDATA ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`] : []),
    ],
  };
  for (const p of (paths[process.platform] || [])) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

let _playwright = null;

export async function loadPlaywright() {
  if (_playwright) return _playwright;
  try { _playwright = await import('playwright'); return _playwright; }
  catch (e1) {
    try { _playwright = await import('playwright-core'); return _playwright; }
    catch (e2) { throw new Error(`Playwright not found. Install: npm install playwright`); }
  }
}

// ── Browser Management ─────────────────────────────────────────────────────

let _browser = null;
let _page = null;

const DEFAULT_VIEWPORT = { width: VIEWPORTS_HD.desktop.width, height: VIEWPORTS_HD.desktop.height };

export async function getBrowser(options = {}) {
  const pw = await loadPlaywright();
  if (_browser && _browser.isConnected()) return _browser;

  let executablePath = options.executablePath;
  if (!executablePath) {
    const isCore = !pw.chromium?.executablePath;
    if (isCore) {
      executablePath = detectChromePath();
      if (!executablePath) throw new Error('Chrome not found. Install Google Chrome or use full playwright.');
    }
  }

  const launchOpts = {
    headless: options.headless !== false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', ...(options.args || [])],
  };
  if (executablePath) launchOpts.executablePath = executablePath;

  _browser = await pw.chromium.launch(launchOpts);
  logInfo('Launched Playwright browser');
  return _browser;
}

export async function getPage(browser, options = {}) {
  if (!browser || !browser.isConnected()) throw new Error('Browser not connected. Call getBrowser() first.');
  if (_page && !_page.isClosed()) return _page;

  const contexts = browser.contexts();
  if (contexts.length > 0) {
    const pages = contexts[0].pages();
    if (pages.length > 0) { _page = pages[0]; return _page; }
  }

  const ctx = await browser.newContext({ viewport: options.viewport || DEFAULT_VIEWPORT });
  _page = await ctx.newPage();
  return _page;
}

export async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch (err) { logError(`Error closing browser: ${err.message}`); }
    _browser = null;
    _page = null;
    logInfo('Closed browser');
  }
}

export async function disconnectBrowser() { return closeBrowser(); }
