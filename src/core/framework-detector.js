/**
 * Framework Detector Module
 *
 * Detects JavaScript frameworks used on a page by checking:
 * - Global objects (window.__NEXT_DATA__, etc.)
 * - DOM attributes ([data-reactroot], [ng-version], etc.)
 * - Script URL patterns (/_next/, /_nuxt/, etc.)
 *
 * Returns framework info with confidence scoring.
 *
 * Usage:
 *   import { detectFramework } from './framework-detector.js';
 *   const info = await detectFramework(page);
 *   // { framework: 'next', version: '14.0.0', confidence: 'high', ... }
 */

/**
 * @typedef {Object} FrameworkInfo
 * @property {string|null} framework - 'next'|'nuxt'|'vue'|'react'|'angular'|'svelte'|'astro'|null
 * @property {string|null} version - Framework version if detectable
 * @property {'spa'|'ssr'|'ssg'|'unknown'} routingType - Routing/rendering strategy
 * @property {'high'|'medium'|'low'} confidence - Detection confidence
 * @property {string[]} signals - Matched detection signals
 */

// Confidence thresholds
const CONFIDENCE_HIGH_THRESHOLD = 5;
const CONFIDENCE_MEDIUM_THRESHOLD = 3;

/**
 * Detection signals for each framework
 * Each signal has: type, path/selector/pattern, weight (1-3), signal (label)
 */
