/**
 * CSS Merge & Deduplication
 *
 * Combines multiple CSS strings into a single stylesheet with deduplication.
 * Preserves cascade order (first occurrence wins).
 * File I/O (reading/writing CSS files) lives in merge-css-file-io.js.
 *
 * Usage:
 *   import { mergeCssFiles } from './merge-css.js';
 *   const result = await mergeCssFiles(['a.css', 'b.css'], 'merged.css');
 */

import { sanitizeCss } from './filter-css.js';
import { getRuleHash, processAtrule } from './merge-css-atrule-processor.js';

// Re-export mergeCssFiles for backward compatibility
export { mergeCssFiles } from './merge-css-file-io.js';

// Import css-tree (already in package.json)
let csstree;
try {
  csstree = await import('css-tree');
} catch {
  console.error('css-tree not installed. Run: npm install css-tree');
  process.exit(1);
}

const DEFAULT_OPTIONS = {
  combineMediaQueries: true,
  deduplicateFontFaces: true,
  deduplicateKeyframes: true,
  removeEmptyRules: true
};

/**
 * Merge multiple CSS strings with deduplication.
 * @param {string[]} cssContents - Array of CSS strings
 * @param {Object} options - Merge options
 * @returns {{ css: string, stats: Object }}
 */
export function mergeStylesheets(cssContents, options = {}) {
  const opts  = { ...DEFAULT_OPTIONS, ...options };
  const stats = {
    inputRules: 0,
    outputRules: 0,
    duplicateRulesRemoved: 0,
    fontFacesDeduped: 0,
    keyframesDeduped: 0,
    mediaQueriesCombined: 0
  };

  const seenRules    = new Map();
  const seenFontFaces  = new Map();
  const seenKeyframes  = new Map();
  const seenCharset  = { found: false, node: null };
  const imports      = [];
  const mediaGroups  = new Map();
  const outputNodes  = [];
  const collections  = { seenFontFaces, seenKeyframes, seenCharset, imports, mediaGroups, outputNodes, stats };

  for (const css of cssContents) {
    if (!css || typeof css !== 'string') continue;

    let ast;
    try {
      ast = csstree.parse(css, { parseRulePrelude: true, parseValue: false });
    } catch {
      continue;
    }

    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) { processAtrule(node, csstree, opts, collections); }
    });

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node, item, list) {
        // Skip rules nested inside @media (handled by processAtrule)
        let parent = list;
        while (parent && parent.data) {
          if (parent.data.type === 'Atrule') return;
          parent = parent.parent;
        }

        stats.inputRules++;
        const hash = getRuleHash(node, csstree);
        if (!seenRules.has(hash)) {
          seenRules.set(hash, node);
          outputNodes.push({ type: 'rule', node });
        } else {
          stats.duplicateRulesRemoved++;
        }
      }
    });
  }

  // Build output AST
  const outputAst = { type: 'StyleSheet', children: new csstree.List() };
  if (seenCharset.node) outputAst.children.push(seenCharset.node);
  for (const imp of imports) outputAst.children.push(imp);

  for (const item of outputNodes) {
    outputAst.children.push(item.node);
    if (item.type === 'rule' || item.type === 'fontface' || item.type === 'keyframes') {
      stats.outputRules++;
    }
  }

  if (opts.combineMediaQueries) {
    for (const [condition, rules] of mediaGroups) {
      if (rules.length === 0) continue;
      stats.mediaQueriesCombined++;

      const mediaBlock = { type: 'Block', children: new csstree.List() };
      for (const r of rules) { mediaBlock.children.push(r.node); stats.outputRules++; }

      outputAst.children.push({
        type: 'Atrule',
        name: 'media',
        prelude: csstree.parse(condition, { context: 'mediaQueryList' }),
        block: mediaBlock
      });
    }
  }

  let outputCss = csstree.generate(outputAst);
  outputCss = sanitizeCss(outputCss);
  return { css: outputCss, stats };
}

// CLI support
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('merge-css.js') ||
  process.argv[1].includes('merge-css')
);

if (isMainModule) {
  const { mergeCssFiles } = await import('./merge-css-file-io.js');
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node merge-css.js <output.css> <input1.css> [input2.css] ...');
    process.exit(1);
  }

  const [outputPath, ...inputFiles] = args;
  mergeCssFiles(inputFiles, outputPath)
    .then(result => { console.log(JSON.stringify(result, null, 2)); process.exit(result.success ? 0 : 1); })
    .catch(err  => { console.error(JSON.stringify({ success: false, error: err.message })); process.exit(1); });
}
