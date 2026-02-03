/**
 * File copy utilities
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Copy directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Object} options - Options
 * @param {string[]} options.exclude - Patterns to exclude
 */
export async function copyRecursive(src, dest, options = {}) {
  const exclude = options.exclude || [
    'node_modules',
    '.git',
    '__pycache__',
    'test-*.js',
    'run-all-tests.js',
    '.DS_Store',
    '*.log'
  ];

  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Check exclusions
    const shouldExclude = exclude.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        return regex.test(entry.name);
      }
      return entry.name === pattern;
    });

    if (shouldExclude) continue;

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath, options);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Check if path exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
