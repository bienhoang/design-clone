/**
 * Shared viewport configurations for Design Clone
 *
 * Two viewport sets are provided:
 * - VIEWPORTS: Standard capture viewports (1440px desktop)
 * - VIEWPORTS_HD: High-resolution verification viewports (1920px desktop)
 */

/**
 * Standard viewport configurations for multi-device capture
 * Used by: screenshot.js, dimension-output.js
 * @type {Object.<string, {width: number, height: number, deviceScaleFactor: number}>}
 */
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 }
};

/**
 * High-resolution viewport configurations for verification
 * Used by: verify-menu.js, verify-layout.js, verify-header.js, verify-footer.js, verify-slider.js
 * @type {Object.<string, {width: number, height: number, deviceScaleFactor: number}>}
 */
export const VIEWPORTS_HD = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 }
};

/**
 * UX Audit viewport configurations (no deviceScaleFactor)
 * Used by: ux-audit.js
 * @type {Object.<string, {width: number, height: number}>}
 */
export const VIEWPORTS_UX = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
};

/**
 * Viewport names array for iteration
 * @type {string[]}
 */
export const VIEWPORT_NAMES = ['desktop', 'tablet', 'mobile'];
