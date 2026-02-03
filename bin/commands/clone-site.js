/**
 * Clone Site Command
 *
 * Clone multiple pages from a website with shared CSS and working navigation.
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
import { fileURLToPath } from 'url';

import { discoverPages } from '../../src/core/discover-pages.js';
import { captureMultiplePages } from '../../src/core/multi-page-screenshot.js';
import { mergeCssFiles } from '../../src/core/merge-css.js';
import { rewriteLinks, createPageManifest, rewriteAllLinks } from '../../src/core/rewrite-links.js';
import { extractDesignTokens } from '../../src/core/design-tokens.js';

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
    output: null,
    ai: false
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
    } else if (arg === '--ai') {
      options.ai = true;
    } else if (!arg.startsWith('--') && !options.url) {
      options.url = arg;
    }
  }

  return options;
}

/**
 * Clone multiple pages from a website
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
    skipConfirm = false,
    output,
    ai = false
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
  console.error('\n[1/6] Discovering pages...');

  let pageList;
  if (manualPages && manualPages.length > 0) {
    // Use manual page list
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
    // Auto-discover
    pageList = await discoverPages(url, { maxPages });
    if (!pageList.success) {
      console.error(`   Warning: Discovery failed - ${pageList.error}`);
      console.error('   Falling back to homepage only');
    }
    console.error(`   Found ${pageList.pages.length} pages`);
  }

  // Show discovered pages
  for (const page of pageList.pages) {
    console.error(`   - ${page.path} (${page.name})`);
  }

  // Step 2: Capture all pages
  console.error('\n[2/6] Capturing pages...');

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

  // Step 3: Merge CSS files (prefer filtered CSS)
  console.error('\n[3/6] Merging CSS...');

  const mergedCssPath = path.join(outputDir, 'styles.css');
  let mergeResult = { success: false };

  // Use filtered CSS if available, fallback to raw CSS
  const cssToMerge = captureResult.cssFilesFiltered?.length > 0
    ? captureResult.cssFilesFiltered
    : captureResult.cssFiles;

  const cssType = captureResult.cssFilesFiltered?.length > 0 ? 'filtered' : 'raw';

  if (cssToMerge.length > 0) {
    mergeResult = await mergeCssFiles(cssToMerge, mergedCssPath);
    if (mergeResult.success) {
      console.error(`   Merged ${mergeResult.input.fileCount} ${cssType} files`);
      console.error(`   Reduction: ${mergeResult.stats.reduction}`);
    } else {
      console.error(`   Warning: Merge failed - ${mergeResult.error}`);
    }
  } else {
    console.error('   No CSS files to merge');
  }

  // Step 4: Extract design tokens (if --ai flag)
  console.error('\n[4/6] Extracting design tokens...');

  let hasTokens = false;
  if (ai) {
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      const tokenResult = await extractDesignTokens(outputDir, mergedCssPath);
      if (tokenResult.success) {
        hasTokens = true;
        console.error(`   Created: tokens.css, design-tokens.json`);
      } else {
        console.error(`   Warning: Token extraction failed - ${tokenResult.error}`);
        if (tokenResult.hint) {
          console.error(`   Hint: ${tokenResult.hint}`);
        }
      }
    } else {
      console.error('   Skipped: GEMINI_API_KEY not set');
      console.error('   Hint: Set GEMINI_API_KEY in ~/.claude/.env for AI token extraction');
    }
  } else {
    console.error('   Skipped (use --ai flag to enable)');
  }

  // Step 5: Rewrite links
  console.error('\n[5/6] Rewriting links...');

  const manifest = createPageManifest(pageList.pages, {
    hasTokens,
    stats: {
      totalPages: pageList.pages.length,
      totalScreenshots: captureResult.stats.totalScreenshots,
      cssReduction: mergeResult.stats?.reduction || '0%',
      captureTimeMs: captureResult.stats.totalTimeMs
    }
  });

  // Copy HTML files to pages/ directory and rewrite links
  const pagesDir = path.join(outputDir, 'pages');
  await fs.mkdir(pagesDir, { recursive: true });

  for (const page of manifest.pages) {
    const sourceHtml = path.join(outputDir, 'html', page.file);
    const destHtml = path.join(pagesDir, page.file);

    try {
      let html = await fs.readFile(sourceHtml, 'utf-8');
      html = rewriteLinks(html, manifest, {
        baseUrl: url,
        injectTokensCss: hasTokens
      });
      await fs.writeFile(destHtml, html, 'utf-8');
      console.error(`   Rewritten: ${page.file}`);
    } catch (err) {
      console.error(`   Warning: Failed to rewrite ${page.file}: ${err.message}`);
    }
  }

  // Step 6: Generate manifest
  console.error('\n[6/6] Generating manifest...');

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
    mergeResult,
    totalTimeMs: totalTime
  };
}

/**
 * Show help message
 */
export function showHelp() {
  console.log(`
Usage: design-clone clone-site <url> [options]

Clone multiple pages from a website with shared CSS and working navigation.

Options:
  --pages <paths>     Comma-separated paths (e.g., /,/about,/contact)
  --max-pages <n>     Maximum pages to auto-discover (default: 10)
  --viewports <list>  Viewport list (default: desktop,tablet,mobile)
  --yes               Skip confirmation prompt
  --output <dir>      Custom output directory
  --ai                Extract design tokens using Gemini AI (requires GEMINI_API_KEY)

Examples:
  design-clone clone-site https://example.com
  design-clone clone-site https://example.com --max-pages 5
  design-clone clone-site https://example.com --pages /,/about,/contact
  design-clone clone-site https://example.com --ai
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