const DETECTION_SIGNALS = {
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

/**
 * Calculate confidence level based on total weight
 * @param {number} totalWeight - Sum of matched signal weights
 * @returns {'high'|'medium'|'low'} Confidence level
 */
function calculateConfidence(totalWeight) {
  if (totalWeight >= CONFIDENCE_HIGH_THRESHOLD) return 'high';
  if (totalWeight >= CONFIDENCE_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Safe property access without eval()
 * @param {Object} obj - Object to traverse
 * @param {string[]} path - Property path array
 * @returns {*} Value at path or undefined
 */
function safeGet(obj, path) {
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Check if element has attribute with prefix
 * @param {Element} el - DOM element
 * @param {string} prefix - Attribute prefix
 * @returns {boolean}
 */
function hasAttributeWithPrefix(el, prefix) {
  return Array.from(el.attributes).some(attr => attr.name.startsWith(prefix));
}

/**
 * Detection logic that runs in browser context via page.evaluate()
 * @param {Object} signals - DETECTION_SIGNALS object
 * @returns {Object} Detection results for all frameworks
 */
function browserDetectionLogic(signals) {
  // Helper: safe property access without eval
  function safeGet(obj, path) {
    let current = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }

  // Helper: check if any element has attribute with prefix
  function hasAttrPrefix(prefix) {
    return Array.from(document.querySelectorAll('*')).some(el =>
      Array.from(el.attributes).some(attr => attr.name.startsWith(prefix))
    );
  }

  const results = {};

  for (const [framework, checks] of Object.entries(signals)) {
    let totalWeight = 0;
    const matchedSignals = [];
    let version = null;

    for (const check of checks) {
      let matched = false;

      try {
        switch (check.type) {
          case 'global':
            // Safe property traversal instead of eval()
            matched = safeGet(window, check.path) !== undefined;
            break;

          case 'dom':
            // Handle attribute selectors with partial match
            if (check.selector.includes('[data-v-]')) {
              matched = hasAttrPrefix('data-v-');
            } else if (check.selector.includes('[data-astro-cid-]')) {
              matched = hasAttrPrefix('data-astro-cid-');
            } else if (check.selector.includes('[_nghost-]')) {
              matched = hasAttrPrefix('_nghost-');
            } else {
              matched = !!document.querySelector(check.selector);
            }
            break;

          case 'script':
            // Check if any script src contains pattern
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            matched = scripts.some(s => s.src.includes(check.pattern));
            break;

          case 'meta':
            // Check meta tag content
            const meta = document.querySelector(`meta[name="${check.name}"]`);
            matched = meta && meta.content && meta.content.includes(check.pattern);
            break;
        }
      } catch (e) {
        matched = false;
      }

      if (matched) {
        totalWeight += check.weight;
        matchedSignals.push(check.signal);
      }
    }

    // Extract version based on framework
    if (totalWeight > 0) {
      try {
        switch (framework) {
          case 'next':
            const nextData = safeGet(window, ['__NEXT_DATA__']);
            if (nextData) {
              version = nextData.nextExport ? 'export' : (nextData.buildId || null);
              // Try runtime config version
              if (nextData.runtimeConfig?.version) {
                version = nextData.runtimeConfig.version;
              }
            }
            break;
          case 'nuxt':
            const nuxtConfig = safeGet(window, ['__NUXT__', 'config', 'app', 'buildId']);
            if (nuxtConfig) version = nuxtConfig;
            break;
          case 'vue':
            version = safeGet(window, ['Vue', 'version']) ||
                      safeGet(window, ['__VUE__', 'version']) || null;
            break;
          case 'react':
            version = safeGet(window, ['React', 'version']) || null;
            break;
          case 'angular':
            const ngVersion = document.querySelector('[ng-version]');
            if (ngVersion) version = ngVersion.getAttribute('ng-version');
            break;
          case 'svelte':
            // Svelte doesn't expose version easily
            break;
          case 'astro':
            const astroMeta = document.querySelector('meta[name="generator"]');
            if (astroMeta && astroMeta.content.includes('Astro')) {
              const match = astroMeta.content.match(/Astro v?([\d.]+)/);
              if (match) version = match[1];
            }
            break;
        }
      } catch (e) {
        // Ignore version extraction errors
      }
    }

    results[framework] = {
      weight: totalWeight,
      signals: matchedSignals,
      version
    };
  }

  return results;
}

/**
 * Infer routing type based on framework and detected signals
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} framework - Detected framework name
 * @returns {Promise<'spa'|'ssr'|'ssg'|'unknown'>} Routing type
 */
async function inferRoutingType(page, framework) {
  if (!framework) return 'unknown';

  return await page.evaluate((fw) => {
    // Helper for safe property access
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
          if (window.$nuxt) return 'ssr'; // Actually Nuxt
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

/**
 * Detect framework used on the current page
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<FrameworkInfo>} Framework detection result
 */
export async function detectFramework(page) {
  // Run detection logic in browser context
  const results = await page.evaluate(browserDetectionLogic, DETECTION_SIGNALS);

  // Find framework with highest weight
  // Priority order: SSR frameworks first, then base frameworks
  const priorityOrder = ['next', 'nuxt', 'astro', 'svelte', 'angular', 'vue', 'react'];

  let bestFramework = null;
  let bestWeight = 0;
  let bestSignals = [];
  let bestVersion = null;

  for (const framework of priorityOrder) {
    const result = results[framework];
    if (result.weight > bestWeight) {
      bestWeight = result.weight;
      bestFramework = framework;
      bestSignals = result.signals;
      bestVersion = result.version;
    }
  }

  // Calculate confidence
  const confidence = bestWeight > 0 ? calculateConfidence(bestWeight) : 'low';

  // Infer routing type
  const routingType = await inferRoutingType(page, bestFramework);

  return {
    framework: bestFramework,
    version: bestVersion,
    routingType,
    confidence,
    signals: bestSignals
  };
}

/**
 * Format detection result for CLI output
 * @param {FrameworkInfo} info - Detection result
 * @returns {string} Human-readable summary
 */
export function formatDetectionResult(info) {
  if (!info.framework) {
    return 'No framework detected (static HTML or unknown framework)';
  }

  const parts = [
    `Framework: ${info.framework}`,
    info.version ? `Version: ${info.version}` : null,
    `Routing: ${info.routingType}`,
    `Confidence: ${info.confidence}`,
    `Signals: ${info.signals.join(', ')}`
  ].filter(Boolean);

  return parts.join(' | ');
}

// CLI support - check if this is the main module being executed directly
// Use import.meta.url to compare with process.argv[1]
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  const { getBrowser, getPage, disconnectBrowser } = await import('../utils/browser.js');

  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node framework-detector.js <url>');
    process.exit(1);
  }

  try {
    const browser = await getBrowser({ headless: true });
    const page = await getPage(browser);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for hydration
    await new Promise(r => setTimeout(r, 2000));

    const result = await detectFramework(page);

    console.log(JSON.stringify(result, null, 2));
    console.error('\n' + formatDetectionResult(result));

    await disconnectBrowser();
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}
