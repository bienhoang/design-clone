/**
 * Utility helpers and configuration for section detection.
 *
 * Contains SECTION_CLASS_PATTERNS, DEFAULT_OPTIONS, mergeSections (dedup
 * by Y-overlap), applyPadding (clamp bounds to page), and getSectionSummary.
 * Used by section-detector.js and section-detector-strategies.js.
 */

// ============================================================================
// Constants
// ============================================================================

/** Section class patterns to match against element class names */
export const SECTION_CLASS_PATTERNS = [
  'hero', 'banner', 'header', 'navigation', 'nav',
  'services', 'features', 'about', 'team', 'portfolio',
  'testimonials', 'reviews', 'pricing', 'plans',
  'faq', 'questions', 'blog', 'news', 'articles',
  'contact', 'cta', 'call-to-action', 'newsletter',
  'footer', 'partners', 'clients', 'gallery', 'showcase'
];

/** Default configuration for section detection */
export const DEFAULT_OPTIONS = {
  minSections: 3,
  maxSections: 20,
  padding: 40,
  fallbackToViewport: true,
  viewportHeight: 900,
  minSectionHeight: 150,
  overlapRatio: 0.1  // 10% overlap for viewport fallback
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Merge sections, removing duplicates based on Y overlap.
 * A new section is skipped if it overlaps >50% with any existing section.
 *
 * @param {Array} existing - Already-accepted sections
 * @param {Array} newSections - Candidates to merge in
 * @returns {Array} Merged deduplicated sections
 */
export function mergeSections(existing, newSections) {
  const result = [...existing];

  for (const section of newSections) {
    const overlaps = result.some(s => {
      const yOverlap = Math.max(0,
        Math.min(s.bounds.y + s.bounds.height, section.bounds.y + section.bounds.height) -
        Math.max(s.bounds.y, section.bounds.y)
      );
      const minHeight = Math.min(s.bounds.height, section.bounds.height);
      return yOverlap > minHeight * 0.5;  // >50% overlap
    });

    if (!overlaps) {
      result.push(section);
    }
  }

  return result;
}

/**
 * Apply padding to bounds, clamping to page dimensions.
 *
 * @param {Object} bounds - { x, y, width, height }
 * @param {number} padding - Pixels to expand on each side
 * @param {Object} pageDimensions - { width, height }
 * @returns {Object} Padded and clamped bounds
 */
export function applyPadding(bounds, padding, pageDimensions) {
  return {
    x: Math.max(0, bounds.x - padding),
    y: Math.max(0, bounds.y - padding),
    width: Math.min(pageDimensions.width, bounds.width + padding * 2),
    height: Math.min(
      pageDimensions.height - Math.max(0, bounds.y - padding),
      bounds.height + padding * 2
    )
  };
}

/**
 * Get section summary for logging / reporting.
 *
 * @param {Array} sections - Detected sections
 * @returns {Object} Summary with count, names, totalHeight, hasViewportFallback
 */
export function getSectionSummary(sections) {
  return {
    count: sections.length,
    names: sections.map(s => s.name),
    totalHeight: sections.reduce((sum, s) => sum + s.bounds.height, 0),
    hasViewportFallback: sections.some(s => s.role === 'viewport-chunk')
  };
}
