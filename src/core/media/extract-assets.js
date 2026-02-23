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
import { getBrowser, getPage, closeBrowser, disconnectBrowser } from '../../utils/browser.js';
import { parseArgs, outputJSON, outputError } from '../../utils/helpers.js';
import { downloadBatch, getSafeFilename, getAssetType } from './extract-assets-downloader.js';
import { extractCssUrls, extractAssetsFromPage } from './extract-assets-page-scraper.js';

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

    await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30000 });

    // Extract assets from page DOM
    const pageAssets = await extractAssetsFromPage(page, args.url);

    // Collect CSS content for font/background extraction
    let allCssContent = '';

    const inlineCss = await page.evaluate(() =>
      Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n')
    );
    allCssContent += inlineCss;

    const sourceCssPath = path.join(args.output, 'analysis', 'source.css');
    try {
      const sourceCss = await fs.readFile(sourceCssPath, 'utf-8');
      allCssContent += '\n' + sourceCss;
    } catch { /* source.css not available */ }

    // Combine all URLs and categorize
    const cssAssetUrls = extractCssUrls(allCssContent, args.url);
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

    // Download all assets
    const parsedConcurrency = args.concurrency ? parseInt(args.concurrency) : NaN;
    const concurrency = Number.isNaN(parsedConcurrency) ? undefined : parsedConcurrency;
    const downloadResults = await downloadBatch(downloads, verbose, { maxConcurrent: concurrency });

    // Validate downloaded assets
    let integrity = null;
    try {
      const { validateBatch } = await import('./asset-validator.js');
      integrity = await validateBatch(assetsDir);
    } catch { /* validation optional */ }

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

    outputJSON({
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
      integrity: integrity || undefined,
      errors: downloadResults.errors.length > 0 ? downloadResults.errors.slice(0, 10) : undefined
    });
    process.exit(0);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

// Run
extractAssets();
