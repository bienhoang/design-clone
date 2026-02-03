/**
 * Svelte/SvelteKit Route Discoverer
 *
 * Extracts routes from SvelteKit applications using:
 * - SvelteKit internal routing state
 * - data-sveltekit-* attributes
 * - Standard link scraping for static Svelte apps
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class SvelteDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from a Svelte/SvelteKit application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      // Method 1: SvelteKit internal state
      if (window.__sveltekit_routes__) {
        // This global may exist in dev mode
        Object.keys(window.__sveltekit_routes__).forEach(path => {
          routes.push({
            path,
            source: 'framework'
          });
        });
      }

      // Method 2: __sveltekit object
      if (window.__sveltekit?.navigation) {
        // May contain navigation state
      }

      // Method 3: data-sveltekit-preload-data links (SvelteKit's prefetching)
      document.querySelectorAll('a[data-sveltekit-preload-data]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          routes.push({
            path: href,
            name: link.textContent?.trim() || '',
            source: 'framework'
          });
        }
      });

      // Method 4: data-sveltekit-reload links
      document.querySelectorAll('a[data-sveltekit-reload]').forEach(link => {
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

      // Method 5: data-sveltekit-noscroll links
      document.querySelectorAll('a[data-sveltekit-noscroll]').forEach(link => {
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

      // Method 6: Standard navigation links (for all Svelte apps)
      document.querySelectorAll('nav a, header a, [role="navigation"] a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          // Check if it's a SvelteKit link
          const isSvelteKitLink = link.hasAttribute('data-sveltekit-preload-data') ||
                                 link.hasAttribute('data-sveltekit-reload') ||
                                 link.hasAttribute('data-sveltekit-noscroll');

          if (!routes.some(r => r.path === href)) {
            routes.push({
              path: href,
              name: link.textContent?.trim() || '',
              source: isSvelteKitLink ? 'framework' : 'link-scrape'
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
}

export default SvelteDiscoverer;
