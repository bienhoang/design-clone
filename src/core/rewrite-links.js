/**
 * Link Rewriting Module
 *
 * Rewrites internal links in HTML to point to local .html files.
 * Preserves external links unchanged.
 *
 * Usage:
 *   import { rewriteLinks, createPageManifest } from './rewrite-links.js';
 *   const rewritten = rewriteLinks(html, manifest, { baseUrl });
 */

import { normalizeUrl } from './discover-pages.js';

/**
 * Convert URL path to local filename
 * @param {string} urlPath - URL path (e.g., '/about', '/services/consulting')
 * @returns {string} Local filename (e.g., 'about.html', 'services-consulting.html')
 */
export function pathToFilename(urlPath) {
  if (!urlPath || urlPath === '/' || urlPath === '') {
    return 'index.html';
  }

  const name = urlPath
    .replace(/^\//, '')           // Remove leading slash
    .replace(/\/$/, '')           // Remove trailing slash
    .replace(/\//g, '-')          // Replace slashes with dashes
    .replace(/[^a-z0-9-]/gi, '-') // Replace special chars
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .toLowerCase();

  return `${name}.html`;
}

/**
 * Create page manifest from discovered pages
 * @param {Array} pages - Array of { path, name, url }
 * @param {Object} options - Additional options
 * @returns {Object} Page manifest
 */
export function createPageManifest(pages, options = {}) {
  const baseUrl = pages[0]?.url ? new URL(pages[0].url).origin : '';

  const manifest = {
    baseUrl,
    capturedAt: new Date().toISOString(),
    pages: pages.map(page => ({
      path: page.path,
      name: page.name,
      file: pathToFilename(page.path),
      originalUrl: page.url
    })),
    assets: {
      css: 'styles.css',
      tokens: options.hasTokens ? 'tokens.css' : null
    },
    stats: options.stats || {}
  };

  return manifest;
}

/**
 * Build URL to filename mapping from manifest
 * @param {Object} manifest - Page manifest
 * @returns {Map} URL -> filename mapping
 */
function buildUrlMap(manifest) {
  const urlMap = new Map();

  for (const page of manifest.pages) {
    // Map by full URL
    if (page.originalUrl) {
      urlMap.set(page.originalUrl, page.file);
      // Also without trailing slash
      const noSlash = page.originalUrl.replace(/\/$/, '');
      urlMap.set(noSlash, page.file);
    }

    // Map by path
    if (page.path) {
      urlMap.set(page.path, page.file);
      // Also without trailing slash
      if (page.path !== '/') {
        urlMap.set(page.path.replace(/\/$/, ''), page.file);
      }
    }
  }

  return urlMap;
}

/**
 * Rewrite links in HTML to point to local files
 * @param {string} html - HTML content
 * @param {Object} manifest - Page manifest
 * @param {Object} options - Rewrite options
 * @returns {string} HTML with rewritten links
 */
export function rewriteLinks(html, manifest, options = {}) {
  const { baseUrl, rewriteCss = true, injectTokensCss = false } = options;
  const urlMap = buildUrlMap(manifest);

  let result = html;

  // Rewrite <a href="..."> links
  result = result.replace(
    /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, href, suffix) => {
      // Skip empty, javascript:, mailto:, tel:, and anchor-only links
      if (!href ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('#')) {
        return match;
      }

      // Try to match against manifest
      let filename = null;

      // Direct path match
      if (urlMap.has(href)) {
        filename = urlMap.get(href);
      }
      // Normalized URL match
      else if (baseUrl) {
        const normalized = normalizeUrl(baseUrl, href);
        if (normalized && urlMap.has(normalized)) {
          filename = urlMap.get(normalized);
        }
      }

      if (filename) {
        // Preserve fragment if present
        const fragmentMatch = href.match(/#[^#]*$/);
        const fragment = fragmentMatch ? fragmentMatch[0] : '';
        return `${prefix}${filename}${fragment}${suffix}`;
      }

      // Keep original for external/unknown links
      return match;
    }
  );

  // Rewrite CSS links to use shared styles.css
  if (rewriteCss) {
    result = result.replace(
      /<link([^>]*?)href=["'][^"']*\.css["']([^>]*?)>/gi,
      (match, before, after) => {
        // Check if it's a stylesheet link
        if (match.includes('rel="stylesheet"') || match.includes("rel='stylesheet'") ||
            !match.includes('rel=')) {
          return `<link${before}href="../styles.css" rel="stylesheet"${after}>`;
        }
        return match;
      }
    );

    // Remove duplicate stylesheet links (keep first)
    const seenStylesheets = new Set();
    result = result.replace(
      /<link[^>]*href=["']\.\.\/styles\.css["'][^>]*>/gi,
      (match) => {
        if (seenStylesheets.has('styles.css')) {
          return ''; // Remove duplicate
        }
        seenStylesheets.add('styles.css');
        return match;
      }
    );

    // Inject tokens.css before styles.css if requested
    if (injectTokensCss) {
      result = result.replace(
        /(<link[^>]*href=["']\.\.\/styles\.css["'][^>]*>)/i,
        '<link href="../tokens.css" rel="stylesheet">\n  $1'
      );
    }
  }

  return result;
}

/**
 * Rewrite links in all HTML files in a directory
 * @param {string} htmlDir - Directory containing HTML files
 * @param {Object} manifest - Page manifest
 * @param {Object} options - Rewrite options
 * @returns {Promise<Object>} Rewrite results
 */
export async function rewriteAllLinks(htmlDir, manifest, options = {}) {
  const fs = await import('fs/promises');
  const path = await import('path');

  const results = {
    processed: [],
    errors: []
  };

  for (const page of manifest.pages) {
    const htmlPath = path.join(htmlDir, page.file);

    try {
      const html = await fs.readFile(htmlPath, 'utf-8');
      const rewritten = rewriteLinks(html, manifest, options);
      await fs.writeFile(htmlPath, rewritten, 'utf-8');
      results.processed.push(page.file);
    } catch (err) {
      results.errors.push({ file: page.file, error: err.message });
    }
  }

  return results;
}

// CLI support
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('rewrite-links.js') ||
  process.argv[1].includes('rewrite-links')
);

if (isMainModule) {
  console.log('rewrite-links.js - Use as module, not CLI');
  console.log('Exports: rewriteLinks, createPageManifest, pathToFilename, rewriteAllLinks');
}
