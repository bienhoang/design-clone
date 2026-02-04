/**
 * Section Cropper
 *
 * Crop full-page screenshot into individual section images using Sharp.
 * Uses section bounds from section-detector.js.
 *
 * Usage:
 *   import { cropSections } from './section-cropper.js';
 *   const results = await cropSections(screenshotPath, sections, outputDir);
 */

import path from 'path';
import fs from 'fs/promises';

// Try to import Sharp
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  // Sharp not available
}

// Default configuration
const DEFAULT_OPTIONS = {
  minHeight: 100,        // Skip sections smaller than this
  quality: 90,           // PNG quality
  compressionLevel: 6,   // PNG compression (0-9)
  format: 'png'          // Output format
};

/**
 * Crop sections from a full-page screenshot
 * @param {string} screenshotPath - Path to full screenshot
 * @param {Array} sections - Array of section objects with bounds
 * @param {string} outputDir - Base output directory
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of cropped section info
 */
export async function cropSections(screenshotPath, sections, outputDir, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Check Sharp availability
  if (!sharp) {
    throw new Error('Sharp is not installed. Run: npm install sharp');
  }

  // Create sections directory
  const sectionsDir = path.join(outputDir, 'sections');
  await fs.mkdir(sectionsDir, { recursive: true });

  // Get source image metadata
  const metadata = await sharp(screenshotPath).metadata();
  const imageWidth = metadata.width;
  const imageHeight = metadata.height;

  const results = [];
  const skipped = [];

  for (const section of sections) {
    // Validate and clamp bounds
    const bounds = validateBounds(section.bounds, imageWidth, imageHeight);

    // Skip tiny sections
    if (bounds.height < config.minHeight) {
      skipped.push({
        index: section.index,
        name: section.name,
        reason: `Height ${bounds.height}px < ${config.minHeight}px minimum`
      });
      continue;
    }

    // Skip zero-dimension sections
    if (bounds.width <= 0 || bounds.height <= 0) {
      skipped.push({
        index: section.index,
        name: section.name,
        reason: 'Zero or negative dimensions'
      });
      continue;
    }

    // Generate output filename
    const safeName = sanitizeName(section.name);
    const filename = `section-${section.index}-${safeName}.png`;
    const outputPath = path.join(sectionsDir, filename);

    try {
      // Crop and save
      await sharp(screenshotPath)
        .extract({
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height
        })
        .png({
          quality: config.quality,
          compressionLevel: config.compressionLevel
        })
        .toFile(outputPath);

      results.push({
        index: section.index,
        name: section.name,
        filename,
        path: outputPath,
        relativePath: path.join('sections', filename),
        bounds: {
          x: bounds.left,
          y: bounds.top,
          width: bounds.width,
          height: bounds.height
        },
        role: section.role || 'unknown',
        selector: section.selector || null
      });
    } catch (err) {
      skipped.push({
        index: section.index,
        name: section.name,
        reason: `Crop error: ${err.message}`
      });
    }
  }

  // Write summary JSON
  const summary = {
    source: path.basename(screenshotPath),
    sourceWidth: imageWidth,
    sourceHeight: imageHeight,
    sectionsCount: results.length,
    skippedCount: skipped.length,
    sections: results,
    skipped: skipped.length > 0 ? skipped : undefined,
    createdAt: new Date().toISOString()
  };

  const summaryPath = path.join(sectionsDir, 'sections.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  return {
    sections: results,
    skipped,
    summary: summaryPath,
    directory: sectionsDir
  };
}

/**
 * Validate and clamp bounds to image dimensions
 * @param {Object} bounds - Section bounds {x, y, width, height}
 * @param {number} imageWidth - Source image width
 * @param {number} imageHeight - Source image height
 * @returns {Object} Validated bounds {left, top, width, height}
 */
function validateBounds(bounds, imageWidth, imageHeight) {
  // Clamp starting position
  const left = Math.max(0, Math.round(bounds.x));
  const top = Math.max(0, Math.round(bounds.y));

  // Calculate max possible dimensions
  const maxWidth = imageWidth - left;
  const maxHeight = imageHeight - top;

  // Clamp dimensions
  const width = Math.min(Math.round(bounds.width), maxWidth);
  const height = Math.min(Math.round(bounds.height), maxHeight);

  return { left, top, width, height };
}

/**
 * Sanitize section name for filename
 * @param {string} name - Section name
 * @returns {string} Safe filename
 */
function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'unnamed';
}

/**
 * Check if Sharp is available
 * @returns {boolean}
 */
export function isSharpAvailable() {
  return sharp !== null;
}

/**
 * Get cropper summary for logging
 * @param {Object} result - Result from cropSections
 * @returns {Object} Summary object
 */
export function getCropperSummary(result) {
  return {
    cropped: result.sections.length,
    skipped: result.skipped.length,
    directory: result.directory,
    totalSize: result.sections.reduce((sum, s) => sum + (s.bounds.width * s.bounds.height), 0)
  };
}

export { DEFAULT_OPTIONS };
