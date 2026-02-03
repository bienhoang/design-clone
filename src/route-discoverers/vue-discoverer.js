/**
 * Vue Route Discoverer
 *
 * Extracts routes from Vue 2 and Vue 3 applications using:
 * - Vue 3: app.__vue_app__.$router
 * - Vue 2: window.Vue.prototype.$router
 * - Fallback: data-v-* attributes and router-link elements
 */

import { BaseDiscoverer } from './base-discoverer.js';

export class VueDiscoverer extends BaseDiscoverer {
  /**
   * Discover routes from a Vue application
   * @returns {Promise<import('./base-discoverer.js').DiscoveredRoute[]>}
   */
  async discover() {
    const rawRoutes = await this.page.evaluate(() => {
      const routes = [];

      /**
       * Recursively extract routes from Vue Router config
       */
      function extractRoutes(routeList, prefix = '') {
        if (!Array.isArray(routeList)) return;

        routeList.forEach(r => {
          if (!r.path && r.path !== '') return;

          let path = r.path;
          if (!path.startsWith('/') && prefix) {
            path = prefix + (prefix.endsWith('/') ? '' : '/') + path;
          } else if (!path.startsWith('/') && path !== '') {
            path = '/' + path;
          }

          // Handle root path
          if (path === '') path = '/';

          routes.push({
            path,
            name: r.name || '',
            component: r.component?.name || r.name || '',
            source: 'framework'
          });

          if (r.children) {
            extractRoutes(r.children, path);
          }
        });
      }

      // Method 1: Vue 3 - __vue_app__ on root element
      const appElements = document.querySelectorAll('[data-v-app], #app, #__nuxt');
      for (const el of appElements) {
        const vueApp = el.__vue_app__;
        if (vueApp?.config?.globalProperties?.$router?.options?.routes) {
          extractRoutes(vueApp.config.globalProperties.$router.options.routes);
          break;
        }
      }

      // Method 2: Vue 2 - window.Vue.prototype.$router
      if (routes.length === 0 && window.Vue?.prototype?.$router?.options?.routes) {
        extractRoutes(window.Vue.prototype.$router.options.routes);
      }

      // Method 3: __VUE_ROUTER__ global (some configurations)
      if (routes.length === 0 && window.__VUE_ROUTER__?.options?.routes) {
        extractRoutes(window.__VUE_ROUTER__.options.routes);
      }

      // Method 4: router-link elements
      document.querySelectorAll('router-link, a[href]').forEach(link => {
        let href = link.getAttribute('to') || link.getAttribute('href');
        if (href && href.startsWith('/')) {
          const text = link.textContent?.trim();
          const isVueComponent = link.tagName.toLowerCase() === 'router-link' ||
                                link.closest('[data-v-]');

          if (!routes.some(r => r.path === href)) {
            routes.push({
              path: href,
              name: text || '',
              source: isVueComponent ? 'framework' : 'link-scrape'
            });
          }
        }
      });

      // Method 5: Links with data-v-* attributes (scoped styles indicate Vue components)
      if (routes.length === 0) {
        document.querySelectorAll('nav a, header a, [role="navigation"] a').forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('/')) {
            routes.push({
              path: href,
              name: link.textContent?.trim() || '',
              source: 'link-scrape'
            });
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

export default VueDiscoverer;
