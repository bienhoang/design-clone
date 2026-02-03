#!/usr/bin/env node
/**
 * Multi-viewport screenshot capture for design cloning
 *
 * Usage:
 *   node screenshot.js --url https://example.com --output ./analysis
 *
 * Options:
 *   --url           Target website URL (required)
 *   --output        Output directory for screenshots (required)
 *   --viewports     Comma-separated viewport names: desktop,tablet,mobile (default: all)
 *   --full-page     Capture full page height (default: true)
 *   --max-size      Max file size in MB before compression (default: 5)
 *   --headless      Run in headless mode (default: false)
 *   --scroll-delay  Pause time in ms between scroll steps (default: 1500)
 *   --close         Close browser after capture (default: false)
 *   --extract-html  Extract cleaned HTML (default: false)
 *   --extract-css   Extract all CSS from page (default: false)
 *   --filter-unused Filter CSS to remove unused selectors (default: true)
 */

import path from 'path';
import fs from 'fs/promises';

// Import modules
import { filterCssFile } from './filter-css.js';
import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Import extracted modules
import { waitForDomStable, waitForFontsLoaded, waitForStylesStable, waitForPageReady } from './page-readiness.js';
import { dismissCookieBanner } from './cookie-handler.js';
import { forceLazyImages, forceAnimatedElementsVisible, triggerLazyLoad, waitForAllImages, LAZY_LOAD_MAX_ITERATIONS } from './lazy-loader.js';
import { extractCleanHtml, JS_FRAMEWORK_PATTERNS, MAX_HTML_SIZE } from './html-extractor.js';
import { extractAllCss, MAX_CSS_SIZE } from './css-extractor.js';
import { extractComponentDimensions } from './dimension-extractor.js';
import { buildDimensionsOutput, generateAISummary } from './dimension-output.js';

// Try to import Sharp for compression
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  // Sharp not available
}

// Constants
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 }
};

const VIEWPORT_SETTLE_DELAY = 1500;
const NETWORK_IDLE_TIMEOUT = 8000;
const DEFAULT_SCROLL_DELAY = 1500;

/**
 * Compress image if it exceeds max size
 */
async function compressIfNeeded(filePath, maxSizeMB = 5) {
  const stats = await fs.stat(filePath);
  const originalSize = stats.size;
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (originalSize <= maxBytes || !sharp) {
    return { compressed: false, originalSize, finalSize: originalSize };
  }

  try {
    const buffer = await fs.readFile(filePath);
    const meta = await sharp(buffer).metadata();

    const newWidth = Math.round(meta.width * 0.85);
    let output = await sharp(buffer)
      .resize(newWidth)
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();

    if (output.length > maxBytes) {
      const smallerWidth = Math.round(meta.width * 0.7);
      output = await sharp(buffer)
        .resize(smallerWidth)
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer();
    }

    await fs.writeFile(filePath, output);
    return { compressed: true, originalSize, finalSize: output.length };
  } catch (err) {
    return { compressed: false, originalSize, finalSize: originalSize, error: err.message };
  }
}

/**
 * Capture screenshot for a single viewport
 */
async function captureViewport(page, viewport, outputPath, fullPage = true, maxSize = 5, scrollDelay = DEFAULT_SCROLL_DELAY) {
  await page.setViewport(VIEWPORTS[viewport]);
  await new Promise(r => setTimeout(r, VIEWPORT_SETTLE_DELAY));
  await waitForDomStable(page, 300, 5000);
  await waitForFontsLoaded(page, 3000);
  await waitForStylesStable(page, 200, 2000);

  const componentDimensions = await extractComponentDimensions(page, viewport);

  const lazyStats = await forceLazyImages(page);
  const scrollInfo = await triggerLazyLoad(page, LAZY_LOAD_MAX_ITERATIONS, scrollDelay);
  await forceLazyImages(page);
  const imageStats = await waitForAllImages(page, 15000);

  try {
    await page.waitForNetworkIdle({ timeout: NETWORK_IDLE_TIMEOUT });
  } catch {
    // Timeout ok
  }

  await new Promise(r => setTimeout(r, 2000));
  await waitForDomStable(page, 300, 3000);
  await waitForFontsLoaded(page, 2000);
  const animStats = await forceAnimatedElementsVisible(page);
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: outputPath, type: 'png', fullPage: fullPage });
  const compression = await compressIfNeeded(outputPath, maxSize);

  return {
    viewport,
    path: path.resolve(outputPath),
    dimensions: VIEWPORTS[viewport],
    componentDimensions,
    scrollInfo,
    imageStats,
    size: compression.finalSize,
    compressed: compression.compressed
  };
}

