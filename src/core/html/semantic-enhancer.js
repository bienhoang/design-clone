/**
 * Semantic HTML Enhancer
 *
 * Injects WordPress-compatible semantic IDs, classes, and ARIA roles
 * into extracted HTML while preserving original styling.
 *
 * Architecture:
 * - semantic-enhancer-mappings.js: Constants + detection/application functions (Node.js context)
 * - semantic-enhancer-page.js: Playwright page.evaluate integration (browser context, inlined)
 * - This file: Browser-context DOMParser enhancer + re-exports
 */

import {
  SEMANTIC_MAPPINGS,
  CLASS_PATTERNS,
  detectSectionType,
  applySemanticAttributes,
  handleMultipleNavs
} from './semantic-enhancer-mappings.js';

export { enhanceSemanticHTMLInPage } from './semantic-enhancer-page.js';

// Re-export mappings module for external consumers
export {
  SEMANTIC_MAPPINGS,
  CLASS_PATTERNS,
  detectSectionType,
  applySemanticAttributes,
  handleMultipleNavs
};

/**
 * Enhance HTML string with semantic attributes.
 *
 * **IMPORTANT:** Requires browser context (uses DOMParser).
 * For Node.js/Playwright, use `enhanceSemanticHTMLInPage()` instead.
 *
 * @param {string} html - Original HTML string (must be valid HTML)
 * @param {Object} [domHierarchy=null] - Optional DOM hierarchy from dom-tree-analyzer
 * @returns {{html: string, stats: Object}} Enhanced HTML and stats
 * @throws {Error} If html is empty or DOMParser is unavailable
 */
export function enhanceSemanticHTML(html, domHierarchy = null) {
  if (!html || typeof html !== 'string') {
    throw new Error('enhanceSemanticHTML requires a valid HTML string');
  }
  if (typeof DOMParser === 'undefined') {
    throw new Error('enhanceSemanticHTML requires browser context (DOMParser). Use enhanceSemanticHTMLInPage() for Playwright.');
  }

  const stats = {
    sectionsEnhanced: 0,
    idsAdded: 0,
    classesAdded: 0,
    rolesAdded: 0,
    warnings: []
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const usedIds = new Set();

  doc.querySelectorAll('[id]').forEach(el => usedIds.add(el.id));

  const combinedLandmarkSelector = [
    'header:not(header header)',
    'footer:not(footer footer)',
    'main',
    'aside',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="main"]',
    '[role="complementary"]'
  ].join(', ');

  const processedElements = new Set();

  try {
    doc.querySelectorAll(combinedLandmarkSelector).forEach(el => {
      if (processedElements.has(el)) return;
      processedElements.add(el);

      const sectionType = detectSectionType(el);
      if (sectionType) {
        const hadId = !!el.id;
        const hadRole = !!el.getAttribute('role');
        const oldClasses = el.className;

        applySemanticAttributes(el, sectionType, { usedIds });

        if (!hadId && el.id) stats.idsAdded++;
        if (!hadRole && el.getAttribute('role')) stats.rolesAdded++;
        if (oldClasses !== el.className) stats.classesAdded++;
        stats.sectionsEnhanced++;
      }
    });
  } catch (err) {
    stats.warnings.push(`Landmark selector error: ${err.message}`);
  }

  const navElements = doc.querySelectorAll('nav, [role="navigation"]');
  let newNavCount = 0;
  navElements.forEach(nav => {
    if (!processedElements.has(nav)) {
      processedElements.add(nav);
      newNavCount++;
    }
  });
  if (navElements.length > 0) {
    handleMultipleNavs(navElements, usedIds);
    stats.sectionsEnhanced += newNavCount;
  }

  const heroSelectors = [
    '.hero', '.banner', '.jumbotron', '.splash',
    '[class*="hero"]', '[class*="banner"]'
  ];
  heroSelectors.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => {
        if (!el.closest('header') && !el.closest('footer')) {
          const hadId = !!el.id;
          applySemanticAttributes(el, 'hero', { usedIds });
          if (!hadId && el.id) stats.idsAdded++;
          stats.sectionsEnhanced++;
        }
      });
    } catch (err) {
      // Some selectors may not be valid in all contexts
    }
  });

  const enhancedHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  return { html: enhancedHtml, stats };
}
