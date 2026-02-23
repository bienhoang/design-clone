/**
 * Framework detection signals configuration.
 *
 * Contains the DETECTION_SIGNALS object that maps each supported framework
 * to its detection rules (global objects, DOM selectors, script patterns, meta tags).
 * Each signal has a weight (1-3) used for confidence scoring.
 * Used exclusively by framework-detector.js.
 */

/**
 * Detection signals for each framework.
 * Each signal: { type, path|selector|pattern|name, weight (1-3), signal (label) }
 */
export const DETECTION_SIGNALS = {
  next: [
    { type: 'global', path: ['__NEXT_DATA__'], weight: 3, signal: '__NEXT_DATA__' },
    { type: 'global', path: ['__NEXT_LOADED_PAGES__'], weight: 2, signal: '__NEXT_LOADED_PAGES__' },
    { type: 'global', path: ['__BUILD_MANIFEST'], weight: 2, signal: '__BUILD_MANIFEST' },
    { type: 'dom', selector: '#__next', weight: 2, signal: '#__next' },
    { type: 'script', pattern: '/_next/', weight: 1, signal: 'script:/_next/' }
  ],
  nuxt: [
    { type: 'global', path: ['__NUXT__'], weight: 3, signal: '__NUXT__' },
    { type: 'global', path: ['$nuxt'], weight: 2, signal: '$nuxt' },
    { type: 'global', path: ['__NUXT_PATHS__'], weight: 2, signal: '__NUXT_PATHS__' },
    { type: 'dom', selector: '#__nuxt', weight: 2, signal: '#__nuxt' },
    { type: 'dom', selector: '#__layout', weight: 1, signal: '#__layout' },
    { type: 'script', pattern: '/_nuxt/', weight: 1, signal: 'script:/_nuxt/' }
  ],
  vue: [
    { type: 'global', path: ['__VUE__'], weight: 3, signal: '__VUE__' },
    { type: 'global', path: ['Vue'], weight: 2, signal: 'Vue' },
    { type: 'global', path: ['__VUE_DEVTOOLS_GLOBAL_HOOK__'], weight: 1, signal: '__VUE_DEVTOOLS_GLOBAL_HOOK__' },
    { type: 'dom', selector: '[data-v-]', weight: 2, signal: 'data-v-*' },
    { type: 'dom', selector: '[data-server-rendered]', weight: 2, signal: 'data-server-rendered' }
  ],
  react: [
    { type: 'global', path: ['__REACT_DEVTOOLS_GLOBAL_HOOK__'], weight: 1, signal: '__REACT_DEVTOOLS_GLOBAL_HOOK__' },
    { type: 'dom', selector: '[data-reactroot]', weight: 3, signal: 'data-reactroot' },
    { type: 'dom', selector: '[data-reactid]', weight: 2, signal: 'data-reactid' },
    { type: 'dom', selector: '#root[data-reactroot], #root > div', weight: 1, signal: '#root' }
  ],
  angular: [
    { type: 'global', path: ['ng'], weight: 2, signal: 'ng' },
    { type: 'global', path: ['getAllAngularRootElements'], weight: 3, signal: 'getAllAngularRootElements' },
    { type: 'dom', selector: '[ng-version]', weight: 3, signal: 'ng-version' },
    { type: 'dom', selector: 'app-root', weight: 2, signal: 'app-root' },
    { type: 'dom', selector: '[_nghost-]', weight: 2, signal: '_nghost-*' },
    { type: 'dom', selector: '[ng-app]', weight: 2, signal: 'ng-app' }
  ],
  svelte: [
    { type: 'global', path: ['__svelte__'], weight: 2, signal: '__svelte__' },
    { type: 'global', path: ['__sveltekit'], weight: 3, signal: '__sveltekit' },
    { type: 'dom', selector: '[data-sveltekit-preload-data]', weight: 3, signal: 'data-sveltekit-preload-data' },
    { type: 'dom', selector: '[data-sveltekit-reload]', weight: 2, signal: 'data-sveltekit-reload' },
    { type: 'script', pattern: '/@svelte/', weight: 1, signal: 'script:/@svelte/' }
  ],
  astro: [
    { type: 'dom', selector: 'astro-island', weight: 3, signal: 'astro-island' },
    { type: 'dom', selector: '[data-astro-cid-]', weight: 2, signal: 'data-astro-cid-*' },
    { type: 'dom', selector: '[data-astro-source-file]', weight: 2, signal: 'data-astro-source-file' },
    { type: 'meta', name: 'generator', pattern: 'Astro', weight: 3, signal: 'meta:generator:Astro' },
    { type: 'script', pattern: '/@astrojs/', weight: 1, signal: 'script:/@astrojs/' }
  ]
};