/**
 * Main capture function
 */
async function captureMultiViewport() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    outputError(new Error('--url is required'));
    process.exit(1);
  }
  if (!args.output) {
    outputError(new Error('--output directory is required'));
    process.exit(1);
  }

  const requestedViewports = args.viewports
    ? args.viewports.split(',').map(v => v.trim().toLowerCase())
    : ['desktop', 'tablet', 'mobile'];
  const fullPage = args['full-page'] !== 'false';
  const maxSize = args['max-size'] ? parseFloat(args['max-size']) : 5;
  const scrollDelay = args['scroll-delay'] ? parseInt(args['scroll-delay'], 10) : DEFAULT_SCROLL_DELAY;
  const extractHtml = args['extract-html'] === 'true';
  const extractCss = args['extract-css'] === 'true';
  const filterUnused = args['filter-unused'] !== 'false';

  for (const vp of requestedViewports) {
    if (!VIEWPORTS[vp]) {
      outputError(new Error(`Invalid viewport: ${vp}. Valid: desktop, tablet, mobile`));
      process.exit(1);
    }
  }

  try {
    await fs.mkdir(args.output, { recursive: true });

    const cliHeadless = args.headless === 'true';
    const getHeadlessForViewport = (viewport) => viewport === 'desktop' ? true : cliHeadless;

    let currentHeadless = null;
    let browser = null;
    let page = null;
    let cookieResult = null;

    const initBrowser = async (headless, navigateUrl = null) => {
      if (browser && currentHeadless !== headless) {
        await closeBrowser();
        browser = null;
        page = null;
      }

      if (!browser) {
        browser = await getBrowser({
          headless,
          args: headless ? [] : ['--start-maximized', '--window-position=0,0']
        });
        page = await getPage(browser);
        currentHeadless = headless;

        if (navigateUrl) {
          await page.setViewport(VIEWPORTS.desktop);
          await page.goto(navigateUrl, { waitUntil: ['load', 'networkidle0'], timeout: 60000 });
          await new Promise(r => setTimeout(r, 3000));
          cookieResult = await dismissCookieBanner(page);
          await waitForPageReady(page);
        }
      }
      return { browser, page };
    };

    const firstViewportHeadless = getHeadlessForViewport(requestedViewports[0]);
    await initBrowser(firstViewportHeadless, args.url);

    // Extract HTML/CSS
    let extraction = null;
    const extractionWarnings = [];

    if (extractHtml || extractCss) {
      extraction = { html: null, css: null, warnings: [] };

      if (extractHtml) {
        try {
          const htmlResult = await extractCleanHtml(page, JS_FRAMEWORK_PATTERNS);
          const html = htmlResult.html;
          const htmlSize = Buffer.byteLength(html, 'utf-8');

          if (htmlSize > MAX_HTML_SIZE) {
            throw new Error(`HTML size exceeds ${MAX_HTML_SIZE / 1024 / 1024}MB limit`);
          }

          const htmlPath = path.join(args.output, 'source.html');
          await fs.writeFile(htmlPath, html, 'utf-8');
          extraction.html = { path: path.resolve(htmlPath), size: htmlSize, elementCount: htmlResult.elementCount };
          if (htmlResult.warnings.length > 0) extractionWarnings.push(...htmlResult.warnings);
        } catch (error) {
          extraction.html = { error: error.message, failed: true };
          extractionWarnings.push(`HTML extraction failed: ${error.message}`);
        }
      }

      if (extractCss) {
        try {
          const cssData = await extractAllCss(page, args.url);
          const rawCss = cssData.cssBlocks.map(b => `/* Source: ${b.source} */\n${b.css}`).join('\n\n');
          const cssSize = Buffer.byteLength(rawCss, 'utf-8');

          if (cssSize > MAX_CSS_SIZE) {
            throw new Error(`CSS size exceeds ${MAX_CSS_SIZE / 1024 / 1024}MB limit`);
          }

          const rawCssPath = path.join(args.output, 'source-raw.css');
          await fs.writeFile(rawCssPath, rawCss, 'utf-8');

          extraction.css = {
            path: path.resolve(rawCssPath),
            size: cssSize,
            blocks: cssData.cssBlocks.length,
            totalRules: cssData.totalRules,
            corsBlocked: cssData.corsBlocked,
            computedStyles: cssData.computedStyles
          };

          if (Object.keys(cssData.computedStyles).length > 0) {
            const stylesPath = path.join(args.output, 'computed-styles.json');
            await fs.writeFile(stylesPath, JSON.stringify(cssData.computedStyles, null, 2));
          }

          if (cssData.warnings.length > 0) extractionWarnings.push(...cssData.warnings);
          if (cssData.corsBlocked.length > 0) extractionWarnings.push(`${cssData.corsBlocked.length} CORS-blocked stylesheets`);
        } catch (error) {
          extraction.css = { error: error.message, failed: true };
          extractionWarnings.push(`CSS extraction failed: ${error.message}`);
        }
      }

      // Filter CSS
      if (filterUnused && extraction?.html?.path && extraction?.css?.path && !extraction.html.failed && !extraction.css.failed) {
        try {
          const filteredCssPath = path.join(args.output, 'source.css');
          const filterResult = await filterCssFile(extraction.html.path, extraction.css.path, filteredCssPath, false, args.output);
          extraction.filtered = {
            path: filterResult.output.path,
            size: filterResult.output.size,
            reduction: filterResult.stats.reduction,
            stats: { totalRules: filterResult.stats.totalRules, keptRules: filterResult.stats.keptRules, removedRules: filterResult.stats.removedRules }
          };
          if (process.stderr.isTTY) console.error(`[INFO] CSS filtered: ${filterResult.stats.reduction} reduction`);
        } catch (error) {
          extraction.filtered = { error: error.message, failed: true };
          extractionWarnings.push(`CSS filtering failed: ${error.message}`);
        }
      }

      extraction.warnings = extractionWarnings;
      if (extractionWarnings.length > 0 && process.stderr.isTTY) {
        extractionWarnings.forEach(w => console.error(`[WARN] ${w}`));
      }
    }

    // Capture viewports
    const screenshots = [];
    const browserRestarts = [];
    for (const viewport of requestedViewports) {
      const viewportHeadless = getHeadlessForViewport(viewport);
      if (currentHeadless !== viewportHeadless) {
        browserRestarts.push({ viewport, from: currentHeadless ? 'headless' : 'headed', to: viewportHeadless ? 'headless' : 'headed' });
        if (process.stderr.isTTY) console.error(`[INFO] Switching to ${viewportHeadless ? 'headless' : 'headed'} for ${viewport}`);
        await initBrowser(viewportHeadless, args.url);
      }

      const outputPath = path.join(args.output, `${viewport}.png`);
      const result = await captureViewport(page, viewport, outputPath, fullPage, maxSize, scrollDelay);
      screenshots.push(result);
    }

    // Build dimension output
    const allViewportDimensions = {};
    for (const screenshot of screenshots) {
      if (screenshot.componentDimensions) {
        allViewportDimensions[screenshot.viewport] = screenshot.componentDimensions;
      }
    }

    const dimensionsOutput = buildDimensionsOutput(allViewportDimensions, args.url);
    const dimensionsPath = path.join(args.output, 'component-dimensions.json');
    await fs.writeFile(dimensionsPath, JSON.stringify(dimensionsOutput, null, 2));

    const aiSummary = generateAISummary(dimensionsOutput);
    const summaryPath = path.join(args.output, 'dimensions-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(aiSummary, null, 2));

    const totalContainers = Object.values(dimensionsOutput.viewports).reduce((sum, vp) => sum + (vp.containers?.length || 0), 0);
    const totalCards = Object.values(dimensionsOutput.viewports).reduce((sum, vp) => sum + (vp.cards?.length || 0), 0);
    const totalGrids = Object.values(dimensionsOutput.viewports).reduce((sum, vp) => sum + (vp.gridLayouts?.length || 0), 0);

    if (process.stderr.isTTY) {
      console.error(`[INFO] Extracted: ${totalContainers} containers, ${totalCards} card groups, ${totalGrids} grid layouts`);
    }

    const result = {
      success: true,
      url: args.url,
      outputDir: path.resolve(args.output),
      cookieHandling: cookieResult,
      extraction,
      componentDimensions: {
        full: path.resolve(dimensionsPath),
        summary: path.resolve(summaryPath),
        viewports: Object.keys(dimensionsOutput.viewports),
        stats: { containers: totalContainers, cards: totalCards, gridLayouts: totalGrids,
          typography: Object.values(dimensionsOutput.viewports).reduce((sum, vp) => sum + (vp.typography?.length || 0), 0) }
      },
      screenshots,
      browserRestarts: browserRestarts.length > 0 ? browserRestarts : undefined,
      scrollDelay,
      totalSize: screenshots.reduce((sum, s) => sum + s.size, 0),
      capturedAt: new Date().toISOString()
    };

    outputJSON(result);

    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    process.exit(0);
  } catch (error) {
    outputError(error);
    process.exit(1);
  } finally {
    try { await closeBrowser(); } catch { /* ignore */ }
  }
}

captureMultiViewport();
