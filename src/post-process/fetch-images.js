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

const UNSPLASH_API = 'https://api.unsplash.com';
const PLACEHOLDER_PATTERNS = [
  /https?:\/\/placehold\.co\/[^"'\s)]+/gi,
  /https?:\/\/placeholder\.com\/[^"'\s)]+/gi,
  /https?:\/\/via\.placeholder\.com\/[^"'\s)]+/gi,
  /https?:\/\/picsum\.photos\/[^"'\s)]+/gi
];

// Cache for search results to avoid duplicate API calls
const searchCache = new Map();

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    html: null,
    output: null,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--html':
        options.html = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

/**
 * Extract image contexts from HTML
 * Returns array of { placeholder, alt, context, orientation }
 */
function extractImageContexts(html) {
  const contexts = [];
  const imgRegex = /<img[^>]*>/gi;
  const matches = html.matchAll(imgRegex);

  for (const match of matches) {
    const imgTag = match[0];

    // Check if src is a placeholder
    let placeholderUrl = null;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const srcMatch = imgTag.match(pattern);
      if (srcMatch) {
        placeholderUrl = srcMatch[0];
        break;
      }
    }

    if (!placeholderUrl) continue;

    // Extract alt text
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';

    // Determine orientation from placeholder URL dimensions
    let orientation = 'landscape';
    const dimMatch = placeholderUrl.match(/(\d+)x(\d+)/);
    if (dimMatch) {
      const width = parseInt(dimMatch[1]);
      const height = parseInt(dimMatch[2]);
      if (height > width) orientation = 'portrait';
      else if (height === width) orientation = 'squarish';
    }

    // Extract surrounding context (100 chars before/after)
    const position = match.index;
    const contextStart = Math.max(0, position - 100);
    const contextEnd = Math.min(html.length, position + imgTag.length + 100);
    const surroundingText = html.slice(contextStart, contextEnd)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    contexts.push({
      placeholder: placeholderUrl,
      alt: alt,
      context: surroundingText,
      orientation: orientation,
      originalTag: imgTag
    });
  }

  return contexts;
}

/**
 * Generate search keywords from image context
 */
function generateKeywords(imageContext) {
  const { alt, context } = imageContext;

  // Priority: alt text > surrounding context
  let keywords = alt;

  if (!keywords || keywords.length < 3) {
    // Extract meaningful words from context
    const words = context
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !['http', 'https', 'www', 'html', 'class', 'style'].includes(w));

    keywords = words.slice(0, 3).join(' ');
  }

  // Translate common Japanese keywords for better Unsplash results
  const translations = {
    '会社': 'company office',
    '仕事': 'work business',
    '人': 'people team',
    'サービス': 'service',
    'ビジネス': 'business',
    '技術': 'technology',
    'オフィス': 'office',
    'チーム': 'team',
    'ミーティング': 'meeting',
    '開発': 'development',
    'デザイン': 'design',
    'マーケティング': 'marketing',
    '事例': 'case study business',
    '導入': 'implementation',
    'CTA': 'business success'
  };

  for (const [jp, en] of Object.entries(translations)) {
    if (keywords.includes(jp)) {
      keywords = keywords.replace(jp, en);
    }
  }

  // Default fallback
  if (!keywords || keywords.length < 3) {
    keywords = 'business professional';
  }

  return keywords.trim();
}

/**
 * Search Unsplash for images
 */
async function searchUnsplash(keywords, orientation = 'landscape') {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!apiKey) {
    return null;
  }

  // Check cache
  const cacheKey = `${keywords}-${orientation}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      query: keywords,
      orientation: orientation,
      per_page: '1'
    });

    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`,
        'Accept-Version': 'v1'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn('  ⚠ Unsplash rate limit reached');
      }
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const photo = data.results[0];
      const result = {
        id: photo.id,
        url: photo.urls.regular, // 1080px width
        thumb: photo.urls.thumb,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
        downloadLocation: photo.links.download_location
      };

      searchCache.set(cacheKey, result);
      return result;
    }

    return null;
  } catch (error) {
    console.warn(`  ⚠ Unsplash search failed: ${error.message}`);
    return null;
  }
}

