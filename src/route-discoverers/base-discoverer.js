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

/**
 * @typedef {Object} DiscoveredRoute
 * @property {string} path - Route path (e.g., '/about', '/blog/[slug]')
 * @property {string} name - Human-readable name
 * @property {string} url - Full URL
 * @property {boolean} dynamic - True if contains dynamic segments
 * @property {string} [component] - Component name if available
 * @property {string} source - Discovery source ('framework'|'link-scrape'|'interception')
 */

// Dynamic segment patterns
const DYNAMIC_PATTERNS = [
  /\[[\w-]+\]/,     // Next.js [slug]
  /\[\.\.\.([\w-]+)\]/, // Next.js catch-all [...slug]
  /:[\w-]+/,        // Vue/React :id
  /\{[\w-]+\}/,     // Angular {id}
  /\*[\w-]*/        // Wildcard
];

/**
 * Abstract base class for route discoverers
 */
export class BaseDiscoverer {
  /**
   * @param {import('puppeteer').Page} page - Puppeteer page object
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
   * Normalize a route path
   * - Removes trailing slashes (except for root)
   * - Removes query params and hash
   * - Ensures leading slash
   * @param {string} path - Route path to normalize
   * @returns {string} Normalized path
   */
  normalizeRoute(path) {
    if (!path || typeof path !== 'string') return '/';

    // Handle full URLs
    if (path.startsWith('http')) {
      try {
        path = new URL(path).pathname;
      } catch {
        return '/';
      }
    }

    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    // Remove query params and hash
    path = path.split('?')[0].split('#')[0];

    // Remove trailing slash (except for root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    return path;
  }

  /**
   * Check if a path contains dynamic segments
   * @param {string} path - Route path
   * @returns {boolean}
   */
  isDynamicRoute(path) {
    return DYNAMIC_PATTERNS.some(pattern => pattern.test(path));
  }

  /**
   * Extract a human-readable page name from a path
   * @param {string} path - Route path
   * @param {string} [componentName] - Optional component name
   * @returns {string}
   */
  extractPageName(path, componentName) {
    // Use component name if available
    if (componentName && componentName !== 'default' && componentName !== 'index') {
      // Convert camelCase/PascalCase to Title Case
      return componentName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
    }

    // Extract from path
    const normalized = this.normalizeRoute(path);

    if (normalized === '/') return 'Home';

    // Get last segment
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) return 'Home';

    let lastSegment = segments[segments.length - 1];

    // Handle dynamic segments
    if (this.isDynamicRoute(lastSegment)) {
      lastSegment = lastSegment.replace(/[\[\]:{}*\.]/g, '');
      return `${this.titleCase(lastSegment)} (Dynamic)`;
    }

    // Convert kebab-case/snake_case to Title Case
    return this.titleCase(lastSegment);
  }

  /**
   * Convert string to Title Case
   * @param {string} str - Input string
   * @returns {string}
   */
  titleCase(str) {
    return str
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Deduplicate routes by path, preferring 'framework' source over others
   * @param {DiscoveredRoute[]} routes - Array of routes
   * @returns {DiscoveredRoute[]} Deduplicated routes
   */
  deduplicateRoutes(routes) {
    const seen = new Map();

    // Source priority: framework > interception > sitemap > link-scrape
    const sourcePriority = {
      'framework': 4,
      'interception': 3,
      'sitemap': 2,
      'link-scrape': 1
    };

    for (const route of routes) {
      const normalized = this.normalizeRoute(route.path);
      const existing = seen.get(normalized);

      const currentPriority = sourcePriority[route.source] || 0;
      const existingPriority = existing ? (sourcePriority[existing.source] || 0) : -1;

      // Replace if higher priority or if same priority but has a name while existing doesn't
      if (!existing || currentPriority > existingPriority ||
          (currentPriority === existingPriority && route.name && !existing.name)) {
        seen.set(normalized, {
          ...route,
          path: normalized,
          url: this.buildFullUrl(normalized),
          dynamic: this.isDynamicRoute(normalized)
        });
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Build full URL from path
   * @param {string} path - Route path
   * @returns {string}
   */
  buildFullUrl(path) {
    const normalized = this.normalizeRoute(path);
    return `${this.baseOrigin}${normalized}`;
  }

  /**
   * Scrape link elements from navigation areas
   * Common utility for all discoverers as fallback
   * @param {string[]} [selectors] - CSS selectors to search
   * @returns {Promise<DiscoveredRoute[]>}
   */
  async scrapeLinkElements(selectors = ['nav a', 'header a', '[role="navigation"] a']) {
    const selectorString = selectors.join(', ');
    const baseOrigin = this.baseOrigin;

    const routes = await this.page.evaluate((sel, origin) => {
      const links = [];
      const elements = document.querySelectorAll(sel);

      elements.forEach(el => {
        const href = el.getAttribute('href');
        if (!href) return;

        // Skip non-http links
        if (href.startsWith('mailto:') || href.startsWith('tel:') ||
            href.startsWith('javascript:') || href === '#') return;

        // Skip external links
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
    }, selectorString, baseOrigin);

    return routes.map(r => ({
      ...r,
      name: r.name || this.extractPageName(r.path)
    }));
  }
}

export default BaseDiscoverer;
