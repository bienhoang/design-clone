#!/usr/bin/env node
/**
 * Filter CSS to remove unused selectors
 *
 * Usage:
 *   node filter-css.js --html source.html --css source-raw.css --output source.css
 *
 * Options:
 *   --html     Path to cleaned HTML file (required)
 *   --css      Path to raw CSS file (required)
 *   --output   Path for filtered CSS output (required)
 *   --verbose  Enable verbose logging
 *
 * Uses css-tree for AST parsing and selector analysis.
 *
 * Memory: Max 10MB CSS input. Large files may cause high memory usage during AST parsing.
 * Reduction: Typical 20-30% reduction. Complex selectors (combinators, nth-child) kept conservatively.
 */

import fs from 'fs/promises';
import path from 'path';

// Dependency check for css-tree
let csstree;
try {
  csstree = await import('css-tree');
} catch {
  console.error(JSON.stringify({
    success: false,
    error: 'css-tree not installed',
    hint: 'Run: npm install css-tree'
  }, null, 2));
  process.exit(1);
}

// Constants - Memory limit for CSS input (prevents OOM on large files)
const MAX_CSS_INPUT_SIZE = 10 * 1024 * 1024; // 10MB max input

// Rules that should always be kept (critical for layout)
const ALWAYS_KEEP_PATTERNS = [
  /^html$/i,
  /^body$/i,
  /^\*$/,
  /^:root$/i
];

// At-rules that should always be kept
const KEEP_AT_RULES = ['font-face', 'keyframes', 'import', 'charset', 'namespace'];

