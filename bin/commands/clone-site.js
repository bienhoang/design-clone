/**
 * Clone Site Command
 *
 * Capture multi-viewport screenshots of multiple pages from a website.
 * Screenshots are used by Claude Code vision to generate new HTML/CSS.
 *
 * Usage:
 *   design-clone clone-site <url> [options]
 *
 * Options:
 *   --pages <paths>     Comma-separated paths (e.g., /,/about,/contact)
 *   --max-pages <n>     Maximum pages to clone (default: 10)
 *   --viewports <list>  Viewport list (default: desktop,tablet,mobile)
 *   --yes               Skip confirmation prompt
 *   --output <dir>      Custom output directory
 */

import fs from 'fs/promises';
import path from 'path';

import { discoverPages } from '../../src/core/discovery/discover-pages.js';
import { captureMultiplePages } from '../../src/core/capture/multi-page-screenshot.js';

/**
 * Generate output directory name
 * @param {string} url - Target URL
 * @returns {string} Output directory path
 */
function generateOutputDir(url) {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace(/^www\./, '');
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 13);

  return `./cloned-designs/${timestamp}-${domain}`;
}

/**
 * Parse CLI arguments
 * @param {string[]} args - CLI arguments
 * @returns {Object} Parsed options
 */
export function parseArgs(args) {
  const options = {
    url: null,
    pages: null,
    maxPages: 10,
    viewports: ['desktop', 'tablet', 'mobile'],
    skipConfirm: false,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--pages' && args[i + 1]) {
      options.pages = args[++i].split(',').map(p => p.trim());
    } else if (arg === '--max-pages' && args[i + 1]) {
      options.maxPages = parseInt(args[++i], 10);
    } else if (arg === '--viewports' && args[i + 1]) {
      options.viewports = args[++i].split(',').map(v => v.trim());
    } else if (arg === '--yes' || arg === '-y') {
      options.skipConfirm = true;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (!arg.startsWith('--') && !options.url) {
      options.url = arg;
    }
  }

  return options;
}

/**
 * Clone multiple pages from a website (screenshot-only capture)
 * @param {string} url - Target URL
 * @param {Object} options - Clone options
 * @returns {Promise<Object>} Clone result
 */
export async function cloneSite(url, options = {}) {
  const startTime = Date.now();
  const {
    pages: manualPages,
    maxPages = 10,
    viewports = ['desktop', 'tablet', 'mobile'],
    output
  } = options;

  // Validate URL
  let baseUrl;
  try {
    baseUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Generate output directory
  const outputDir = output || generateOutputDir(url);

  console.error(`\n[clone-site] Target: ${url}`);
  console.error(`[clone-site] Output: ${outputDir}`);

  // Step 1: Discover or use manual pages
  console.error('\n[1/3] Discovering pages...');

  let pageList;
  if (manualPages && manualPages.length > 0) {
    pageList = {
      success: true,
      pages: manualPages.map(p => ({
        path: p,
        name: p === '/' ? 'Home' : p.replace(/^\//, '').replace(/-/g, ' '),
        url: new URL(p, url).href
      }))
    };
    console.error(`   Using ${pageList.pages.length} manual pages`);
  } else {
    pageList = await discoverPages(url, { maxPages });
    if (!pageList.success) {
      console.error(`   Warning: Discovery failed - ${pageList.error}`);
      console.error('   Falling back to homepage only');
    }
    console.error(`   Found ${pageList.pages.length} pages`);
  }

  for (const page of pageList.pages) {
    console.error(`   - ${page.path} (${page.name})`);
  }

  // Step 2: Capture all pages (screenshots only)
  console.error('\n[2/3] Capturing screenshots...');

  const captureResult = await captureMultiplePages(pageList.pages, {
    outputDir,
    viewports,
    onProgress: (current, total, info) => {
      console.error(`   [${current}/${total}] ${info.status}: ${info.name}`);
    }
  });

  if (!captureResult.success) {
    throw new Error(`Capture failed: ${captureResult.error}`);
  }

  console.error(`   Captured ${captureResult.stats.successfulPages}/${captureResult.stats.totalPages} pages`);
  console.error(`   Screenshots: ${captureResult.stats.totalScreenshots}`);

  // Step 3: Generate manifest
  console.error('\n[3/3] Generating manifest...');

  const manifest = {
    baseUrl: url,
    capturedAt: new Date().toISOString(),
    pages: captureResult.pages
      .filter(p => p.success)
      .map(p => ({
        path: p.path,
        name: p.name,
        originalUrl: p.url,
        screenshots: Object.fromEntries(
          Object.entries(p.screenshots)
            .filter(([, v]) => !v.failed)
            .map(([vp, v]) => [vp, path.relative(outputDir, v.path)])
        )
      })),
    stats: {
      totalPages: captureResult.stats.totalPages,
      totalScreenshots: captureResult.stats.totalScreenshots,
      captureTimeMs: captureResult.stats.totalTimeMs
    }
  };

  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.error(`   Created: manifest.json`);

  // Summary
  const totalTime = Date.now() - startTime;
  console.error(`\n[clone-site] Complete!`);
  console.error(`   Output: ${path.resolve(outputDir)}`);
  console.error(`   Pages: ${manifest.pages.length}`);
  console.error(`   Time: ${(totalTime / 1000).toFixed(1)}s`);

  return {
    success: true,
    outputDir: path.resolve(outputDir),
    manifest,
    captureResult,
    totalTimeMs: totalTime
  };
}

/**
 * Show help message
 */
export function showHelp() {
  console.log(`
Usage: design-clone clone-site <url> [options]

Capture multi-viewport screenshots of multiple pages from a website.

Options:
  --pages <paths>     Comma-separated paths (e.g., /,/about,/contact)
  --max-pages <n>     Maximum pages to auto-discover (default: 10)
  --viewports <list>  Viewport list (default: desktop,tablet,mobile)
  --yes               Skip confirmation prompt
  --output <dir>      Custom output directory

Examples:
  design-clone clone-site https://example.com
  design-clone clone-site https://example.com --max-pages 5
  design-clone clone-site https://example.com --pages /,/about,/contact
`);
}

// CLI entry point
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('clone-site.js') ||
  process.argv[1].includes('clone-site')
);

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.url) {
    console.error('Error: URL is required');
    showHelp();
    process.exit(1);
  }

  cloneSite(options.url, options)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error(`\n[ERROR] ${err.message}`);
      process.exit(1);
    });
}
