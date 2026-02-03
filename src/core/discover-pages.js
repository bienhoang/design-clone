/**
 * Page Discovery Module
 *
 * Extracts navigation links from a website to discover cloneable pages.
 * Handles SPA hydration, filters external links, and normalizes URLs.
 *
 * Enhanced with SPA/Framework support (v1.3):
 * - Framework detection (Next.js, Nuxt, Vue, React, Angular, Svelte, Astro)
 * - Framework-specific route discovery
 * - App state capture (optional)
 *
 * Usage:
 *   import { discoverPages } from './discover-pages.js';
 *   const result = await discoverPages('https://example.com', { maxPages: 10 });
 */

import { getBrowser, getPage, disconnectBrowser } from '../utils/browser.js';
import { waitForDomStable, waitForPageReady } from './page-readiness.js';
import { dismissCookieBanner } from './cookie-handler.js';

// SPA/Framework support imports
import { detectFramework, formatDetectionResult } from './framework-detector.js';
import { discoverRoutes as discoverFrameworkRoutes } from '../route-discoverers/index.js';
import { captureAppState, formatStateSnapshot } from './app-state-snapshot.js';

// Navigation selectors in priority order
const NAV_SELECTORS = [
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
const EXCLUDE_PATTERNS = [
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

// Default options
const DEFAULT_OPTIONS = {
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
function shouldExclude(href) {
  if (!href) return true;
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(href));
}

/**
 * Merge framework-discovered routes with link-scraped pages
 * Prioritizes framework routes (higher quality), fills gaps with link-scraped
 * @param {Array} frameworkRoutes - Routes from framework discoverer
 * @param {Array} linkScrapedPages - Pages from link scraping
 * @param {string} baseDomain - Base domain for URL normalization
 * @param {string} baseUrl - Base URL for resolving paths
 * @returns {Array} Merged and deduplicated pages
 */
function mergeRoutes(frameworkRoutes, linkScrapedPages, baseDomain, baseUrl) {
  const seenPaths = new Set();
  const merged = [];

  // Add framework routes first (higher quality, more accurate)
  if (Array.isArray(frameworkRoutes)) {
    for (const route of frameworkRoutes) {
      const path = route.path || '/';
      const normalizedPath = path.endsWith('/') && path !== '/'
        ? path.slice(0, -1)
        : path;

      if (seenPaths.has(normalizedPath)) continue;
      seenPaths.add(normalizedPath);

      const url = normalizeUrl(baseUrl, normalizedPath) || route.url;

      merged.push({
        path: normalizedPath,
        name: route.name || extractPageName('', normalizedPath),
        url,
        source: route.source || 'framework',
        dynamic: route.dynamic || false
      });
    }
  }

  // Add link-scraped pages (fill gaps)
  if (Array.isArray(linkScrapedPages)) {
    for (const page of linkScrapedPages) {
      const path = page.path || '/';
      const normalizedPath = path.endsWith('/') && path !== '/'
        ? path.slice(0, -1)
        : path;

      if (seenPaths.has(normalizedPath)) continue;
      seenPaths.add(normalizedPath);

      merged.push({
        ...page,
        path: normalizedPath,
        source: 'link-scrape',
        dynamic: false
      });
    }
  }

  return merged;
}

/**
 * Discover pages from a website by extracting navigation links
 * @param {string} baseUrl - Starting URL to discover from
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Discovery result
 */
export async function discoverPages(baseUrl, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  let browser = null;
  let page = null;

  try {
    // Parse base URL
    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname;

    // Launch browser
    browser = await getBrowser({ headless: true });
    page = await getPage(browser);

    // Navigate to page
    await page.goto(baseUrl, {
      waitUntil: 'networkidle',
      timeout: opts.timeout
    });

    // Wait for SPA hydration
    await page.waitForSelector('nav a, header a, [role="navigation"] a', {
      visible: true,
      timeout: 5000
    }).catch(() => {});

    await waitForDomStable(page, 500, 5000);

    // Dismiss cookie banner if present
    await dismissCookieBanner(page);

    // Wait a bit more for any dynamic content
    await new Promise(r => setTimeout(r, 1000));

    // Extract links using selectors
    const selectors = opts.selectors || NAV_SELECTORS;
    const selectorString = selectors.join(', ');

    const rawLinks = await page.$$eval(selectorString, (elements) => {
      return elements.map(el => ({
        href: el.href,
        text: el.textContent?.trim() || '',
        tagName: el.tagName
      }));
    }).catch(() => []);

    // Process and filter links
    const seenUrls = new Set();
    const pages = [];

    // Always include homepage first
    const homeUrl = normalizeUrl(baseUrl, '/');
    if (homeUrl) {
      seenUrls.add(homeUrl);
      pages.push({
        path: '/',
        name: 'Home',
        url: homeUrl
      });
    }

    for (const link of rawLinks) {
      // Skip excluded patterns
      if (shouldExclude(link.href)) continue;

      // Normalize URL
      const normalized = normalizeUrl(baseUrl, link.href);
      if (!normalized) continue;

      // Skip if already seen
      if (seenUrls.has(normalized)) continue;

      // Check same domain
      if (!isSameDomain(normalized, baseDomain, opts.includeSubdomains)) continue;

      // Extract path
      const urlObj = new URL(normalized);
      const path = urlObj.pathname;

      // Skip homepage (already added)
      if (path === '/') continue;

      // Add to results
      seenUrls.add(normalized);
      pages.push({
        path,
        name: extractPageName(link.text, path),
        url: normalized
      });

      // Check max pages limit
      if (pages.length >= opts.maxPages) break;
    }

    // Sort by path depth (shallow first)
    pages.sort((a, b) => {
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      const depthA = (a.path.match(/\//g) || []).length;
      const depthB = (b.path.match(/\//g) || []).length;
      return depthA - depthB;
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      baseUrl: baseUrlObj.origin,
      baseDomain,
      pages,
      stats: {
        totalLinksFound: rawLinks.length,
        pagesDiscovered: pages.length,
        durationMs: duration
      }
    };
  } catch (error) {
    return {
      success: false,
      baseUrl,
      pages: [{
        path: '/',
        name: 'Home',
        url: normalizeUrl(baseUrl, '/') || baseUrl
      }],
      error: error.message,
      stats: {
        totalLinksFound: 0,
        pagesDiscovered: 1,
        durationMs: Date.now() - startTime
      }
    };
  } finally {
    if (browser) {
      await disconnectBrowser();
    }
  }
}

// CLI support
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('discover-pages.js') ||
  process.argv[1].includes('discover-pages')
);

if (isMainModule) {
  const url = process.argv[2];
  const maxPages = parseInt(process.argv[3]) || 10;

  if (!url) {
    console.error('Usage: node discover-pages.js <url> [maxPages]');
    process.exit(1);
  }

  discoverPages(url, { maxPages })
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error(JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    });
}
