#!/usr/bin/env node
/**
 * Run all Phase 02 tests and summarize results
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  { name: 'Node.js env.js tests', cmd: 'node', args: ['test-env-js.js'] },
  { name: 'Python env.py tests', cmd: 'python3', args: ['test-env-py.py'] },
  { name: 'filter-css.js tests', cmd: 'node', args: ['test-filter-css.js'] },
  { name: 'animation-extractor.js tests', cmd: 'node', args: ['test-animation-extractor.js'] },
  { name: 'state-capture.js tests', cmd: 'node', args: ['test-state-capture.js'] },
  { name: 'video-capture.js tests', cmd: 'node', args: ['test-video-capture.js'] },
  { name: 'framework-detector.js tests', cmd: 'node', args: ['test-framework-detector.js'] },
  { name: 'route-discoverers tests', cmd: 'node', args: ['test-route-discoverers.js'] },
  { name: 'app-state-snapshot.js tests', cmd: 'node', args: ['test-app-state-snapshot.js'] },
  { name: 'discover-pages SPA tests', cmd: 'node', args: ['test-discover-pages-spa.js'] },
  { name: 'section-context-mapping tests', cmd: 'node', args: ['test-section-context-mapping.js'] },
  { name: 'enhanced-ai-prompt tests', cmd: 'python3', args: ['test-enhanced-ai-prompt.py'] },
  { name: 'Python imports tests', cmd: 'python3', args: ['test-python-imports.py'] },
  { name: 'Env path order tests', cmd: 'node', args: ['test-env-path-order.js'] },
  { name: 'Integration tests', cmd: 'node', args: ['test-integration.js'] }
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

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        test: test.name,
        code,
        stdout,
        stderr
      });
    });
  });
}

async function runAllTests() {
  console.log('Running all Phase 02 tests...\n');
  console.log('='.repeat(60));

  for (const test of tests) {
    console.log(`\n▶ ${test.name}...`);
    const result = await runTest(test);
    results.push(result);

    if (result.code === 0) {
      console.log(`✓ PASSED`);
      // Extract test count from output if available
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
      // Show first few lines of error
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
