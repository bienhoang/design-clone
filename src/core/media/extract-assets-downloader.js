/**
 * Asset Downloader Utilities
 *
 * Handles file downloading with timeout/retry, batch rate-limiting,
 * safe filename generation, and asset-type classification.
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// Asset type configurations
export const ASSET_TYPES = {
  images: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'],
    folder: 'images'
  },
  fonts: {
    extensions: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
    folder: 'fonts'
  },
  icons: {
    extensions: ['.svg'],
    folder: 'icons'
  }
};

// Rate limiting configuration
export const RATE_LIMIT = {
  maxConcurrent: 10,
  delayBetweenBatches: 50
};

/**
 * Download a file with timeout and retry.
 * @param {string} url
 * @param {string} destPath
 * @param {number} timeout - ms
 * @param {number} retries
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function downloadFile(url, destPath, timeout = 30000, retries = 2) {
  const protocol = url.startsWith('https') ? https : http;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Download timeout')), timeout);

        const request = protocol.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': '*/*'
          }
        }, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            clearTimeout(timeoutId);
            downloadFile(response.headers.location, destPath, timeout, 0).then(resolve).catch(reject);
            return;
          }

          if (response.statusCode === 429) {
            clearTimeout(timeoutId);
            const retryAfter = parseInt(response.headers['retry-after'] || '0', 10);
            const backoffMs = retryAfter > 0
              ? retryAfter * 1000
              : Math.min(1000 * Math.pow(2, attempt), 8000);
            reject(new Error(`HTTP 429 (retry after ${backoffMs}ms)`));
            return;
          }

          if (response.statusCode !== 200) {
            clearTimeout(timeoutId);
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', async () => {
            clearTimeout(timeoutId);
            try {
              const buffer = Buffer.concat(chunks);
              await fs.mkdir(path.dirname(destPath), { recursive: true });
              await fs.writeFile(destPath, buffer);
              resolve({ size: buffer.length });
            } catch (err) {
              reject(err);
            }
          });
          response.on('error', err => { clearTimeout(timeoutId); reject(err); });
        });

        request.on('error', err => { clearTimeout(timeoutId); reject(err); });
      });

      return { success: true };
    } catch (err) {
      if (attempt === retries) return { success: false, error: err.message };
      const is429 = err.message.includes('HTTP 429');
      const delay = is429
        ? parseInt(err.message.match(/(\d+)ms/)?.[1] || '2000')
        : 500 * (attempt + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Download files in batches with rate limiting.
 * @param {Array<{ url: string, destPath: string, type: string }>} downloads
 * @param {boolean} verbose
 * @returns {Promise<{ success: number, failed: number, skipped: number, errors: Array }>}
 */
export async function downloadBatch(downloads, verbose = false, options = {}) {
  const { maxConcurrent = RATE_LIMIT.maxConcurrent, delayBetween = RATE_LIMIT.delayBetweenBatches } = options;
  const results = { success: 0, failed: 0, skipped: 0, errors: [] };

  for (let i = 0; i < downloads.length; i += maxConcurrent) {
    const batch = downloads.slice(i, i + maxConcurrent);

    await Promise.all(batch.map(async ({ url, destPath, type }) => {
      try {
        await fs.access(destPath);
        results.skipped++;
        return;
      } catch { /* file doesn't exist, continue */ }

      const result = await downloadFile(url, destPath);
      if (result.success) {
        results.success++;
        if (verbose) console.error(`  ✓ ${type}: ${path.basename(destPath)}`);
      } else {
        results.failed++;
        results.errors.push({ url, error: result.error });
        if (verbose) console.error(`  ✗ ${type}: ${path.basename(url)} - ${result.error}`);
      }
    }));

    if (i + maxConcurrent < downloads.length) {
      await new Promise(r => setTimeout(r, delayBetween));
    }
  }

  return results;
}

/**
 * Generate safe filename from URL.
 * @param {string} url
 * @returns {string}
 */
export function getSafeFilename(url) {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname);

    if (urlObj.search) {
      const hash = Buffer.from(urlObj.search).toString('base64').slice(0, 8);
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      filename = `${base}-${hash}${ext}`;
    }

    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!path.extname(filename)) filename += '.bin';

    return filename;
  } catch {
    return `asset-${Date.now()}.bin`;
  }
}

/**
 * Determine asset type from URL extension.
 * @param {string} url
 * @returns {'fonts'|'icons'|'images'|'other'}
 */
export function getAssetType(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (ASSET_TYPES.fonts.extensions.includes(ext)) return 'fonts';
  if (ext === '.svg') return 'icons';
  if (ASSET_TYPES.images.extensions.includes(ext)) return 'images';
  return 'other';
}
