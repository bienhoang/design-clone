#!/usr/bin/env node
/**
 * Test suite for env utilities in utils.js
 * Tests env resolution logic and .env file parsing
 */

import { loadEnv, getEnv, requireEnv, getSkillDir } from '../src/utils.js';
import fs from 'fs';
import path from 'path';
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
  if (!value) throw new Error(`${message}: Expected true, got ${value}`);
}

test('loadEnv() returns string path or null', () => {
  const result = loadEnv();
  if (result !== null && typeof result !== 'string') {
    throw new Error('loadEnv() should return string path or null');
  }
});

test('getEnv() returns value when exists', () => {
  process.env.TEST_ENV_VAR = 'test_value';
  assertEquals(getEnv('TEST_ENV_VAR'), 'test_value', 'getEnv() should return existing var');
});

test('getEnv() returns default when not exists', () => {
  delete process.env.NONEXISTENT_VAR_XYZ;
  assertEquals(getEnv('NONEXISTENT_VAR_XYZ', 'default_val'), 'default_val', 'getEnv() should return default');
});

test('getEnv() returns null when no default and not exists', () => {
  delete process.env.NONEXISTENT_VAR_ABC;
  assertEquals(getEnv('NONEXISTENT_VAR_ABC'), null, 'getEnv() should return null');
});

test('requireEnv() returns value when exists', () => {
  process.env.REQUIRED_TEST = 'required_value';
  assertEquals(requireEnv('REQUIRED_TEST'), 'required_value', 'requireEnv() should return existing var');
});

test('requireEnv() throws when not exists', () => {
  delete process.env.NONEXISTENT_REQUIRED;
  try {
    requireEnv('NONEXISTENT_REQUIRED');
    throw new Error('requireEnv() should throw for missing var');
  } catch (e) {
    if (!e.message.includes('Required env var')) {
      throw new Error('Error message should mention required variable');
    }
  }
});

test('requireEnv() includes hint in error message', () => {
  delete process.env.ANOTHER_MISSING_VAR;
  try {
    requireEnv('ANOTHER_MISSING_VAR', 'Set ANOTHER_MISSING_VAR=value');
    throw new Error('requireEnv() should throw');
  } catch (e) {
    if (!e.message.includes('Set ANOTHER_MISSING_VAR=value')) {
      throw new Error('Error message should include hint');
    }
  }
});

test('getSkillDir() returns valid directory', () => {
  const skillDir = getSkillDir();
  assertTrue(skillDir && skillDir.length > 0, 'getSkillDir() should return non-empty string');
  assertTrue(skillDir.endsWith('design-clone'), 'getSkillDir() should point to design-clone');
  assertTrue(fs.existsSync(skillDir), 'getSkillDir() should point to existing directory');
});

test('getSkillDir() returns absolute path', () => {
  const skillDir = getSkillDir();
  assertTrue(path.isAbsolute(skillDir), 'getSkillDir() should return absolute path');
});

// Run all tests
async function runTests() {
  console.log('Running env utility tests...\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${tests.length} tests passed`);
  if (failed > 0) {
    console.log(`${failed} tests failed`);
    process.exit(1);
  } else {
    console.log('All tests passed!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
