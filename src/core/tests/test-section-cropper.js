/**
 * Test Section Cropper
 *
 * Usage: node src/core/tests/test-section-cropper.js [screenshot-path]
 *
 * Tests the section cropper with a real screenshot.
 * If no path provided, uses a sample from cloned-designs if available.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { detectSections, getSectionSummary } from '../section-detector.js';
import { cropSections, isSharpAvailable, getCropperSummary } from '../section-cropper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

async function findTestScreenshot() {
  // Look for existing screenshots in cloned-designs
  const clonedDir = path.join(projectRoot, 'cloned-designs');
  try {
    const dirs = await fs.readdir(clonedDir);
    for (const dir of dirs.reverse()) { // newest first
      const desktopPath = path.join(clonedDir, dir, 'analysis', 'desktop.png');
      try {
        await fs.access(desktopPath);
        return desktopPath;
      } catch {
        continue;
      }
    }
  } catch {
    // No cloned-designs directory
  }
  return null;
}

async function testWithUrl(url, outputDir) {
  console.log(`\n=== Testing with URL: ${url} ===\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Navigate
    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Take full-page screenshot
    const screenshotPath = path.join(outputDir, 'test-full.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Detect sections
    console.log('\nDetecting sections...');
    const sections = await detectSections(page, { padding: 40 });
    console.log(`Found ${sections.length} sections:`);
    sections.forEach(s => {
      console.log(`  [${s.index}] ${s.name} (${s.role}) - ${s.bounds.height}px`);
    });

    // Crop sections
    console.log('\nCropping sections...');
    const result = await cropSections(screenshotPath, sections, outputDir);

    console.log(`\nCropped ${result.sections.length} sections:`);
    result.sections.forEach(s => {
      console.log(`  [${s.index}] ${s.filename} - ${s.bounds.width}x${s.bounds.height}`);
    });

    if (result.skipped.length > 0) {
      console.log(`\nSkipped ${result.skipped.length} sections:`);
      result.skipped.forEach(s => {
        console.log(`  [${s.index}] ${s.name} - ${s.reason}`);
      });
    }

    console.log(`\nSummary saved: ${result.summary}`);
    console.log(`Sections directory: ${result.directory}`);

    return result;

  } finally {
    await browser.close();
  }
}

async function testWithExistingScreenshot(screenshotPath, outputDir) {
  console.log(`\n=== Testing with existing screenshot ===`);
  console.log(`Screenshot: ${screenshotPath}\n`);

  // We need a browser to detect sections from the page
  // For existing screenshots, we'll create mock sections based on image height
  const { default: sharp } = await import('sharp');
  const metadata = await sharp(screenshotPath).metadata();

  console.log(`Image size: ${metadata.width}x${metadata.height}`);

  // Create mock sections based on viewport chunking
  const viewportHeight = 900;
  const sections = [];
  let y = 0;
  let index = 0;

  while (y < metadata.height) {
    const height = Math.min(viewportHeight, metadata.height - y);
    sections.push({
      index,
      name: `viewport-${index}`,
      role: 'viewport-chunk',
      bounds: { x: 0, y, width: metadata.width, height }
    });
    y += viewportHeight - 90; // 10% overlap
    index++;
    if (index > 20) break;
  }

  console.log(`Created ${sections.length} viewport chunks`);

  // Crop sections
  console.log('\nCropping sections...');
  const result = await cropSections(screenshotPath, sections, outputDir);

  console.log(`\nCropped ${result.sections.length} sections:`);
  result.sections.forEach(s => {
    console.log(`  [${s.index}] ${s.filename} - ${s.bounds.width}x${s.bounds.height}`);
  });

  return result;
}

async function main() {
  // Check Sharp availability
  if (!isSharpAvailable()) {
    console.error('ERROR: Sharp is not installed. Run: npm install sharp');
    process.exit(1);
  }
  console.log('Sharp is available');

  const arg = process.argv[2];
  const outputDir = path.join(projectRoot, 'test-output', 'section-cropper-test');
  await fs.mkdir(outputDir, { recursive: true });

  let result;

  if (arg && arg.startsWith('http')) {
    // Test with URL
    result = await testWithUrl(arg, outputDir);
  } else if (arg) {
    // Test with provided screenshot path
    result = await testWithExistingScreenshot(arg, outputDir);
  } else {
    // Find existing screenshot or use default URL
    const existingScreenshot = await findTestScreenshot();
    if (existingScreenshot) {
      result = await testWithExistingScreenshot(existingScreenshot, outputDir);
    } else {
      result = await testWithUrl('https://example.com', outputDir);
    }
  }

  // Final summary
  console.log('\n=== Final Summary ===');
  console.log(getCropperSummary(result));
  console.log(`\nOutput directory: ${outputDir}`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