/**
 * Trigger download event for attribution (required by Unsplash API)
 */
async function triggerDownload(downloadLocation) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey || !downloadLocation) return;

  try {
    await fetch(downloadLocation, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`
      }
    });
  } catch {
    // Silently fail - not critical
  }
}

/**
 * Replace placeholder URLs in HTML with Unsplash images
 */
async function replaceImages(html, verbose = false) {
  const contexts = extractImageContexts(html);
  const attributions = [];
  let updatedHtml = html;
  let replacedCount = 0;

  if (verbose) {
    console.log(`  Found ${contexts.length} placeholder images`);
  }

  for (const ctx of contexts) {
    const keywords = generateKeywords(ctx);

    if (verbose) {
      console.log(`  → Searching: "${keywords}" (${ctx.orientation})`);
    }

    const photo = await searchUnsplash(keywords, ctx.orientation);

    if (photo) {
      // Replace placeholder URL with Unsplash URL
      updatedHtml = updatedHtml.replace(ctx.placeholder, photo.url);
      replacedCount++;

      // Track attribution
      attributions.push({
        keywords: keywords,
        photoId: photo.id,
        url: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographerUrl,
        license: 'Unsplash License'
      });

      // Trigger download for attribution tracking
      await triggerDownload(photo.downloadLocation);

      if (verbose) {
        console.log(`    ✓ Found: ${photo.photographer}`);
      }
    } else if (verbose) {
      console.log(`    ✗ No results`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  return { html: updatedHtml, attributions, replacedCount };
}

/**
 * Add attribution comment to HTML
 */
function addAttributionComment(html, attributions) {
  if (attributions.length === 0) return html;

  const comment = `
<!--
  Image Credits (Unsplash)
  ========================
${attributions.map(a => `  - "${a.keywords}": Photo by ${a.photographer} (${a.photographerUrl})`).join('\n')}

  Licensed under the Unsplash License: https://unsplash.com/license
-->
`;

  // Insert after <head> tag
  return html.replace(/<head>/i, `<head>${comment}`);
}

/**
 * Main function
 */
async function fetchImages(htmlPath, outputDir, verbose = false) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!apiKey) {
    console.log('  → Skipping Unsplash (no UNSPLASH_ACCESS_KEY set)');
    return {
      success: true,
      skipped: true,
      message: 'No API key configured'
    };
  }

  // Read HTML
  const html = await fs.readFile(htmlPath, 'utf-8');

  // Replace images
  const { html: updatedHtml, attributions, replacedCount } = await replaceImages(html, verbose);

  if (replacedCount > 0) {
    // Add attribution comment
    const finalHtml = addAttributionComment(updatedHtml, attributions);

    // Write updated HTML
    await fs.writeFile(htmlPath, finalHtml, 'utf-8');

    // Write attribution JSON
    const attrPath = path.join(outputDir, 'attribution.json');
    await fs.writeFile(attrPath, JSON.stringify({
      generated: new Date().toISOString(),
      source: 'Unsplash',
      images: attributions
    }, null, 2), 'utf-8');

    console.log(`  ✓ Replaced ${replacedCount} images from Unsplash`);
  } else {
    console.log('  → No placeholder images found to replace');
  }

  return {
    success: true,
    replacedCount,
    attributions
  };
}

// CLI execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();

  if (!args.html) {
    console.error('Usage: node fetch-images.js --html <path> --output <dir>');
    process.exit(1);
  }

  const outputDir = args.output || path.dirname(args.html);

  fetchImages(args.html, outputDir, args.verbose)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

export { fetchImages, extractImageContexts, generateKeywords };
