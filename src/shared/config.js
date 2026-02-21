/**
 * Centralized configuration constants for design-clone
 * Single source of truth for timeouts, size limits, and CDN URLs
 */

/** Browser timing constants (ms) */
export const TIMING = {
  VIEWPORT_SETTLE_DELAY: 1500,
  NETWORK_IDLE_TIMEOUT: 8000,
  POST_NAVIGATION_DELAY: 3000,
  POST_RESIZE_DELAY: 2000,
  VERIFICATION_DELAY: 500,
};

/** Size limits (bytes) */
export const SIZE_LIMITS = {
  MAX_CSS_INPUT: 10 * 1024 * 1024,   // 10MB
  MAX_STATE: 1024 * 1024,             // 1MB
};

/** CDN URLs */
export const CDN = {
  FONT_AWESOME_VERSION: '6.5.1',
  FONT_AWESOME_CSS: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  GOSNAP_WIDGET_VERSION: '1.0.1',
};

/** Layout constants */
export const LAYOUT = {
  SIDEBAR_MAX_WIDTH: 400,
};
