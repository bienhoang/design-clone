/**
 * SVG Icon Replacer Utilities
 *
 * Handles finding SVG placeholder elements in HTML and preserving
 * original attributes (class, width, height, aria-*) when injecting
 * replacement icons.
 */

/**
 * Extract surrounding context text from HTML at a given position.
 * @param {string} html
 * @param {number} position - Character index of the SVG element
 * @param {number} range - Characters to capture before and after
 * @returns {string}
 */
export function extractContext(html, position, range = 200) {
  const start = Math.max(0, position - range);
  const end   = Math.min(html.length, position + range);
  return html.slice(start, end);
}

/**
 * Find SVG elements that are candidates for icon replacement.
 * Skips logos (text elements, >6 path nodes, logo/brand class).
 * @param {string} html
 * @param {Function} detectPurpose - detectIconPurpose(svgTag, context) → string
 * @returns {Array<{ original, position, context, purpose }>}
 */
export function findSvgElements(html, detectPurpose) {
  const elements = [];
  const svgRegex = /<svg[^>]*viewBox=["'][^"']*["'][^>]*>[\s\S]*?<\/svg>/gi;
  let match;

  while ((match = svgRegex.exec(html)) !== null) {
    const svgTag  = match[0];
    const context = extractContext(html, match.index);

    const pathCount = (svgTag.match(/<(path|circle|rect|line|polyline|polygon)/gi) || []).length;

    // Skip complex SVGs (likely logos or illustrations)
    if (svgTag.includes('<text') || pathCount > 6) continue;
    if (/class=["'][^"']*(logo|brand)[^"']*["']/i.test(svgTag)) continue;

    elements.push({
      original: svgTag,
      position: match.index,
      context,
      purpose: detectPurpose(svgTag, context)
    });
  }

  return elements;
}

/**
 * Preserve original SVG attributes (class, width, height, aria-*)
 * when replacing with a new icon SVG string.
 * @param {string} originalSvg - The original SVG markup
 * @param {string} newSvg - The replacement icon SVG markup
 * @returns {string} New SVG with original attributes preserved
 */
export function preserveAttributes(originalSvg, newSvg) {
  const classMatch  = originalSvg.match(/class=["']([^"']*)["']/i);
  const widthMatch  = originalSvg.match(/width=["']([^"']*)["']/i);
  const heightMatch = originalSvg.match(/height=["']([^"']*)["']/i);
  const ariaMatch   = originalSvg.match(/aria-[^=]+=["'][^"']*["']/gi);

  let result = newSvg;

  if (classMatch)  result = result.replace('<svg', `<svg class="${classMatch[1]}"`);
  if (widthMatch)  result = result.replace('<svg', `<svg width="${widthMatch[1]}"`);
  if (heightMatch) result = result.replace('<svg', `<svg height="${heightMatch[1]}"`);
  if (ariaMatch)   result = result.replace('<svg', `<svg ${ariaMatch.join(' ')}`);

  return result;
}
