#!/usr/bin/env node
/**
 * Test script for section-detector.js
 * Usage: node src/core/test-section-detector.js [url]
 */

import { detectSections, getSectionSummary } from './section-detector.js';
import { getBrowser, getPage, closeBrowser } from '../utils/browser.js';

const url = process.argv[2] || 'https://www.techno-concier.co.jp/';

async function test() {
  console.error(`Testing section detection on: ${url}\n`);

  const browser = await getBrowser({ headless: true });
  const page = await getPage(browser);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to stabilize
    await new Promise(r => setTimeout(r, 3000));

    const sections = await detectSections(page, {
      padding: 40,
      minSections: 3,
      minSectionHeight: 150
    });

    const summary = getSectionSummary(sections);

    console.log('=== Summary ===');
    console.log(JSON.stringify(summary, null, 2));

    console.log('\n=== Sections ===');
    for (const s of sections) {
      console.log(`  [${s.index}] ${s.name.padEnd(20)} (${s.role.padEnd(15)}) y:${String(s.bounds.y).padStart(5)} h:${String(s.bounds.height).padStart(5)}`);
    }

    // Output JSON result
    console.log('\n=== JSON Output ===');
    console.log(JSON.stringify({ success: true, sections }, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

test();
