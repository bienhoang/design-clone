/**
 * Verify command - check installation status
 */

import fs from 'fs/promises';
import path from 'path';
import { exists } from '../utils/copy.js';
import { runAllChecks } from '../utils/validate.js';

const getSkillDir = () => path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude/skills/design-clone');

/**
 * Verify skill installation
 */
export async function verify() {
  const SKILL_DIR = getSkillDir();
  let allOk = true;

  console.log('design-clone skill verification\n');

  // Check skill directory
  console.log('Installation:');
  const skillExists = await exists(SKILL_DIR);
  console.log(`  Skill directory: ${skillExists ? '✓' : '✗'} ${SKILL_DIR}`);
  if (!skillExists) {
    console.log('\n  Skill not installed. Run: design-clone init');
    return;
  }

  // Check required files
  const requiredFiles = [
    'SKILL.md',
    'src/core/screenshot.js',
    'src/core/filter-css.js',
    'src/ai/analyze-structure.py',
    'src/utils/browser.js',
    'src/utils/env.js',
    'src/utils/env.py',
    'requirements.txt'
  ];

  let filesOk = true;
  for (const file of requiredFiles) {
    const filePath = path.join(SKILL_DIR, file);
    const fileExists = await exists(filePath);
    if (!fileExists) {
      console.log(`  ${file}: ✗ missing`);
      filesOk = false;
    }
  }
  if (filesOk) {
    console.log(`  Required files: ✓ all present`);
  } else {
    allOk = false;
  }

  // Check node_modules
  const nodeModulesExists = await exists(path.join(SKILL_DIR, 'node_modules'));
  console.log(`  Node modules: ${nodeModulesExists ? '✓' : '✗'} ${nodeModulesExists ? 'installed' : 'not installed'}`);
  if (!nodeModulesExists) allOk = false;

  // Check environment
  console.log('\nEnvironment:');
  const checks = await runAllChecks();

  console.log(`  Node.js:    ${checks.node.ok ? '✓' : '✗'} ${checks.node.message}`);
  console.log(`  Python:     ${checks.python.ok ? '✓' : '✗'} ${checks.python.message}`);
  console.log(`  Playwright: ${checks.playwright.ok ? '✓' : '✗'} ${checks.playwright.message}`);
  console.log(`  Chrome:     ${checks.chrome.ok ? '✓' : '○'} ${checks.chrome.message}${checks.playwright.ok ? ' (optional with Playwright)' : ''}`);

  if (!checks.node.ok) allOk = false;
  if (!checks.playwright.ok && !checks.chrome.ok) allOk = false;

  // Check Gemini API key
  console.log('\nOptional:');
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  console.log(`  GEMINI_API_KEY: ${geminiKey ? '✓ set' : '○ not set (AI analysis disabled)'}`);

  // Check .env files
  const envLocations = [
    path.join(SKILL_DIR, '.env'),
    path.join(process.env.HOME || '', '.claude/skills/.env'),
    path.join(process.env.HOME || '', '.claude/.env')
  ];

  for (const envPath of envLocations) {
    const envExists = await exists(envPath);
    if (envExists) {
      console.log(`  .env found: ${envPath}`);
      break;
    }
  }

  // Summary
  console.log('\nStatus:');
  if (allOk) {
    console.log('  ✓ Ready to use! Try /design:clone in Claude Code');
  } else {
    console.log('  ✗ Some issues found. Run: design-clone init --force');
  }
}
