/**
 * HTML Extractor
 *
 * Extract and clean HTML from page, removing scripts,
 * event handlers, and framework-specific attributes.
 */

import { LAYOUT_PROPERTIES } from './css-extractor.js';

// Size limits
export const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB limit
export const MAX_DOM_ELEMENTS = 50000;          // Warn on large DOMs

// JS framework attribute patterns to remove
export const JS_FRAMEWORK_PATTERNS = [
  /^data-react/i, /^data-vue/i, /^data-ng/i, /^ng-/i,
  /^data-svelte/i, /^x-/i, /^hx-/i, /^v-/i,
  /^data-alpine/i, /^wire:/i, /^@/
];

// Properties to inline on critical elements (layout only, not visual)
// Uses shared LAYOUT_PROPERTIES from css-extractor (DRY)
export const INLINE_LAYOUT_PROPS = [
  ...LAYOUT_PROPERTIES.display,
  ...LAYOUT_PROPERTIES.grid,
  ...LAYOUT_PROPERTIES.position,
  ...LAYOUT_PROPERTIES.sizing,
  ...LAYOUT_PROPERTIES.box.slice(0, 2) // boxSizing, overflow only (skip overflowX/Y, border)
];

// Criteria for critical elements (no sticky - avoid scroll context side effects)
export const CRITICAL_DISPLAY = ['flex', 'inline-flex', 'grid', 'inline-grid'];
export const CRITICAL_POSITION = ['absolute', 'fixed'];

/**
 * Extract and clean HTML from page
 * @param {Page} page - Puppeteer page
 * @param {Array} frameworkPatterns - Patterns to remove
 * @returns {Promise<{html: string, warnings: string[], elementCount: number}>}
 */
export async function extractCleanHtml(page, frameworkPatterns = JS_FRAMEWORK_PATTERNS) {
  return await page.evaluate((patterns, inlineProps, criticalDisplay, criticalPosition) => {
    const warnings = [];

    // Check DOM size
    const elementCount = document.querySelectorAll('*').length;
    if (elementCount > 50000) {
      warnings.push(`Large DOM: ${elementCount} elements`);
    }

    // Clone document to avoid modifying live page
    const doc = document.documentElement.cloneNode(true);

    // Remove scripts and noscript
    doc.querySelectorAll('script, noscript').forEach(el => el.remove());
    doc.querySelectorAll('svg script, svg a[href^="javascript:"]').forEach(el => el.remove());

    // Sanitize CSS links
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        link.remove();
      }
    });

    // Sanitize inline styles
    doc.querySelectorAll('style').forEach(style => {
      const content = style.textContent || '';
      if (content.match(/@import\s+url\s*\(\s*['"]?(javascript|data):/i)) {
        style.remove();
      }
    });

    // Convert patterns to regex
    const patternRegexes = patterns.map(p => new RegExp(p.source, p.flags));

    // Remove event handlers and framework attributes
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = [...el.attributes];
      attrs.forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if (patternRegexes.some(p => p.test(attr.name))) {
          el.removeAttribute(attr.name);
        }
      });
    });

    // Inline computed styles on critical elements (flex/grid/positioned)
    // Using index-based matching for reliability
    const inlineStyles = [];
    let inlinedCount = 0;

    document.querySelectorAll('*').forEach((liveEl, idx) => {
      const style = getComputedStyle(liveEl);
      const display = style.display;
      const position = style.position;

      // Only critical elements (flex/grid containers, absolute/fixed positioned)
      if (criticalDisplay.includes(display) || criticalPosition.includes(position)) {
        const props = [];
        inlineProps.forEach(prop => {
          const val = style[prop];
          // Skip defaults/empty values
          if (val && val !== 'auto' && val !== 'none' && val !== 'normal' &&
              val !== '0px' && val !== 'static' && val !== 'visible' &&
              val !== 'content-box') {
            // Convert camelCase to kebab-case
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            props.push(`${cssProp}: ${val}`);
          }
        });

        // Always include display for critical elements
        if (!props.some(p => p.startsWith('display:'))) {
          props.unshift(`display: ${display}`);
        }

        if (props.length > 0) {
          inlineStyles.push({ idx, style: props.join('; ') });
        }
      }
    });

    // Apply to cloned doc using index matching
    const clonedElements = doc.querySelectorAll('*');
    inlineStyles.forEach(({ idx, style }) => {
      if (clonedElements[idx]) {
        const existing = clonedElements[idx].getAttribute('style') || '';
        clonedElements[idx].setAttribute('style',
          existing ? `${existing}; ${style}` : style);
        inlinedCount++;
      }
    });

    // Track for warnings
    if (inlinedCount > 100) {
      warnings.push(`Inlined ${inlinedCount} critical elements`);
    }

    // Remove hidden elements
    doc.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]')
       .forEach(el => el.remove());

    // Remove empty style tags
    doc.querySelectorAll('style:empty').forEach(el => el.remove());

    // Remove HTML comments
    const removeComments = (node) => {
      const children = [...node.childNodes];
      children.forEach(child => {
        if (child.nodeType === 8) {
          child.remove();
        } else if (child.nodeType === 1) {
          removeComments(child);
        }
      });
    };
    removeComments(doc);

    // Build clean HTML
    const html = '<!DOCTYPE html>\n<html lang="' +
                 (document.documentElement.lang || 'en') + '">\n' +
                 doc.innerHTML + '\n</html>';

    return { html, warnings, elementCount, inlinedCount };
  }, frameworkPatterns.map(r => ({ source: r.source, flags: r.flags })),
     INLINE_LAYOUT_PROPS, CRITICAL_DISPLAY, CRITICAL_POSITION);
}
