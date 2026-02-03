/**
 * App State Snapshot Module
 *
 * Captures application state from SPAs including:
 * - Framework data (__NEXT_DATA__, __NUXT__)
 * - State management stores (Redux, Vuex, Pinia, Zustand)
 *
 * Features:
 * - Sensitive data filtering (tokens, passwords, secrets)
 * - Safe serialization (handles circular refs, functions, symbols)
 * - Size limit enforcement (1MB max)
 *
 * @module app-state-snapshot
 */

// ============================================================================
// Constants
// ============================================================================

/** Maximum state size in bytes (1MB) */
const MAX_STATE_SIZE = 1024 * 1024;

/** Maximum depth for recursive object traversal */
const MAX_TRAVERSAL_DEPTH = 50;

/** Patterns to identify sensitive keys */
const SENSITIVE_PATTERNS = [
  /token/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /auth/i,
  /api[_-]?key/i,
  /credential/i,
  /private/i,
  /session/i,
  /cookie/i,
  /bearer/i,
  /jwt/i,
  /access[_-]?key/i,
  /refresh[_-]?token/i
];

/** Marker for filtered sensitive values */
const FILTERED_MARKER = '[FILTERED]';

/** Marker for circular references */
const CIRCULAR_MARKER = '[Circular]';

/** Marker for unserializable values */
const UNSERIALIZABLE_MARKER = '[Unserializable]';

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} StateSnapshot
 * @property {Object|null} frameworkData - __NEXT_DATA__, __NUXT__, etc.
 * @property {Object|null} storeState - Redux/Vuex/Pinia/Zustand state
 * @property {string|null} framework - Detected framework name
 * @property {string} storeType - 'redux'|'vuex'|'pinia'|'zustand'|'none'
 * @property {string[]} warnings - Serialization/filtering warnings
 * @property {number} capturedAt - Unix timestamp
 * @property {number} sizeBytes - Serialized size in bytes
 */

/**
 * @typedef {Object} StoreResult
 * @property {string} type - Store type identifier
 * @property {Object|null} state - Captured state object
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a key matches sensitive patterns
 * @param {string} key - Object key to check
 * @returns {boolean}
 */
function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Filter sensitive keys from an object recursively
 * @param {*} obj - Object to filter
 * @param {string[]} warnings - Array to collect warnings
 * @param {string} path - Current path for warning messages
 * @param {number} depth - Current recursion depth
 * @returns {*} Filtered object
 */
function filterSensitive(obj, warnings = [], path = '', depth = 0) {
  // Prevent infinite recursion
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return '[Max Depth Exceeded]';
  }

  // Handle primitives
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, i) =>
      filterSensitive(item, warnings, `${path}[${i}]`, depth + 1)
    );
  }

  // Handle objects
  const filtered = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;

    // Check if key is sensitive
    if (isSensitiveKey(key)) {
      warnings.push(`Filtered sensitive key: ${fullPath}`);
      filtered[key] = FILTERED_MARKER;
      continue;
    }

    // Recursively filter nested objects
    filtered[key] = filterSensitive(value, warnings, fullPath, depth + 1);
  }

  return filtered;
}

/**
 * Safely serialize an object handling circular refs, functions, symbols
 * @param {*} obj - Object to serialize
 * @param {WeakSet} seen - Set of seen objects for circular detection
 * @param {number} depth - Current recursion depth
 * @returns {*} Serializable version of object
 */
function safeSerialize(obj, seen = new WeakSet(), depth = 0) {
  // Prevent infinite recursion
  if (depth > MAX_TRAVERSAL_DEPTH) {
    return '[Max Depth Exceeded]';
  }

  // Handle primitives
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'string') {
    return obj;
  }

  // Handle special types
  if (typeof obj === 'function') return '[Function]';
  if (typeof obj === 'symbol') return obj.toString();
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof RegExp) return obj.toString();
  if (obj instanceof Error) return { message: obj.message, name: obj.name };
  if (obj instanceof Map) return Object.fromEntries(obj);
  if (obj instanceof Set) return Array.from(obj);

  // Handle objects
  if (typeof obj === 'object') {
    // Circular reference check
    if (seen.has(obj)) return CIRCULAR_MARKER;
    seen.add(obj);

    try {
      if (Array.isArray(obj)) {
        return obj.map(item => safeSerialize(item, seen, depth + 1));
      }

      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        try {
          result[key] = safeSerialize(value, seen, depth + 1);
        } catch {
          result[key] = UNSERIALIZABLE_MARKER;
        }
      }
      return result;
    } catch {
      return UNSERIALIZABLE_MARKER;
    }
  }

  return obj;
}

/**
 * Enforce state size limit
 * @param {StateSnapshot} snapshot - State snapshot to check
 * @param {string[]} warnings - Array to collect warnings
 * @returns {StateSnapshot} Possibly truncated snapshot
 */
