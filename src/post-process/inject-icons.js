#!/usr/bin/env node
/**
 * Japanese-style SVG Icon Injector for Design Clone
 *
 * Injects Japanese-style SVG icons into generated HTML by:
 * - Detecting generic SVG placeholders
 * - Matching semantic keywords to icon library
 * - Replacing with curated Japanese-aesthetic icons
 *
 * Usage:
 *   node inject-icons.js --html ./index.html
 */

import fs from 'fs/promises';
import { icons, iconMapping, getIcon } from './icons/japanese-icons.js';
import { parseArgs as parseRawArgs } from '../utils/helpers.js';
import { findSvgElements, preserveAttributes } from './inject-icons-svg-replacer.js';

/**
 * Parse command line arguments.
 * @returns {{ html: string|null, verbose: boolean }}
 */
function parseArgs() {
  const raw = parseRawArgs(process.argv.slice(2));
  return {
    html:    raw.html    || null,
    verbose: raw.verbose === true || raw.verbose === 'true'
  };
}

/**
 * Detect icon purpose from class names, aria-label, or surrounding text.
 * @param {string} svgTag - The SVG opening tag markup
 * @param {string} context - Surrounding HTML context string
 * @returns {string} Matched keyword or 'decorative'
 */
export function detectIconPurpose(svgTag, context) {
  const classMatch = svgTag.match(/class=["']([^"']*)["']/i);
  if (classMatch) {
    const classes = classMatch[1].toLowerCase();
    for (const keyword of Object.keys(iconMapping)) {
      if (classes.includes(keyword)) return keyword;
    }
    if (classes.includes('icon')) {
      const parts = classes.split(/[-_\s]+/);
      for (const part of parts) {
        if (iconMapping[part]) return part;
      }
    }
  }

  const ariaMatch = svgTag.match(/aria-label=["']([^"']*)["']/i);
  if (ariaMatch) {
    const label = ariaMatch[1].toLowerCase();
    for (const keyword of Object.keys(iconMapping)) {
      if (label.includes(keyword)) return keyword;
    }
  }

  const contextLower = context.toLowerCase();
  const priorityKeywords = [
    'mail', 'email', 'phone', 'tel', 'location', 'address',
    'menu', 'search', 'home', 'arrow', 'chevron',
    'user', 'users', 'team', 'company', 'building',
    'twitter', 'facebook', 'instagram', 'linkedin', 'line',
    'check', 'info', 'warning', 'success', 'star',
    'sakura', 'wave', 'zen'
  ];
  for (const keyword of priorityKeywords) {
    if (contextLower.includes(keyword)) return keyword;
  }

  return 'decorative';
}

/**
 * Inject replacement icons into HTML file.
 * @param {string} htmlPath
 * @param {boolean} verbose
 * @returns {Promise<{ success: boolean, replacedCount: number, replacements?: Array }>}
 */
export async function injectIcons(htmlPath, verbose = false) {
  const html     = await fs.readFile(htmlPath, 'utf-8');
  const elements = findSvgElements(html, detectIconPurpose);

  if (verbose) console.log(`  Found ${elements.length} SVG elements to enhance`);

  if (elements.length === 0) {
    console.log('  → No SVG icons to enhance');
    return { success: true, replacedCount: 0 };
  }

  let updatedHtml   = html;
  let replacedCount = 0;
  const replacements = [];

  // Process in reverse order to preserve character positions
  const sorted = [...elements].sort((a, b) => b.position - a.position);

  for (const element of sorted) {
    const iconName      = iconMapping[element.purpose] || 'decorative-dot';
    const newIcon       = getIcon(iconName);
    const preservedIcon = preserveAttributes(element.original, newIcon);

    updatedHtml = updatedHtml.replace(element.original, preservedIcon);
    replacedCount++;
    replacements.push({ purpose: element.purpose, iconName });

    if (verbose) console.log(`  → Replaced: ${element.purpose} → ${iconName}`);
  }

  await fs.writeFile(htmlPath, updatedHtml, 'utf-8');
  console.log(`  ✓ Enhanced ${replacedCount} icons with Japanese style`);

  return { success: true, replacedCount, replacements };
}

/**
 * Ensure icon base styles are present in HTML (idempotent).
 * @param {string} htmlPath
 */
export async function ensureIconStyles(htmlPath) {
  const html = await fs.readFile(htmlPath, 'utf-8');
  if (html.includes('.icon {') || html.includes('/* Icon styles */')) return;

  const iconStyles = `
  /* Japanese-style icon defaults */
  .icon { width: 24px; height: 24px; flex-shrink: 0; }
  .icon--sm { width: 16px; height: 16px; }
  .icon--lg { width: 32px; height: 32px; }
  .icon--decorative { opacity: 0.6; }
`;

  let updatedHtml;
  if (html.includes('</style>')) {
    updatedHtml = html.replace('</style>', `${iconStyles}\n</style>`);
  } else if (html.includes('</head>')) {
    updatedHtml = html.replace('</head>', `<style>${iconStyles}</style>\n</head>`);
  } else {
    return;
  }

  await fs.writeFile(htmlPath, updatedHtml, 'utf-8');
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();

  if (!args.html) {
    console.error('Usage: node inject-icons.js --html <path>');
    process.exit(1);
  }

  injectIcons(args.html, args.verbose)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error('Error:', error.message); process.exit(1); });
}
