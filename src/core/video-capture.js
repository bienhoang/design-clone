/**
 * Video Capture Module
 *
 * Record scrolling interactions and CSS animations using Playwright's
 * context-level video recording. Optionally convert WebM to MP4/GIF using ffmpeg.
 *
 * Usage:
 *   import { captureVideo, hasFfmpeg } from './video-capture.js';
 *   const result = await captureVideo(page, outputDir, { format: 'webm' });
 *
 * @module video-capture
 */

import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// Constants
// ============================================================================

/** Default recording duration in milliseconds */
const DEFAULT_DURATION = 12000;

/** Default hold time at top/bottom of scroll */
const DEFAULT_HOLD_MS = 500;

/** Formats requiring ffmpeg for conversion */
const FFMPEG_REQUIRED_FORMATS = ['mp4', 'gif'];

/** GIF output settings */
const GIF_DEFAULT_FPS = 10;
const GIF_DEFAULT_WIDTH = 640;

/** Maximum scroll steps to prevent memory exhaustion on very large pages */
const MAX_SCROLL_STEPS = 100;

/** Viewport overlap fraction for scroll step calculation */
const VIEWPORT_OVERLAP_FRACTION = 0.5;

/** Default viewport for video recording */
const DEFAULT_VIDEO_VIEWPORT = { width: 1440, height: 900 };

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} RecordOptions
 * @property {number} [duration=12000] - Total recording duration in ms
 * @property {number} [scrollPauseMs=50] - Pause between scroll steps for smoothness
 * @property {number} [holdTopMs=500] - Hold time at page top
 * @property {number} [holdBottomMs=500] - Hold time at page bottom
 * @property {{width: number, height: number}} [viewport] - Viewport dimensions
 */

/**
 * @typedef {Object} RecordResult
 * @property {string} path - Output file path
 * @property {string} format - Output format ('webm')
 * @property {number} duration - Actual recording duration in ms
 * @property {number} scrollSteps - Number of scroll steps taken
 * @property {number} pageHeight - Total page height in pixels
 */

/**
 * @typedef {Object} ConvertResult
 * @property {string} path - Output file path
 * @property {string} format - Output format ('mp4' | 'gif')
 */

/**
 * @typedef {Object} CaptureOptions
 * @property {'webm'|'mp4'|'gif'} [format='webm'] - Output format
 * @property {number} [duration=12000] - Recording duration in ms
 * @property {string} [filename='preview'] - Output filename (without extension)
 */

/**
 * @typedef {Object} CaptureResult
 * @property {string} webm - Path to WebM file (always created)
 * @property {string} [mp4] - Path to MP4 file (if format='mp4')
 * @property {string} [gif] - Path to GIF file (if format='gif')
 * @property {string} output - Path to final output file
 * @property {number} duration - Recording duration in ms
 * @property {number} pageHeight - Total page height in pixels
 * @property {string} [conversionError] - Error message if conversion failed
 */

// ============================================================================
// ffmpeg Dependency Management
// ============================================================================

/**
 * ffmpeg module references
 * Loaded dynamically to handle missing optional dependency gracefully
 */
let ffmpeg = null;
let ffmpegPath = null;
let ffmpegInitialized = false;

/**
 * Initialize ffmpeg dependencies.
 * Lazy-loads fluent-ffmpeg and @ffmpeg-installer/ffmpeg.
 *
 * @returns {Promise<boolean>} True if ffmpeg is available
 */
async function initFfmpeg() {
  if (ffmpegInitialized) {
    return ffmpeg !== false;
  }

  ffmpegInitialized = true;

  try {
    const [fluentFfmpeg, installer] = await Promise.all([
      import('fluent-ffmpeg'),
      import('@ffmpeg-installer/ffmpeg')
    ]);

    ffmpeg = fluentFfmpeg.default;
    ffmpegPath = installer.path;
    ffmpeg.setFfmpegPath(ffmpegPath);

    return true;
  } catch (importError) {
    // Mark as unavailable
    ffmpeg = false;

    const isModuleNotFound = importError.code === 'ERR_MODULE_NOT_FOUND';
    if (!isModuleNotFound) {
      // Unexpected error
      console.error(
        '[video-capture] ffmpeg initialization error:',
        importError.message
      );
    }

    return false;
  }
}

