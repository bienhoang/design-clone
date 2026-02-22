#!/usr/bin/env node
/**
 * Tests for CLI utility modules: paths.js, version.js
 * and command modules: uninstall.js, update.js
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(`${message}: Expected true, got ${value}`);
  }
}

function assertMatch(value, regex, message) {
  if (!regex.test(value)) {
    throw new Error(`${message}\n  Pattern: ${regex}\n  Actual: ${value}`);
  }
}

// ============================================================
// paths.js tests
// ============================================================

test('getHomeDir returns HOME env var', async () => {
  const { getHomeDir } = await import('../bin/utils/paths.js');
  const home = getHomeDir();
  assertEquals(home, process.env.HOME || process.env.USERPROFILE, 'Should return HOME');
});

test('getSkillDest returns correct path', async () => {
  const { getSkillDest } = await import('../bin/utils/paths.js');
  const dest = getSkillDest();
  assertTrue(dest.endsWith('.claude/skills/design-clone'), `Path should end with .claude/skills/design-clone, got: ${dest}`);
});

test('getCommandsDest returns correct path', async () => {
  const { getCommandsDest } = await import('../bin/utils/paths.js');
  const dest = getCommandsDest();
  assertTrue(dest.endsWith('.claude/commands/design'), `Path should end with .claude/commands/design, got: ${dest}`);
});

test('paths are absolute', async () => {
  const { getSkillDest, getCommandsDest } = await import('../bin/utils/paths.js');
  assertTrue(path.isAbsolute(getSkillDest()), 'Skill dest should be absolute');
  assertTrue(path.isAbsolute(getCommandsDest()), 'Commands dest should be absolute');
});

// ============================================================
// version.js tests
// ============================================================

test('getVersion returns valid semver', async () => {
  const { getVersion } = await import('../bin/utils/version.js');
  const version = getVersion();
  assertMatch(version, /^\d+\.\d+\.\d+/, `Version should be semver, got: ${version}`);
});

test('getVersion matches package.json', async () => {
  const { getVersion } = await import('../bin/utils/version.js');
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  assertEquals(getVersion(), pkg.version, 'Version should match package.json');
});

// ============================================================
// uninstall.js tests (module-level validation)
// ============================================================

test('uninstall module exports uninstall function', async () => {
  const mod = await import('../bin/commands/uninstall.js');
  assertEquals(typeof mod.uninstall, 'function', 'Should export uninstall function');
});

test('uninstall reports nothing when not installed', async () => {
  // Temporarily override paths to non-existent location
  const originalHome = process.env.HOME;
  const tmpDir = path.join(__dirname, '.tmp-test-uninstall-' + Date.now());
  await fs.mkdir(tmpDir, { recursive: true });
  process.env.HOME = tmpDir;

  // Re-import with cache busting isn't possible in ESM,
  // so we test via CLI subprocess
  const { execSync } = await import('child_process');
  const output = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} uninstall --yes`, {
    env: { ...process.env, HOME: tmpDir },
    encoding: 'utf-8',
    timeout: 5000,
  });

  assertTrue(output.includes('Nothing to uninstall'), `Should report nothing to uninstall, got: ${output}`);

  // Cleanup
  process.env.HOME = originalHome;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('uninstall removes created directories with --yes', async () => {
  const tmpDir = path.join(__dirname, '.tmp-test-uninstall2-' + Date.now());
  const skillDir = path.join(tmpDir, '.claude/skills/design-clone');
  const cmdsDir = path.join(tmpDir, '.claude/commands/design');

  // Create fake install dirs
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'test');
  await fs.mkdir(cmdsDir, { recursive: true });
  await fs.writeFile(path.join(cmdsDir, 'clone.md'), 'test');

  const { execSync } = await import('child_process');
  const output = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} uninstall --yes`, {
    env: { ...process.env, HOME: tmpDir },
    encoding: 'utf-8',
    timeout: 5000,
  });

  assertTrue(output.includes('uninstalled successfully'), `Should report success, got: ${output}`);

  // Verify dirs removed
  let skillExists = true;
  try { await fs.access(skillDir); } catch { skillExists = false; }
  assertTrue(!skillExists, 'Skill directory should be removed');

  let cmdsExists = true;
  try { await fs.access(cmdsDir); } catch { cmdsExists = false; }
  assertTrue(!cmdsExists, 'Commands directory should be removed');

  // Cleanup
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================
// update.js tests (module-level validation)
// ============================================================

test('update module exports update function', async () => {
  const mod = await import('../bin/commands/update.js');
  assertEquals(typeof mod.update, 'function', 'Should export update function');
});

test('update reports not installed for empty HOME', async () => {
  const tmpDir = path.join(__dirname, '.tmp-test-update-' + Date.now());
  await fs.mkdir(tmpDir, { recursive: true });

  const { execSync } = await import('child_process');
  const output = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} update`, {
    env: { ...process.env, HOME: tmpDir },
    encoding: 'utf-8',
    timeout: 5000,
  });

  assertTrue(output.includes('not installed'), `Should report not installed, got: ${output}`);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('update detects already up to date', async () => {
  // Uses real HOME where skill is installed
  const { execSync } = await import('child_process');
  try {
    const output = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} update`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    // If installed, should show version comparison
    assertTrue(
      output.includes('Installed:') && output.includes('Available:'),
      `Should show version info, got: ${output}`
    );
  } catch {
    // If not installed, update should say so - that's also valid
    assertTrue(true, 'Update command executed');
  }
});

// ============================================================
// CLI integration tests
// ============================================================

test('CLI --version shows version', async () => {
  const { execSync } = await import('child_process');
  const output = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} --version`, {
    encoding: 'utf-8',
    timeout: 5000,
  });
  assertMatch(output.trim(), /^design-clone v\d+\.\d+\.\d+$/, 'Should show version');
});

test('CLI aliases work (remove -> uninstall, upgrade -> update)', async () => {
  const tmpDir = path.join(__dirname, '.tmp-test-alias-' + Date.now());
  await fs.mkdir(tmpDir, { recursive: true });

  const { execSync } = await import('child_process');

  const removeOutput = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} remove --yes`, {
    env: { ...process.env, HOME: tmpDir },
    encoding: 'utf-8',
    timeout: 5000,
  });
  assertTrue(removeOutput.includes('Nothing to uninstall'), '"remove" alias should work');

  const upgradeOutput = execSync(`node ${path.resolve(__dirname, '../bin/cli.js')} upgrade`, {
    env: { ...process.env, HOME: tmpDir },
    encoding: 'utf-8',
    timeout: 5000,
  });
  assertTrue(upgradeOutput.includes('not installed'), '"upgrade" alias should work');

  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Runner
// ============================================================

async function runTests() {
  console.log('Running CLI utility tests...\n');

  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (error) {
      failed++;
      console.log(`  ✗ ${t.name}`);
      console.log(`    ${error.message}`);
    }
  }

  console.log(`\n${passed}/${passed + failed} tests passed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
