/**
 * Route merging logic for page discovery.
 *
 * Merges framework-discovered routes (higher quality) with
 * link-scraped pages (fallback), deduplicating by normalized path.
 * Used by discover-pages.js (main orchestrator).
 */

import { normalizeUrl, extractPageName, normalizePath, logWarning } from './discover-pages-utils.js';

/**
 * Merge framework-discovered routes with link-scraped pages.
 * Prioritizes framework routes (higher quality), fills gaps with link-scraped.
 *
 * @param {Array|null} frameworkRoutes - Routes from framework discoverer
 * @param {Array|null} linkScrapedPages - Pages from link scraping
 * @param {string} baseDomain - Base domain for URL normalization
 * @param {string} baseUrl - Base URL for resolving paths
 * @returns {Array} Merged and deduplicated pages
 *
 * @example
 * const merged = mergeRoutes(
 *   [{ path: '/about', name: 'About' }],
 *   [{ path: '/contact', name: 'Contact' }],
 *   'example.com',
 *   'https://example.com'
 * );
 */
export function mergeRoutes(frameworkRoutes, linkScrapedPages, baseDomain, baseUrl) {
  // Input validation
  if (!baseDomain || typeof baseDomain !== 'string') {
    logWarning('mergeRoutes: Invalid baseDomain');
    baseDomain = '';
  }
  if (!baseUrl || typeof baseUrl !== 'string') {
    logWarning('mergeRoutes: Invalid baseUrl');
    baseUrl = '';
  }

  const seenPaths = new Set();
  const merged = [];

  // Add framework routes first (higher quality, more accurate)
  if (Array.isArray(frameworkRoutes)) {
    for (const route of frameworkRoutes) {
      if (!route || typeof route !== 'object') continue;

      const normalizedPath = normalizePath(route.path || '/');
      if (seenPaths.has(normalizedPath)) continue;
      seenPaths.add(normalizedPath);

      const url = normalizeUrl(baseUrl, normalizedPath) || route.url || '';

      merged.push({
        path: normalizedPath,
        name: route.name || extractPageName('', normalizedPath),
        url,
        source: route.source || 'framework',
        dynamic: Boolean(route.dynamic)
      });
    }
  }

  // Add link-scraped pages (fill gaps)
  if (Array.isArray(linkScrapedPages)) {
    for (const page of linkScrapedPages) {
      if (!page || typeof page !== 'object') continue;

      const normalizedPath = normalizePath(page.path || '/');
      if (seenPaths.has(normalizedPath)) continue;
      seenPaths.add(normalizedPath);

      merged.push({
        path: normalizedPath,
        name: page.name || extractPageName('', normalizedPath),
        url: page.url || normalizeUrl(baseUrl, normalizedPath) || '',
        source: 'link-scrape',
        dynamic: false
      });
    }
  }

  return merged;
}
