/**
 * Uninstall command - remove skill from ~/.claude/skills/
 */

import fs from 'fs/promises';
import readline from 'readline';
import { exists } from '../utils/copy.js';
import { getSkillDest, getCommandsDest } from '../utils/paths.js';

/**
 * Prompt user for confirmation
 * @param {string} message - Prompt message
 * @returns {Promise<boolean>}
 */
function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Uninstall skill from Claude Code skills directory
 * @param {string[]} args - CLI arguments
 */
export async function uninstall(args) {
  const skipConfirm = args.includes('--yes') || args.includes('-y');
  const SKILL_DEST = getSkillDest();
  const COMMANDS_DEST = getCommandsDest();

  console.log('design-clone uninstaller\n');

  // Check what exists
  const skillExists = await exists(SKILL_DEST);
  const commandsExist = await exists(COMMANDS_DEST);

  if (!skillExists && !commandsExist) {
    console.log('Nothing to uninstall. design-clone is not installed.');
    return;
  }

  // Show what will be removed
  console.log('The following will be removed:');
  if (skillExists) console.log(`  - ${SKILL_DEST}`);
  if (commandsExist) console.log(`  - ${COMMANDS_DEST}`);
  console.log('');

  // Confirm
  if (!skipConfirm) {
    const confirmed = await confirm('Are you sure you want to uninstall?');
    if (!confirmed) {
      console.log('Uninstall cancelled.');
      return;
    }
    console.log('');
  }

  // Remove directories - attempt both before exiting on errors
  const errors = [];

  if (skillExists) {
    try {
      await fs.rm(SKILL_DEST, { recursive: true, force: true });
      console.log(`  Removed: ${SKILL_DEST}`);
    } catch (error) {
      errors.push(`skill directory: ${error.message}`);
      console.error(`  Error removing skill directory: ${error.message}`);
    }
  }

  if (commandsExist) {
    try {
      await fs.rm(COMMANDS_DEST, { recursive: true, force: true });
      console.log(`  Removed: ${COMMANDS_DEST}`);
    } catch (error) {
      errors.push(`commands directory: ${error.message}`);
      console.error(`  Error removing commands directory: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    process.exit(1);
  }

  // Verify cleanup
  const skillStillExists = await exists(SKILL_DEST);
  const commandsStillExist = await exists(COMMANDS_DEST);

  console.log('');
  if (!skillStillExists && !commandsStillExist) {
    console.log('design-clone uninstalled successfully.');
    console.log('\nTo reinstall: design-clone init');
  } else {
    console.error('Warning: Some files may not have been removed completely.');
    if (skillStillExists) console.error(`  Still exists: ${SKILL_DEST}`);
    if (commandsStillExist) console.error(`  Still exists: ${COMMANDS_DEST}`);
    process.exit(1);
  }
}
