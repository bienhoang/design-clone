#!/usr/bin/env node
/**
 * Test video-capture.js for:
 * 1. Module structure and exports
 * 2. Input validation
 * 3. Constants
 * 4. hasFfmpeg dependency check
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test utilities
let tests = [];
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

function assertThrows(fn, errorType, message) {
  try {
    fn();
    throw new Error(`${message}: Expected to throw ${errorType}`);
  } catch (e) {
    if (errorType && !(e instanceof errorType)) {
      throw new Error(`${message}: Expected ${errorType.name}, got ${e.constructor.name}`);
    }
  }
}

async function assertThrowsAsync(fn, errorType, message) {
  try {
    await fn();
    throw new Error(`${message}: Expected to throw ${errorType}`);
  } catch (e) {
    if (errorType && !(e instanceof errorType)) {
      throw new Error(`${message}: Expected ${errorType.name}, got ${e.constructor.name}`);
    }
  }
}

// Module imports
let captureVideo, recordScroll, convertToMp4, convertToGif, hasFfmpeg;
let DEFAULT_DURATION, FFMPEG_REQUIRED_FORMATS, MAX_SCROLL_STEPS, VIEWPORT_OVERLAP_FRACTION;

test('video-capture.js module loads successfully', async () => {
  const module = await import('../src/core/video-capture.js');
  captureVideo = module.captureVideo;
  recordScroll = module.recordScroll;
  convertToMp4 = module.convertToMp4;
  convertToGif = module.convertToGif;
  hasFfmpeg = module.hasFfmpeg;
  DEFAULT_DURATION = module.DEFAULT_DURATION;
  FFMPEG_REQUIRED_FORMATS = module.FFMPEG_REQUIRED_FORMATS;
  MAX_SCROLL_STEPS = module.MAX_SCROLL_STEPS;
  VIEWPORT_OVERLAP_FRACTION = module.VIEWPORT_OVERLAP_FRACTION;

  assertTrue(typeof captureVideo === 'function', 'captureVideo should be a function');
  assertTrue(typeof recordScroll === 'function', 'recordScroll should be a function');
  assertTrue(typeof convertToMp4 === 'function', 'convertToMp4 should be a function');
  assertTrue(typeof convertToGif === 'function', 'convertToGif should be a function');
  assertTrue(typeof hasFfmpeg === 'function', 'hasFfmpeg should be a function');
});

test('DEFAULT_DURATION constant is correct', async () => {
  assertEquals(DEFAULT_DURATION, 12000, 'DEFAULT_DURATION should be 12000ms');
});

test('FFMPEG_REQUIRED_FORMATS contains mp4 and gif', async () => {
  assertTrue(Array.isArray(FFMPEG_REQUIRED_FORMATS), 'FFMPEG_REQUIRED_FORMATS should be an array');
  assertTrue(FFMPEG_REQUIRED_FORMATS.includes('mp4'), 'Should include mp4');
  assertTrue(FFMPEG_REQUIRED_FORMATS.includes('gif'), 'Should include gif');
  assertTrue(!FFMPEG_REQUIRED_FORMATS.includes('webm'), 'Should not include webm');
});

test('MAX_SCROLL_STEPS constant is reasonable', async () => {
  assertEquals(MAX_SCROLL_STEPS, 100, 'MAX_SCROLL_STEPS should be 100');
});

test('VIEWPORT_OVERLAP_FRACTION constant is correct', async () => {
  assertEquals(VIEWPORT_OVERLAP_FRACTION, 0.5, 'VIEWPORT_OVERLAP_FRACTION should be 0.5');
});

test('recordScroll throws for page without initialized viewport', async () => {
  const fakePageNoViewport = {
    evaluate: () => {},
    viewport: () => null
  };

  await assertThrowsAsync(
    async () => await recordScroll(fakePageNoViewport, '/tmp/test.webm'),
    Error,
    'Should throw Error for page without viewport'
  );
});

test('hasFfmpeg returns boolean', async () => {
  const result = await hasFfmpeg();
  assertTrue(typeof result === 'boolean', 'hasFfmpeg() should return boolean');
});

test('recordScroll validates page parameter', async () => {
  await assertThrowsAsync(
    async () => await recordScroll(null, '/tmp/test.webm'),
    TypeError,
    'Should throw TypeError for null page'
  );

  await assertThrowsAsync(
    async () => await recordScroll({}, '/tmp/test.webm'),
    TypeError,
    'Should throw TypeError for invalid page object'
  );
});

test('recordScroll validates outputPath parameter', async () => {
  const fakePage = { evaluate: () => {} };

  await assertThrowsAsync(
    async () => await recordScroll(fakePage, null),
    TypeError,
    'Should throw TypeError for null outputPath'
  );

  await assertThrowsAsync(
    async () => await recordScroll(fakePage, ''),
    TypeError,
    'Should throw TypeError for empty outputPath'
  );
});

test('captureVideo validates page parameter', async () => {
  await assertThrowsAsync(
    async () => await captureVideo(null, '/tmp'),
    TypeError,
    'Should throw TypeError for null page'
  );
});

test('captureVideo validates outputDir parameter', async () => {
  const fakePage = { evaluate: () => {}, viewport: () => ({ height: 900 }) };

  await assertThrowsAsync(
    async () => await captureVideo(fakePage, null),
    TypeError,
    'Should throw TypeError for null outputDir'
  );
});

test('convertToMp4 validates inputPath parameter', async () => {
  await assertThrowsAsync(
    async () => await convertToMp4(null, '/tmp/out.mp4'),
    TypeError,
    'Should throw TypeError for null inputPath'
  );

  await assertThrowsAsync(
    async () => await convertToMp4('', '/tmp/out.mp4'),
    TypeError,
    'Should throw TypeError for empty inputPath'
  );
});

test('convertToMp4 validates outputPath parameter', async () => {
  await assertThrowsAsync(
    async () => await convertToMp4('/tmp/in.webm', null),
    TypeError,
    'Should throw TypeError for null outputPath'
  );
});

test('convertToGif validates inputPath parameter', async () => {
  await assertThrowsAsync(
    async () => await convertToGif(null, '/tmp/out.gif'),
    TypeError,
    'Should throw TypeError for null inputPath'
  );
});

test('convertToGif validates outputPath parameter', async () => {
  await assertThrowsAsync(
    async () => await convertToGif('/tmp/in.webm', null),
    TypeError,
    'Should throw TypeError for null outputPath'
  );
});

// Run all tests
async function runTests() {
  console.log('Running video-capture.js tests...\n');

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
