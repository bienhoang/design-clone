#!/usr/bin/env node
/**
 * Asset Extraction Script for Pixel-Perfect Clone
 *
 * Downloads and organizes assets from source website:
 * - Images (jpg, png, gif, webp, svg)
 * - Fonts (woff, woff2, ttf, otf)
 * - CSS-embedded images (background-url)
 *
 * Usage:
 *   node extract-assets.js --url <url> --output <dir> [--verbose]
 *
 * Options:
 *   --url       Target website URL (required)
 *   --output    Output directory (required)
 *   --verbose   Show detailed progress
 *   --timeout   Download timeout in ms (default: 30000)
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// Import browser abstraction (auto-detects chrome-devtools or standalone)
import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Asset type configurations
const ASSET_TYPES = {
  images: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'],
    folder: 'images',
    selectors: ['img[src]', 'picture source[srcset]', '[style*="background"]', 'link[rel="icon"]', 'link[rel="apple-touch-icon"]']
  },
  fonts: {
    extensions: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
    folder: 'fonts',
    patterns: [/@font-face\s*\{[^}]*url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi]
  },
  icons: {
    extensions: ['.svg'],
    folder: 'icons',
    selectors: ['svg', 'use[href]', 'use[xlink\\:href]']
  }
};

// Rate limiting configuration
const RATE_LIMIT = {
  maxConcurrent: 5,
  delayBetweenBatches: 200
};

/**
 * Parse CSS for asset URLs
 */
function extractCssUrls(cssContent, baseUrl) {
  const urls = new Set();

  // Background images
  const bgPattern = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  let match;
  while ((match = bgPattern.exec(cssContent)) !== null) {
    const url = match[1];
    if (!url.startsWith('data:')) {
      try {
        const absoluteUrl = new URL(url, baseUrl).href;
        urls.add(absoluteUrl);
      } catch { /* ignore invalid URLs */ }
    }
  }

  // Font URLs
  const fontPattern = /@font-face\s*\{[^}]*src:\s*([^;]+)/gi;
  while ((match = fontPattern.exec(cssContent)) !== null) {
    const srcValue = match[1];
    const urlPattern = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(srcValue)) !== null) {
      const url = urlMatch[1];
      if (!url.startsWith('data:')) {
        try {
          const absoluteUrl = new URL(url, baseUrl).href;
          urls.add(absoluteUrl);
        } catch { /* ignore invalid URLs */ }
      }
    }
  }

  return Array.from(urls);
}

/**
 * Download a file with timeout and retry
 */
async function downloadFile(url, destPath, timeout = 30000, retries = 2) {
  const protocol = url.startsWith('https') ? https : http;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Download timeout')), timeout);

        const request = protocol.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*'
          }
        }, (response) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            clearTimeout(timeoutId);
            downloadFile(response.headers.location, destPath, timeout, 0)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (response.statusCode !== 200) {
            clearTimeout(timeoutId);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', async () => {
            clearTimeout(timeoutId);
            try {
              const buffer = Buffer.concat(chunks);
              await fs.mkdir(path.dirname(destPath), { recursive: true });
              await fs.writeFile(destPath, buffer);
              resolve({ size: buffer.length });
            } catch (err) {
              reject(err);
            }
          });
          response.on('error', (err) => {
            clearTimeout(timeoutId);
            reject(err);
          });
        });

        request.on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      return { success: true };
    } catch (err) {
      if (attempt === retries) {
        return { success: false, error: err.message };
      }
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

/**
 * Download files in batches with rate limiting
 */
async function downloadBatch(downloads, verbose = false) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < downloads.length; i += RATE_LIMIT.maxConcurrent) {
    const batch = downloads.slice(i, i + RATE_LIMIT.maxConcurrent);

    const promises = batch.map(async ({ url, destPath, type }) => {
      // Check if file already exists
      try {
        await fs.access(destPath);
        results.skipped++;
        return { url, skipped: true };
      } catch { /* file doesn't exist, continue */ }

      const result = await downloadFile(url, destPath);
      if (result.success) {
        results.success++;
        if (verbose) console.error(`  ✓ ${type}: ${path.basename(destPath)}`);
      } else {
        results.failed++;
        results.errors.push({ url, error: result.error });
        if (verbose) console.error(`  ✗ ${type}: ${path.basename(url)} - ${result.error}`);
      }
      return { url, ...result };
    });

    await Promise.all(promises);

    if (i + RATE_LIMIT.maxConcurrent < downloads.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT.delayBetweenBatches));
    }
  }

  return results;
}

/**
 * Generate safe filename from URL
 */
function getSafeFilename(url) {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname);

    // Handle query strings in filename
    if (urlObj.search) {
      const hash = Buffer.from(urlObj.search).toString('base64').slice(0, 8);
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      filename = `${base}-${hash}${ext}`;
    }

    // Sanitize filename
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Ensure extension
    if (!path.extname(filename)) {
      filename += '.bin';
    }

    return filename;
  } catch {
    return `asset-${Date.now()}.bin`;
  }
}

/**
 * Determine asset type from URL
 */
function getAssetType(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();

  if (ASSET_TYPES.fonts.extensions.includes(ext)) return 'fonts';
  if (ext === '.svg') return 'icons';
  if (ASSET_TYPES.images.extensions.includes(ext)) return 'images';

  return 'other';
}

/**
 * Extract all assets from page
 */
