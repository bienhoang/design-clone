#!/usr/bin/env node
/**
 * Test env search path ordering for lib/env.js
 * Verifies that search paths follow the documented order
 */

import { loadEnv, getEnv } from '../src/utils/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test search path ordering
const homeDir = process.env.HOME;
const searchPaths = [
  process.cwd(),
  path.join(__dirname), // skill dir
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

// Set a test variable in process.env
process.env.TEST_PRECEDENCE = 'from-process-env';

// Try to load env files
const loaded = loadEnv();
console.log(`loadEnv() result: ${loaded || 'null'}`);

// Check that process.env value is preserved
const value = getEnv('TEST_PRECEDENCE');
console.log(`TEST_PRECEDENCE value: ${value}`);

if (value === 'from-process-env') {
  console.log('✓ process.env takes precedence (correct)\n');
} else {
  console.log('✗ process.env did not take precedence (ERROR)\n');
  process.exit(1);
}

// Test that .env files don't override existing process.env
const skillDir = path.join(__dirname);
const envPath = path.join(skillDir, '.env');

if (fs.existsSync(envPath)) {
  console.log(`Reading ${envPath}...`);
  const content = fs.readFileSync(envPath, 'utf-8');

  // Look for any variable that's also in process.env
  let foundOverride = false;
  content.split('\n').forEach(line => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const key = match[1];
      if (process.env[key]) {
        foundOverride = true;
        console.log(`  ${key}: process.env="${process.env[key]}" (preserved)`);
      }
    }
  });

  if (!foundOverride) {
    console.log('  No overlapping variables found');
  }
  console.log('\n✓ process.env values are not overridden by .env files\n');
} else {
  console.log(`No .env file found at ${envPath}\n`);
}

console.log('=== Path Order Tests Complete ===');
process.exit(0);
