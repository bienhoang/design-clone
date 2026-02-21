/**
 * Base Discoverer Utilities
 *
 * Route normalization, deduplication, name extraction, and string helpers
 * extracted from base-discoverer.js to keep each file under 200 lines.
 */

// Dynamic segment patterns for detecting parameterized routes
export const DYNAMIC_PATTERNS = [
  /\[[\w-]+\]/,            // Next.js [slug]
  /\[\.\.\.([\w-]+)\]/,   // Next.js catch-all [...slug]
  /:[\w-]+/,               // Vue/React :id
  /\{[\w-]+\}/,            // Angular {id}
  /\*[\w-]*/               // Wildcard
];

// Source priority for deduplication (higher = preferred)
export const SOURCE_PRIORITY = {
  'framework': 4,
  'interception': 3,
  'sitemap': 2,
  'link-scrape': 1
};

/**
 * Normalize a route path:
 * - Strips full URL to pathname
 * - Ensures leading slash
 * - Removes query params and hash
 * - Removes trailing slash (except root)
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizeRoute(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '/';

  let p = rawPath;

  if (p.startsWith('http')) {
    try {
      p = new URL(p).pathname;
    } catch {
      return '/';
    }
  }

  if (!p.startsWith('/')) p = '/' + p;

  p = p.split('?')[0].split('#')[0];

  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  return p;
}

/**
 * Check if a path contains dynamic segments
 * @param {string} path
 * @returns {boolean}
 */
export function isDynamicRoute(path) {
  return DYNAMIC_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Convert string to Title Case (handles kebab-case and snake_case)
 * @param {string} str
 * @returns {string}
 */
export function titleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Extract a human-readable page name from a route path
 * @param {string} path - Route path
 * @param {string} [componentName] - Optional component name hint
 * @returns {string}
 */
export function extractPageName(path, componentName) {
  if (componentName && componentName !== 'default' && componentName !== 'index') {
    return componentName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  const normalized = normalizeRoute(path);
  if (normalized === '/') return 'Home';

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return 'Home';

  let lastSegment = segments[segments.length - 1];

  if (isDynamicRoute(lastSegment)) {
    lastSegment = lastSegment.replace(/[\[\]:{}*\.]/g, '');
    return `${titleCase(lastSegment)} (Dynamic)`;
  }

  return titleCase(lastSegment);
}

/**
 * Deduplicate routes by path, preferring higher-priority sources.
 * @param {Array} routes - Raw route objects
 * @param {string} baseOrigin - Origin for building full URLs
 * @returns {Array} Deduplicated routes with normalized paths and full URLs
 */
export function deduplicateRoutes(routes, baseOrigin) {
  const seen = new Map();

  for (const route of routes) {
    const normalized = normalizeRoute(route.path);
    const existing = seen.get(normalized);

    const currentPriority = SOURCE_PRIORITY[route.source] || 0;
    const existingPriority = existing ? (SOURCE_PRIORITY[existing.source] || 0) : -1;

    const shouldReplace = !existing ||
      currentPriority > existingPriority ||
      (currentPriority === existingPriority && route.name && !existing.name);

    if (shouldReplace) {
      seen.set(normalized, {
        ...route,
        path: normalized,
        url: `${baseOrigin}${normalized}`,
        dynamic: isDynamicRoute(normalized)
      });
    }
  }

  return Array.from(seen.values());
}
