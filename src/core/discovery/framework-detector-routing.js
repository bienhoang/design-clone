/**
 * Routing type inference for detected JavaScript frameworks.
 *
 * Runs page.evaluate to determine whether a framework is using
 * SPA, SSR, or SSG rendering by inspecting framework-specific
 * global objects and DOM attributes. Used by framework-detector.js.
 */

/**
 * Infer routing type based on framework and detected signals.
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string|null} framework - Detected framework name
 * @returns {Promise<'spa'|'ssr'|'ssg'|'unknown'>}
 */
export async function inferRoutingType(page, framework) {
  if (!framework) return 'unknown';

  return await page.evaluate((fw) => {
    function safeGet(obj, path) {
      let current = obj;
      for (const key of path) {
        if (current === null || current === undefined) return undefined;
        current = current[key];
      }
      return current;
    }

    try {
      switch (fw) {
        case 'next': {
          const nextData = safeGet(window, ['__NEXT_DATA__']);
          if (nextData) {
            if (nextData.nextExport) return 'ssg';
            if (nextData.isFallback === false) return 'ssr';
            if (document.querySelector('[data-nscript]')) return 'ssr';
          }
          return 'ssr';
        }
        case 'nuxt': {
          const nuxtData = safeGet(window, ['__NUXT__']);
          if (nuxtData?.serverRendered === true) return 'ssr';
          if (nuxtData?.serverRendered === false) return 'spa';
          return 'ssr';
        }
        case 'vue':
          if (window.$nuxt) return 'ssr';
          if (document.querySelector('[data-server-rendered="true"]')) return 'ssr';
          return 'spa';
        case 'react':
          if (safeGet(window, ['__NEXT_DATA__'])) return 'ssr';
          if (window.___gatsby) return 'ssg';
          return 'spa';
        case 'angular':
          if (document.querySelector('[ng-server-context]')) return 'ssr';
          return 'spa';
        case 'svelte':
          if (safeGet(window, ['__sveltekit'])) return 'ssr';
          return 'spa';
        case 'astro':
          return 'ssg';
        default:
          return 'unknown';
      }
    } catch (e) {
      return 'unknown';
    }
  }, framework);
}
