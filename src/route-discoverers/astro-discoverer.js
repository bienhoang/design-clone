/**
 * Astro Route Discoverer
 *
 * Astro is primarily a static site generator with islands architecture.
 * Routes are extracted from:
 * - astro-island components
 * - data-astro-* prefetch attributes
 * - Standard navigation links (Astro generates static HTML)
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class AstroDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from an Astro application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      // Method 1: astro-island components (indicate interactive pages)
      document.querySelectorAll('astro-island').forEach(island => {
        // Islands don't directly indicate routes, but their presence
        // confirms we're on an Astro site. Look for nearby links.
        const nearbyLinks = island.querySelectorAll('a[href]');
        nearbyLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('/')) {
            routes.push({
              path: href,
              name: link.textContent?.trim() || '',
              source: 'framework'
            });
          }
        });
      });

      // Method 2: data-astro-prefetch links (Astro's View Transitions)
      document.querySelectorAll('a[data-astro-prefetch]').forEach(link => {
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

      // Method 3: Links with data-astro-cid-* (component IDs)
      document.querySelectorAll('a[href]').forEach(link => {
        // Check if link has Astro component ID attribute
        const hasAstroAttr = Array.from(link.attributes).some(
          attr => attr.name.startsWith('data-astro-cid-')
        );

        if (hasAstroAttr) {
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
        }
      });

      // Method 4: Standard navigation (Astro generates static HTML)
      document.querySelectorAll('nav a, header a, [role="navigation"] a, footer a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          // Check if inside Astro component
          const isAstroLink = link.closest('astro-island') ||
                             Array.from(link.attributes).some(
                               attr => attr.name.startsWith('data-astro-')
                             );

          if (!routes.some(r => r.path === href)) {
            routes.push({
              path: href,
              name: link.textContent?.trim() || '',
              source: isAstroLink ? 'framework' : 'link-scrape'
            });
          }
        }
      });

      // Method 5: Look for Astro's client:* directives in islands
      document.querySelectorAll('[client\\:load], [client\\:idle], [client\\:visible]').forEach(el => {
        // These indicate interactive components
        const links = el.querySelectorAll('a[href^="/"]');
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href && !routes.some(r => r.path === href)) {
            routes.push({
              path: href,
              name: link.textContent?.trim() || '',
              source: 'framework'
            });
          }
        });
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

export default AstroDiscoverer;
