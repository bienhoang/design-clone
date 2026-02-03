/**
 * Universal Route Discoverer
 *
 * Fallback discoverer for unknown frameworks or static sites.
 * Uses comprehensive techniques:
 * - history.pushState/replaceState interception
 * - Exhaustive link scraping from navigation elements
 * - Sitemap.xml parsing if available
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class UniversalDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes using universal techniques
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    // First, inject history interception
    await this.injectHistoryInterception();

    // Get routes from multiple sources
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];
      const seenPaths = new Set();

      /**
       * Add route if not already seen
       */
      function addRoute(path, name, source) {
        if (!path || seenPaths.has(path)) return;
        if (!path.startsWith('/')) return;

        // Skip common non-page paths
        const skipPatterns = [
          /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i,
          /^\/api\//,
          /^\/_next\//,
          /^\/_nuxt\//,
          /^\/static\//,
          /^\/assets\//,
        ];

        if (skipPatterns.some(pattern => pattern.test(path))) return;

        seenPaths.add(path);
        routes.push({
          path,
          name: name || '',
          source
        });
      }

      // Method 1: History interception results
      if (window.__UNIVERSAL_DISCOVERED_ROUTES__ && Array.isArray(window.__UNIVERSAL_DISCOVERED_ROUTES__)) {
        window.__UNIVERSAL_DISCOVERED_ROUTES__.forEach(url => {
          try {
            const path = new URL(url, window.location.origin).pathname;
            addRoute(path, '', 'interception');
          } catch {
            // Invalid URL, skip
          }
        });
      }

      // Method 2: Navigation elements (high confidence)
      const navSelectors = [
        'nav a[href]',
        'header a[href]',
        '[role="navigation"] a[href]',
        '[class*="nav"] a[href]',
        '[class*="menu"] a[href]',
        '[class*="sidebar"] a[href]',
        'footer a[href]'
      ];

      navSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('/')) {
            addRoute(href, link.textContent?.trim() || '', 'link-scrape');
          }
        });
      });

      // Method 3: All internal links (lower confidence but comprehensive)
      document.querySelectorAll('a[href^="/"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          // Skip if has target="_blank" or download attribute
          if (link.hasAttribute('download')) return;
          if (link.getAttribute('target') === '_blank') return;

          addRoute(href, link.textContent?.trim() || '', 'link-scrape');
        }
      });

      // Method 4: Links in main content area
      const mainSelectors = ['main', '[role="main"]', '#content', '.content', 'article'];
      mainSelectors.forEach(selector => {
        const main = document.querySelector(selector);
        if (main) {
          main.querySelectorAll('a[href^="/"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !link.hasAttribute('download')) {
              addRoute(href, link.textContent?.trim() || '', 'link-scrape');
            }
          });
        }
      });

      return routes;
    });

    // Try to fetch sitemap
    const sitemapRoutes = await this.fetchSitemapRoutes();

    // Combine all routes
    const allRoutes = [...rawRoutes, ...sitemapRoutes];

    const processedRoutes = allRoutes.map(route => ({
      ...route,
      name: route.name || this.extractPageName(route.path),
      path: this.normalizeRoute(route.path)
    }));

    return this.deduplicateRoutes(processedRoutes);
  }

  /**
   * Inject history.pushState/replaceState interception
   */
  async injectHistoryInterception() {
    try {
      await this.page.evaluate(() => {
        if (window.__UNIVERSAL_INTERCEPTION_ACTIVE__) return;

      window.__UNIVERSAL_DISCOVERED_ROUTES__ = [];
      window.__UNIVERSAL_INTERCEPTION_ACTIVE__ = true;

      // Intercept pushState
      const originalPushState = history.pushState.bind(history);
      history.pushState = function(state, title, url) {
        if (url) {
          window.__UNIVERSAL_DISCOVERED_ROUTES__.push(url.toString());
        }
        return originalPushState(state, title, url);
      };

      // Intercept replaceState
      const originalReplaceState = history.replaceState.bind(history);
      history.replaceState = function(state, title, url) {
        if (url) {
          window.__UNIVERSAL_DISCOVERED_ROUTES__.push(url.toString());
        }
        return originalReplaceState(state, title, url);
      };

      // Listen for popstate
      window.addEventListener('popstate', () => {
        window.__UNIVERSAL_DISCOVERED_ROUTES__.push(window.location.pathname);
      });

      // Listen for hashchange (for hash-based routing)
      window.addEventListener('hashchange', () => {
        window.__UNIVERSAL_DISCOVERED_ROUTES__.push(window.location.href);
      });
    });
    } catch {
      // Interception may fail in some browser contexts, continue without it
    }
  }

  /**
   * Try to fetch and parse sitemap.xml
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async fetchSitemapRoutes() {
    const routes = [];

    try {
      const sitemapUrl = new URL('/sitemap.xml', this.baseUrl).href;

      const response = await this.page.evaluate(async (url) => {
        try {
          // Add timeout using AbortController
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!res.ok) return null;
          return await res.text();
        } catch {
          return null;
        }
      }, sitemapUrl);

      if (response) {
        // Parse sitemap XML
        const urlMatches = response.matchAll(/<loc>([^<]+)<\/loc>/gi);
        for (const match of urlMatches) {
          try {
            const url = new URL(match[1]);
            // Only include paths from same origin
            if (url.origin === new URL(this.baseUrl).origin) {
              routes.push({
                path: url.pathname,
                name: '',
                source: 'sitemap'
              });
            }
          } catch {
            // Invalid URL in sitemap
          }
        }
      }
    } catch {
      // Sitemap fetch failed, continue without it
    }

    return routes;
  }
}

export default UniversalDiscoverer;
