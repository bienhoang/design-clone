/**
 * CSS Selector Matcher for CSS Filtering
 *
 * Checks whether CSS selectors match elements in analyzed HTML.
 * Uses css-tree AST walking to evaluate TypeSelector, IdSelector,
 * ClassSelector nodes against the HTML analysis result sets.
 */

import { ALWAYS_KEEP_PATTERNS } from './filter-css-html-analyzer.js';

/**
 * Check if a single CSS selector matches any element in the HTML.
 * @param {Object} selectorAst - css-tree Selector AST node
 * @param {Object} htmlAnalysis - Result from analyzeHtml
 * @param {Object} csstree - css-tree module reference
 * @returns {boolean}
 */
export function selectorMatches(selectorAst, htmlAnalysis, csstree) {
  const { tags, ids, classes } = htmlAnalysis;
  let matches = true;
  let hasSpecificSelector = false;

  csstree.walk(selectorAst, {
    enter(node) {
      switch (node.type) {
        case 'TypeSelector':
          hasSpecificSelector = true;
          if (node.name !== '*' && !tags.has(node.name.toLowerCase())) {
            matches = false;
          }
          break;

        case 'IdSelector':
          hasSpecificSelector = true;
          if (!ids.has(node.name)) {
            matches = false;
          }
          break;

        case 'ClassSelector':
          hasSpecificSelector = true;
          if (!classes.has(node.name)) {
            matches = false;
          }
          break;

        case 'AttributeSelector':
          // Be lenient — hard to check attribute values accurately
          hasSpecificSelector = true;
          break;

        case 'PseudoClassSelector':
        case 'PseudoElementSelector':
          // Always keep — state-based or decorative
          break;
      }
    }
  });

  // No specific selectors found → keep the rule
  if (!hasSpecificSelector) return true;

  return matches;
}

/**
 * Check if any selector in a SelectorList matches the HTML.
 * @param {Object} selectorList - css-tree SelectorList AST node
 * @param {Object} htmlAnalysis - Result from analyzeHtml
 * @param {Object} csstree - css-tree module reference
 * @returns {boolean}
 */
export function selectorListMatches(selectorList, htmlAnalysis, csstree) {
  let anyMatch = false;

  csstree.walk(selectorList, {
    visit: 'Selector',
    enter(node) {
      if (selectorMatches(node, htmlAnalysis, csstree)) {
        anyMatch = true;
      }
    }
  });

  return anyMatch;
}

/**
 * Check if a selector text should always be kept (html, body, *, :root).
 * @param {string} selectorText
 * @returns {boolean}
 */
export function shouldAlwaysKeep(selectorText) {
  return ALWAYS_KEEP_PATTERNS.some(pattern => pattern.test(selectorText.trim()));
}

/**
 * Filter CSS AST rules based on HTML analysis.
 * Mutates the AST in-place by removing non-matching rules.
 * @param {Object} cssAst - css-tree AST
 * @param {Object} htmlAnalysis - Result from analyzeHtml
 * @param {Object} csstree - css-tree module reference
 * @param {boolean} verbose - Enable verbose logging
 * @returns {{ totalRules: number, keptRules: number, removedRules: number, atRules: number, mediaQueries: number }}
 */
export function filterCssRules(cssAst, htmlAnalysis, csstree, verbose) {
  const stats = {
    totalRules: 0,
    keptRules: 0,
    removedRules: 0,
    atRules: 0,
    mediaQueries: 0
  };

  const nodesToRemove = [];

  csstree.walk(cssAst, {
    visit: 'Rule',
    enter(node, item, list) {
      stats.totalRules++;

      if (node.prelude && node.prelude.type === 'SelectorList') {
        const selectorText = csstree.generate(node.prelude);

        if (shouldAlwaysKeep(selectorText)) {
          stats.keptRules++;
          return;
        }

        if (!selectorListMatches(node.prelude, htmlAnalysis, csstree)) {
          nodesToRemove.push({ item, list });
          stats.removedRules++;
        } else {
          stats.keptRules++;
        }
      } else {
        stats.keptRules++;
      }
    }
  });

  for (const { item, list } of nodesToRemove) {
    if (list) list.remove(item);
  }

  csstree.walk(cssAst, {
    visit: 'Atrule',
    enter(node) {
      stats.atRules++;
      if (node.name === 'media') stats.mediaQueries++;
    }
  });

  if (verbose) {
    console.error(`[CSS Filter] Total rules: ${stats.totalRules}`);
    console.error(`[CSS Filter] Kept: ${stats.keptRules} (${Math.round(stats.keptRules / stats.totalRules * 100)}%)`);
    console.error(`[CSS Filter] Removed: ${stats.removedRules}`);
    console.error(`[CSS Filter] At-rules: ${stats.atRules} (${stats.mediaQueries} media queries)`);
  }

  return stats;
}