function enforceStateLimit(snapshot, warnings) {
  const serialized = JSON.stringify(snapshot);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  if (sizeBytes > MAX_STATE_SIZE) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    warnings.push(`State exceeded 1MB limit (${sizeMB}MB), store state truncated`);

    return {
      ...snapshot,
      storeState: {
        _truncated: true,
        _reason: `exceeded 1MB limit (${sizeMB}MB)`,
        _originalType: snapshot.storeType
      },
      sizeBytes: MAX_STATE_SIZE
    };
  }

  return { ...snapshot, sizeBytes };
}

// ============================================================================
// Framework Data Capture
// ============================================================================

/**
 * Capture framework-specific data from page
 * @param {import('playwright').Page} page - Playwright page
 * @param {string|null} framework - Detected framework name
 * @returns {Promise<Object|null>}
 */
async function captureFrameworkData(page, framework) {
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

        case 'vue':
          // Vue 3 app data
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

        case 'react':
          // React doesn't have standard framework data
          // Return basic hydration info if available
          const reactRoot = document.getElementById('root') ||
                           document.querySelector('[data-reactroot]');
          return reactRoot ? {
            hasReactRoot: true,
            rootId: reactRoot.id || null
          } : null;

        case 'angular':
          // Angular app state
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

        case 'svelte':
          // SvelteKit data
          if (window.__sveltekit_data__) {
            return window.__sveltekit_data__;
          }
          return null;

        case 'astro':
          // Astro islands info
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

        default:
          return null;
      }
    }, framework);
  } catch {
    return null;
  }
}

// ============================================================================
// Store State Capture
// ============================================================================

/**
 * Capture state management store state
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<StoreResult>}
 */
async function captureStoreState(page) {
  try {
    return await page.evaluate(() => {
      // Redux - check multiple detection methods
      // Method 1: Redux DevTools extension
      if (window.__REDUX_DEVTOOLS_EXTENSION__) {
        try {
          // Access store through devtools
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

      // Method 2: Direct store on window
      if (window.store?.getState) {
        return { type: 'redux', state: window.store.getState() };
      }

      // Method 3: __REDUX_STATE__ hydration
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

      // Check Vue app for Vuex
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

      // Zustand - check common patterns
      // Zustand stores are typically named exports, check window for common names
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

      // MobX - check for observable state
      if (window.__MOBX_STATE__) {
        return { type: 'mobx', state: window.__MOBX_STATE__ };
      }

      // No store found
      return { type: 'none', state: null };
    });
  } catch {
    return { type: 'none', state: null };
  }
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Capture application state from page
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object|null} [frameworkInfo] - Framework detection result
 * @returns {Promise<StateSnapshot>}
 */
export async function captureAppState(page, frameworkInfo = null) {
  const warnings = [];
  const framework = frameworkInfo?.framework || null;

  // Initialize snapshot
  let snapshot = {
    frameworkData: null,
    storeState: null,
    framework,
    storeType: 'none',
    warnings,
    capturedAt: Date.now(),
    sizeBytes: 0
  };

  try {
    // Capture framework-specific data
    const rawFrameworkData = await captureFrameworkData(page, framework);
    if (rawFrameworkData) {
      const serialized = safeSerialize(rawFrameworkData);
      snapshot.frameworkData = filterSensitive(serialized, warnings);
    }

    // Capture store state
    const storeResult = await captureStoreState(page);
    if (storeResult.state) {
      const serialized = safeSerialize(storeResult.state);
      snapshot.storeState = filterSensitive(serialized, warnings);
      snapshot.storeType = storeResult.type;
    }

    // Enforce size limit
    snapshot = enforceStateLimit(snapshot, warnings);

  } catch (error) {
    warnings.push(`State capture error: ${error.message}`);
  }

  return snapshot;
}

/**
 * Format state snapshot for logging
 * @param {StateSnapshot} snapshot - Captured state
 * @returns {string}
 */
export function formatStateSnapshot(snapshot) {
  const lines = [
    '\n=== App State Snapshot ===',
    `Framework: ${snapshot.framework || 'unknown'}`,
    `Store Type: ${snapshot.storeType}`,
    `Framework Data: ${snapshot.frameworkData ? 'captured' : 'none'}`,
    `Store State: ${snapshot.storeState ? 'captured' : 'none'}`,
    `Size: ${(snapshot.sizeBytes / 1024).toFixed(2)} KB`
  ];

  if (snapshot.warnings.length > 0) {
    lines.push(`Warnings (${snapshot.warnings.length}):`);
    snapshot.warnings.slice(0, 5).forEach(w => lines.push(`  - ${w}`));
    if (snapshot.warnings.length > 5) {
      lines.push(`  ... and ${snapshot.warnings.length - 5} more`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Exports for Testing
// ============================================================================

export {
  filterSensitive,
  safeSerialize,
  enforceStateLimit,
  isSensitiveKey,
  captureFrameworkData,
  captureStoreState,
  SENSITIVE_PATTERNS,
  MAX_STATE_SIZE,
  FILTERED_MARKER,
  CIRCULAR_MARKER
};
