/**
 * Base Discoverer - Abstract base class for route discoverers
 *
 * Provides common utilities for route normalization, deduplication,
 * and page name extraction. Framework-specific discoverers extend this.
 *
 * Usage:
 *   class NextDiscoverer extends BaseDiscoverer {
 *     async discover() { ... }
 *   }
 */

import {
  normalizeRoute,
  isDynamicRoute,
  titleCase,
  extractPageName,
  deduplicateRoutes
} from './base-discoverer-utils.js';

/**
 * @typedef {Object} DiscoveredRoute
 * @property {string} path - Route path (e.g., '/about', '/blog/[slug]')
 * @property {string} name - Human-readable name
 * @property {string} url - Full URL
 * @property {boolean} dynamic - True if contains dynamic segments
 * @property {string} [component] - Component name if available
 * @property {string} source - Discovery source ('framework'|'link-scrape'|'interception')
 */

/**
 * Abstract base class for route discoverers
 */
export class BaseDiscoverer {
  /**
   * @param {import('playwright').Page} page - Playwright page object
   * @param {string} baseUrl - Base URL of the site
   */
  constructor(page, baseUrl) {
    this.page = page;
    this.baseUrl = baseUrl;
    this.baseOrigin = new URL(baseUrl).origin;
  }

  /**
   * Discover routes - must be implemented by subclasses
   * @returns {Promise<DiscoveredRoute[]>}
   */
  async discover() {
    throw new Error('discover() must be implemented by subclass');
  }

  /**
   * Normalize a route path (delegates to utility)
   * @param {string} path
   * @returns {string}
   */
  normalizeRoute(path) {
    return normalizeRoute(path);
  }

  /**
   * Check if a path contains dynamic segments (delegates to utility)
   * @param {string} path
   * @returns {boolean}
   */
  isDynamicRoute(path) {
    return isDynamicRoute(path);
  }

  /**
   * Extract a human-readable page name from a path (delegates to utility)
   * @param {string} path
   * @param {string} [componentName]
   * @returns {string}
   */
  extractPageName(path, componentName) {
    return extractPageName(path, componentName);
  }

  /**
   * Convert string to Title Case (delegates to utility)
   * @param {string} str
   * @returns {string}
   */
  titleCase(str) {
    return titleCase(str);
  }

  /**
   * Deduplicate routes by path, preferring higher-priority sources
   * @param {DiscoveredRoute[]} routes
   * @returns {DiscoveredRoute[]}
   */
  deduplicateRoutes(routes) {
    return deduplicateRoutes(routes, this.baseOrigin);
  }

  /**
   * Build full URL from path
   * @param {string} path
   * @returns {string}
   */
  buildFullUrl(path) {
    return `${this.baseOrigin}${normalizeRoute(path)}`;
  }

  /**
   * Scrape link elements from navigation areas
   * Common utility for all discoverers as fallback
   * @param {string[]} [selectors]
   * @returns {Promise<DiscoveredRoute[]>}
   */
  async scrapeLinkElements(selectors = ['nav a', 'header a', '[role="navigation"] a']) {
    const selectorString = selectors.join(', ');
    const baseOrigin = this.baseOrigin;

    const routes = await this.page.evaluate(({ sel, origin }) => {
      const links = [];
      const elements = document.querySelectorAll(sel);

      elements.forEach(el => {
        const href = el.getAttribute('href');
        if (!href) return;

        if (href.startsWith('mailto:') || href.startsWith('tel:') ||
            href.startsWith('javascript:') || href === '#') return;

        try {
          const url = new URL(href, origin);
          if (url.origin !== origin) return;

          links.push({
            path: url.pathname,
            name: el.textContent?.trim() || '',
            source: 'link-scrape'
          });
        } catch {
          // Invalid URL, skip
        }
      });

      return links;
    }, { sel: selectorString, origin: baseOrigin });

    return routes.map(r => ({
      ...r,
      name: r.name || this.extractPageName(r.path)
    }));
  }
}

export default BaseDiscoverer;
