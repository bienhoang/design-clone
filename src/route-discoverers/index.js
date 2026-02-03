/**
 * Route Discoverers Registry
 *
 * Central registry for framework-specific route discoverers.
 * Uses the framework detector to select the appropriate discoverer.
 */

import { NextDiscoverer } from './next-discoverer.js';
import { NuxtDiscoverer } from './nuxt-discoverer.js';
import { VueDiscoverer } from './vue-discoverer.js';
import { ReactDiscoverer } from './react-discoverer.js';
import { AngularDiscoverer } from './angular-discoverer.js';
import { SvelteDiscoverer } from './svelte-discoverer.js';
import { AstroDiscoverer } from './astro-discoverer.js';
import { UniversalDiscoverer } from './universal-discoverer.js';

/**
 * Registry mapping framework names to discoverer classes
 */
export const DISCOVERER_REGISTRY = {
  'next': NextDiscoverer,
  'nuxt': NuxtDiscoverer,
  'vue': VueDiscoverer,
  'react': ReactDiscoverer,
  'angular': AngularDiscoverer,
  'svelte': SvelteDiscoverer,
  'astro': AstroDiscoverer,
  'unknown': UniversalDiscoverer
};

/**
 * Get the appropriate discoverer class for a framework
 * @param {string} framework - Framework name from detector
 * @returns {typeof import('./base-discoverer.js').BaseDiscoverer}
 */
export function getDiscovererClass(framework) {
  const normalizedFramework = framework?.toLowerCase() || 'unknown';
  return DISCOVERER_REGISTRY[normalizedFramework] || UniversalDiscoverer;
}

/**
 * Create a discoverer instance for a framework
 * @param {string} framework - Framework name
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} baseUrl - Base URL of the site
 * @returns {import('./base-discoverer.js').BaseDiscoverer}
 */
export function createDiscoverer(framework, page, baseUrl) {
  const DiscovererClass = getDiscovererClass(framework);
  return new DiscovererClass(page, baseUrl);
}

/**
 * Discover routes for a given page using framework detection
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} baseUrl - Base URL of the site
 * @param {object} [frameworkInfo] - Optional pre-detected framework info
 * @returns {Promise<{routes: import('./base-discoverer.js').DiscoveredRoute[], framework: string, discoverer: string}>}
 */
export async function discoverRoutes(page, baseUrl, frameworkInfo = null) {
  // Import framework detector if we need to detect
  let detectedFramework = frameworkInfo?.framework || 'unknown';

  if (!frameworkInfo) {
    try {
      const { detectFramework } = await import('../core/framework-detector.js');
      const info = await detectFramework(page);
      detectedFramework = info.framework;
    } catch {
      // Framework detector not available, use universal
      detectedFramework = 'unknown';
    }
  }

  const discoverer = createDiscoverer(detectedFramework, page, baseUrl);
  const routes = await discoverer.discover();

  return {
    routes,
    framework: detectedFramework,
    discoverer: discoverer.constructor.name
  };
}

/**
 * Get list of supported frameworks
 * @returns {string[]}
 */
export function getSupportedFrameworks() {
  return Object.keys(DISCOVERER_REGISTRY).filter(k => k !== 'unknown');
}

// Export all discoverer classes for direct use
export {
  NextDiscoverer,
  NuxtDiscoverer,
  VueDiscoverer,
  ReactDiscoverer,
  AngularDiscoverer,
  SvelteDiscoverer,
  AstroDiscoverer,
  UniversalDiscoverer
};

// Re-export base class
export { BaseDiscoverer } from './base-discoverer.js';
