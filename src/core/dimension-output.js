/**
 * Dimension Output Builder
 *
 * Build and format component dimension output for JSON files.
 * Includes sanitization, cross-viewport summary, and AI-friendly format.
 * AI summary generation lives in dimension-output-ai-summary.js.
 */

import { VIEWPORTS } from '../shared/viewports.js';
export { generateAISummary } from './dimension-output-ai-summary.js';

/**
 * Build final component-dimensions.json output with proper schema.
 * @param {Object} allViewportDimensions - Dimensions from all viewports
 * @param {string} url - Source URL
 * @returns {Object} Final JSON structure
 */
export function buildDimensionsOutput(allViewportDimensions, url) {
  const output = {
    meta: {
      version: '1.0',
      extractedAt: new Date().toISOString(),
      url,
      tool: 'design-clone/screenshot.js'
    },
    viewports: {},
    summary: {}
  };

  for (const [vpName, vpData] of Object.entries(allViewportDimensions)) {
    output.viewports[vpName] = sanitizeViewportData(vpData, vpName);
  }

  output.summary = buildCrossViewportSummary(output.viewports);
  return output;
}

/**
 * Sanitize viewport data for JSON output.
 * Rounds numbers, truncates long strings, and limits array sizes.
 * @param {Object} data - Raw viewport dimension data
 * @param {string} vpName - Viewport name key
 * @returns {Object}
 */
export function sanitizeViewportData(data, vpName) {
  if (!data) return {};

  const clean  = JSON.parse(JSON.stringify(data));
  clean.width  = VIEWPORTS[vpName]?.width  || 0;
  clean.height = VIEWPORTS[vpName]?.height || 0;

  function roundNumbers(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'number') {
        obj[key] = Math.round(obj[key]);
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach(item => roundNumbers(item));
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        roundNumbers(obj[key]);
      }
    }
    return obj;
  }

  function truncateStrings(obj, maxLen = 80) {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].length > maxLen) {
        obj[key] = obj[key].slice(0, maxLen) + '...';
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach(item => truncateStrings(item, maxLen));
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        truncateStrings(obj[key], maxLen);
      }
    }
    return obj;
  }

  // Limit array sizes for token efficiency
  if (clean.containers && clean.containers.length > 15) clean.containers = clean.containers.slice(0, 15);
  if (clean.images     && clean.images.length     > 10) clean.images     = clean.images.slice(0, 10);
  if (clean.buttons    && clean.buttons.length     > 10) clean.buttons    = clean.buttons.slice(0, 10);

  return truncateStrings(roundNumbers(clean));
}

/**
 * Build cross-viewport summary for AI consumption.
 * Includes section-aware typography and container data.
 * @param {Object} viewports - Viewport data keyed by name (desktop, tablet, mobile)
 * @returns {Object} Summary
 */
export function buildCrossViewportSummary(viewports) {
  const summary = {
    maxContainerWidth: 0,
    commonGap: 0,
    breakpoints: {
      desktop: VIEWPORTS.desktop.width,
      tablet:  VIEWPORTS.tablet.width,
      mobile:  VIEWPORTS.mobile.width
    },
    typography: { h1: {}, h2: {}, h3: {}, body: {} },
    typographyBySection: { hero: {}, content: {}, header: {}, footer: {}, sidebar: {} },
    cardPatterns: { totalGroups: 0, avgCardSize: null },
    sections: {
      hero:    { found: false, containerWidth: null },
      content: { found: false, containerWidth: null },
      header:  { found: false, containerWidth: null },
      footer:  { found: false, containerWidth: null },
      sidebar: { found: false, width: null }
    }
  };

  for (const [vpName, vpData] of Object.entries(viewports)) {
    if (!vpData) continue;

    // Container section mapping
    if (vpData.containers) {
      for (const container of vpData.containers) {
        if (container.width > summary.maxContainerWidth) {
          summary.maxContainerWidth = container.width;
        }
        const section = container.section || 'content';
        if (summary.sections[section]) {
          summary.sections[section].found = true;
          if (section === 'sidebar') {
            if (!summary.sections[section].width || container.width > summary.sections[section].width) {
              summary.sections[section].width = container.width;
            }
          } else {
            if (!summary.sections[section].containerWidth || container.width > summary.sections[section].containerWidth) {
              summary.sections[section].containerWidth = container.width;
            }
          }
        }
      }
    }

    // Typography by section
    if (vpData.typography) {
      for (const typo of vpData.typography) {
        const tag     = typo.selector?.toLowerCase();
        const section = typo.section || 'content';

        // Flat typography (backward compat)
        if (tag === 'h1' && !summary.typography.h1[vpName])   summary.typography.h1[vpName]   = typo.fontSize;
        if (tag === 'h2' && !summary.typography.h2[vpName])   summary.typography.h2[vpName]   = typo.fontSize;
        if (tag === 'h3' && !summary.typography.h3[vpName])   summary.typography.h3[vpName]   = typo.fontSize;
        if (tag === 'p'  && !summary.typography.body[vpName]) summary.typography.body[vpName] = typo.fontSize;

        // Section-aware typography
        if (!summary.typographyBySection[section]) summary.typographyBySection[section] = {};
        if (!summary.typographyBySection[section][tag]) summary.typographyBySection[section][tag] = {};
        if (!summary.typographyBySection[section][tag][vpName]) {
          summary.typographyBySection[section][tag][vpName] = typo.fontSize;
        }
      }
    }

    // Card patterns
    if (vpData.cards && vpData.cards.length > 0) {
      summary.cardPatterns.totalGroups += vpData.cards.length;
      if (vpName === 'desktop' && vpData.cards[0]?.avgDimensions) {
        summary.cardPatterns.avgCardSize = vpData.cards[0].avgDimensions;
      }
      const gaps = vpData.cards.map(g => g.gap).filter(g => g > 0);
      if (gaps.length > 0) {
        summary.commonGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }
    }
  }

  return summary;
}
