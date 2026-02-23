#!/usr/bin/env node
/**
 * Multi-viewport screenshot capture for design cloning
 *
 * Usage: node screenshot.js --url <url> --output <dir> [options]
 *
 * Options:
 *   --url, --output, --viewports, --full-page, --max-size, --headless,
 *   --scroll-delay, --close, --extract-html, --extract-css, --filter-unused,
 *   --capture-hover, --video, --video-format, --video-duration,
 *   --section-mode, --no-semantic
 */

import path from 'path';
import fs from 'fs/promises';

import { getBrowser, getPage, closeBrowser, disconnectBrowser } from '../../utils/browser.js';
import { parseArgs, outputJSON, outputError } from '../../utils/helpers.js';
import { parseScreenshotArgs, createBrowserManager } from './screenshot-helpers.js';
import { runExtractionPipeline } from './screenshot-extraction.js';
import { runHoverCapture, runVideoCapture, runSectionCapture, runDimensionOutput, writeDomHierarchy } from './screenshot-orchestrator.js';
import { logInfo } from '../../utils/log.js';
import { captureViewport } from './screenshot-viewport.js';

// ============================================================================
// Main Orchestration
// ============================================================================

async function captureMultiViewport() {
  const options = parseScreenshotArgs(process.argv.slice(2));
  const {
    url, output, viewports: requestedViewports,
    fullPage, maxSize, scrollDelay,
    extractHtml, extractCss, filterUnused,
    captureHover, captureVideo: captureVideoFlag,
    videoFormat, videoDuration, sectionMode,
    enhanceSemantic, extractAnimations: extractAnimationsFlag,
    headless: cliHeadless, close: shouldClose
  } = options;

  try {
    await fs.mkdir(output, { recursive: true });

    const browserMgr = createBrowserManager(cliHeadless);
    const { getHeadlessForViewport, init: initBrowser } = browserMgr;
    await initBrowser(getHeadlessForViewport(requestedViewports[0]), url);

    const cookieResult = browserMgr.getCookieResult();

    // HTML/CSS/animation extraction
    let extraction = null;
    if (extractHtml || extractCss) {
      extraction = await runExtractionPipeline(browserMgr.getPage(), url, output, {
        extractHtml, extractCss, filterUnused, enhanceSemantic,
        extractAnimations: extractAnimationsFlag
      });
    }

    // Hover state capture
    let hoverResult = null;
    if (captureHover) {
      hoverResult = await runHoverCapture(
        browserMgr, extraction, output, url,
        initBrowser, getHeadlessForViewport, requestedViewports
      );
    }

    // Per-viewport screenshots
    const screenshots = [];
    const browserRestarts = [];
    for (const viewport of requestedViewports) {
      const viewportHeadless = getHeadlessForViewport(viewport);
      if (browserMgr.getCurrentHeadless() !== viewportHeadless) {
        browserRestarts.push({ viewport, from: browserMgr.getCurrentHeadless() ? 'headless' : 'headed', to: viewportHeadless ? 'headless' : 'headed' });
        logInfo(`Switching to ${viewportHeadless ? 'headless' : 'headed'} for ${viewport}`);
        await initBrowser(viewportHeadless, url);
      }
      screenshots.push(await captureViewport({
        page: browserMgr.getPage(), viewport,
        outputPath: path.join(output, `${viewport}.png`),
        fullPage, maxSize, scrollDelay
      }));
    }

    // Optional: video, dimensions, DOM hierarchy, sections
    const videoResult = captureVideoFlag
      ? await runVideoCapture(browserMgr, output, videoFormat, videoDuration)
      : null;

    const dimResult = await runDimensionOutput(screenshots, url, output);
    const desktopScreenshot = screenshots.find(s => s.viewport === 'desktop');
    const hierarchyPath = await writeDomHierarchy(desktopScreenshot, output);
    const sectionResult = (sectionMode && desktopScreenshot)
      ? await runSectionCapture(browserMgr, desktopScreenshot, output)
      : null;

    outputJSON({
      success: true, url, outputDir: path.resolve(output), cookieHandling: cookieResult,
      extraction,
      hoverStates: hoverResult && !hoverResult.failed
        ? { directory: hoverResult.directory, detected: hoverResult.detected, captured: hoverResult.captured, summaryPath: hoverResult.summaryPath, generatedCss: hoverResult.generatedCss }
        : (hoverResult?.error ? { error: hoverResult.error } : undefined),
      video: videoResult && !videoResult.failed
        ? { path: videoResult.output, format: videoResult.output.split('.').pop(), duration: videoResult.duration, pageHeight: videoResult.pageHeight, webm: videoResult.webm, mp4: videoResult.mp4, gif: videoResult.gif, conversionError: videoResult.conversionError }
        : (videoResult?.error ? { error: videoResult.error } : undefined),
      componentDimensions: { full: dimResult.dimensionsPath, summary: dimResult.summaryPath, viewports: Object.keys(dimResult.dimensionsOutput.viewports), stats: dimResult.stats },
      domHierarchy: desktopScreenshot?.domHierarchy ? { path: hierarchyPath, stats: desktopScreenshot.domHierarchy.stats } : undefined,
      sections: sectionResult, screenshots,
      browserRestarts: browserRestarts.length > 0 ? browserRestarts : undefined,
      scrollDelay, totalSize: screenshots.reduce((sum, s) => sum + s.size, 0),
      capturedAt: new Date().toISOString()
    });

    if (shouldClose) await closeBrowser(); else await disconnectBrowser();
    process.exit(0);
  } catch (error) {
    outputError(error);
    process.exit(1);
  } finally {
    try { await closeBrowser(); } catch { /* ignore */ }
  }
}

// ============================================================================
// Exports (backward-compatible)
// ============================================================================

export { captureViewport } from './screenshot-viewport.js';
export { compressIfNeeded, parseScreenshotArgs, createBrowserManager, VIEWPORT_SETTLE_DELAY, DEFAULT_SCROLL_DELAY, VIEWPORTS } from './screenshot-helpers.js';

// Run if called directly
if (process.argv[1]?.endsWith('screenshot.js') || process.argv[1]?.includes('screenshot')) {
  captureMultiViewport();
}
