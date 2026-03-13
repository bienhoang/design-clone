/**
 * Clone Site Command
 *
 * Capture multi-viewport screenshots of multiple pages from a website.
 * Screenshots are used by Claude Code vision to generate new HTML/CSS.
 *
 * Usage:
 *   design-clone clone-site <url> [options]
 *
 * Options:
 *   --pages <paths>     Comma-separated paths (e.g., /,/about,/contact)
 *   --max-pages <n>     Maximum pages to clone (default: 10)
 *   --viewports <list>  Viewport list (default: desktop,tablet,mobile)
 *   --yes               Skip confirmation prompt
 *   --output <dir>      Custom output directory
 */

import fs from 'fs/promises';
import path from 'path';

import { cloneSite as cloneSiteCore } from '../../src/clone-site.js';

/**
 * Generate output directory name
 * @param {string} url - Target URL
 * @returns {string} Output directory path
 */
function generateOutputDir(url) {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace(/^www\./, '');
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 13);

  return `./cloned-designs/${timestamp}-${domain}`;
}

/**
 * Parse CLI arguments
 * @param {string[]} args - CLI arguments
 * @returns {Object} Parsed options
 */
export function parseArgs(args) {
  const options = {
    url: null,
    pages: null,
    maxPages: 10,
    viewports: ['desktop', 'tablet', 'mobile'],
    skipConfirm: false,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--pages' && args[i + 1]) {
      options.pages = args[++i].split(',').map(p => p.trim());
    } else if (arg === '--max-pages' && args[i + 1]) {
      options.maxPages = parseInt(args[++i], 10);
    } else if (arg === '--viewports' && args[i + 1]) {
      options.viewports = args[++i].split(',').map(v => v.trim());
    } else if (arg === '--yes' || arg === '-y') {
      options.skipConfirm = true;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (!arg.startsWith('--') && !options.url) {
      options.url = arg;
    }
  }

  return options;
}

/**
 * Clone multiple pages from a website (screenshot-only capture)
 * @param {string} url - Target URL
 * @param {Object} options - Clone options
 * @returns {Promise<Object>} Clone result
 */
export async function cloneSite(url, options = {}) {
  const {
    pages: manualPages,
    maxPages = 10,
    output
  } = options;

  const outputDir = output || generateOutputDir(url);

  return cloneSiteCore(url, {
    pages: manualPages,
    maxPages,
    output: outputDir,
  });
}

/**
 * Show help message
 */
export function showHelp() {
  console.log(`
Usage: design-clone clone-site <url> [options]

Capture multi-viewport screenshots of multiple pages from a website.

Options:
  --pages <paths>     Comma-separated paths (e.g., /,/about,/contact)
  --max-pages <n>     Maximum pages to auto-discover (default: 10)
  --viewports <list>  Viewport list (default: desktop,tablet,mobile)
  --yes               Skip confirmation prompt
  --output <dir>      Custom output directory

Examples:
  design-clone clone-site https://example.com
  design-clone clone-site https://example.com --max-pages 5
  design-clone clone-site https://example.com --pages /,/about,/contact
`);
}

// CLI entry point
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('clone-site.js') ||
  process.argv[1].includes('clone-site')
);

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.url) {
    console.error('Error: URL is required');
    showHelp();
    process.exit(1);
  }

  cloneSite(options.url, options)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error(`\n[ERROR] ${err.message}`);
      process.exit(1);
    });
}
