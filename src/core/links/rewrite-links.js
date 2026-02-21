/**
 * Link Rewriting Module
 *
 * Rewrites internal links in HTML to point to local .html files.
 * Preserves external links unchanged.
 * CSS link rewriting lives in rewrite-links-css-rewriter.js.
 *
 * Usage:
 *   import { rewriteLinks, createPageManifest } from '../links/rewrite-links.js';
 *   const rewritten = rewriteLinks(html, manifest, { baseUrl });
 */

import fs from 'fs/promises';
import path from 'path';
import { normalizeUrl } from '../discovery/discover-pages.js';
import { rewriteCssLinks } from './rewrite-links-css-rewriter.js';

/**
 * Convert URL path to local filename.
 * @param {string} urlPath - e.g. '/about', '/services/consulting'
 * @returns {string} e.g. 'about.html', 'services-consulting.html'
 */
export function pathToFilename(urlPath) {
  if (!urlPath || urlPath === '/' || urlPath === '') return 'index.html';

  const name = urlPath
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();

  return `${name}.html`;
}

/**
 * Create page manifest from discovered pages.
 * @param {Array<{ path, name, url }>} pages
 * @param {Object} options
 * @returns {Object} Page manifest
 */
export function createPageManifest(pages, options = {}) {
  const baseUrl = pages[0]?.url ? new URL(pages[0].url).origin : '';

  return {
    baseUrl,
    capturedAt: new Date().toISOString(),
    pages: pages.map(page => ({
      path:        page.path,
      name:        page.name,
      file:        pathToFilename(page.path),
      originalUrl: page.url
    })),
    assets: {
      css:    'styles.css',
      tokens: options.hasTokens ? 'tokens.css' : null
    },
    stats: options.stats || {}
  };
}

/**
 * Build URL-to-filename mapping from manifest (path + full URL variants).
 * @param {Object} manifest
 * @returns {Map<string, string>}
 */
function buildUrlMap(manifest) {
  const urlMap = new Map();

  for (const page of manifest.pages) {
    if (page.originalUrl) {
      urlMap.set(page.originalUrl, page.file);
      urlMap.set(page.originalUrl.replace(/\/$/, ''), page.file);
    }
    if (page.path) {
      urlMap.set(page.path, page.file);
      if (page.path !== '/') urlMap.set(page.path.replace(/\/$/, ''), page.file);
    }
  }

  return urlMap;
}

/**
 * Rewrite links in HTML to point to local files.
 * @param {string} html
 * @param {Object} manifest
 * @param {Object} options
 * @param {string} [options.baseUrl]
 * @param {boolean} [options.rewriteCss=true]
 * @param {boolean} [options.injectTokensCss=false]
 * @returns {string} HTML with rewritten links
 */
export function rewriteLinks(html, manifest, options = {}) {
  const { baseUrl, rewriteCss = true, injectTokensCss = false } = options;
  const urlMap = buildUrlMap(manifest);

  let result = html;

  // Rewrite <a href="..."> internal links
  result = result.replace(
    /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, href, suffix) => {
      if (!href ||
          href.startsWith('javascript:') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('#')) {
        return match;
      }

      let filename = null;

      if (urlMap.has(href)) {
        filename = urlMap.get(href);
      } else if (baseUrl) {
        const normalized = normalizeUrl(baseUrl, href);
        if (normalized && urlMap.has(normalized)) filename = urlMap.get(normalized);
      }

      if (filename) {
        const fragmentMatch = href.match(/#[^#]*$/);
        const fragment      = fragmentMatch ? fragmentMatch[0] : '';
        return `${prefix}${filename}${fragment}${suffix}`;
      }

      return match;
    }
  );

  if (rewriteCss) {
    result = rewriteCssLinks(result, injectTokensCss);
  }

  return result;
}

/**
 * Rewrite links in all HTML files listed in manifest.
 * @param {string} htmlDir
 * @param {Object} manifest
 * @param {Object} options
 * @returns {Promise<{ processed: string[], errors: Array }>}
 */
export async function rewriteAllLinks(htmlDir, manifest, options = {}) {
  const results = { processed: [], errors: [] };

  for (const page of manifest.pages) {
    const htmlPath = path.join(htmlDir, page.file);
    try {
      const html      = await fs.readFile(htmlPath, 'utf-8');
      const rewritten = rewriteLinks(html, manifest, options);
      await fs.writeFile(htmlPath, rewritten, 'utf-8');
      results.processed.push(page.file);
    } catch (err) {
      results.errors.push({ file: page.file, error: err.message });
    }
  }

  return results;
}

// CLI stub
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('rewrite-links.js') ||
  process.argv[1].includes('rewrite-links')
);

if (isMainModule) {
  console.log('rewrite-links.js - Use as module, not CLI');
  console.log('Exports: rewriteLinks, createPageManifest, pathToFilename, rewriteAllLinks');
}
