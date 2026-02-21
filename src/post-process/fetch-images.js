#!/usr/bin/env node
/**
 * Unsplash Image Fetcher for Design Clone
 *
 * Fetches relevant images from Unsplash to replace placeholder URLs in generated HTML.
 *
 * Usage:
 *   node fetch-images.js --html ./index.html --output ./
 *
 * Environment:
 *   UNSPLASH_ACCESS_KEY - Your Unsplash API access key
 *
 * Features:
 *   - Extracts context from alt text and surrounding content
 *   - Searches Unsplash for relevant images
 *   - Replaces placehold.co URLs with real images
 *   - Creates attribution.json for credits
 *   - Graceful fallback when API unavailable
 */

import fs from 'fs/promises';
import path from 'path';
import { parseArgs as parseRawArgs } from '../utils/helpers.js';
import { generateKeywords, searchUnsplash, triggerDownload } from './fetch-images-unsplash-client.js';

const PLACEHOLDER_PATTERNS = [
  /https?:\/\/placehold\.co\/[^"'\s)]+/gi,
  /https?:\/\/placeholder\.com\/[^"'\s)]+/gi,
  /https?:\/\/via\.placeholder\.com\/[^"'\s)]+/gi,
  /https?:\/\/picsum\.photos\/[^"'\s)]+/gi
];

/**
 * Parse command line arguments.
 * @returns {{ html: string|null, output: string|null, verbose: boolean }}
 */
function parseArgs() {
  const raw = parseRawArgs(process.argv.slice(2));
  return {
    html:    raw.html    || null,
    output:  raw.output  || null,
    verbose: raw.verbose === true || raw.verbose === 'true'
  };
}

/**
 * Extract image contexts from HTML.
 * @param {string} html
 * @returns {Array<{ placeholder, alt, context, orientation, originalTag }>}
 */
export function extractImageContexts(html) {
  const contexts = [];
  const imgRegex = /<img[^>]*>/gi;

  for (const match of html.matchAll(imgRegex)) {
    const imgTag = match[0];

    let placeholderUrl = null;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const srcMatch = imgTag.match(pattern);
      if (srcMatch) { placeholderUrl = srcMatch[0]; break; }
    }
    if (!placeholderUrl) continue;

    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const alt      = altMatch ? altMatch[1] : '';

    let orientation = 'landscape';
    const dimMatch  = placeholderUrl.match(/(\d+)x(\d+)/);
    if (dimMatch) {
      const w = parseInt(dimMatch[1]);
      const h = parseInt(dimMatch[2]);
      if (h > w)      orientation = 'portrait';
      else if (h === w) orientation = 'squarish';
    }

    const position     = match.index;
    const contextStart = Math.max(0, position - 100);
    const contextEnd   = Math.min(html.length, position + imgTag.length + 100);
    const surroundingText = html.slice(contextStart, contextEnd)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    contexts.push({ placeholder: placeholderUrl, alt, context: surroundingText, orientation, originalTag: imgTag });
  }

  return contexts;
}

/** Build Unsplash attribution HTML comment block. */
function addAttributionComment(html, attributions) {
  if (attributions.length === 0) return html;
  const lines = attributions.map(a => `  - "${a.keywords}": Photo by ${a.photographer} (${a.photographerUrl})`).join('\n');
  const comment = `\n<!--\n  Image Credits (Unsplash)\n  ========================\n${lines}\n\n  Licensed under the Unsplash License: https://unsplash.com/license\n-->\n`;
  return html.replace(/<head>/i, `<head>${comment}`);
}

/**
 * Replace placeholder image URLs in HTML with Unsplash images.
 * @param {string} html
 * @param {boolean} verbose
 * @returns {Promise<{ html: string, attributions: Array, replacedCount: number }>}
 */
async function replaceImages(html, verbose = false) {
  const contexts      = extractImageContexts(html);
  const attributions  = [];
  let updatedHtml     = html;
  let replacedCount   = 0;

  if (verbose) console.log(`  Found ${contexts.length} placeholder images`);

  for (const ctx of contexts) {
    const keywords = generateKeywords(ctx);
    if (verbose) console.log(`  → Searching: "${keywords}" (${ctx.orientation})`);

    const photo = await searchUnsplash(keywords, ctx.orientation);

    if (photo) {
      updatedHtml = updatedHtml.replace(ctx.placeholder, photo.url);
      replacedCount++;

      attributions.push({
        keywords,
        photoId:         photo.id,
        url:             photo.url,
        photographer:    photo.photographer,
        photographerUrl: photo.photographerUrl,
        license:         'Unsplash License'
      });

      await triggerDownload(photo.downloadLocation);
      if (verbose) console.log(`    ✓ Found: ${photo.photographer}`);
    } else if (verbose) {
      console.log(`    ✗ No results`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  return { html: updatedHtml, attributions, replacedCount };
}

/**
 * Main function — reads HTML, replaces images, writes results.
 * @param {string} htmlPath
 * @param {string} outputDir
 * @param {boolean} verbose
 * @returns {Promise<{ success: boolean, replacedCount?: number, attributions?: Array, skipped?: boolean }>}
 */
export async function fetchImages(htmlPath, outputDir, verbose = false) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!apiKey) {
    console.log('  → Skipping Unsplash (no UNSPLASH_ACCESS_KEY set)');
    return { success: true, skipped: true, message: 'No API key configured' };
  }

  const html = await fs.readFile(htmlPath, 'utf-8');
  const { html: updatedHtml, attributions, replacedCount } = await replaceImages(html, verbose);

  if (replacedCount > 0) {
    const finalHtml = addAttributionComment(updatedHtml, attributions);
    await fs.writeFile(htmlPath, finalHtml, 'utf-8');

    const attrPath = path.join(outputDir, 'attribution.json');
    await fs.writeFile(attrPath, JSON.stringify({
      generated: new Date().toISOString(),
      source:    'Unsplash',
      images:    attributions
    }, null, 2), 'utf-8');

    console.log(`  ✓ Replaced ${replacedCount} images from Unsplash`);
  } else {
    console.log('  → No placeholder images found to replace');
  }

  return { success: true, replacedCount, attributions };
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args      = parseArgs();
  const outputDir = args.output || path.dirname(args.html);

  if (!args.html) {
    console.error('Usage: node fetch-images.js --html <path> --output <dir>');
    process.exit(1);
  }

  fetchImages(args.html, outputDir, args.verbose)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error('Error:', error.message); process.exit(1); });
}
