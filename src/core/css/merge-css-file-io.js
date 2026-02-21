/**
 * CSS Merge File I/O
 *
 * Reads multiple CSS files from disk, merges them via mergeStylesheets,
 * and writes the result. Separates file system concerns from merge logic.
 */

import fs from 'fs/promises';
import path from 'path';
import { mergeStylesheets } from './merge-css.js';

/**
 * Merge multiple CSS files into a single output file.
 * @param {string[]} cssFiles - Array of CSS file paths
 * @param {string} outputPath - Output file path
 * @param {Object} options - Merge options (passed through to mergeStylesheets)
 * @returns {Promise<Object>} Merge result with success, input, output, stats
 */
export async function mergeCssFiles(cssFiles, outputPath, options = {}) {
  const startTime    = Date.now();
  const cssContents  = [];
  let totalInputSize = 0;

  for (const filePath of cssFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      cssContents.push(content);
      totalInputSize += Buffer.byteLength(content, 'utf-8');
    } catch (err) {
      console.error(`[WARN] Could not read ${filePath}: ${err.message}`);
    }
  }

  if (cssContents.length === 0) {
    return {
      success: false,
      error: 'No CSS files could be read',
      input: { files: cssFiles, totalSize: 0, totalRules: 0 },
      output: null,
      stats: null
    };
  }

  const { css, stats } = mergeStylesheets(cssContents, options);
  const outputSize    = Buffer.byteLength(css, 'utf-8');
  await fs.writeFile(outputPath, css, 'utf-8');

  const duration  = Date.now() - startTime;
  const reduction = totalInputSize > 0
    ? Math.round((1 - outputSize / totalInputSize) * 100)
    : 0;

  return {
    success: true,
    input: {
      files:      cssFiles,
      fileCount:  cssFiles.length,
      totalSize:  totalInputSize,
      totalRules: stats.inputRules
    },
    output: {
      path:  path.resolve(outputPath),
      size:  outputSize,
      rules: stats.outputRules
    },
    stats: { ...stats, reduction: `${reduction}%`, durationMs: duration }
  };
}
