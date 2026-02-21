/**
 * Video Capture Conversion
 *
 * ffmpeg dependency management and WebM-to-MP4/GIF format conversion.
 * Lazy-loads fluent-ffmpeg and @ffmpeg-installer/ffmpeg so the module
 * can be imported without those packages installed.
 *
 * @module video-capture-convert
 */

import fs from 'fs/promises';

// ============================================================================
// Constants
// ============================================================================

/** Formats requiring ffmpeg for conversion */
export const FFMPEG_REQUIRED_FORMATS = ['mp4', 'gif'];

/** GIF output settings */
const GIF_DEFAULT_FPS = 10;
const GIF_DEFAULT_WIDTH = 640;

// ============================================================================
// ffmpeg Dependency Management
// ============================================================================

let ffmpeg = null;
let ffmpegInitialized = false;

/**
 * Initialize ffmpeg dependencies.
 * Lazy-loads fluent-ffmpeg and @ffmpeg-installer/ffmpeg.
 *
 * @returns {Promise<boolean>} True if ffmpeg is available
 */
export async function initFfmpeg() {
  if (ffmpegInitialized) return ffmpeg !== false;

  ffmpegInitialized = true;

  try {
    const [fluentFfmpeg, installer] = await Promise.all([
      import('fluent-ffmpeg'),
      import('@ffmpeg-installer/ffmpeg')
    ]);

    ffmpeg = fluentFfmpeg.default;
    const ffmpegPath = installer.path;
    ffmpeg.setFfmpegPath(ffmpegPath);

    return true;
  } catch (importError) {
    ffmpeg = false;

    if (importError.code !== 'ERR_MODULE_NOT_FOUND') {
      console.error('[video-capture] ffmpeg initialization error:', importError.message);
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
// Input Validation
// ============================================================================

/**
 * Validate output path
 * @param {string} outputPath - Output file/directory path
 * @throws {TypeError} If path is invalid
 */
export function validatePath(outputPath) {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new TypeError('Invalid output path: must be a non-empty string');
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
 * @returns {Promise<{path: string, format: string}>} Conversion result
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
 * @returns {Promise<{path: string, format: string}>} Conversion result
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
    try {
      await fs.unlink(palettePath);
    } catch (cleanupErr) {
      if (process.env.DEBUG) {
        console.error(`[video-capture] Palette cleanup failed: ${cleanupErr.message}`);
      }
    }
  }
}
