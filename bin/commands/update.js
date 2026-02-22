/**
 * Update command - update installed skill to latest version
 */

import { readFileSync } from 'fs';
import path from 'path';
import { exists } from '../utils/copy.js';
import { getVersion } from '../utils/version.js';
import { getSkillDest } from '../utils/paths.js';
import { init } from './init.js';

/**
 * Read version from installed skill's package.json
 * @returns {string|null} Installed version or null if not found
 */
function getInstalledVersion() {
  const pkgPath = path.join(getSkillDest(), 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return null;
  }
}

/**
 * Update installed skill to current version
 * @param {string[]} args - CLI arguments
 */
export async function update(args) {
  const force = args.includes('--force') || args.includes('-f');
  const skipDeps = args.includes('--skip-deps');
  const SKILL_DEST = getSkillDest();

  console.log('design-clone updater\n');

  // Check if installed
  const installed = await exists(SKILL_DEST);
  if (!installed) {
    console.log('design-clone is not installed.');
    console.log('Run "design-clone init" to install.');
    return;
  }

  // Compare versions
  const currentVersion = getVersion();
  const installedVersion = getInstalledVersion();

  console.log(`  Installed: v${installedVersion || 'unknown'}`);
  console.log(`  Available: v${currentVersion}`);
  console.log('');

  if (installedVersion === currentVersion && !force) {
    console.log('Already up to date.');
    console.log('Use --force to reinstall anyway.');
    return;
  }

  // Build args for init
  const initArgs = ['--force'];
  if (skipDeps) initArgs.push('--skip-deps');

  // Run init with --force
  console.log('Updating...\n');
  await init(initArgs);

  // Verify new version
  const newVersion = getInstalledVersion();
  console.log(`\nUpdate complete: v${installedVersion || 'unknown'} -> v${newVersion}`);
}
