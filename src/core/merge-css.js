/**
 * CSS Merge & Deduplication
 *
 * Combines multiple CSS files into a single stylesheet with deduplication.
 * Preserves cascade order (first occurrence wins).
 *
 * Usage:
 *   import { mergeCssFiles } from './merge-css.js';
 *   const result = await mergeCssFiles(['a.css', 'b.css'], 'merged.css');
 */

import fs from 'fs/promises';
import path from 'path';

// Import css-tree (already in package.json)
let csstree;
try {
  csstree = await import('css-tree');
} catch {
  console.error('css-tree not installed. Run: npm install css-tree');
  process.exit(1);
}

// Reuse from filter-css.js
import { sanitizeCss, validatePath } from './filter-css.js';

// Default options
const DEFAULT_OPTIONS = {
  combineMediaQueries: true,
  deduplicateFontFaces: true,
  deduplicateKeyframes: true,
  removeEmptyRules: true
};

/**
 * Generate hash for a CSS rule (selector + declarations)
 * @param {Object} node - css-tree Rule node
 * @returns {string} Hash string
 */
function getRuleHash(node) {
  const selector = csstree.generate(node.prelude);
  const declarations = csstree.generate(node.block);
  return `${selector}|${declarations}`;
}

/**
 * Extract font-family value from @font-face rule
 * @param {Object} node - css-tree Atrule node
 * @returns {string} Font family name
 */
