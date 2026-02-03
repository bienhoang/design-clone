/**
 * HTML Extractor
 *
 * Extract and clean HTML from page, removing scripts,
 * event handlers, and framework-specific attributes.
 */

// Size limits
export const MAX_HTML_SIZE = 10 * 1024 * 1024; // 10MB limit
export const MAX_DOM_ELEMENTS = 50000;          // Warn on large DOMs

// JS framework attribute patterns to remove
export const JS_FRAMEWORK_PATTERNS = [
  /^data-react/i, /^data-vue/i, /^data-ng/i, /^ng-/i,
  /^data-svelte/i, /^x-/i, /^hx-/i, /^v-/i,
  /^data-alpine/i, /^wire:/i, /^@/
];

/**
 * Extract and clean HTML from page
 * @param {Page} page - Puppeteer page
 * @param {Array} frameworkPatterns - Patterns to remove
 * @returns {Promise<{html: string, warnings: string[], elementCount: number}>}
 */
export async function extractCleanHtml(page, frameworkPatterns = JS_FRAMEWORK_PATTERNS) {
  return await page.evaluate((patterns) => {
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

    return { html, warnings, elementCount };
  }, frameworkPatterns.map(r => ({ source: r.source, flags: r.flags })));
}
