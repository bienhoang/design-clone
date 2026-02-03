/**
 * Nuxt Route Discoverer
 *
 * Extracts routes from Nuxt 2 and Nuxt 3 applications using:
 * - window.__NUXT__ (Nuxt 2/3 state)
 * - window.$nuxt.$router (Vue Router instance)
 * - window.__NUXT_PATHS__ (Nuxt 3 prerendered paths)
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class NuxtDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from a Nuxt application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      /**
       * Recursively extract routes from Vue Router config
       * @param {Array} routeList - Array of route objects
       * @param {string} prefix - Path prefix for nested routes
       */
      function extractRoutes(routeList, prefix = '') {
        if (!Array.isArray(routeList)) return;

        routeList.forEach(r => {
          if (!r.path) return;

          // Build full path
          let path = r.path;
          if (!path.startsWith('/') && prefix) {
            path = prefix + (prefix.endsWith('/') ? '' : '/') + path;
          } else if (!path.startsWith('/')) {
            path = '/' + path;
          }

          // Skip internal routes
          if (path.startsWith('/_') || path.startsWith('/:')) {
            // But process children
            if (r.children) extractRoutes(r.children, path);
            return;
          }

          routes.push({
            path,
            name: r.name || '',
            component: r.name || r.component?.name || '',
            source: 'framework'
          });

          // Process nested routes
          if (r.children) {
            extractRoutes(r.children, path);
          }
        });
      }

      // Method 1: __NUXT__ state (both Nuxt 2 and 3)
      if (window.__NUXT__) {
        const nuxt = window.__NUXT__;

        // Current route path
        if (nuxt.state?.route?.path) {
          routes.push({
            path: nuxt.state.route.path,
            name: nuxt.state.route.name || 'Current Page',
            source: 'framework'
          });
        }

        // Nuxt 3: route from payload
        if (nuxt.data?.path || nuxt.path) {
          routes.push({
            path: nuxt.data?.path || nuxt.path,
            name: 'Current Page',
            source: 'framework'
          });
        }
      }

      // Method 2: $nuxt.$router (Vue Router instance)
      if (window.$nuxt?.$router?.options?.routes) {
        extractRoutes(window.$nuxt.$router.options.routes);
      }

      // Method 3: Nuxt 3 useRouter
      if (window.__NUXT_PATHS__ && Array.isArray(window.__NUXT_PATHS__)) {
        window.__NUXT_PATHS__.forEach(path => {
          if (!routes.some(r => r.path === path)) {
            routes.push({
              path,
              source: 'framework'
            });
          }
        });
      }

      // Method 4: NuxtLink components in DOM
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('/_')) {
          // Check for Nuxt-specific attributes
          const isNuxtLink = link.hasAttribute('data-v-') ||
                            link.closest('[data-v-]') ||
                            link.classList.contains('nuxt-link-active') ||
                            link.classList.contains('nuxt-link-exact-active');

          if (isNuxtLink || link.closest('nav, header, [role="navigation"]')) {
            const text = link.textContent?.trim();
            if (!routes.some(r => r.path === href)) {
              routes.push({
                path: href,
                name: text || '',
                source: isNuxtLink ? 'framework' : 'link-scrape'
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

export default NuxtDiscoverer;
