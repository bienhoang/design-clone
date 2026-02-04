#!/usr/bin/env node
/**
 * Unit tests for DOM Tree Analyzer
 *
 * Tests:
 * - TC1: Tree depth reflects DOM nesting
 * - TC2: W3C landmarks detected correctly
 * - TC3: Headings grouped by section context
 * - TC4: Performance <500ms for typical pages
 * - TC5: Parent-child bidirectional refs
 *
 * Usage:
 *   node tests/test-dom-tree-analyzer.js
 */

import { chromium } from 'playwright';
import { extractDOMHierarchy, MAX_DEPTH, LANDMARK_TAGS, HEADING_TAGS } from '../src/core/dom-tree-analyzer.js';

// Test HTML with semantic structure
const TEST_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: sans-serif; }
    header { height: 80px; background: #333; }
    .hero { height: 500px; background: #f0f0f0; padding: 60px; }
    main { padding: 40px; }
    section { margin: 40px 0; }
    aside { width: 300px; position: fixed; right: 0; top: 100px; background: #eee; padding: 20px; }
    footer { height: 200px; background: #222; color: white; padding: 40px; }
    h1 { font-size: 48px; }
    h2 { font-size: 36px; }
    h3 { font-size: 24px; }
    p { font-size: 16px; }
    .content-section h2 { font-size: 32px; }
    .sidebar h3 { font-size: 18px; }
    footer h3 { font-size: 20px; }
  </style>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  </header>

  <div class="hero">
    <h1>Welcome to Our Site</h1>
    <p>This is the hero section with large typography.</p>
  </div>

  <main>
    <section class="content-section">
      <h2>Features Section</h2>
      <p>This is content in the main area.</p>
      <div class="grid">
        <div class="card">Card 1</div>
        <div class="card">Card 2</div>
        <div class="card">Card 3</div>
      </div>
    </section>

    <section class="content-section">
      <h2>About Section</h2>
      <p>More content here.</p>
    </section>
  </main>

  <aside class="sidebar">
    <h3>Sidebar Title</h3>
    <p>Sidebar content.</p>
  </aside>

  <footer>
    <h3>Contact Us</h3>
    <p>Footer content here.</p>
  </footer>
</body>
</html>
`;

let browser, page;
let passed = 0, failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

async function setup() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  page = await context.newPage();
  await page.setContent(TEST_HTML, { waitUntil: 'networkidle' });
}

async function teardown() {
  if (browser) await browser.close();
}

async function testTC1_TreeDepth() {
  console.log('\nTC1: Tree depth reflects DOM nesting');

  const result = await extractDOMHierarchy(page);

  // body > main > section > div.grid > div.card = 4 levels
  assert(result.stats.maxDepth >= 4, `Max depth >= 4 (got ${result.stats.maxDepth})`);
  assert(result.stats.maxDepth <= MAX_DEPTH, `Max depth <= ${MAX_DEPTH}`);
  assert(result.root.depth === 0, 'Root (body) has depth 0');

  // Check nested children have increasing depth
  const main = result.landmarks.main;
  if (main) {
    assert(main.depth > 0, `Main has depth > 0 (got ${main.depth})`);
    if (main.children.length > 0) {
      assert(main.children[0].depth === main.depth + 1, 'Child depth = parent + 1');
    }
  }
}

async function testTC2_LandmarksDetected() {
  console.log('\nTC2: W3C landmarks detected correctly');

  const result = await extractDOMHierarchy(page);
  const { landmarks } = result;

  assert(landmarks.header !== null, 'Header landmark detected');
  assert(landmarks.main !== null, 'Main landmark detected');
  assert(landmarks.footer !== null, 'Footer landmark detected');
  assert(landmarks.nav.length >= 1, `Nav elements detected (got ${landmarks.nav.length})`);
  assert(landmarks.aside.length >= 1, `Aside elements detected (got ${landmarks.aside.length})`);

  // Verify landmark roles
  if (landmarks.header) {
    assert(landmarks.header.role === 'header-landmark', 'Header has correct role');
  }
  if (landmarks.footer) {
    assert(landmarks.footer.role === 'footer-landmark', 'Footer has correct role');
  }
  if (landmarks.main) {
    assert(landmarks.main.role === 'main', 'Main has correct role');
  }
}

async function testTC3_HeadingsBySection() {
  console.log('\nTC3: Headings grouped by section context');

  const result = await extractDOMHierarchy(page);
  const { headingTree } = result;

  assert(headingTree.length >= 4, `At least 4 headings found (got ${headingTree.length})`);

  // Check section assignments
  const heroH1 = headingTree.find(h => h.level === 1);
  const contentH2s = headingTree.filter(h => h.level === 2 && h.section === 'content');
  const sidebarH3 = headingTree.find(h => h.section === 'sidebar');
  const footerH3 = headingTree.find(h => h.section === 'footer' && h.level === 3);

  assert(heroH1 !== undefined, 'H1 found in heading tree');
  if (heroH1) {
    assert(heroH1.section === 'hero' || heroH1.section === 'content', `H1 in hero/content section (got ${heroH1.section})`);
    assert(heroH1.text?.includes('Welcome'), `H1 text extracted: "${heroH1.text?.slice(0, 20)}..."`);
  }

  assert(contentH2s.length >= 1, `Content H2s found (got ${contentH2s.length})`);
  assert(sidebarH3 !== undefined, 'Sidebar heading detected');
  assert(footerH3 !== undefined, 'Footer heading detected');

  // Verify fontSize populated
  const withFontSize = headingTree.filter(h => h.fontSize !== null);
  assert(withFontSize.length > 0, `Headings have fontSize (${withFontSize.length}/${headingTree.length})`);
}

async function testTC4_Performance() {
  console.log('\nTC4: Performance <500ms for typical pages');

  const result = await extractDOMHierarchy(page);

  assert(result.stats.extractionTimeMs !== undefined, 'Extraction time tracked');
  assert(result.stats.extractionTimeMs < 500, `Extraction time < 500ms (got ${result.stats.extractionTimeMs}ms)`);

  // Additional stats
  assert(result.stats.totalNodes > 0, `Total nodes > 0 (got ${result.stats.totalNodes})`);
  assert(result.stats.pageHeight > 0, `Page height > 0 (got ${result.stats.pageHeight})`);
}

async function testTC5_ParentChildRefs() {
  console.log('\nTC5: Parent-child bidirectional refs');

  const result = await extractDOMHierarchy(page);

  assert(result.root.parentId === null, 'Root has no parent');

  // Verify all children reference parent correctly
  function verifyRefs(node) {
    for (const child of node.children || []) {
      if (child.parentId !== node.id) {
        return false;
      }
      if (!verifyRefs(child)) {
        return false;
      }
    }
    return true;
  }

  assert(verifyRefs(result.root), 'All children reference correct parent');

  // Check specific case
  const main = result.landmarks.main;
  if (main && main.children.length > 0) {
    const firstChild = main.children[0];
    assert(firstChild.parentId === main.id, `Main's child references main (${firstChild.parentId} === ${main.id})`);
  }
}

async function testTC6_SectionContextPriority() {
  console.log('\nTC6: Semantic tags override position heuristics');

  const result = await extractDOMHierarchy(page);

  // Footer should be detected by semantic tag, not just position
  if (result.landmarks.footer) {
    assert(result.landmarks.footer.section === 'footer', 'Footer section from semantic tag');
  }

  // Header should be detected by semantic tag
  if (result.landmarks.header) {
    assert(result.landmarks.header.section === 'header', 'Header section from semantic tag');
  }

  // Aside should be sidebar
  if (result.landmarks.aside.length > 0) {
    assert(result.landmarks.aside[0].section === 'sidebar', 'Aside section = sidebar');
  }
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('DOM Tree Analyzer Unit Tests');
  console.log('='.repeat(60));

  try {
    await setup();

    await testTC1_TreeDepth();
    await testTC2_LandmarksDetected();
    await testTC3_HeadingsBySection();
    await testTC4_Performance();
    await testTC5_ParentChildRefs();
    await testTC6_SectionContextPriority();

  } catch (err) {
    console.error('\n[ERROR]', err.message);
    failed++;
  } finally {
    await teardown();
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
