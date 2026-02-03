/**
 * Angular Route Discoverer
 *
 * Extracts routes from Angular applications using:
 * - ng.probe() for component inspection
 * - routerLink attributes in DOM
 * - app-root element analysis
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class AngularDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from an Angular application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      // Method 1: ng.probe() to access Router
      const appRoot = document.querySelector('app-root');
      if (appRoot && window.ng?.probe) {
        try {
          const debugElement = window.ng.probe(appRoot);
          if (debugElement?.injector) {
            // Try to get Router from injector
            // Note: This may not work in production builds
            const injector = debugElement.injector;

            // Look for router in provider tree
            const getAllProviders = (inj) => {
              const providers = [];
              if (inj._records) {
                inj._records.forEach((v, k) => {
                  if (k.toString().includes('Router')) {
                    providers.push(v);
                  }
                });
              }
              return providers;
            };

            const routerProviders = getAllProviders(injector);
            routerProviders.forEach(provider => {
              if (provider?.config) {
                extractAngularRoutes(provider.config, routes);
              }
            });
          }
        } catch (e) {
          // ng.probe may not be available in production
        }
      }

      // Method 2: routerLink attributes (most reliable)
      document.querySelectorAll('[routerLink], [routerlink]').forEach(el => {
        const path = el.getAttribute('routerLink') || el.getAttribute('routerlink');
        if (path) {
          const text = el.textContent?.trim();
          routes.push({
            path: path.startsWith('/') ? path : '/' + path,
            name: text || '',
            source: 'framework'
          });
        }
      });

      // Method 3: [routerLink] with binding syntax
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          // Check if it's inside Angular app
          const isAngularLink = link.closest('app-root') ||
                               link.hasAttribute('routerLinkActive') ||
                               link.classList.contains('active');

          if (isAngularLink || link.closest('nav, header, [role="navigation"]')) {
            const text = link.textContent?.trim();
            if (!routes.some(r => r.path === href)) {
              routes.push({
                path: href,
                name: text || '',
                source: isAngularLink ? 'framework' : 'link-scrape'
              });
            }
          }
        }
      });

      // Method 4: routerLinkActive elements
      document.querySelectorAll('[routerLinkActive], [routerlinkactive]').forEach(el => {
        const link = el.tagName === 'A' ? el : el.querySelector('a');
        if (link) {
          const href = link.getAttribute('href') ||
                      link.getAttribute('routerLink') ||
                      link.getAttribute('routerlink');
          if (href && !routes.some(r => r.path === href)) {
            routes.push({
              path: href.startsWith('/') ? href : '/' + href,
              name: link.textContent?.trim() || '',
              source: 'framework'
            });
          }
        }
      });

      /**
       * Extract routes from Angular Router config
       */
      function extractAngularRoutes(config, output, prefix = '') {
        if (!Array.isArray(config)) return;

        config.forEach(route => {
          if (!route.path && route.path !== '') return;

          let path = route.path;
          if (prefix && !path.startsWith('/')) {
            path = prefix + '/' + path;
          }
          if (!path.startsWith('/')) {
            path = '/' + path;
          }

          // Skip wildcard and redirect-only routes
          if (path === '/**' || path === '**' || (!route.component && route.redirectTo)) {
            return;
          }

          output.push({
            path,
            name: route.data?.title || route.title || '',
            component: route.component?.name || '',
            source: 'framework'
          });

          // Process child routes
          if (route.children) {
            extractAngularRoutes(route.children, output, path);
          }
        });
      }

      return routes;
    });

    const processedRoutes = rawRoutes.map(route => ({
      ...route,
      name: route.name || this.extractPageName(route.path, route.component),
      path: this.normalizeRoute(route.path)
    }));

    return this.deduplicateRoutes(processedRoutes);
  }
}

export default AngularDiscoverer;
