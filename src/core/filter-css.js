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
 * Memory: Max 10MB CSS input. Large files may cause high memory usage during AST parsing.
 * Reduction: Typical 20-30% reduction. Complex selectors kept conservatively.
 */

import fs from 'fs/promises';
import path from 'path';
import { parseArgs } from '../utils/helpers.js';
import { SIZE_LIMITS } from '../shared/config.js';
import { filterCssRules } from './filter-css-selector-matcher.js';

// ============================================================================
// Constants (re-declared here for backward compatibility and test visibility)
// ============================================================================

/** Maximum CSS input size: 10MB */
const MAX_CSS_INPUT_SIZE = 10 * 1024 * 1024;

/** Rules that should always be kept (critical for layout) */
const ALWAYS_KEEP_PATTERNS = [
  /^html$/i,
  /^body$/i,
  /^\*$/,
  /^:root$/i
];

/** CSS injection patterns to sanitize (XSS vectors) */
const CSS_INJECTION_PATTERNS = [
  /expression\s*\(/gi,
  /-moz-binding\s*:/gi,
  /url\s*\(\s*["']?javascript:/gi,
  /url\s*\(\s*["']?data:text\/html/gi,
  /behavior\s*:/gi,
  /@import\s+["']?javascript:/gi
];

// ============================================================================
// Utility functions (re-declared here for backward compatibility)
// ============================================================================

/**
 * Parse HTML and build sets of all possible selector matches.
 * @param {string} html - HTML content to analyze
 * @returns {{ tags: Set<string>, ids: Set<string>, classes: Set<string>, attributes: Set<string> }}
 */
function analyzeHtml(html) {
  const tags = new Set();
  const ids = new Set();
  const classes = new Set();
  const attributes = new Set();

  const tagMatches = html.matchAll(/<([a-z][a-z0-9]*)/gi);
  for (const match of tagMatches) {
    tags.add(match[1].toLowerCase());
  }

  const idMatches = html.matchAll(/\bid=["']([^"']+)["']/gi);
  for (const match of idMatches) {
    ids.add(match[1]);
  }

  const classMatches = html.matchAll(/\bclass=["']([^"']+)["']/gi);
  for (const match of classMatches) {
    match[1].split(/\s+/).forEach(c => {
      const trimmed = c.trim();
      if (trimmed) classes.add(trimmed);
    });
  }

  const attrMatches = html.matchAll(/\s(data-[a-z0-9-]+)/gi);
  for (const match of attrMatches) {
    attributes.add(match[1].toLowerCase());
  }

  return { tags, ids, classes, attributes };
}

/**
 * Validate file path is within allowed directory (prevents path traversal).
 * @param {string} filePath - Path to validate
 * @param {string} allowedDir - Directory paths must be within
 * @returns {string} Resolved absolute path
 * @throws {Error} If path is outside allowed directory
 */
function validatePath(filePath, allowedDir = process.cwd()) {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);

  if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
    throw new Error(`Path "${filePath}" is outside allowed directory "${allowedDir}"`);
  }

  return resolved;
}

/**
 * Sanitize CSS output to remove potential XSS vectors.
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

/**
 * Main filtering function
 * @param {string} htmlPath - Path to HTML file
 * @param {string} cssPath - Path to raw CSS file
 * @param {string} outputPath - Path for filtered CSS output
 * @param {boolean} verbose - Enable verbose logging
 * @param {string|null} allowedDir - Base directory for path validation (optional)
 * @returns {Promise<Object>} Result object
 */
async function filterCssFile(htmlPath, cssPath, outputPath, verbose = false, allowedDir = null) {
  const startTime = Date.now();

  const resolvedHtml   = allowedDir ? validatePath(htmlPath, allowedDir)   : path.resolve(htmlPath);
  const resolvedCss    = allowedDir ? validatePath(cssPath, allowedDir)    : path.resolve(cssPath);
  const resolvedOutput = allowedDir ? validatePath(outputPath, allowedDir) : path.resolve(outputPath);

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

  if (inputSize > SIZE_LIMITS.MAX_CSS_INPUT) {
    throw new Error(
      `CSS file "${resolvedCss}" (${(inputSize / 1024 / 1024).toFixed(1)}MB) ` +
      `exceeds ${SIZE_LIMITS.MAX_CSS_INPUT / 1024 / 1024}MB limit. ` +
      `Consider splitting the CSS file or increasing SIZE_LIMITS.MAX_CSS_INPUT.`
    );
  }

  if (verbose) console.error(`[CSS Filter] Input CSS size: ${(inputSize / 1024).toFixed(1)}KB`);

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
    ast = csstree.parse(css, { parseRulePrelude: true, parseValue: false });
  } catch (parseError) {
    if (verbose) {
      console.error(`[CSS Filter] Parse error: ${parseError.message}`);
      console.error(`[CSS Filter] Attempting lenient parse...`);
    }
    try {
      ast = csstree.parse(css, { parseRulePrelude: false, parseValue: false });
    } catch (lenientError) {
      throw new Error(`Failed to parse CSS: ${lenientError.message}`);
    }
  }

  const stats = filterCssRules(ast, htmlAnalysis, csstree, verbose);

  let filteredCss = csstree.generate(ast);
  filteredCss = sanitizeCss(filteredCss);
  const outputSize = Buffer.byteLength(filteredCss, 'utf-8');

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
    input: { html: resolvedHtml, css: resolvedCss, cssSize: inputSize },
    output: { path: resolvedOutput, size: outputSize },
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
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
    process.exit(1);
  }
}

// Export for module use (backward-compatible — all original exports preserved)
export { filterCssFile, analyzeHtml, validatePath, sanitizeCss };

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('filter-css.js') ||
  process.argv[1].includes('filter-css')
);

if (isMainModule) {
  main();
}
