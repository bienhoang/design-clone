/**
 * Next.js Route Discoverer
 *
 * Extracts routes from Next.js applications using:
 * - window.__NEXT_DATA__ (always present)
 * - window.__BUILD_MANIFEST (pages router)
 * - window.__NEXT_LOADED_PAGES__ (loaded pages)
 *
 * Supports both Pages Router and App Router.
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class NextDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from a Next.js application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      // Method 1: __NEXT_DATA__ (always present in Next.js)
      if (window.__NEXT_DATA__) {
        const nextData = window.__NEXT_DATA__;

        // Current page
        if (nextData.page) {
          routes.push({
            path: nextData.page,
            name: 'Current Page',
            source: 'framework',
            component: nextData.page
          });
        }

        // Dynamic route info from query
        if (nextData.query && Object.keys(nextData.query).length > 0) {
          // The page path with dynamic segments
        }
      }

      // Method 2: __BUILD_MANIFEST (Pages Router - contains all static routes)
      if (window.__BUILD_MANIFEST && typeof window.__BUILD_MANIFEST === 'object') {
        const manifest = window.__BUILD_MANIFEST;
        const manifestKeys = Object.keys(manifest);
        if (!Array.isArray(manifestKeys)) return routes;

        const pages = manifestKeys.filter(p =>
          !p.startsWith('/_') && // Skip internal pages
          (!p.includes('[') || p === '/') // Include root and static pages (fixed precedence)
        );

        pages.forEach(page => {
          if (!routes.some(r => r.path === page)) {
            routes.push({
              path: page,
              source: 'framework',
              component: page
            });
          }
        });

        // Also get dynamic routes
        const dynamicPages = Object.keys(manifest).filter(p =>
          p.includes('[') && !p.startsWith('/_')
        );

        dynamicPages.forEach(page => {
          if (!routes.some(r => r.path === page)) {
            routes.push({
              path: page,
              source: 'framework',
              component: page,
              dynamic: true
            });
          }
        });
      }

      // Method 3: __NEXT_LOADED_PAGES__ (pages that have been loaded)
      if (window.__NEXT_LOADED_PAGES__ && Array.isArray(window.__NEXT_LOADED_PAGES__)) {
        window.__NEXT_LOADED_PAGES__.forEach(page => {
          if (!routes.some(r => r.path === page) && !page.startsWith('/_')) {
            routes.push({
              path: page,
              source: 'framework',
              component: page
            });
          }
        });
      }

      // Method 4: Next.js Link components in DOM
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('/_')) {
          // Check if it's a Next.js Link by looking for data attributes
          const isNextLink = link.hasAttribute('data-next') ||
                            link.closest('[data-next]') ||
                            link.hasAttribute('data-nscript');

          if (isNextLink || link.closest('nav, header, [role="navigation"]')) {
            const text = link.textContent?.trim();
            if (!routes.some(r => r.path === href)) {
              routes.push({
                path: href,
                name: text || '',
                source: isNextLink ? 'framework' : 'link-scrape'
              });
            }
          }
        }
      });

      return routes;
    });

    // Process and deduplicate
    const processedRoutes = rawRoutes.map(route => ({
      ...route,
      name: route.name || this.extractPageName(route.path, route.component),
      path: this.normalizeRoute(route.path)
    }));

    return this.deduplicateRoutes(processedRoutes);
  }
}

export default NextDiscoverer;
