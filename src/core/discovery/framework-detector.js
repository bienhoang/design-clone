/**
 * Framework Detector Module
 *
 * Detects JS frameworks via global objects, DOM attributes, script patterns.
 * Returns framework info with confidence scoring.
 *
 * Usage:
 *   import { detectFramework } from './framework-detector.js';
 *   const info = await detectFramework(page);
 */

import { DETECTION_SIGNALS } from './framework-detector-signals.js';
import { inferRoutingType } from './framework-detector-routing.js';

export { DETECTION_SIGNALS };

/**
 * @typedef {Object} FrameworkInfo
 * @property {string|null} framework
 * @property {string|null} version
 * @property {'spa'|'ssr'|'ssg'|'unknown'} routingType
 * @property {'high'|'medium'|'low'} confidence
 * @property {string[]} signals
 */

function calculateConfidence(w) {
  return w >= 5 ? 'high' : w >= 3 ? 'medium' : 'low';
}

/**
 * Detect framework used on the current page.
 * @param {import('playwright').Page} page
 * @returns {Promise<FrameworkInfo>}
 */
export async function detectFramework(page) {
  const results = await page.evaluate((signals) => {
    function safeGet(obj, path) {
      let current = obj;
      for (const key of path) {
        if (current === null || current === undefined) return undefined;
        current = current[key];
      }
      return current;
    }

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
              matched = safeGet(window, check.path) !== undefined;
              break;
            case 'dom':
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
            case 'script': {
              const scripts = Array.from(document.querySelectorAll('script[src]'));
              matched = scripts.some(s => s.src.includes(check.pattern));
              break;
            }
            case 'meta': {
              const meta = document.querySelector(`meta[name="${check.name}"]`);
              matched = !!(meta?.content?.includes(check.pattern));
              break;
            }
          }
        } catch (e) {
          matched = false;
        }

        if (matched) {
          totalWeight += check.weight;
          matchedSignals.push(check.signal);
        }
      }

      // Version extraction
      if (totalWeight > 0) {
        try {
          switch (framework) {
            case 'next': {
              const d = safeGet(window, ['__NEXT_DATA__']);
              if (d) {
                version = d.nextExport ? 'export' : (d.buildId || null);
                if (d.runtimeConfig?.version) version = d.runtimeConfig.version;
              }
              break;
            }
            case 'nuxt': {
              const v = safeGet(window, ['__NUXT__', 'config', 'app', 'buildId']);
              if (v) version = v;
              break;
            }
            case 'vue':
              version = safeGet(window, ['Vue', 'version']) ||
                        safeGet(window, ['__VUE__', 'version']) || null;
              break;
            case 'react':
              version = safeGet(window, ['React', 'version']) || null;
              break;
            case 'angular': {
              const el = document.querySelector('[ng-version]');
              if (el) version = el.getAttribute('ng-version');
              break;
            }
            case 'astro': {
              const m = document.querySelector('meta[name="generator"]');
              if (m?.content?.includes('Astro')) {
                const match = m.content.match(/Astro v?([\d.]+)/);
                if (match) version = match[1];
              }
              break;
            }
          }
        } catch (e) { /* ignore version errors */ }
      }

      results[framework] = { weight: totalWeight, signals: matchedSignals, version };
    }

    return results;
  }, DETECTION_SIGNALS);

  // SSR frameworks take priority over base frameworks
  let bestFramework = null, bestWeight = 0, bestSignals = [], bestVersion = null;
  for (const fw of ['next', 'nuxt', 'astro', 'svelte', 'angular', 'vue', 'react']) {
    if (results[fw].weight > bestWeight) {
      bestWeight = results[fw].weight; bestFramework = fw;
      bestSignals = results[fw].signals; bestVersion = results[fw].version;
    }
  }
  const confidence = bestWeight > 0 ? calculateConfidence(bestWeight) : 'low';
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
 * Format detection result for CLI output.
 * @param {FrameworkInfo} info
 * @returns {string}
 */
export function formatDetectionResult(info) {
  if (!info.framework) return 'No framework detected (static HTML or unknown framework)';
  return [`Framework: ${info.framework}`, info.version ? `Version: ${info.version}` : null,
    `Routing: ${info.routingType}`, `Confidence: ${info.confidence}`,
    `Signals: ${info.signals.join(', ')}`].filter(Boolean).join(' | ');
}

// CLI support
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const { getBrowser, getPage, disconnectBrowser } = await import('../utils/browser.js');
  const url = process.argv[2];
  if (!url) { console.error('Usage: node framework-detector.js <url>'); process.exit(1); }
  try {
    const browser = await getBrowser({ headless: true });
    const page = await getPage(browser);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
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
