/**
 * Environment variable resolution for design-clone scripts
 *
 * Search order (first found wins, process.env takes precedence):
 * 1. process.env (already set)
 * 2. .env in current working directory
 * 3. .env in skill directory (scripts/design-clone/)
 * 4. .env in ~/.claude/skills/
 * 5. .env in ~/.claude/
 *
 * @module lib/env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From src/utils/ -> go up 2 levels to reach skill root (design-clone/)
const SKILL_DIR = path.resolve(__dirname, '../..');

/**
 * Get user home directory (cross-platform: HOME on Unix, USERPROFILE on Windows)
 * @returns {string} Home directory path
 */
function getHomeDir() {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Get list of .env file search paths
 * @returns {string[]} Array of directory paths to search for .env
 */
function getEnvSearchPaths() {
  const home = getHomeDir();
  return [
    process.cwd(),
    SKILL_DIR,
    home ? path.join(home, '.claude/skills') : null,
    home ? path.join(home, '.claude') : null
  ].filter(Boolean);
}

/**
 * Parse .env file content into key-value object
 * Handles: KEY=value, KEY="quoted value", KEY='quoted', comments (#), empty lines
 * Quote handling: Only strips matching outer quotes (both same type, length >= 2)
 *
 * @param {string} content - .env file content
 * @returns {Object} Parsed key-value pairs
 */
function parseEnvContent(content) {
  const result = {};

  content.split('\n').forEach(line => {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    // Parse KEY=value using partition approach (handles = in value)
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key) return;

    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove matching outer quotes only (double or single)
    // Must have same quote type at both ends, length >= 2
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }

    result[key] = value;
  });

  return result;
}

/**
 * Load environment variables from .env files
 * Only sets variables not already in process.env
 *
 * @returns {string|null} Path to loaded .env file, or null if none found
 */
export function loadEnv() {
  const searchPaths = getEnvSearchPaths();

  for (const dir of searchPaths) {
    const envPath = path.join(dir, '.env');

    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const parsed = parseEnvContent(content);

        // Only set vars not already in process.env
        Object.entries(parsed).forEach(([key, value]) => {
          if (!process.env[key]) {
            process.env[key] = value;
          }
        });

        return envPath;
      } catch (err) {
        console.error(`[env] Failed to read ${envPath}: ${err.message}`);
      }
    }
  }

  return null;
}

/**
 * Get environment variable with optional default
 *
 * @param {string} key - Environment variable name
 * @param {string} [defaultValue=null] - Default value if not found
 * @returns {string|null} Variable value or default
 */
export function getEnv(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * Require environment variable, throw if not found
 *
 * @param {string} key - Environment variable name
 * @param {string} [hint] - Hint message for how to set the variable
 * @returns {string} Variable value
 * @throws {Error} If variable not set
 */
export function requireEnv(key, hint = '') {
  const value = process.env[key];
  if (!value) {
    const hintMsg = hint ? `\nHint: ${hint}` : '';
    throw new Error(`Required environment variable ${key} not set.${hintMsg}`);
  }
  return value;
}

/**
 * Get skill directory path
 * @returns {string} Absolute path to skill directory
 */
export function getSkillDir() {
  return SKILL_DIR;
}
