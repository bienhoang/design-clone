#!/usr/bin/env node
/**
 * Run all tests and summarize results
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  { name: 'Env utility tests', cmd: 'node', args: ['test-env-js.js'] },
  { name: 'Env path order tests', cmd: 'node', args: ['test-env-path-order.js'] },
  { name: 'filter-css.js tests', cmd: 'node', args: ['test-filter-css.js'] },
  { name: 'clone-site.js tests', cmd: 'node', args: ['test-clone-site.js'] },
  { name: 'Integration tests', cmd: 'node', args: ['test-integration.js'] },
  { name: 'CLI utils tests', cmd: 'node', args: ['test-cli-utils.js'] },
];

let totalPassed = 0;
let totalFailed = 0;
let results = [];

function runTest(test) {
  return new Promise((resolve) => {
    const proc = spawn(test.cmd, test.args, {
      cwd: __dirname,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ test: test.name, code, stdout, stderr });
    });
  });
}

async function runAllTests() {
  console.log('Running all tests...\n');
  console.log('='.repeat(60));

  for (const test of tests) {
    console.log(`\n▶ ${test.name}...`);
    const result = await runTest(test);
    results.push(result);

    if (result.code === 0) {
      console.log(`✓ PASSED`);
      const match = result.stdout.match(/(\d+)\/(\d+) tests passed/);
      if (match) {
        const [, passed, total] = match;
        totalPassed += parseInt(passed);
        totalFailed += (parseInt(total) - parseInt(passed));
      }
    } else {
      console.log(`✗ FAILED (exit code: ${result.code})`);
      totalFailed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n=== SUMMARY ===\n');

  let allPassed = true;
  results.forEach(result => {
    const status = result.code === 0 ? '✓' : '✗';
    console.log(`${status} ${result.test}: ${result.code === 0 ? 'PASSED' : 'FAILED'}`);
    if (result.code !== 0) {
      allPassed = false;
      if (result.stderr) {
        console.log(`   Error: ${result.stderr.split('\n')[0]}`);
      }
    }
  });

  console.log(`\nTotal tests passed: ${totalPassed}`);
  console.log(`Total tests failed: ${totalFailed}`);

  if (allPassed) {
    console.log('\n✓ ALL TESTS PASSED\n');
    process.exit(0);
  } else {
    console.log('\n✗ SOME TESTS FAILED\n');
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
