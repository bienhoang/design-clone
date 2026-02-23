/**
 * CSS Breakpoint Detector
 *
 * Extracts responsive breakpoint widths from @media queries in CSS.
 * Used by --detect-breakpoints flag to capture at actual design breakpoints
 * instead of fixed viewport widths.
 */

import { VIEWPORTS } from '../../shared/viewports.js';

const MEDIA_WIDTH_RE = /\(\s*(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|em|rem)\s*\)/g;
const EM_TO_PX = 16;
const MAX_BREAKPOINTS = 6;
const DESKTOP_BASELINE = 1440;

/**
 * Extract breakpoint widths from CSS @media queries
 * @param {string} cssContent - Raw CSS string
 * @returns {{ breakpoints: number[], mediaQueries: Array<{query: string, width: number}> }}
 */
export function detectBreakpoints(cssContent) {
  const widths = new Set();
  const queries = [];
  let match;

  // Find all @media blocks and extract width values
  const mediaRe = /@media\s*([^{]+)\{/g;
  while ((match = mediaRe.exec(cssContent)) !== null) {
    const query = match[1].trim();
    let widthMatch;
    MEDIA_WIDTH_RE.lastIndex = 0;

    while ((widthMatch = MEDIA_WIDTH_RE.exec(query)) !== null) {
      let px = parseFloat(widthMatch[1]);
      const unit = widthMatch[2];

      if (unit === 'em' || unit === 'rem') px = Math.round(px * EM_TO_PX);
      if (px >= 320 && px <= 2560) {
        widths.add(px);
        queries.push({ query, width: px });
      }
    }
  }

  const sorted = [...widths].sort((a, b) => a - b).slice(0, MAX_BREAKPOINTS);
  return { breakpoints: sorted, mediaQueries: queries };
}

/**
 * Replace fixed viewports with detected breakpoints, keep desktop baseline.
 * @param {number[]} detected - Detected widths
 * @returns {Object} Viewport configs keyed by name
 */
export function mergeWithFixed(detected) {
  const all = [...new Set([DESKTOP_BASELINE, ...detected])].sort((a, b) => b - a);
  const capped = all.slice(0, MAX_BREAKPOINTS);
  const result = {};

  for (const w of capped) {
    const existing = Object.entries(VIEWPORTS).find(([, v]) => v.width === w);
    const name = existing ? existing[0] : `bp-${w}`;
    result[name] = { width: w, height: Math.round(w * 0.625), deviceScaleFactor: 1 };
  }

  return result;
}