function extractFontFamily(node) {
  let family = '';
  csstree.walk(node, {
    visit: 'Declaration',
    enter(decl) {
      if (decl.property === 'font-family') {
        family = csstree.generate(decl.value).replace(/["']/g, '').trim();
      }
    }
  });
  return family;
}

/**
 * Extract src value from @font-face rule
 * @param {Object} node - css-tree Atrule node
 * @returns {string} Font src
 */
function extractFontSrc(node) {
  let src = '';
  csstree.walk(node, {
    visit: 'Declaration',
    enter(decl) {
      if (decl.property === 'src') {
        src = csstree.generate(decl.value);
      }
    }
  });
  return src;
}

/**
 * Extract animation name from @keyframes rule
 * @param {Object} node - css-tree Atrule node
 * @returns {string} Animation name
 */
function extractKeyframeName(node) {
  return node.prelude ? csstree.generate(node.prelude).trim() : '';
}

/**
 * Merge multiple CSS strings with deduplication
 * @param {string[]} cssContents - Array of CSS strings
 * @param {Object} options - Merge options
 * @returns {Object} { css, stats }
 */
export function mergeStylesheets(cssContents, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const stats = {
    inputRules: 0,
    outputRules: 0,
    duplicateRulesRemoved: 0,
    fontFacesDeduped: 0,
    keyframesDeduped: 0,
    mediaQueriesCombined: 0
  };

  // Collections for different rule types
  const seenRules = new Map();        // hash -> rule node
  const seenFontFaces = new Map();    // family|src -> node
  const seenKeyframes = new Map();    // name -> node
  const seenCharset = { found: false, node: null };
  const imports = [];
  const mediaGroups = new Map();      // condition -> rules[]

  // Collected output nodes (in order)
  const outputNodes = [];

  // Process each CSS file
  for (const css of cssContents) {
    if (!css || typeof css !== 'string') continue;

    let ast;
    try {
      ast = csstree.parse(css, {
        parseRulePrelude: true,
        parseValue: false
      });
    } catch (err) {
      // Skip invalid CSS
      continue;
    }

    // Walk through all nodes
    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        const name = node.name.toLowerCase();

        // @charset - keep first only
        if (name === 'charset') {
          if (!seenCharset.found) {
            seenCharset.found = true;
            seenCharset.node = node;
          }
          return;
        }

        // @import - keep all in order
        if (name === 'import') {
          imports.push(node);
          return;
        }

        // @font-face - dedupe by family+src
        if (name === 'font-face') {
          stats.inputRules++;
          if (opts.deduplicateFontFaces) {
            const family = extractFontFamily(node);
            const src = extractFontSrc(node);
            const key = `${family}|${src}`;
            if (!seenFontFaces.has(key)) {
              seenFontFaces.set(key, node);
              outputNodes.push({ type: 'fontface', node });
            } else {
              stats.fontFacesDeduped++;
            }
          } else {
            outputNodes.push({ type: 'fontface', node });
          }
          return;
        }

        // @keyframes - dedupe by name
        if (name === 'keyframes' || name === '-webkit-keyframes') {
          stats.inputRules++;
          if (opts.deduplicateKeyframes) {
            const animName = extractKeyframeName(node);
            if (!seenKeyframes.has(animName)) {
              seenKeyframes.set(animName, node);
              outputNodes.push({ type: 'keyframes', node });
            } else {
              stats.keyframesDeduped++;
            }
          } else {
            outputNodes.push({ type: 'keyframes', node });
          }
          return;
        }

        // @media - collect for combining or keep as-is
        if (name === 'media') {
          const condition = node.prelude ? csstree.generate(node.prelude) : '';

          if (opts.combineMediaQueries && condition) {
            if (!mediaGroups.has(condition)) {
              mediaGroups.set(condition, []);
            }

            // Extract rules from this media block
            csstree.walk(node.block, {
              visit: 'Rule',
              enter(rule) {
                stats.inputRules++;
                const hash = getRuleHash(rule);
                const groupRules = mediaGroups.get(condition);

                // Check if already in this media group
                const exists = groupRules.some(r => r.hash === hash);
                if (!exists) {
                  groupRules.push({ hash, node: rule });
                } else {
                  stats.duplicateRulesRemoved++;
                }
              }
            });
          } else {
            outputNodes.push({ type: 'atrule', node });
          }
          return;
        }

        // Other @rules (supports, page, etc.) - keep as-is
        outputNodes.push({ type: 'atrule', node });
      }
    });

    // Walk regular rules
    csstree.walk(ast, {
      visit: 'Rule',
      enter(node, item, list) {
        // Skip if inside @media (handled above)
        let parent = list;
        while (parent && parent.data) {
          if (parent.data.type === 'Atrule') return;
          parent = parent.parent;
        }

        stats.inputRules++;
        const hash = getRuleHash(node);

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
  const outputAst = {
    type: 'StyleSheet',
    children: new csstree.List()
  };

  // Add @charset first (if any)
  if (seenCharset.node) {
    outputAst.children.push(seenCharset.node);
  }

  // Add @imports
  for (const imp of imports) {
    outputAst.children.push(imp);
  }

  // Add collected nodes
  for (const item of outputNodes) {
    outputAst.children.push(item.node);
    if (item.type === 'rule' || item.type === 'fontface' || item.type === 'keyframes') {
      stats.outputRules++;
    }
  }

  // Add combined media queries
  if (opts.combineMediaQueries) {
    for (const [condition, rules] of mediaGroups) {
      if (rules.length === 0) continue;

      stats.mediaQueriesCombined++;

      // Create combined media rule
      const mediaBlock = {
        type: 'Block',
        children: new csstree.List()
      };

      for (const r of rules) {
        mediaBlock.children.push(r.node);
        stats.outputRules++;
      }

      const mediaRule = {
        type: 'Atrule',
        name: 'media',
        prelude: csstree.parse(condition, { context: 'mediaQueryList' }),
        block: mediaBlock
      };

      outputAst.children.push(mediaRule);
    }
  }

  // Generate output CSS
  let outputCss = csstree.generate(outputAst);

  // Sanitize output
  outputCss = sanitizeCss(outputCss);

  return { css: outputCss, stats };
}

/**
 * Merge multiple CSS files into single output file
 * @param {string[]} cssFiles - Array of CSS file paths
 * @param {string} outputPath - Output file path
 * @param {Object} options - Merge options
 * @returns {Promise<Object>} Merge result
 */
export async function mergeCssFiles(cssFiles, outputPath, options = {}) {
  const startTime = Date.now();

  // Read all CSS files
  const cssContents = [];
  let totalInputSize = 0;

  for (const filePath of cssFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      cssContents.push(content);
      totalInputSize += Buffer.byteLength(content, 'utf-8');
    } catch (err) {
      // Skip files that can't be read
      console.error(`[WARN] Could not read ${filePath}: ${err.message}`);
    }
  }

  if (cssContents.length === 0) {
    return {
      success: false,
      error: 'No CSS files could be read',
      input: { files: cssFiles, totalSize: 0, totalRules: 0 },
      output: null,
      stats: null
    };
  }

  // Merge stylesheets
  const { css, stats } = mergeStylesheets(cssContents, options);

  // Write output
  const outputSize = Buffer.byteLength(css, 'utf-8');
  await fs.writeFile(outputPath, css, 'utf-8');

  const duration = Date.now() - startTime;
  const reduction = totalInputSize > 0
    ? Math.round((1 - outputSize / totalInputSize) * 100)
    : 0;

  return {
    success: true,
    input: {
      files: cssFiles,
      fileCount: cssFiles.length,
      totalSize: totalInputSize,
      totalRules: stats.inputRules
    },
    output: {
      path: path.resolve(outputPath),
      size: outputSize,
      rules: stats.outputRules
    },
    stats: {
      ...stats,
      reduction: `${reduction}%`,
      durationMs: duration
    }
  };
}

// CLI support
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('merge-css.js') ||
  process.argv[1].includes('merge-css')
);

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node merge-css.js <output.css> <input1.css> [input2.css] ...');
    process.exit(1);
  }

  const [outputPath, ...inputFiles] = args;

  mergeCssFiles(inputFiles, outputPath)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error(JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    });
}
