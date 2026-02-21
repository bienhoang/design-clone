/**
 * HTML Analyzer for CSS Filtering
 *
 * Parses HTML content to extract tags, IDs, classes, and attributes
 * used as input for CSS selector matching during CSS filtering.
 * Also exports shared constants and sanitization utilities.
 */

import path from 'path';

// Rules that should always be kept (critical for layout)
export const ALWAYS_KEEP_PATTERNS = [
  /^html$/i,
  /^body$/i,
  /^\*$/,
  /^:root$/i
];

// At-rules that should always be kept
export const KEEP_AT_RULES = ['font-face', 'keyframes', 'import', 'charset', 'namespace'];

// CSS injection patterns to sanitize (XSS vectors)
export const CSS_INJECTION_PATTERNS = [
  /expression\s*\(/gi,
  /-moz-binding\s*:/gi,
  /url\s*\(\s*["']?javascript:/gi,
  /url\s*\(\s*["']?data:text\/html/gi,
  /behavior\s*:/gi,
  /@import\s+["']?javascript:/gi
];

/**
 * Parse HTML and build sets of all possible selector matches.
 * Uses regex for speed (no DOM parser needed).
 * @param {string} html - HTML content to analyze
 * @returns {{ tags: Set<string>, ids: Set<string>, classes: Set<string>, attributes: Set<string> }}
 */
export function analyzeHtml(html) {
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

  const commonAttrs = [
    'href', 'src', 'type', 'name', 'value', 'disabled', 'checked',
    'selected', 'readonly', 'required', 'placeholder', 'role',
    'aria-hidden', 'aria-label', 'aria-expanded', 'target', 'rel'
  ];
  commonAttrs.forEach(attr => {
    if (html.includes(attr + '=') || html.includes(attr + ' ') || html.includes(attr + '>')) {
      attributes.add(attr);
    }
  });

  return { tags, ids, classes, attributes };
}

/**
 * Validate file path is within allowed directory (prevents path traversal).
 * @param {string} filePath - Path to validate
 * @param {string} allowedDir - Directory paths must be within (defaults to cwd)
 * @returns {string} Resolved absolute path
 * @throws {Error} If path is outside allowed directory
 */
export function validatePath(filePath, allowedDir = process.cwd()) {
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
export function sanitizeCss(css) {
  let sanitized = css;
  for (const pattern of CSS_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* [sanitized] */');
  }
  return sanitized;
}
