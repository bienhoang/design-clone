/**
 * React Route Discoverer
 *
 * React Router doesn't expose routes globally, so we use:
 * - Link component scraping from DOM
 * - history.pushState interception
 * - Navigation area link extraction
 *
 * This is the most challenging discoverer due to React's lack of global state.
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class ReactDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from a React application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    // First, inject pushState interception
    await this.injectInterception();

    // Get routes from various sources
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      // Method 1: React Router Link components (they render as <a> tags)
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href || !href.startsWith('/')) return;

        // React Router Links typically don't have target="_blank"
        // and are within the app structure
        const isInternalLink = !link.hasAttribute('target') ||
                              link.getAttribute('target') === '_self';

        if (isInternalLink) {
          const isInNav = link.closest('nav, header, [role="navigation"], [class*="nav"], [class*="menu"]');
          const text = link.textContent?.trim();

          // Detect React-specific patterns
          const reactRoot = document.getElementById('root') ||
                           document.querySelector('[data-reactroot]');
          const isInsideReact = reactRoot && reactRoot.contains(link);

          if (isInNav || isInsideReact) {
            routes.push({
              path: href,
              name: text || '',
              source: isInsideReact ? 'framework' : 'link-scrape'
            });
          }
        }
      });

      // Method 2: Check for intercepted routes
      if (window.__DISCOVERED_ROUTES__ && Array.isArray(window.__DISCOVERED_ROUTES__)) {
        window.__DISCOVERED_ROUTES__.forEach(url => {
          try {
            const path = new URL(url, window.location.origin).pathname;
            if (!routes.some(r => r.path === path)) {
              routes.push({
                path,
                source: 'interception'
              });
            }
          } catch {
            // Invalid URL
          }
        });
      }

      // Method 3: Look for NavLink active classes (React Router specific)
      document.querySelectorAll('a.active, a[aria-current="page"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          if (!routes.some(r => r.path === href)) {
            routes.push({
              path: href,
              name: link.textContent?.trim() || '',
              source: 'framework'
            });
          }
        }
      });

      return routes;
    });

    const processedRoutes = rawRoutes.map(route => ({
      ...route,
      name: route.name || this.extractPageName(route.path),
      path: this.normalizeRoute(route.path)
    }));

    return this.deduplicateRoutes(processedRoutes);
  }

  /**
   * Inject history.pushState interception script
   */
  async injectInterception() {
    try {
      await this.page.evaluate(() => {
        if (window.__ROUTE_INTERCEPTION_ACTIVE__) return;

      window.__DISCOVERED_ROUTES__ = [];
      window.__ROUTE_INTERCEPTION_ACTIVE__ = true;

      // Intercept pushState
      const originalPushState = history.pushState.bind(history);
      history.pushState = function(state, title, url) {
        if (url) {
          window.__DISCOVERED_ROUTES__.push(url.toString());
        }
        return originalPushState(state, title, url);
      };

      // Intercept replaceState
      const originalReplaceState = history.replaceState.bind(history);
      history.replaceState = function(state, title, url) {
        if (url) {
          window.__DISCOVERED_ROUTES__.push(url.toString());
        }
        return originalReplaceState(state, title, url);
      };

      // Listen for popstate
      window.addEventListener('popstate', () => {
        window.__DISCOVERED_ROUTES__.push(window.location.pathname);
      });
    });
    } catch {
      // Interception may fail in some browser contexts, continue without it
    }
  }
}

export default ReactDiscoverer;
