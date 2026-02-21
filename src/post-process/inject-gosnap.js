#!/usr/bin/env node
/**
 * GoSnap Widget Injector for Design Clone
 *
 * Injects gosnap-widget Web Component into generated HTML files.
 * Scans pages/ directory and adds <go-snap> element before </body>.
 * Idempotent -- skips files that already contain the widget.
 *
 * Usage:
 *   node inject-gosnap.js --dir ./pages [--verbose]
 */

import fs from 'fs/promises';
import path from 'path';

const GOSNAP_TAG = 'go-snap';
const GOSNAP_SNIPPET = `<script src="https://unpkg.com/gosnap-widget@1.0.1/dist/embed.global.js"></script>
<go-snap position="bottom-right" theme="dark" persist></go-snap>`;

/**
 * Inject gosnap-widget into all HTML files in a directory
 * @param {string} pagesDir - Path to directory containing HTML files
 * @param {boolean} [verbose=false] - Show detailed progress
 * @returns {Promise<{success: boolean, injectedCount: number, skippedCount: number}>}
 */
async function injectGosnap(pagesDir, verbose = false) {
  // Guard: check directory exists
  try {
    await fs.access(pagesDir);
  } catch {
    throw new Error(`Directory not found: ${pagesDir}`);
  }

  const entries = await fs.readdir(pagesDir);
  const htmlFiles = entries.filter(f => f.endsWith('.html'));

  let injectedCount = 0;
  let skippedCount = 0;

  for (const file of htmlFiles) {
    const filePath = path.join(pagesDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    if (content.includes(GOSNAP_TAG)) {
      skippedCount++;
      if (verbose) console.log(`  -> Skipped (already present): ${file}`);
      continue;
    }

    if (!content.includes('</body>')) {
      skippedCount++;
      if (verbose) console.log(`  -> Skipped (no </body> tag): ${file}`);
      continue;
    }

    const updated = content.replace('</body>', `\n${GOSNAP_SNIPPET}\n</body>`);
    await fs.writeFile(filePath, updated, 'utf-8');
    injectedCount++;
    if (verbose) console.log(`  -> Injected: ${file}`);
  }

  console.log(`  Injected gosnap-widget into ${injectedCount} file(s), skipped ${skippedCount}`);

  return { success: true, injectedCount, skippedCount };
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  let dir = null;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) dir = args[++i];
    else if (args[i] === '--verbose') verbose = true;
  }

  if (!dir) {
    console.error('Usage: node inject-gosnap.js --dir <path> [--verbose]');
    process.exit(1);
  }

  injectGosnap(dir, verbose)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error('Error:', error.message); process.exit(1); });
}

export { injectGosnap };
