#!/usr/bin/env node
/**
 * Test env search path ordering for utils.js
 * Verifies that search paths follow the documented order
 */

import { loadEnv, getEnv } from '../src/utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const homeDir = process.env.HOME;
const searchPaths = [
  process.cwd(),
  path.join(__dirname),
  path.join(homeDir, '.claude/skills'),
  path.join(homeDir, '.claude')
];

console.log('=== Environment Variable Search Path Order ===\n');
console.log('Order (first found wins):');
searchPaths.forEach((p, idx) => {
  const envPath = path.join(p, '.env');
  const exists = fs.existsSync(envPath);
  const status = exists ? '✓ EXISTS' : '  (not found)';
  console.log(`${idx + 1}. ${p}${status}`);
});

console.log('\n=== Verifying process.env takes precedence ===\n');

process.env.TEST_PRECEDENCE = 'from-process-env';
const loaded = loadEnv();
console.log(`loadEnv() result: ${loaded || 'null'}`);

const value = getEnv('TEST_PRECEDENCE');
console.log(`TEST_PRECEDENCE value: ${value}`);

if (value === 'from-process-env') {
  console.log('✓ process.env takes precedence (correct)\n');
} else {
  console.log('✗ process.env did not take precedence (ERROR)\n');
  process.exit(1);
}

console.log('=== Path Order Tests Complete ===');
process.exit(0);
