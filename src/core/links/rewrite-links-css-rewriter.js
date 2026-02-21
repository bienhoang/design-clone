/**
 * CSS Link Rewriter
 *
 * Rewrites stylesheet <link> tags in HTML to point to the shared
 * styles.css file, deduplicates them, and optionally injects tokens.css.
 */

/**
 * Rewrite all CSS <link> tags to use shared ../styles.css,
 * remove duplicates, and optionally inject tokens.css before it.
 * @param {string} html
 * @param {boolean} injectTokensCss - Inject tokens.css link before styles.css
 * @returns {string} Updated HTML
 */
export function rewriteCssLinks(html, injectTokensCss = false) {
  let result = html;

  // Rewrite all stylesheet links to shared styles.css
  result = result.replace(
    /<link([^>]*?)href=["'][^"']*\.css["']([^>]*?)>/gi,
    (match, before, after) => {
      if (
        match.includes('rel="stylesheet"') ||
        match.includes("rel='stylesheet'") ||
        !match.includes('rel=')
      ) {
        return `<link${before}href="../styles.css" rel="stylesheet"${after}>`;
      }
      return match;
    }
  );

  // Remove duplicate stylesheet links (keep first occurrence)
  const seenStylesheets = new Set();
  result = result.replace(
    /<link[^>]*href=["']\.\.\/styles\.css["'][^>]*>/gi,
    (match) => {
      if (seenStylesheets.has('styles.css')) return '';
      seenStylesheets.add('styles.css');
      return match;
    }
  );

  // Optionally inject tokens.css before styles.css
  if (injectTokensCss) {
    result = result.replace(
      /(<link[^>]*href=["']\.\.\/styles\.css["'][^>]*>)/i,
      '<link href="../tokens.css" rel="stylesheet">\n  $1'
    );
  }

  return result;
}
