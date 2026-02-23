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
import { parseScreenshotArgs, createBrowserManager, VIEWPORTS } from './screenshot-helpers.js';
import { runExtractionPipeline } from './screenshot-extraction.js';
import { runHoverCapture, runVideoCapture, runSectionCapture, runDimensionOutput, writeDomHierarchy } from './screenshot-orchestrator.js';
import { logInfo } from '../../utils/log.js';
import { createProgress } from '../../utils/progress.js';
import { captureViewport } from './screenshot-viewport.js';

// ============================================================================
// Main Orchestration
// ============================================================================

async function captureMultiViewport() {
  const options = parseScreenshotArgs(process.argv.slice(2));
  let {
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
        extractAnimations: extractAnimationsFlag,
        extractComputed: options.extractComputed,
        aggressiveFilter: options.aggressiveFilter
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

    // Breakpoint detection: override viewports with CSS-detected breakpoints
    // Use a local copy to avoid mutating the global VIEWPORTS object (side-effect prevention)
    let localViewports = { ...VIEWPORTS };
    let detectedBreakpoints = null;
    if (options.detectBreakpoints && extraction?.css?.path && !extraction.css.failed) {
      try {
        const rawCss = await fs.readFile(extraction.css.path, 'utf-8');
        const { detectBreakpoints, mergeWithFixed } = await import('../css/breakpoint-detector.js');
        detectedBreakpoints = detectBreakpoints(rawCss);
        const bpPath = path.join(output, 'breakpoints.json');
        await fs.writeFile(bpPath, JSON.stringify(detectedBreakpoints, null, 2));
        if (detectedBreakpoints.breakpoints.length > 0) {
          const mergedViewports = mergeWithFixed(detectedBreakpoints.breakpoints);
          requestedViewports = Object.keys(mergedViewports);
          for (const [name, config] of Object.entries(mergedViewports)) {
            if (!localViewports[name]) localViewports[name] = config;
          }
        }
      } catch { /* breakpoint detection optional, continue with defaults */ }
    }

    // Per-viewport screenshots
    const screenshots = [];
    const browserRestarts = [];
    const allHeadless = requestedViewports.every(vp => getHeadlessForViewport(vp));
    const vpProgress = createProgress();
    vpProgress.start(requestedViewports.length, 'Viewport capture');

    if (allHeadless) {
      // Fast path: single browser session, just resize viewport
      for (const viewport of requestedViewports) {
        vpProgress.step(`Capturing ${viewport}`, `${localViewports[viewport].width}px`);
        screenshots.push(await captureViewport({
          page: browserMgr.getPage(), viewport,
          outputPath: path.join(output, `${viewport}.png`),
          fullPage, maxSize, scrollDelay, viewportMap: localViewports
        }));
      }
    } else {
      // Restart path for mixed headless/headed scenarios
      for (const viewport of requestedViewports) {
        vpProgress.step(`Capturing ${viewport}`, `${localViewports[viewport].width}px`);
        const viewportHeadless = getHeadlessForViewport(viewport);
        if (browserMgr.getCurrentHeadless() !== viewportHeadless) {
          browserRestarts.push({ viewport, from: browserMgr.getCurrentHeadless() ? 'headless' : 'headed', to: viewportHeadless ? 'headless' : 'headed' });
          logInfo(`Switching to ${viewportHeadless ? 'headless' : 'headed'} for ${viewport}`);
          await initBrowser(viewportHeadless, url);
        }
        screenshots.push(await captureViewport({
          page: browserMgr.getPage(), viewport,
          outputPath: path.join(output, `${viewport}.png`),
          fullPage, maxSize, scrollDelay, viewportMap: localViewports
        }));
      }
    }
    vpProgress.complete(`${screenshots.length} viewports captured`);

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

    // Quality score: auto for clone-px, opt-in for basic clone
    const isClonePx = captureHover || options.extractAssets;
    let qualityScore = null;
    if (isClonePx || options.qualityScore) {
      try {
        const { scoreCapture } = await import('../../verification/quality-scorer.js');
        qualityScore = await scoreCapture({
          extraction, screenshots, assetStats: null, outputDir: output
        });
        const scorePath = path.join(output, 'quality-score.json');
        await fs.writeFile(scorePath, JSON.stringify(qualityScore, null, 2));
      } catch { /* quality scoring optional */ }
    }

    outputJSON({
      success: true, url, outputDir: path.resolve(output), cookieHandling: cookieResult,
      extraction,
      qualityScore: qualityScore || undefined,
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
