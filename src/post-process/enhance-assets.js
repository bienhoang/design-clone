#!/usr/bin/env node
/**
 * Asset Enhancement Orchestrator for Design Clone
 *
 * Enhances generated HTML with:
 * 1. Real images from Unsplash (replaces placeholders)
 * 2. Japanese-style SVG icons
 *
 * Usage:
 *   node enhance-assets.js <output-dir> [--verbose]
 *
 * Environment:
 *   UNSPLASH_ACCESS_KEY - Optional, for image fetching
 *
 * This script is called automatically by /design:clone after HTML generation.
 */

import fs from 'fs/promises';
import path from 'path';
import { fetchImages } from './fetch-images.js';
import { injectIcons } from './inject-icons.js';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    outputDir: null,
    verbose: false,
    skipImages: false,
    skipIcons: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--skip-images') {
      options.skipImages = true;
    } else if (arg === '--skip-icons') {
      options.skipIcons = true;
    } else if (!arg.startsWith('-')) {
      options.outputDir = arg;
    }
  }

  return options;
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main enhancement function
 */
async function enhanceAssets(outputDir, options = {}) {
  const {
    verbose = false,
    skipImages = false,
    skipIcons = false
  } = options;

  const htmlPath = path.join(outputDir, 'index.html');
  const structurePath = path.join(outputDir, 'analysis', 'structure.md');

  console.log('🎨 Enhancing assets...');

  // Verify HTML exists
  if (!await fileExists(htmlPath)) {
    console.error(`  ✗ HTML not found: ${htmlPath}`);
    return {
      success: false,
      error: 'HTML file not found'
    };
  }

  const results = {
    success: true,
    images: null,
    icons: null
  };

  // Step 1: Fetch and replace images
  if (!skipImages) {
    if (process.env.UNSPLASH_ACCESS_KEY) {
      console.log('📷 Fetching images from Unsplash...');
      try {
        results.images = await fetchImages(htmlPath, outputDir, verbose);
      } catch (error) {
        console.warn(`  ⚠ Image fetch failed: ${error.message}`);
        results.images = { success: false, error: error.message };
      }
    } else {
      console.log('  → Skipping images (set UNSPLASH_ACCESS_KEY to enable)');
      results.images = { skipped: true };
    }
  }

  // Step 2: Inject Japanese-style icons
  if (!skipIcons) {
    console.log('🎌 Injecting Japanese-style icons...');
    try {
      results.icons = await injectIcons(htmlPath, verbose);
    } catch (error) {
      console.warn(`  ⚠ Icon injection failed: ${error.message}`);
      results.icons = { success: false, error: error.message };
    }
  }

  console.log('✅ Asset enhancement complete');

  return results;
}

// CLI execution
const args = parseArgs();

if (!args.outputDir) {
  console.error('Usage: node enhance-assets.js <output-dir> [--verbose] [--skip-images] [--skip-icons]');
  console.error('');
  console.error('Options:');
  console.error('  --verbose, -v    Show detailed progress');
  console.error('  --skip-images    Skip Unsplash image fetching');
  console.error('  --skip-icons     Skip icon injection');
  console.error('');
  console.error('Environment:');
  console.error('  UNSPLASH_ACCESS_KEY    Your Unsplash API key (optional)');
  process.exit(1);
}

enhanceAssets(args.outputDir, {
  verbose: args.verbose,
  skipImages: args.skipImages,
  skipIcons: args.skipIcons
})
  .then(result => {
    if (args.verbose) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });

export { enhanceAssets };