async function extractAssetsFromPage(page, baseUrl) {
  return await page.evaluate((url) => {
    const assets = {
      images: new Set(),
      fonts: new Set(),
      icons: new Set(),
      cssUrls: []
    };

    // Images from img tags
    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        try {
          assets.images.add(new URL(src, url).href);
        } catch { /* ignore */ }
      }
    });

    // Images from srcset
    document.querySelectorAll('[srcset]').forEach(el => {
      const srcset = el.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach(part => {
          const src = part.trim().split(/\s+/)[0];
          if (src && !src.startsWith('data:')) {
            try {
              assets.images.add(new URL(src, url).href);
            } catch { /* ignore */ }
          }
        });
      }
    });

    // Background images from inline styles
    document.querySelectorAll('[style*="background"]').forEach(el => {
      const style = el.getAttribute('style');
      const urlMatch = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
      if (urlMatch && !urlMatch[1].startsWith('data:')) {
        try {
          assets.images.add(new URL(urlMatch[1], url).href);
        } catch { /* ignore */ }
      }
    });

    // Favicon and touch icons
    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('data:')) {
        try {
          assets.images.add(new URL(href, url).href);
        } catch { /* ignore */ }
      }
    });

    // Inline SVGs - extract as string
    const inlineSvgs = [];
    document.querySelectorAll('svg').forEach((svg, index) => {
      const svgContent = svg.outerHTML;
      if (svgContent.length < 50000) { // Skip huge SVGs
        inlineSvgs.push({
          id: svg.id || `inline-svg-${index}`,
          content: svgContent
        });
      }
    });

    // CSS stylesheet URLs for font extraction
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        try {
          assets.cssUrls.push(new URL(href, url).href);
        } catch { /* ignore */ }
      }
    });

    return {
      images: Array.from(assets.images),
      cssUrls: assets.cssUrls,
      inlineSvgs
    };
  }, baseUrl);
}

/**
 * Main extraction function
 */
async function extractAssets() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    outputError(new Error('--url is required'));
    process.exit(1);
  }
  if (!args.output) {
    outputError(new Error('--output directory is required'));
    process.exit(1);
  }

  const verbose = args.verbose === 'true';
  const timeout = args.timeout ? parseInt(args.timeout) : 30000;

  try {
    // Create output directories
    const assetsDir = path.join(args.output, 'assets');
    await fs.mkdir(path.join(assetsDir, 'images'), { recursive: true });
    await fs.mkdir(path.join(assetsDir, 'fonts'), { recursive: true });
    await fs.mkdir(path.join(assetsDir, 'icons'), { recursive: true });

    // Launch browser and navigate
    const browser = await getBrowser({ headless: args.headless !== 'false' });
    const page = await getPage(browser);

    if (verbose) console.error(`\n📦 Extracting assets from: ${args.url}\n`);

    await page.goto(args.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Extract assets from page
    const pageAssets = await extractAssetsFromPage(page, args.url);

    // Collect CSS content for font extraction
    let allCssContent = '';

    // Get inline styles
    const inlineCss = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('style'))
        .map(style => style.textContent)
        .join('\n');
    });
    allCssContent += inlineCss;

    // Get external CSS content (already extracted by multi-screenshot if available)
    const sourceCssPath = path.join(args.output, 'analysis', 'source.css');
    try {
      const sourceCss = await fs.readFile(sourceCssPath, 'utf-8');
      allCssContent += '\n' + sourceCss;
    } catch { /* source.css not available */ }

    // Extract URLs from CSS
    const cssAssetUrls = extractCssUrls(allCssContent, args.url);

    // Combine all URLs and categorize
    const allUrls = new Set([...pageAssets.images, ...cssAssetUrls]);

    const downloads = [];
    const urlMapping = {};

    for (const url of allUrls) {
      const type = getAssetType(url);
      const filename = getSafeFilename(url);
      const destPath = path.join(assetsDir, type === 'other' ? 'images' : type, filename);
      const relativePath = path.relative(args.output, destPath);

      downloads.push({ url, destPath, type });
      urlMapping[url] = relativePath;
    }

    if (verbose) {
      console.error(`Found ${downloads.length} assets to download:`);
      console.error(`  - Images: ${downloads.filter(d => d.type === 'images').length}`);
      console.error(`  - Fonts: ${downloads.filter(d => d.type === 'fonts').length}`);
      console.error(`  - Icons: ${downloads.filter(d => d.type === 'icons').length}`);
      console.error('');
    }

    // Download assets
    const downloadResults = await downloadBatch(downloads, verbose);

    // Save inline SVGs
    let savedSvgs = 0;
    for (const svg of pageAssets.inlineSvgs) {
      const filename = `${svg.id.replace(/[^a-zA-Z0-9-_]/g, '_')}.svg`;
      const svgPath = path.join(assetsDir, 'icons', filename);
      try {
        await fs.writeFile(svgPath, svg.content, 'utf-8');
        savedSvgs++;
      } catch { /* ignore */ }
    }

    // Save URL mapping for HTML rewriting
    const mappingPath = path.join(assetsDir, 'url-mapping.json');
    await fs.writeFile(mappingPath, JSON.stringify(urlMapping, null, 2));

    // Close browser
    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    const result = {
      success: true,
      assetsDir: path.resolve(assetsDir),
      urlMapping: mappingPath,
      stats: {
        total: downloads.length,
        downloaded: downloadResults.success,
        failed: downloadResults.failed,
        skipped: downloadResults.skipped,
        inlineSvgs: savedSvgs
      },
      errors: downloadResults.errors.length > 0 ? downloadResults.errors.slice(0, 10) : undefined
    };

    outputJSON(result);
    process.exit(0);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

// Run
extractAssets();
