/**
 * URL utility helpers for page discovery.
 *
 * Provides URL normalization, domain checking, page name extraction,
 * exclusion filtering, path normalization, and route merging logic.
 * Used by discover-pages.js (main orchestrator).
 */

// Navigation selectors in priority order
export const NAV_SELECTORS = [
  'header nav a',
  'header a',
  'nav a',
  '[role="navigation"] a',
  '.navbar a',
  '.nav-menu a',
  '.navigation a',
  'footer nav a',
  'footer a'
];

// Patterns to exclude from discovered links
export const EXCLUDE_PATTERNS = [
  /^mailto:/i,
  /^tel:/i,
  /^javascript:/i,
  /^#/,
  /\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|zip|tar|gz|mp3|mp4|avi|mov)$/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /instagram\.com/i,
  /linkedin\.com/i,
  /youtube\.com/i,
  /tiktok\.com/i
];

// Valid framework names for validation
export const VALID_FRAMEWORKS = ['next', 'nuxt', 'vue', 'react', 'angular', 'svelte', 'astro'];

// Default options
export const DEFAULT_OPTIONS = {
  maxPages: 10,
  selectors: null,  // Use default NAV_SELECTORS if null
  includeSubdomains: false,
  timeout: 30000,
  // SPA/Framework options (v1.3)
  spaMode: true,         // Enable SPA detection and route discovery
  framework: null,       // Force specific framework (skip detection)
  noSpaDetect: false,    // Disable SPA/framework detection entirely
  captureState: false    // Capture app state (Redux/Vuex/Pinia/Zustand)
};

/**
 * Log warning message (only in TTY mode)
 * @param {string} message - Warning message
 */
export function logWarning(message) {
  if (process.stderr.isTTY) {
    console.error(`[discover-pages] WARN: ${message}`);
  }
}

/**
 * Validate and normalize framework option
 * @param {string|null} framework - Framework name to validate
 * @returns {string|null} Validated framework name or null
 */
export function validateFramework(framework) {
  if (!framework) return null;
  const normalized = String(framework).toLowerCase().trim();
  if (VALID_FRAMEWORKS.includes(normalized)) {
    return normalized;
  }
  logWarning(`Invalid framework "${framework}". Valid options: ${VALID_FRAMEWORKS.join(', ')}`);
  return null;
}

/**
 * Normalize URL for comparison and deduplication
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @param {string} href - URL to normalize
 * @returns {string|null} Normalized URL or null if invalid
 */
export function normalizeUrl(baseUrl, href) {
  if (!href || typeof href !== 'string') return null;

  try {
    const url = new URL(href, baseUrl);

    // Skip non-http(s) protocols
    if (!url.protocol.startsWith('http')) return null;

    // Build normalized URL: origin + pathname (no hash, no query)
    let normalized = url.origin + url.pathname;

    // Remove trailing slash (except for root)
    if (normalized.endsWith('/') && normalized !== url.origin + '/') {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return null;
  }
}

/**
 * Check if URL is same domain as base
 * @param {string} url - URL to check
 * @param {string} baseDomain - Base domain to compare against
 * @param {boolean} includeSubdomains - Whether to include subdomains
 * @returns {boolean}
 */
export function isSameDomain(url, baseDomain, includeSubdomains = false) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const base = baseDomain.toLowerCase();

    if (hostname === base) return true;

    if (includeSubdomains) {
      return hostname.endsWith('.' + base);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract page name from link text or URL path
 * @param {string} text - Link text
 * @param {string} path - URL path
 * @returns {string} Page name
 */
export function extractPageName(text, path) {
  // Use link text if available and meaningful
  if (text && text.length > 0 && text.length < 50) {
    return text;
  }

  // Extract from path
  if (!path || path === '/') return 'Home';

  // Get last segment of path
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'Home';

  const lastSegment = segments[segments.length - 1];

  // Convert kebab-case/snake_case to Title Case
  return lastSegment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Check if href should be excluded
 * @param {string} href - URL to check
 * @returns {boolean}
 */
export function shouldExclude(href) {
  if (!href) return true;
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(href));
}

/**
 * Normalize a path (remove trailing slash except for root)
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
export function normalizePath(path) {
  if (!path || typeof path !== 'string') return '/';
  return path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
}
