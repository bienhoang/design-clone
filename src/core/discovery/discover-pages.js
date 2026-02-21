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
 *   import { discoverPages } from '../discovery/discover-pages.js';
 *   const result = await discoverPages('https://example.com', { maxPages: 10 });
 */

import { getBrowser, getPage, disconnectBrowser } from '../../utils/browser.js';
import { waitForDomStable } from '../page-prep/page-readiness.js';
import { dismissCookieBanner } from '../page-prep/cookie-handler.js';
import { detectFramework } from './framework-detector.js';
import { discoverRoutes as discoverFrameworkRoutes } from '../../route-discoverers/index.js';
import { captureAppState } from './app-state-snapshot.js';
import {
  NAV_SELECTORS, DEFAULT_OPTIONS, logWarning, validateFramework,
  normalizeUrl, isSameDomain, extractPageName, shouldExclude
} from './discover-pages-utils.js';
import { mergeRoutes } from './discover-pages-routes.js';

export { normalizeUrl, isSameDomain, extractPageName } from './discover-pages-utils.js';

/**
 * Scrape navigation links from the loaded page.
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 * @param {string} baseDomain
 * @param {Object} opts
 * @returns {Promise<Array>} linkScrapedPages
 */
async function scrapeNavLinks(page, baseUrl, baseDomain, opts) {
  const selectorString = (opts.selectors || NAV_SELECTORS).join(', ');
  const rawLinks = await page.$$eval(selectorString, els =>
    els.map(el => ({ href: el.href, text: el.textContent?.trim() || '' }))
  ).catch(() => []);

  const seenUrls = new Set();
  const pages = [];

  const homeUrl = normalizeUrl(baseUrl, '/');
  if (homeUrl) { seenUrls.add(homeUrl); pages.push({ path: '/', name: 'Home', url: homeUrl }); }

  for (const link of rawLinks) {
    if (shouldExclude(link.href)) continue;
    const normalized = normalizeUrl(baseUrl, link.href);
    if (!normalized || seenUrls.has(normalized)) continue;
    if (!isSameDomain(normalized, baseDomain, opts.includeSubdomains)) continue;
    const path = new URL(normalized).pathname;
    if (path === '/') continue;
    seenUrls.add(normalized);
    pages.push({ path, name: extractPageName(link.text, path), url: normalized });
    if (pages.length >= opts.maxPages) break;
  }

  return { pages, rawCount: rawLinks.length };
}

/**
 * Discover pages from a website by extracting navigation links.
 * @param {string} baseUrl - Starting URL to discover from
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Discovery result
 */
export async function discoverPages(baseUrl, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let browser = null;

  try {
    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname;

    browser = await getBrowser({ headless: true });
    const page = await getPage(browser);

    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: opts.timeout });
    await page.waitForSelector('nav a, header a, [role="navigation"] a', {
      visible: true, timeout: 5000
    }).catch(() => {});
    await waitForDomStable(page, 500, 5000);
    await dismissCookieBanner(page);
    await new Promise(r => setTimeout(r, 1000));

    // SPA/Framework detection
    let frameworkInfo = null;
    let frameworkRoutes = [];
    let stateSnapshot = null;

    if (!opts.noSpaDetect) {
      if (opts.framework) {
        const fw = validateFramework(opts.framework);
        if (fw) frameworkInfo = { framework: fw, version: null, routingType: 'spa', confidence: 'forced', signals: ['user-specified'] };
      } else {
        try { frameworkInfo = await detectFramework(page); }
        catch (e) { logWarning(`Framework detection failed: ${e.message}`); }
      }

      if (frameworkInfo?.framework && opts.spaMode) {
        try {
          const r = await discoverFrameworkRoutes(page, baseUrl, frameworkInfo);
          frameworkRoutes = r.routes || [];
        } catch (e) { logWarning(`Route discovery failed for ${frameworkInfo.framework}: ${e.message}`); }
      }

      if (opts.captureState && frameworkInfo) {
        try { stateSnapshot = await captureAppState(page, frameworkInfo); }
        catch (e) { logWarning(`State capture failed: ${e.message}`); }
      }
    }

    // Link scraping
    const { pages: linkScrapedPages, rawCount } = await scrapeNavLinks(page, baseUrl, baseDomain, opts);

    // Merge and sort
    let pages = frameworkRoutes.length > 0
      ? mergeRoutes(frameworkRoutes, linkScrapedPages, baseDomain, baseUrl)
      : linkScrapedPages.map(p => ({ ...p, source: 'link-scrape', dynamic: false }));

    if (pages.length > opts.maxPages) pages = pages.slice(0, opts.maxPages);

    pages.sort((a, b) => {
      if (a.path === '/') return -1;
      if (b.path === '/') return 1;
      return (a.path.match(/\//g) || []).length - (b.path.match(/\//g) || []).length;
    });

    return {
      success: true,
      baseUrl: baseUrlObj.origin,
      baseDomain,
      framework: frameworkInfo,
      stateSnapshot,
      pages,
      stats: { totalLinksFound: rawCount, frameworkRoutesFound: frameworkRoutes.length, pagesDiscovered: pages.length, durationMs: Date.now() - startTime }
    };
  } catch (error) {
    let normalizedBaseUrl = baseUrl;
    let errorBaseDomain = '';
    try { const u = new URL(baseUrl); normalizedBaseUrl = u.origin; errorBaseDomain = u.hostname; } catch { /* keep original */ }
    return {
      success: false,
      baseUrl: normalizedBaseUrl,
      baseDomain: errorBaseDomain,
      framework: null,
      stateSnapshot: null,
      pages: [{ path: '/', name: 'Home', url: normalizeUrl(baseUrl, '/') || baseUrl, source: 'fallback', dynamic: false }],
      error: error.message,
      stats: { totalLinksFound: 0, frameworkRoutesFound: 0, pagesDiscovered: 1, durationMs: Date.now() - startTime }
    };
  } finally {
    if (browser) await disconnectBrowser();
  }
}

// CLI support
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const url = process.argv[2];
  const maxPages = parseInt(process.argv[3]) || 10;
  if (!url) { console.error('Usage: node discover-pages.js <url> [maxPages]'); process.exit(1); }
  discoverPages(url, { maxPages })
    .then(result => { console.log(JSON.stringify(result, null, 2)); process.exit(result.success ? 0 : 1); })
    .catch(err => { console.error(JSON.stringify({ success: false, error: err.message })); process.exit(1); });
}