/**
 * Check if ffmpeg is available for video conversion.
 *
 * @returns {Promise<boolean>} True if ffmpeg dependencies are available
 */
export async function hasFfmpeg() {
  return await initFfmpeg();
}

// ============================================================================
// Logging Helper
// ============================================================================

/**
 * Log message to stderr if running in TTY
 * @param {string} message - Message to log
 */
function log(message) {
  if (process.stderr.isTTY) {
    console.error(message);
  }
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate page object (Playwright page)
 * @param {import('playwright').Page} page - Playwright page object
 * @throws {TypeError} If page is invalid
 */
function validatePage(page) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError('Invalid page object: must be a Playwright page');
  }
  // Playwright-specific check
  if (typeof page.context !== 'function') {
    throw new TypeError('Invalid page object: missing context() method');
  }
}

/**
 * Validate output path
 * @param {string} outputPath - Output file/directory path
 * @throws {TypeError} If path is invalid
 */
function validatePath(outputPath) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new TypeError('Invalid output path: must be a non-empty string');
  }
}

// ============================================================================
// Scroll Recording (Playwright Context-Level Video)
// ============================================================================

/**
 * Record page scroll interaction using Playwright context-level video.
 *
 * Creates a new browser context with video recording enabled, navigates to
 * the page URL, performs scroll animation, then closes to finalize video.
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @param {string} pageUrl - URL to navigate and record
 * @param {string} outputDir - Directory for video output
 * @param {RecordOptions} [options={}] - Recording options
 * @returns {Promise<RecordResult>} Recording result with metadata
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

  // Create context with video recording enabled
  const context = await browser.newContext({
    recordVideo: {
      dir: outputDir,
      size: viewport
    },
    viewport
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    // Navigate to page
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Get page dimensions
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

    // Ensure at top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await new Promise(r => setTimeout(r, 200));

    // Hold at top
    await new Promise(r => setTimeout(r, holdTopMs));

    if (isScrollable && scrollSteps > 0) {
      // Scroll down
      for (let i = 1; i <= scrollSteps; i++) {
        const y = (i / scrollSteps) * scrollDistance;
        await page.evaluate(scrollY => window.scrollTo({ top: scrollY, behavior: 'instant' }), y);
        await new Promise(r => setTimeout(r, scrollDelay));
      }

      // Hold at bottom
      await new Promise(r => setTimeout(r, holdBottomMs));

      // Scroll back up
      for (let i = scrollSteps - 1; i >= 0; i--) {
        const y = (i / scrollSteps) * scrollDistance;
        await page.evaluate(scrollY => window.scrollTo({ top: scrollY, behavior: 'instant' }), y);
        await new Promise(r => setTimeout(r, scrollDelay));
      }

      // Hold at top
      await new Promise(r => setTimeout(r, holdTopMs));
    } else {
      // Single-screen: hold for duration
      await new Promise(r => setTimeout(r, scrollTime + holdBottomMs));
    }

    const actualDuration = Date.now() - startTime;

    // IMPORTANT: Close page before getting video path (Playwright requirement)
    await page.close();

    // Get video path (only available after page close)
    const video = page.video();
    const videoPath = video ? await video.path() : null;

    // Cleanup context
    await context.close();

    if (!videoPath) {
      throw new Error('Video recording failed - no path returned');
    }

    return {
      path: videoPath,
      format: 'webm',
      duration: actualDuration,
      scrollSteps,
      pageHeight: totalHeight
    };

  } catch (error) {
    // Cleanup on error
    try {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    } catch { /* ignore cleanup errors */ }
    throw error;
  }
}

// ============================================================================
// Format Conversion
// ============================================================================

/**
 * Convert WebM to MP4 using ffmpeg.
 *
 * Uses H.264 codec with settings optimized for web playback:
 * - libx264 encoder with fast preset
 * - CRF 23 for good quality/size balance
 * - yuv420p pixel format for iOS/Safari compatibility
 * - faststart flag for progressive playback
 *
 * @param {string} inputPath - Path to WebM file
 * @param {string} outputPath - Path for MP4 output
 * @returns {Promise<ConvertResult>} Conversion result
 * @throws {Error} If ffmpeg is not available or conversion fails
 */
