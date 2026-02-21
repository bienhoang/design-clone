/**
 * Section Detector
 *
 * Detect semantic page sections from DOM hierarchy for section-based
 * screenshot analysis. Returns bounding boxes for cropping.
 *
 * Usage:
 *   import { detectSections } from './section-detector.js';
 *   const sections = await detectSections(page, { padding: 40 });
 *
 * Strategies (in order):
 * 1. Semantic HTML: <header>, <main>, <section>, <footer>
 * 2. data-section attributes
 * 3. Class patterns: hero, services, features, about, contact
 * 4. Large direct children of <main> or <body> (>200px height)
 * 5. Fallback: viewport chunking if <minSections detected
 */

import {
  DEFAULT_OPTIONS,
  SECTION_CLASS_PATTERNS,
  mergeSections,
  applyPadding,
  getSectionSummary
} from './section-detector-utils.js';

import {
  findSemanticSections,
  findClassPatternSections,
  findLargeChildSections,
  generateViewportChunks
} from './section-detector-strategies.js';

// Re-export for backward compatibility
export { DEFAULT_OPTIONS, SECTION_CLASS_PATTERNS, getSectionSummary };

/**
 * Detect page sections from DOM hierarchy
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of section objects with bounds
 */
export async function detectSections(page, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const pageDimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    )
  }));

  // Strategy 1: Semantic HTML sections
  let sections = await findSemanticSections(page, pageDimensions, config);

  // Strategy 2: Class pattern matching
  if (sections.length < config.minSections) {
    const classSections = await findClassPatternSections(page, pageDimensions, config);
    sections = mergeSections(sections, classSections);
  }

  // Strategy 3: Large direct children
  if (sections.length < config.minSections) {
    const largeSections = await findLargeChildSections(page, pageDimensions, config);
    sections = mergeSections(sections, largeSections);
  }

  // Strategy 4: Viewport chunking fallback
  if (sections.length < config.minSections && config.fallbackToViewport) {
    sections = generateViewportChunks(pageDimensions, config);
  }

  // Apply padding and validate bounds
  sections = sections.map((section, idx) => ({
    ...section,
    index: idx,
    bounds: applyPadding(section.bounds, config.padding, pageDimensions)
  }));

  // Sort by Y position and limit
  sections = sections
    .sort((a, b) => a.bounds.y - b.bounds.y)
    .slice(0, config.maxSections);

  // Re-index after sort
  return sections.map((section, idx) => ({ ...section, index: idx }));
}
