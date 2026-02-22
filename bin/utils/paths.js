/**
 * Shared path helpers for CLI commands
 */

import path from 'path';

/**
 * Get user home directory or exit if not available
 * @returns {string} Home directory path
 */
export function getHomeDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    console.error('Error: HOME environment variable is not set.');
    process.exit(1);
  }
  return home;
}

/** Skill installation directory: ~/.claude/skills/design-clone */
export function getSkillDest() {
  return path.join(getHomeDir(), '.claude/skills/design-clone');
}

/** Slash commands directory: ~/.claude/commands/design */
export function getCommandsDest() {
  return path.join(getHomeDir(), '.claude/commands/design');
}
