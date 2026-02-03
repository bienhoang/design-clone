/**
 * Init command - install skill to ~/.claude/skills/
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { copyRecursive, exists } from '../utils/copy.js';
import { runAllChecks } from '../utils/validate.js';

const exec = promisify(execCallback);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Source: package root (where SKILL.md is)
const SKILL_SOURCE = path.resolve(__dirname, '../..');
// Destination: ~/.claude/skills/design-clone
const getSkillDest = () => path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude/skills/design-clone');

/**
 * Install skill to Claude Code skills directory
 * @param {string[]} args - CLI arguments
 */
export async function init(args) {
  const force = args.includes('--force') || args.includes('-f');
  const skipDeps = args.includes('--skip-deps');
  const SKILL_DEST = getSkillDest();

  console.log('design-clone skill installer\n');

  // Pre-flight checks
  console.log('Checking requirements...');
  const checks = await runAllChecks();

  console.log(`  Node.js: ${checks.node.ok ? '✓' : '✗'} ${checks.node.message}`);
  console.log(`  Python:  ${checks.python.ok ? '✓' : '✗'} ${checks.python.message}`);
  console.log(`  Chrome:  ${checks.chrome.ok ? '✓' : '✗'} ${checks.chrome.message}`);
  console.log('');

  if (!checks.node.ok) {
    console.error('Error: Node.js 18+ is required');
    process.exit(1);
  }

  if (!checks.python.ok) {
    console.warn('Warning: Python 3.9+ not found. AI analysis features will be unavailable.');
  }

  if (!checks.chrome.ok) {
    console.warn('Warning: Chrome not found. Screenshots may not work without Puppeteer\'s bundled Chromium.');
  }

  // Check existing installation
  const alreadyExists = await exists(SKILL_DEST);
  if (alreadyExists && !force) {
    console.log(`Skill already installed at: ${SKILL_DEST}`);
    console.log('Use --force to overwrite existing installation.');
    return;
  }

  // Copy skill files
  console.log('Installing skill files...');
  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(SKILL_DEST), { recursive: true });

    // Remove existing if force
    if (alreadyExists && force) {
      await fs.rm(SKILL_DEST, { recursive: true, force: true });
    }

    // Copy files (excluding test files and node_modules)
    await copyRecursive(SKILL_SOURCE, SKILL_DEST, {
      exclude: [
        'node_modules',
        '.git',
        '__pycache__',
        'test-*.js',
        'test-*.py',
        'run-all-tests.js',
        '.DS_Store',
        '*.log',
        'cloned-designs',
        'test-output',
        'icons'
      ]
    });

    console.log(`  Copied to: ${SKILL_DEST}`);
  } catch (error) {
    console.error(`Error copying files: ${error.message}`);
    process.exit(1);
  }

  // Install dependencies
  if (!skipDeps) {
    // Node.js dependencies
    console.log('Installing Node.js dependencies...');
    try {
      await exec('npm install --omit=dev', { cwd: SKILL_DEST });
      console.log('  npm packages installed');
    } catch (error) {
      console.warn(`  Warning: npm install failed: ${error.message}`);
    }

    // Python dependencies
    if (checks.python.ok) {
      console.log('Installing Python dependencies...');
      try {
        await exec('pip install -r requirements.txt', { cwd: SKILL_DEST });
        console.log('  Python packages installed');
      } catch (error) {
        console.warn(`  Warning: pip install failed: ${error.message}`);
        console.warn('  Try: pip install google-genai');
      }
    }
  }

  // Success
  console.log('\n✓ design-clone skill installed successfully!\n');
  console.log('Next steps:');
  console.log('  1. (Optional) Set GEMINI_API_KEY in ~/.claude/.env for AI analysis');
  console.log('  2. Use /design:clone or /design:clone-px in Claude Code');
  console.log('\nRun "design-clone verify" to check installation status.');
}