export async function convertToMp4(inputPath, outputPath) {
  validatePath(inputPath);
  validatePath(outputPath);

  const hasFf = await initFfmpeg();
  if (!hasFf) {
    throw new Error(
      'ffmpeg not available. Install: npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg'
    );
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('end', () => resolve({ path: outputPath, format: 'mp4' }))
      .on('error', (err) => reject(new Error(`MP4 conversion failed: ${err.message}`)))
      .run();
  });
}

/**
 * Convert WebM to GIF using ffmpeg.
 *
 * Uses two-pass conversion with palette generation for high-quality output:
 * 1. Generate optimized palette from video
 * 2. Create GIF using palette with dithering
 *
 * @param {string} inputPath - Path to WebM file
 * @param {string} outputPath - Path for GIF output
 * @param {Object} [options={}] - GIF options
 * @param {number} [options.fps=10] - Output frame rate
 * @param {number} [options.width=640] - Output width (height auto-calculated)
 * @returns {Promise<ConvertResult>} Conversion result
 * @throws {Error} If ffmpeg is not available or conversion fails
 */
export async function convertToGif(inputPath, outputPath, options = {}) {
  validatePath(inputPath);
  validatePath(outputPath);

  const { fps = GIF_DEFAULT_FPS, width = GIF_DEFAULT_WIDTH } = options;

  const hasFf = await initFfmpeg();
  if (!hasFf) {
    throw new Error(
      'ffmpeg not available. Install: npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg'
    );
  }

  // Palette path for two-pass conversion
  const palettePath = inputPath.replace(/\.webm$/i, '-palette.png');

  try {
    // Pass 1: Generate palette
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf',
          `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`
        ])
        .output(palettePath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`Palette generation failed: ${err.message}`)))
        .run();
    });

    // Pass 2: Create GIF with palette
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .input(palettePath)
        .complexFilter([
          `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`GIF creation failed: ${err.message}`)))
        .run();
    });

    return { path: outputPath, format: 'gif' };
  } finally {
    // Cleanup palette file
    try {
      await fs.unlink(palettePath);
    } catch (cleanupErr) {
      if (process.env.DEBUG) {
        console.error(`[video-capture] Palette cleanup failed: ${cleanupErr.message}`);
      }
    }
  }
}

// ============================================================================
// Main Capture Function
// ============================================================================

/**
 * Capture video of page scroll interaction.
 *
 * Creates a new browser context for recording (Playwright requirement),
 * records page scrolling, and optionally converts to MP4 or GIF.
 * WebM is always created first (native Playwright format).
 *
 * @param {import('playwright').Page} page - Playwright page (used for browser reference and URL)
 * @param {string} outputDir - Directory for output files
 * @param {CaptureOptions} [options={}] - Capture options
 * @returns {Promise<CaptureResult>} Capture result with file paths
 */
export async function captureVideo(page, outputDir, options = {}) {
  validatePage(page);
  validatePath(outputDir);

  const {
    format = 'webm',
    duration = DEFAULT_DURATION,
    filename = 'preview'
  } = options;

  // Get browser and current URL from page
  const browser = page.context().browser();
  const pageUrl = page.url();
  const viewport = page.viewportSize() || DEFAULT_VIDEO_VIEWPORT;

  if (!browser) {
    throw new Error('Cannot get browser from page. Ensure page has browser context.');
  }

  // Record using new context (Playwright context-level video)
  log('[video] Recording scroll...');
  const recordResult = await recordScroll(browser, pageUrl, outputDir, {
    duration,
    viewport
  });
  log(`[video] Recorded ${(recordResult.duration / 1000).toFixed(1)}s`);

  // Rename video file to expected name (Playwright auto-generates random name)
  const expectedPath = path.join(outputDir, `${filename}.webm`);
  if (recordResult.path !== expectedPath) {
    try {
      await fs.rename(recordResult.path, expectedPath);
      recordResult.path = expectedPath;
    } catch (renameErr) {
      // If rename fails, keep original path
      log(`[video] Could not rename video: ${renameErr.message}`);
    }
  }

  /** @type {CaptureResult} */
  const result = {
    webm: recordResult.path,
    duration: recordResult.duration,
    pageHeight: recordResult.pageHeight,
    output: recordResult.path
  };

  // Convert if needed (ffmpeg logic unchanged)
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

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_DURATION,
  FFMPEG_REQUIRED_FORMATS,
  MAX_SCROLL_STEPS,
  VIEWPORT_OVERLAP_FRACTION
};