// CSS injection patterns to sanitize (XSS vectors)
const CSS_INJECTION_PATTERNS = [
  /expression\s*\(/gi,           // IE expression()
  /-moz-binding\s*:/gi,          // Firefox XBL binding
  /url\s*\(\s*["']?javascript:/gi, // javascript: URLs
  /url\s*\(\s*["']?data:text\/html/gi, // data: HTML URLs
  /behavior\s*:/gi,              // IE behavior
  /@import\s+["']?javascript:/gi // @import javascript:
];

/**
 * Validate file path is within allowed directory (prevents path traversal)
 * @param {string} filePath - Path to validate
 * @param {string} allowedDir - Directory paths must be within (optional, defaults to cwd)
 * @returns {string} Resolved absolute path
 * @throws {Error} If path is outside allowed directory
 */
function validatePath(filePath, allowedDir = process.cwd()) {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);

  // Check for path traversal: resolved path must start with allowed directory
  if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
    throw new Error(`Path "${filePath}" is outside allowed directory "${allowedDir}"`);
  }

  return resolved;
}

/**
 * Sanitize CSS output to remove potential XSS vectors
 * @param {string} css - CSS string to sanitize
 * @returns {string} Sanitized CSS
 */
function sanitizeCss(css) {
  let sanitized = css;
  for (const pattern of CSS_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* [sanitized] */');
  }
  return sanitized;
}

/**
 * Simple argument parser
 */
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        result[key] = nextArg;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

/**
 * Parse HTML and build sets of all possible selector matches
 * Uses regex for speed (no DOM parser needed)
 * @returns {{ tags: Set, ids: Set, classes: Set, attributes: Set }}
 */
function analyzeHtml(html) {
  const tags = new Set();
  const ids = new Set();
  const classes = new Set();
  const attributes = new Set();

  // Extract tag names: <tagname or <tagname>
  const tagMatches = html.matchAll(/<([a-z][a-z0-9]*)/gi);
  for (const match of tagMatches) {
    tags.add(match[1].toLowerCase());
  }

  // Extract IDs: id="value" or id='value'
  const idMatches = html.matchAll(/\bid=["']([^"']+)["']/gi);
  for (const match of idMatches) {
    ids.add(match[1]);
  }

  // Extract classes: class="value1 value2" or class='value1 value2'
  const classMatches = html.matchAll(/\bclass=["']([^"']+)["']/gi);
  for (const match of classMatches) {
    const classNames = match[1].split(/\s+/);
    classNames.forEach(c => {
      const trimmed = c.trim();
      if (trimmed) classes.add(trimmed);
    });
  }

  // Extract data attributes: data-foo="bar"
  const attrMatches = html.matchAll(/\s(data-[a-z0-9-]+)/gi);
  for (const match of attrMatches) {
    attributes.add(match[1].toLowerCase());
  }

  // Add common attributes that are often used in selectors
  const commonAttrs = ['href', 'src', 'type', 'name', 'value', 'disabled', 'checked',
                       'selected', 'readonly', 'required', 'placeholder', 'role',
                       'aria-hidden', 'aria-label', 'aria-expanded', 'target', 'rel'];
  commonAttrs.forEach(attr => {
    if (html.includes(attr + '=') || html.includes(attr + ' ') || html.includes(attr + '>')) {
      attributes.add(attr);
    }
  });

  return { tags, ids, classes, attributes };
}

/**
 * Check if a single CSS selector matches any element in the HTML
 * @param {Object} selectorAst - css-tree selector AST node
 * @param {Object} htmlAnalysis - Result from analyzeHtml
 * @returns {boolean}
 */
function selectorMatches(selectorAst, htmlAnalysis) {
  const { tags, ids, classes } = htmlAnalysis;
  let matches = true;
  let hasSpecificSelector = false;

  csstree.walk(selectorAst, {
    enter(node) {
      switch (node.type) {
        case 'TypeSelector':
          // Tag selector: div, span, header, etc.
          hasSpecificSelector = true;
          if (node.name !== '*' && !tags.has(node.name.toLowerCase())) {
            matches = false;
          }
          break;

        case 'IdSelector':
          // ID selector: #main, #header
          hasSpecificSelector = true;
          if (!ids.has(node.name)) {
            matches = false;
          }
          break;

        case 'ClassSelector':
          // Class selector: .container, .btn
          hasSpecificSelector = true;
          if (!classes.has(node.name)) {
            matches = false;
          }
          break;

        case 'AttributeSelector':
          // Attribute selector: [type="text"], [data-foo]
          // Be lenient with attribute selectors - hard to check accurately
          hasSpecificSelector = true;
          break;

        case 'PseudoClassSelector':
          // Pseudo-class: :hover, :focus, :first-child
          // Always keep - these are state-based
          break;

        case 'PseudoElementSelector':
          // Pseudo-element: ::before, ::after, ::placeholder
          // Always keep
          break;
      }
    }
  });

  // If no specific selectors found, keep the rule
  if (!hasSpecificSelector) {
    return true;
  }

  return matches;
}

/**
 * Check if any selector in a selector list matches
 * @param {Object} selectorList - css-tree SelectorList AST node
 * @param {Object} htmlAnalysis - Result from analyzeHtml
 * @returns {boolean}
 */
function selectorListMatches(selectorList, htmlAnalysis) {
  let anyMatch = false;

  csstree.walk(selectorList, {
    visit: 'Selector',
    enter(node) {
      if (selectorMatches(node, htmlAnalysis)) {
        anyMatch = true;
      }
    }
  });

  return anyMatch;
}

/**
 * Check if a selector text should always be kept
 */
function shouldAlwaysKeep(selectorText) {
  return ALWAYS_KEEP_PATTERNS.some(pattern => pattern.test(selectorText.trim()));
}

/**
 * Filter CSS rules based on HTML analysis
 * @param {Object} cssAst - css-tree AST
 * @param {Object} htmlAnalysis - Result from analyzeHtml
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Object} stats
 */
function filterCss(cssAst, htmlAnalysis, verbose) {
  const stats = {
    totalRules: 0,
    keptRules: 0,
    removedRules: 0,
    atRules: 0,
    mediaQueries: 0
  };

  const nodesToRemove = [];

  // Walk through all rules
  csstree.walk(cssAst, {
    visit: 'Rule',
    enter(node, item, list) {
      stats.totalRules++;

      // Check if selector matches HTML
      if (node.prelude && node.prelude.type === 'SelectorList') {
        // Get selector text for always-keep check
        const selectorText = csstree.generate(node.prelude);

        if (shouldAlwaysKeep(selectorText)) {
          stats.keptRules++;
          return;
        }

        if (!selectorListMatches(node.prelude, htmlAnalysis)) {
          nodesToRemove.push({ item, list });
          stats.removedRules++;
        } else {
          stats.keptRules++;
        }
      } else {
        // Keep rules without standard selectors
        stats.keptRules++;
      }
    }
  });

  // Remove filtered rules
  for (const { item, list } of nodesToRemove) {
    if (list) {
      list.remove(item);
    }
  }

  // Count at-rules
  csstree.walk(cssAst, {
    visit: 'Atrule',
    enter(node) {
      stats.atRules++;
      if (node.name === 'media') {
        stats.mediaQueries++;
      }
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

/**
 * Main filtering function
 * @param {string} htmlPath - Path to HTML file
 * @param {string} cssPath - Path to raw CSS file
 * @param {string} outputPath - Path for filtered CSS output
 * @param {boolean} verbose - Enable verbose logging
 * @param {string} allowedDir - Base directory for path validation (optional)
 * @returns {Promise<Object>} Result object
 */
async function filterCssFile(htmlPath, cssPath, outputPath, verbose = false, allowedDir = null) {
  const startTime = Date.now();

  // Validate paths if allowedDir specified (security: prevent path traversal)
  const resolvedHtml = allowedDir ? validatePath(htmlPath, allowedDir) : path.resolve(htmlPath);
  const resolvedCss = allowedDir ? validatePath(cssPath, allowedDir) : path.resolve(cssPath);
  const resolvedOutput = allowedDir ? validatePath(outputPath, allowedDir) : path.resolve(outputPath);

  // Read input files with detailed error messages
  let html, css;
  try {
    [html, css] = await Promise.all([
      fs.readFile(resolvedHtml, 'utf-8'),
      fs.readFile(resolvedCss, 'utf-8')
    ]);
  } catch (readError) {
    const failedFile = readError.path || 'unknown';
    throw new Error(`Failed to read file "${failedFile}": ${readError.message}`);
  }

  const inputSize = Buffer.byteLength(css, 'utf-8');

  // Size limit check with detailed message
  if (inputSize > MAX_CSS_INPUT_SIZE) {
    throw new Error(
      `CSS file "${resolvedCss}" (${(inputSize / 1024 / 1024).toFixed(1)}MB) ` +
      `exceeds ${MAX_CSS_INPUT_SIZE / 1024 / 1024}MB limit. ` +
      `Consider splitting the CSS file or increasing MAX_CSS_INPUT_SIZE.`
    );
  }

  if (verbose) {
    console.error(`[CSS Filter] Input CSS size: ${(inputSize / 1024).toFixed(1)}KB`);
  }

  // Analyze HTML
  const htmlAnalysis = analyzeHtml(html);
  if (verbose) {
    console.error(`[CSS Filter] HTML Analysis:`);
    console.error(`  Tags: ${htmlAnalysis.tags.size}`);
    console.error(`  IDs: ${htmlAnalysis.ids.size}`);
    console.error(`  Classes: ${htmlAnalysis.classes.size}`);
    console.error(`  Attributes: ${htmlAnalysis.attributes.size}`);
  }

  // Parse CSS with css-tree
  let ast;
  try {
    ast = csstree.parse(css, {
      parseRulePrelude: true,
      parseValue: false // Skip value parsing for speed
    });
  } catch (parseError) {
    if (verbose) {
      console.error(`[CSS Filter] Parse error: ${parseError.message}`);
      console.error(`[CSS Filter] Attempting lenient parse...`);
    }
    // Try lenient parse on error
    try {
      ast = csstree.parse(css, {
        parseRulePrelude: false,
        parseValue: false
      });
    } catch (lenientError) {
      throw new Error(`Failed to parse CSS: ${lenientError.message}`);
    }
  }

  // Filter CSS
  const stats = filterCss(ast, htmlAnalysis, verbose);

  // Generate output CSS and sanitize for XSS vectors
  let filteredCss = csstree.generate(ast);
  filteredCss = sanitizeCss(filteredCss);
  const outputSize = Buffer.byteLength(filteredCss, 'utf-8');

  // Write output with detailed error message
  try {
    await fs.writeFile(resolvedOutput, filteredCss, 'utf-8');
  } catch (writeError) {
    throw new Error(`Failed to write output "${resolvedOutput}": ${writeError.message}`);
  }

  const duration = Date.now() - startTime;
  const reductionPercent = Math.round((1 - outputSize / inputSize) * 100);

  if (verbose) {
    console.error(`[CSS Filter] Output CSS size: ${(outputSize / 1024).toFixed(1)}KB`);
    console.error(`[CSS Filter] Reduction: ${reductionPercent}%`);
    console.error(`[CSS Filter] Duration: ${duration}ms`);
  }

  return {
    success: true,
    input: {
      html: resolvedHtml,
      css: resolvedCss,
      cssSize: inputSize
    },
    output: {
      path: resolvedOutput,
      size: outputSize
    },
    htmlAnalysis: {
      tags: htmlAnalysis.tags.size,
      ids: htmlAnalysis.ids.size,
      classes: htmlAnalysis.classes.size
    },
    stats: {
      ...stats,
      reduction: `${reductionPercent}%`,
      durationMs: duration
    }
  };
}

/**
 * CLI entry point
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.html || !args.css || !args.output) {
    console.error('Usage: node filter-css.js --html source.html --css source-raw.css --output source.css [--verbose]');
    process.exit(1);
  }

  try {
    const result = await filterCssFile(
      args.html,
      args.css,
      args.output,
      args.verbose === 'true' || args.verbose === true
    );

    // Output JSON to stdout
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

// Export for module use
export { filterCssFile, analyzeHtml, validatePath, sanitizeCss };

// Run if called directly (not imported as module)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('filter-css.js') ||
  process.argv[1].includes('filter-css')
);

if (isMainModule) {
  main();
}
