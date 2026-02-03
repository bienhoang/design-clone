/**
 * CSS Extractor
 *
 * Extract all CSS from page including inline styles,
 * external stylesheets, and computed styles.
 */

// Size limits
export const MAX_CSS_SIZE = 5 * 1024 * 1024;   // 5MB limit
export const MAX_CSS_RULES_WARN = 5000;        // Warn on large stylesheets

/**
 * Extract all CSS from page
 * @param {Page} page - Puppeteer page
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Promise<{cssBlocks: Array, corsBlocked: Array, computedStyles: Object, totalRules: number, warnings: Array}>}
 */
export async function extractAllCss(page, baseUrl) {
  return await page.evaluate((url) => {
    const cssBlocks = [];
    const corsBlocked = [];
    const warnings = [];

    // Collect from all stylesheets
    for (const sheet of document.styleSheets) {
      try {
        const source = sheet.href || 'inline';
        const rulesArray = sheet.cssRules || sheet.rules || [];
        const rules = Array.from(rulesArray).map(rule => rule.cssText);

        if (rules.length > 0) {
          const resolvedSource = source === 'inline'
            ? 'inline'
            : new URL(source, url).href;

          if (rules.length > 5000) {
            warnings.push(`Large stylesheet: ${rules.length} rules from ${resolvedSource}`);
          }

          cssBlocks.push({
            source: resolvedSource,
            css: rules.join('\n'),
            ruleCount: rules.length
          });
        }
      } catch (e) {
        if (sheet.href) {
          corsBlocked.push(sheet.href);
        }
      }
    }

    // Dynamic computed styles: semantic elements + top classes
    const baseSelectors = [
      'body', 'header', 'nav', 'main', 'footer', 'section', 'article',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'button', 'input', 'select', 'textarea'
    ];

    // Find top 10 most used classes
    const classCounts = {};
    document.querySelectorAll('[class]').forEach(el => {
      el.classList.forEach(cls => {
        classCounts[cls] = (classCounts[cls] || 0) + 1;
      });
    });
    const topClasses = Object.entries(classCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cls]) => `.${cls}`);

    const keySelectors = [...baseSelectors, ...topClasses];

    const computedStyles = {};
    keySelectors.forEach(selector => {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const style = getComputedStyle(el);
          computedStyles[selector] = {
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            padding: style.padding,
            margin: style.margin,
            borderRadius: style.borderRadius
          };
        }
      } catch (e) {
        // Ignore invalid selectors
      }
    });

    const totalRules = cssBlocks.reduce((sum, b) => sum + b.ruleCount, 0);

    return {
      cssBlocks,
      corsBlocked,
      computedStyles,
      totalRules,
      warnings
    };
  }, baseUrl);
}
