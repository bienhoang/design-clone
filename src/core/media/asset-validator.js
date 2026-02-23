/**
 * Asset Validator
 *
 * Validates downloaded assets via magic bytes and size thresholds.
 * Sanitizes SVG files by stripping script tags and event handlers.
 */

import fs from 'fs/promises';
import path from 'path';

const MAGIC_BYTES = {
  png:   [0x89, 0x50, 0x4E, 0x47],
  jpeg:  [0xFF, 0xD8, 0xFF],
  gif:   [0x47, 0x49, 0x46],
  woff2: [0x77, 0x4F, 0x46, 0x32],
  woff:  [0x77, 0x4F, 0x46, 0x46],
};

const MIN_SIZES = { images: 100, fonts: 1024 };

/**
 * Validate a single asset file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{valid: boolean, type: string, issues: string[]}>}
 */
export async function validateAsset(filePath) {
  const issues = [];
  const ext = path.extname(filePath).toLowerCase().slice(1);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return { valid: false, type: ext, issues: ['File not found'] };
  }

  // Size check
  const isFont = ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext);
  const minSize = isFont ? MIN_SIZES.fonts : MIN_SIZES.images;
  if (stat.size < minSize) {
    issues.push(`File too small: ${stat.size} bytes (min: ${minSize})`);
  }

  // SVG check
  if (ext === 'svg') {
    const content = await fs.readFile(filePath, 'utf-8');
    if (/<script[\s>]/i.test(content)) issues.push('SVG contains script tags');
    if (/\son\w+\s*=/i.test(content)) issues.push('SVG contains event handlers');
    if (issues.length > 0) {
      const sanitized = sanitizeSvg(content);
      await fs.writeFile(filePath, sanitized, 'utf-8');
      return { valid: true, type: 'svg', issues, sanitized: true };
    }
    return { valid: true, type: 'svg', issues: [] };
  }

  // Magic byte check for known types
  const magicKey = ext === 'jpg' ? 'jpeg' : ext;
  const expected = MAGIC_BYTES[magicKey];
  if (expected && stat.size >= expected.length) {
    const buf = Buffer.alloc(expected.length);
    const fh = await fs.open(filePath, 'r');
    await fh.read(buf, 0, expected.length, 0);
    await fh.close();
    const matches = expected.every((b, i) => buf[i] === b);
    if (!matches) issues.push(`Magic bytes mismatch for ${ext}`);
  }

  return { valid: issues.length === 0, type: ext, issues };
}

/**
 * Validate all assets in a directory
 * @param {string} assetsDir - Assets root directory
 * @returns {Promise<{valid: number, invalid: number, sanitized: number, details: Array}>}
 */
export async function validateBatch(assetsDir) {
  const results = { valid: 0, invalid: 0, sanitized: 0, details: [] };
  const subdirs = ['images', 'fonts', 'icons'];

  for (const sub of subdirs) {
    const dir = path.join(assetsDir, sub);
    let files;
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const file of files) {
      const result = await validateAsset(path.join(dir, file));
      if (result.sanitized) results.sanitized++;
      if (result.valid) results.valid++;
      else {
        results.invalid++;
        results.details.push({ file: `${sub}/${file}`, ...result });
      }
    }
  }

  return results;
}

/**
 * Strip dangerous content from SVG
 * @param {string} content - SVG content
 * @returns {string} Sanitized SVG
 */
export function sanitizeSvg(content) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
}
