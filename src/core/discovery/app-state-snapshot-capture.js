/**
 * Browser-side state capture for SPA app state snapshots.
 *
 * Runs page.evaluate calls to capture framework-specific data
 * (__NEXT_DATA__, __NUXT__, etc.) and state management store state
 * (Redux, Vuex, Pinia, Zustand, MobX). Used by app-state-snapshot.js.
 */

/**
 * Capture framework-specific data from page
 * @param {import('playwright').Page} page - Playwright page
 * @param {string|null} framework - Detected framework name
 * @returns {Promise<Object|null>}
 */
export async function captureFrameworkData(page, framework) {
  try {
    return await page.evaluate((fw) => {
      switch (fw) {
        case 'next':
          if (!window.__NEXT_DATA__) return null;
          return {
            props: window.__NEXT_DATA__.props,
            page: window.__NEXT_DATA__.page,
            query: window.__NEXT_DATA__.query,
            buildId: window.__NEXT_DATA__.buildId,
            runtimeConfig: window.__NEXT_DATA__.runtimeConfig,
            dynamicIds: window.__NEXT_DATA__.dynamicIds
          };

        case 'nuxt':
          if (!window.__NUXT__) return null;
          return {
            data: window.__NUXT__.data,
            state: window.__NUXT__.state,
            serverRendered: window.__NUXT__.serverRendered,
            routePath: window.__NUXT__.routePath,
            config: window.__NUXT__.config
          };

        case 'vue': {
          const vueApp = document.querySelector('[data-v-app]')?.__vue_app__;
          if (vueApp?.config?.globalProperties) {
            return {
              routePath: window.location.pathname,
              hasRouter: !!vueApp.config.globalProperties.$router,
              hasStore: !!vueApp.config.globalProperties.$store ||
                        !!vueApp.config.globalProperties.$pinia
            };
          }
          return null;
        }

        case 'react': {
          const reactRoot = document.getElementById('root') ||
                           document.querySelector('[data-reactroot]');
          return reactRoot ? {
            hasReactRoot: true,
            rootId: reactRoot.id || null
          } : null;
        }

        case 'angular': {
          const appRoot = document.querySelector('app-root');
          if (appRoot && window.ng?.probe) {
            try {
              const component = window.ng.probe(appRoot);
              return {
                componentName: component?.componentInstance?.constructor?.name,
                hasRouter: !!component?.injector?.get?.('Router', null)
              };
            } catch {
              return { hasAppRoot: true };
            }
          }
          return appRoot ? { hasAppRoot: true } : null;
        }

        case 'svelte':
          if (window.__sveltekit_data__) {
            return window.__sveltekit_data__;
          }
          return null;

        case 'astro': {
          const islands = document.querySelectorAll('astro-island');
          if (islands.length > 0) {
            return {
              islandCount: islands.length,
              componentNames: Array.from(islands)
                .map(i => i.getAttribute('component-export'))
                .filter(Boolean)
            };
          }
          return null;
        }

        default:
          return null;
      }
    }, framework);
  } catch {
    return null;
  }
}

/**
 * Capture state management store state (Redux, Vuex, Pinia, Zustand, MobX)
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<{type: string, state: Object|null}>}
 */
export async function captureStoreState(page) {
  try {
    return await page.evaluate(() => {
      // Redux - Method 1: Redux DevTools extension
      if (window.__REDUX_DEVTOOLS_EXTENSION__) {
        try {
          const stores = window.__REDUX_DEVTOOLS_EXTENSION__.stores ||
                        window.__REDUX_DEVTOOLS_EXTENSION__.open?.() ||
                        null;
          if (stores && typeof stores === 'object') {
            const storeKeys = Object.keys(stores);
            if (storeKeys.length > 0) {
              const store = stores[storeKeys[0]];
              if (store?.getState) {
                return { type: 'redux', state: store.getState() };
              }
            }
          }
        } catch {
          // Continue to other methods
        }
      }

      // Redux - Method 2: Direct store on window
      if (window.store?.getState) {
        return { type: 'redux', state: window.store.getState() };
      }

      // Redux - Method 3: __REDUX_STATE__ hydration
      if (window.__REDUX_STATE__) {
        return { type: 'redux', state: window.__REDUX_STATE__ };
      }

      // Vuex - Nuxt 2 / Vue 2/3
      if (window.$nuxt?.$store?.state) {
        return { type: 'vuex', state: window.$nuxt.$store.state };
      }
      if (window.__VUEX__?.state) {
        return { type: 'vuex', state: window.__VUEX__.state };
      }

      // Vuex via Vue app
      const vueApp = document.querySelector('[data-v-app]')?.__vue_app__;
      if (vueApp?.config?.globalProperties?.$store?.state) {
        return { type: 'vuex', state: vueApp.config.globalProperties.$store.state };
      }

      // Pinia - Nuxt 3 / Vue 3
      if (window.$nuxt?.$pinia?.state?.value) {
        return { type: 'pinia', state: window.$nuxt.$pinia.state.value };
      }
      if (window.__PINIA__?.state?.value) {
        return { type: 'pinia', state: window.__PINIA__.state.value };
      }
      if (vueApp?.config?.globalProperties?.$pinia?.state?.value) {
        return { type: 'pinia', state: vueApp.config.globalProperties.$pinia.state.value };
      }

      // Zustand - check common window-exposed store names
      const zustandPatterns = ['useStore', 'useAppStore', 'useBearStore', 'store'];
      for (const pattern of zustandPatterns) {
        const potentialStore = window[pattern];
        if (potentialStore?.getState && typeof potentialStore.getState === 'function') {
          try {
            const state = potentialStore.getState();
            if (state && typeof state === 'object') {
              return { type: 'zustand', state };
            }
          } catch {
            // Not a valid Zustand store
          }
        }
      }

      // MobX
      if (window.__MOBX_STATE__) {
        return { type: 'mobx', state: window.__MOBX_STATE__ };
      }

      return { type: 'none', state: null };
    });
  } catch {
    return { type: 'none', state: null };
  }
}
