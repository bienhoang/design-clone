/**
 * HTML Extractor
 *
 * Extract and clean HTML from page, removing scripts,
 * event handlers, and framework-specific attributes.
 * Optionally enhances with WordPress-compatible semantic structure.
 *
 * Inline style computation lives in html-extractor-inline-styler.js
 * and is serialized into the browser context via page.evaluate.
 */

import { LAYOUT_PROPERTIES } from './css-extractor.js';
import { enhanceSemanticHTMLInPage } from './semantic-enhancer.js';
import { computeAndApplyInlineStyles } from './html-extractor-inline-styler.js';

// Size limits
export const MAX_HTML_SIZE    = 10 * 1024 * 1024; // 10MB
export const MAX_DOM_ELEMENTS = 50000;

// JS framework attribute patterns to remove
export const JS_FRAMEWORK_PATTERNS = [
  /^data-react/i, /^data-vue/i, /^data-ng/i, /^ng-/i,
  /^data-svelte/i, /^x-/i, /^hx-/i, /^v-/i,
  /^data-alpine/i, /^wire:/i, /^@/
];

// Properties to inline on critical elements (layout only, not visual)
export const INLINE_LAYOUT_PROPS = [
  ...LAYOUT_PROPERTIES.display,
  ...LAYOUT_PROPERTIES.grid,
  ...LAYOUT_PROPERTIES.position,
  ...LAYOUT_PROPERTIES.sizing,
  ...LAYOUT_PROPERTIES.box.slice(0, 2) // boxSizing, overflow only
];

export const CRITICAL_DISPLAY  = ['flex', 'inline-flex', 'grid', 'inline-grid'];
export const CRITICAL_POSITION = ['absolute', 'fixed'];

/**
 * Extract and clean HTML from page.
 * @param {import('playwright').Page} page
 * @param {Array<RegExp>} frameworkPatterns - Patterns to remove
 * @returns {Promise<{ html: string, warnings: string[], elementCount: number, inlinedCount: number }>}
 */
export async function extractCleanHtml(page, frameworkPatterns = JS_FRAMEWORK_PATTERNS) {
  // Serialize browser-side helper for inline styling
  const inlineStylerSrc = computeAndApplyInlineStyles.toString();

  return await page.evaluate(
    ({ patterns, inlineProps, criticalDisplay, criticalPosition, inlineStylerSrc }) => {
      const warnings = [];

      const elementCount = document.querySelectorAll('*').length;
      if (elementCount > 50000) warnings.push(`Large DOM: ${elementCount} elements`);

      const doc = document.documentElement.cloneNode(true);

      // Remove scripts and noscript
      doc.querySelectorAll('script, noscript').forEach(el => el.remove());
      doc.querySelectorAll('svg script, svg a[href^="javascript:"]').forEach(el => el.remove());

      // Sanitize CSS links
      doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href') || '';
        if (href.startsWith('javascript:') || href.startsWith('data:')) link.remove();
      });

      // Sanitize inline styles
      doc.querySelectorAll('style').forEach(style => {
        if ((style.textContent || '').match(/@import\s+url\s*\(\s*['"]?(javascript|data):/i)) {
          style.remove();
        }
      });

      // Remove event handlers and framework attributes
      const patternRegexes = patterns.map(p => new RegExp(p.source, p.flags));
      doc.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
          if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
          if (patternRegexes.some(p => p.test(attr.name))) el.removeAttribute(attr.name);
        });
      });

      // Inline critical layout styles (browser-side helper deserialized here)
      // eslint-disable-next-line no-new-func
      const computeAndApplyInlineStyles = new Function('return (' + inlineStylerSrc + ')')();
      const { inlinedCount, warnings: styleWarnings } = computeAndApplyInlineStyles(
        document, doc, inlineProps, criticalDisplay, criticalPosition
      );
      warnings.push(...styleWarnings);

      // Remove hidden elements
      doc.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]')
         .forEach(el => el.remove());

      // Remove empty style tags and HTML comments
      doc.querySelectorAll('style:empty').forEach(el => el.remove());

      const removeComments = (node) => {
        [...node.childNodes].forEach(child => {
          if (child.nodeType === 8) child.remove();
          else if (child.nodeType === 1) removeComments(child);
        });
      };
      removeComments(doc);

      const html = '<!DOCTYPE html>\n<html lang="' +
                   (document.documentElement.lang || 'en') + '">\n' +
                   doc.innerHTML + '\n</html>';

      return { html, warnings, elementCount, inlinedCount };
    },
    {
      patterns:         frameworkPatterns.map(r => ({ source: r.source, flags: r.flags })),
      inlineProps:      INLINE_LAYOUT_PROPS,
      criticalDisplay:  CRITICAL_DISPLAY,
      criticalPosition: CRITICAL_POSITION,
      inlineStylerSrc
    }
  );
}

/**
 * Extract, clean, and optionally enhance HTML with semantic structure.
 * @param {import('playwright').Page} page
 * @param {Object} options
 * @param {boolean} [options.enhanceSemantic=true]
 * @param {Array<RegExp>} [options.frameworkPatterns]
 * @returns {Promise<{ html: string, warnings: string[], elementCount: number, semanticStats?: Object }>}
 */
export async function extractAndEnhanceHtml(page, options = {}) {
  const { enhanceSemantic = true, frameworkPatterns = JS_FRAMEWORK_PATTERNS } = options;

  const result = await extractCleanHtml(page, frameworkPatterns);

  if (enhanceSemantic) {
    try {
      const enhanced = await enhanceSemanticHTMLInPage(page, result.html);
      return { ...result, html: enhanced.html, semanticStats: enhanced.stats };
    } catch (err) {
      result.warnings.push(`Semantic enhancement failed: ${err.message}`);
      return result;
    }
  }

  return result;
}
