/**
 * Section Cropper Helpers
 *
 * Bounds validation and filename sanitization utilities
 * extracted from section-cropper.js to keep each file under 200 lines.
 */

/**
 * Validate and clamp section bounds to image dimensions
 * @param {{x: number, y: number, width: number, height: number}} bounds - Section bounds
 * @param {number} imageWidth - Source image width in pixels
 * @param {number} imageHeight - Source image height in pixels
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function validateBounds(bounds, imageWidth, imageHeight) {
  const left = Math.max(0, Math.round(bounds.x));
  const top = Math.max(0, Math.round(bounds.y));

  const maxWidth = imageWidth - left;
  const maxHeight = imageHeight - top;

  const width = Math.min(Math.round(bounds.width), maxWidth);
  const height = Math.min(Math.round(bounds.height), maxHeight);

  return { left, top, width, height };
}

/**
 * Sanitize a section name for use as a filename component
 * - Lowercased, non-alphanumeric chars replaced with hyphens
 * - Collapsed and trimmed hyphens
 * - Truncated to 50 characters
 * @param {string} name
 * @returns {string}
 */
export function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) || 'unnamed';
}
