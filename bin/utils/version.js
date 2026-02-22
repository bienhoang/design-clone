/**
 * Version utility - reads version from package.json
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get package version from package.json
 * @returns {string} Version string (e.g., "2.1.0")
 */
export function getVersion() {
  try {
    const pkgPath = resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}
