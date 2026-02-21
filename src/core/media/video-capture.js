/**
 * Video Capture Module
 *
 * Record scrolling interactions using Playwright's context-level video
 * recording. Optionally converts WebM to MP4/GIF via video-capture-convert.js.
 *
 * Usage:
 *   import { captureVideo, hasFfmpeg } from './video-capture.js';
 *   const result = await captureVideo(page, outputDir, { format: 'webm' });
 *
 * @module video-capture
 */

import path from 'path';
import fs from 'fs/promises';

import { hasFfmpeg, convertToMp4, convertToGif, validatePath, FFMPEG_REQUIRED_FORMATS } from './video-capture-convert.js';

const DEFAULT_DURATION = 12000;        // ms
const DEFAULT_HOLD_MS = 500;           // hold at top/bottom of scroll
const MAX_SCROLL_STEPS = 100;          // cap to avoid memory exhaustion
const VIEWPORT_OVERLAP_FRACTION = 0.5; // fraction of viewport per scroll step
const DEFAULT_VIDEO_VIEWPORT = { width: 1440, height: 900 };

/** Log to stderr when running in TTY. */
function log(message) {
  if (process.stderr.isTTY) console.error(message);
}

/** Validate that page is a Playwright page instance. */
function validatePage(page) {
  if (!page || typeof page.evaluate !== 'function') throw new TypeError('Invalid page object: must be a Playwright page');
  if (typeof page.context !== 'function') throw new TypeError('Invalid page object: missing context() method');
}

/**
 * Record page scroll using a new Playwright context with video enabled.
 * IMPORTANT: page must be closed before calling video.path() (Playwright requirement).
 * @param {import('playwright').Browser} browser
 * @param {string} pageUrl
 * @param {string} outputDir
 * @param {{duration?, scrollPauseMs?, holdTopMs?, holdBottomMs?, viewport?}} [options]
 * @returns {Promise<{path, format, duration, scrollSteps, pageHeight}>}
 */
export async function recordScroll(browser, pageUrl, outputDir, options = {}) {
  if (!browser || typeof browser.newContext !== 'function') {
    throw new TypeError('Invalid browser: must be a Playwright browser instance');
  }
  validatePath(outputDir);

  const {
    duration = DEFAULT_DURATION,
    scrollPauseMs = 50,
    holdTopMs = DEFAULT_HOLD_MS,
    holdBottomMs = DEFAULT_HOLD_MS,
    viewport = DEFAULT_VIDEO_VIEWPORT
  } = options;

  const context = await browser.newContext({
    recordVideo: { dir: outputDir, size: viewport },
    viewport
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const totalHeight = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
    );

    const viewportHeight = viewport.height;
    const scrollDistance = Math.max(0, totalHeight - viewportHeight);
    const isScrollable = scrollDistance > 0;

    const rawScrollSteps = isScrollable
      ? Math.ceil(scrollDistance / (viewportHeight * VIEWPORT_OVERLAP_FRACTION))
      : 0;
    const scrollSteps = Math.min(rawScrollSteps, MAX_SCROLL_STEPS);

    const scrollTime = duration - holdTopMs - holdBottomMs;
    const scrollDelay = scrollSteps > 0
      ? Math.max(scrollPauseMs, Math.floor(scrollTime / (scrollSteps * 2)))
      : 0;

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await new Promise(r => setTimeout(r, 200 + holdTopMs));

    if (isScrollable && scrollSteps > 0) {
      const scroll = (i) => page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), (i / scrollSteps) * scrollDistance);
      for (let i = 1; i <= scrollSteps; i++) { await scroll(i); await new Promise(r => setTimeout(r, scrollDelay)); }
      await new Promise(r => setTimeout(r, holdBottomMs));
      for (let i = scrollSteps - 1; i >= 0; i--) { await scroll(i); await new Promise(r => setTimeout(r, scrollDelay)); }
      await new Promise(r => setTimeout(r, holdTopMs));
    } else {
      await new Promise(r => setTimeout(r, scrollTime + holdBottomMs));
    }

    const actualDuration = Date.now() - startTime;
    // IMPORTANT: Close page before video.path() (Playwright requirement)
    await page.close();
    const video = page.video();
    const videoPath = video ? await video.path() : null;
    await context.close();
    if (!videoPath) throw new Error('Video recording failed - no path returned');
    return { path: videoPath, format: 'webm', duration: actualDuration, scrollSteps, pageHeight: totalHeight };

  } catch (error) {
    try {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    } catch { /* ignore cleanup errors */ }
    throw error;
  }
}

/**
 * Capture scroll video. Records WebM via new browser context, optionally converts to MP4/GIF.
 * @param {import('playwright').Page} page - source of browser + URL
 * @param {string} outputDir
 * @param {{'webm'|'mp4'|'gif'} format?, number duration?, string filename?} [options]
 * @returns {Promise<{webm, mp4?, gif?, output, duration, pageHeight, conversionError?}>}
 */
export async function captureVideo(page, outputDir, options = {}) {
  validatePage(page);
  validatePath(outputDir);

  const { format = 'webm', duration = DEFAULT_DURATION, filename = 'preview' } = options;

  const browser = page.context().browser();
  const pageUrl = page.url();
  const viewport = page.viewportSize() || DEFAULT_VIDEO_VIEWPORT;

  if (!browser) {
    throw new Error('Cannot get browser from page. Ensure page has browser context.');
  }

  log('[video] Recording scroll...');
  const recordResult = await recordScroll(browser, pageUrl, outputDir, { duration, viewport });
  log(`[video] Recorded ${(recordResult.duration / 1000).toFixed(1)}s`);

  // Rename to expected filename (Playwright auto-generates random names)
  const expectedPath = path.join(outputDir, `${filename}.webm`);
  if (recordResult.path !== expectedPath) {
    try {
      await fs.rename(recordResult.path, expectedPath);
      recordResult.path = expectedPath;
    } catch (renameErr) {
      log(`[video] Could not rename video: ${renameErr.message}`);
    }
  }

  const result = {
    webm: recordResult.path,
    duration: recordResult.duration,
    pageHeight: recordResult.pageHeight,
    output: recordResult.path
  };

  if (format === 'mp4') {
    const mp4Path = path.join(outputDir, `${filename}.mp4`);
    log('[video] Converting to MP4...');
    try {
      await convertToMp4(recordResult.path, mp4Path);
      result.mp4 = mp4Path;
      result.output = mp4Path;
      log('[video] MP4 conversion complete');
    } catch (e) {
      log(`[video] MP4 conversion failed: ${e.message}`);
      result.conversionError = e.message;
    }
  } else if (format === 'gif') {
    const gifPath = path.join(outputDir, `${filename}.gif`);
    log('[video] Converting to GIF...');
    try {
      await convertToGif(recordResult.path, gifPath);
      result.gif = gifPath;
      result.output = gifPath;
      log('[video] GIF conversion complete');
    } catch (e) {
      log(`[video] GIF conversion failed: ${e.message}`);
      result.conversionError = e.message;
    }
  }

  return result;
}

// Re-exports for backward compatibility
export {
  hasFfmpeg,
  convertToMp4,
  convertToGif,
  FFMPEG_REQUIRED_FORMATS,
  DEFAULT_DURATION,
  MAX_SCROLL_STEPS,
  VIEWPORT_OVERLAP_FRACTION
};
