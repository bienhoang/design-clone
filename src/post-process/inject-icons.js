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
import path from 'path';
import { icons, iconMapping, getIcon, getIconByKeyword } from './icons/japanese-icons.js';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    html: null,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--html':
        options.html = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

/**
 * Extract context from element's surrounding HTML
 */
function extractContext(html, position, range = 200) {
  const start = Math.max(0, position - range);
  const end = Math.min(html.length, position + range);
  return html.slice(start, end);
}

/**
 * Detect icon purpose from class names, aria-label, or surrounding text
 */
function detectIconPurpose(svgTag, context) {
  // Check class names
  const classMatch = svgTag.match(/class=["']([^"']*)["']/i);
  if (classMatch) {
    const classes = classMatch[1].toLowerCase();

    // Check for icon type in class
    for (const keyword of Object.keys(iconMapping)) {
      if (classes.includes(keyword)) {
        return keyword;
      }
    }

    // Check for category hints
    if (classes.includes('icon')) {
      // Try to extract purpose from class like "icon-mail" or "mail-icon"
      const parts = classes.split(/[-_\s]+/);
      for (const part of parts) {
        if (iconMapping[part]) {
          return part;
        }
      }
    }
  }

  // Check aria-label
  const ariaMatch = svgTag.match(/aria-label=["']([^"']*)["']/i);
  if (ariaMatch) {
    const label = ariaMatch[1].toLowerCase();
    for (const keyword of Object.keys(iconMapping)) {
      if (label.includes(keyword)) {
        return keyword;
      }
    }
  }

  // Check surrounding context for hints
  const contextLower = context.toLowerCase();

  // Priority keywords for Japanese business sites
  const priorityKeywords = [
    'mail', 'email', 'phone', 'tel', 'location', 'address',
    'menu', 'search', 'home', 'arrow', 'chevron',
    'user', 'users', 'team', 'company', 'building',
    'twitter', 'facebook', 'instagram', 'linkedin', 'line',
    'check', 'info', 'warning', 'success', 'star',
    'sakura', 'wave', 'zen'
  ];

  for (const keyword of priorityKeywords) {
    if (contextLower.includes(keyword)) {
      return keyword;
    }
  }

  // Default to decorative
  return 'decorative';
}

/**
 * Find SVG elements that need replacement
 */
function findSvgElements(html) {
  const elements = [];

  // Pattern 1: Generic SVG with viewBox (likely placeholder)
  const svgRegex = /<svg[^>]*viewBox=["'][^"']*["'][^>]*>[\s\S]*?<\/svg>/gi;

  let match;
  while ((match = svgRegex.exec(html)) !== null) {
    const svgTag = match[0];
    const context = extractContext(html, match.index);

    // Skip if it's a complex SVG (logo, illustration)
    // Simple icons typically have fewer than 3 path/shape elements
    const pathCount = (svgTag.match(/<(path|circle|rect|line|polyline|polygon)/gi) || []).length;

    // Skip logo SVGs (typically contain text elements or complex paths)
    if (svgTag.includes('<text') || pathCount > 6) {
      continue;
    }

    // Skip if it has specific classes indicating it's a logo
    if (/class=["'][^"']*(logo|brand)[^"']*["']/i.test(svgTag)) {
      continue;
    }

    elements.push({
      original: svgTag,
      position: match.index,
      context: context,
      purpose: detectIconPurpose(svgTag, context)
    });
  }

  return elements;
}

/**
 * Preserve original attributes when replacing SVG
 */
function preserveAttributes(originalSvg, newSvg) {
  // Extract class from original
  const classMatch = originalSvg.match(/class=["']([^"']*)["']/i);
  const widthMatch = originalSvg.match(/width=["']([^"']*)["']/i);
  const heightMatch = originalSvg.match(/height=["']([^"']*)["']/i);
  const ariaMatch = originalSvg.match(/aria-[^=]+=["'][^"']*["']/gi);

  let result = newSvg;

  // Add class if present
  if (classMatch) {
    result = result.replace('<svg', `<svg class="${classMatch[1]}"`);
  }

  // Preserve width/height if specified
  if (widthMatch) {
    result = result.replace('<svg', `<svg width="${widthMatch[1]}"`);
  }
  if (heightMatch) {
    result = result.replace('<svg', `<svg height="${heightMatch[1]}"`);
  }

  // Preserve aria attributes
  if (ariaMatch) {
    const attrs = ariaMatch.join(' ');
    result = result.replace('<svg', `<svg ${attrs}`);
  }

  return result;
}

/**
 * Inject icons into HTML
 */
async function injectIcons(htmlPath, verbose = false) {
  // Read HTML
  const html = await fs.readFile(htmlPath, 'utf-8');

  // Find SVG elements
  const elements = findSvgElements(html);

  if (verbose) {
    console.log(`  Found ${elements.length} SVG elements to enhance`);
  }

  if (elements.length === 0) {
    console.log('  → No SVG icons to enhance');
    return {
      success: true,
      replacedCount: 0
    };
  }

  let updatedHtml = html;
  let replacedCount = 0;
  const replacements = [];

  // Process elements in reverse order to maintain positions
  const sortedElements = [...elements].sort((a, b) => b.position - a.position);

  for (const element of sortedElements) {
    const iconName = iconMapping[element.purpose] || 'decorative-dot';
    const newIcon = getIcon(iconName);
    const preservedIcon = preserveAttributes(element.original, newIcon);

    updatedHtml = updatedHtml.replace(element.original, preservedIcon);
    replacedCount++;

    replacements.push({
      purpose: element.purpose,
      iconName: iconName
    });

    if (verbose) {
      console.log(`  → Replaced: ${element.purpose} → ${iconName}`);
    }
  }

  // Write updated HTML
  await fs.writeFile(htmlPath, updatedHtml, 'utf-8');

  console.log(`  ✓ Enhanced ${replacedCount} icons with Japanese style`);

  return {
    success: true,
    replacedCount,
    replacements
  };
}

/**
 * Add icon styles to HTML if not present
 */
async function ensureIconStyles(htmlPath) {
  const html = await fs.readFile(htmlPath, 'utf-8');

  // Check if icon styles already exist
  if (html.includes('.icon {') || html.includes('/* Icon styles */')) {
    return;
  }

  const iconStyles = `
  /* Japanese-style icon defaults */
  .icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .icon--sm {
    width: 16px;
    height: 16px;
  }

  .icon--lg {
    width: 32px;
    height: 32px;
  }

  .icon--decorative {
    opacity: 0.6;
  }
`;

  // Find </style> or add before </head>
  let updatedHtml;
  if (html.includes('</style>')) {
    updatedHtml = html.replace('</style>', `${iconStyles}\n</style>`);
  } else if (html.includes('</head>')) {
    updatedHtml = html.replace('</head>', `<style>${iconStyles}</style>\n</head>`);
  } else {
    return; // Can't safely add styles
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
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

export { injectIcons, findSvgElements, detectIconPurpose };
