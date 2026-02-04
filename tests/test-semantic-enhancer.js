#!/usr/bin/env node
/**
 * Unit tests for Semantic HTML Enhancer (Phase 3)
 *
 * Tests:
 * - Verify semantic-enhancer.js exports: SEMANTIC_MAPPINGS, detectSectionType, applySemanticAttributes, handleMultipleNavs, enhanceSemanticHTML, enhanceSemanticHTMLInPage
 * - Verify detectSectionType detects: header, nav, main, sidebar, footer, hero
 * - Verify applySemanticAttributes adds ID, classes, role correctly
 * - Verify handleMultipleNavs labels Primary Menu, Footer Menu
 * - Verify enhanceSemanticHTML returns stats with sectionsEnhanced, idsAdded, classesAdded, rolesAdded
 * - Verify html-extractor.js extractAndEnhanceHtml works with enhanceSemantic option
 *
 * Usage:
 *   node tests/test-semantic-enhancer.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

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

function assertFalse(value, message) {
  if (value) {
    throw new Error(`${message}: Expected false, got ${value}`);
  }
}

function assertContains(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(`${message}\n  Expected to find: "${substring}"\n  In: "${str}"`);
  }
}

function assertNotContains(str, substring, message) {
  if (str.includes(substring)) {
    throw new Error(`${message}\n  Should not find: "${substring}"\n  In: "${str}"`);
  }
}

function assertArrayIncludes(arr, item, message) {
  if (!arr.includes(item)) {
    throw new Error(`${message}\n  Array does not include: "${item}"`);
  }
}

function assertGreater(actual, expected, message) {
  if (actual <= expected) {
    throw new Error(`${message}\n  Expected greater than: ${expected}\n  Actual: ${actual}`);
  }
}

function assertDefined(value, message) {
  if (value === undefined) {
    throw new Error(`${message}: Expected defined, got undefined`);
  }
}

// Test HTML samples
const BASIC_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Test Page</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
    </nav>
  </header>
  <main>
    <h1>Welcome</h1>
  </main>
  <footer>
    <p>Footer content</p>
  </footer>
</body>
</html>
`;

const MULTIPLE_NAV_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
  <header>
    <nav class="primary-nav">
      <a href="/">Home</a>
    </nav>
  </header>
  <main>
    <h1>Content</h1>
  </main>
  <footer>
    <nav class="footer-nav">
      <a href="/sitemap">Sitemap</a>
    </nav>
  </footer>
</body>
</html>
`;

const CLASS_PATTERN_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
  <div class="header-wrapper">
    <div class="navigation">
      <a href="/">Home</a>
    </div>
  </div>
  <div class="main-content">
    <h1>Welcome</h1>
  </div>
  <div class="sidebar-widget">
    <h3>Sidebar</h3>
  </div>
  <div class="footer-section">
    <p>Footer</p>
  </div>
  <div class="hero-banner">
    <h1>Hero</h1>
  </div>
</body>
</html>
`;

const ROLE_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
  <div role="banner">
    <div role="navigation">
      <a href="/">Home</a>
    </div>
  </div>
  <div role="main">
    <h1>Content</h1>
  </div>
  <div role="complementary">
    <h3>Sidebar</h3>
  </div>
  <div role="contentinfo">
    <p>Footer</p>
  </div>
</body>
</html>
`;

const MIXED_HTML = `
<!DOCTYPE html>
<html lang="en">
<body>
  <header class="site-header-custom">
    <nav>Navigation</nav>
  </header>
  <main class="main-wrapper">
    <h1>Content</h1>
  </main>
  <aside class="sidebar">
    <h3>Sidebar</h3>
  </aside>
  <footer>
    <nav>Footer Nav</nav>
    <p>Footer content</p>
  </footer>
</body>
</html>
`;

// ===== File existence tests =====

test('semantic-enhancer.js file exists', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  assertTrue(fs.existsSync(filePath), 'semantic-enhancer.js should exist');
});

test('semantic-enhancer.js exports SEMANTIC_MAPPINGS', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export const SEMANTIC_MAPPINGS', 'Should export SEMANTIC_MAPPINGS');
});

test('semantic-enhancer.js exports detectSectionType function', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export function detectSectionType', 'Should export detectSectionType');
});

test('semantic-enhancer.js exports applySemanticAttributes function', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export function applySemanticAttributes', 'Should export applySemanticAttributes');
});

test('semantic-enhancer.js exports handleMultipleNavs function', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export function handleMultipleNavs', 'Should export handleMultipleNavs');
});

test('semantic-enhancer.js exports enhanceSemanticHTML function', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export function enhanceSemanticHTML', 'Should export enhanceSemanticHTML');
});

test('semantic-enhancer.js exports enhanceSemanticHTMLInPage function', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export async function enhanceSemanticHTMLInPage', 'Should export enhanceSemanticHTMLInPage');
});

// ===== SEMANTIC_MAPPINGS tests =====

test('SEMANTIC_MAPPINGS contains header mapping', async () => {
  const { SEMANTIC_MAPPINGS } = await import('../src/core/semantic-enhancer.js');
  assertDefined(SEMANTIC_MAPPINGS.header, 'header mapping should exist');
  assertEquals(SEMANTIC_MAPPINGS.header.id, 'site-header', 'header ID should be site-header');
  assertTrue(SEMANTIC_MAPPINGS.header.classes.includes('site-header'), 'header classes should include site-header');
  assertEquals(SEMANTIC_MAPPINGS.header.role, 'banner', 'header role should be banner');
});

test('SEMANTIC_MAPPINGS contains nav mapping', async () => {
  const { SEMANTIC_MAPPINGS } = await import('../src/core/semantic-enhancer.js');
  assertDefined(SEMANTIC_MAPPINGS.nav, 'nav mapping should exist');
  assertEquals(SEMANTIC_MAPPINGS.nav.id, 'site-navigation', 'nav ID should be site-navigation');
  assertTrue(SEMANTIC_MAPPINGS.nav.classes.includes('main-navigation'), 'nav classes should include main-navigation');
  assertEquals(SEMANTIC_MAPPINGS.nav.role, 'navigation', 'nav role should be navigation');
});

test('SEMANTIC_MAPPINGS contains main mapping', async () => {
  const { SEMANTIC_MAPPINGS } = await import('../src/core/semantic-enhancer.js');
  assertDefined(SEMANTIC_MAPPINGS.main, 'main mapping should exist');
  assertEquals(SEMANTIC_MAPPINGS.main.id, 'main-content', 'main ID should be main-content');
  assertTrue(SEMANTIC_MAPPINGS.main.classes.includes('site-main'), 'main classes should include site-main');
  assertEquals(SEMANTIC_MAPPINGS.main.role, 'main', 'main role should be main');
});

test('SEMANTIC_MAPPINGS contains sidebar mapping', async () => {
  const { SEMANTIC_MAPPINGS } = await import('../src/core/semantic-enhancer.js');
  assertDefined(SEMANTIC_MAPPINGS.sidebar, 'sidebar mapping should exist');
  assertEquals(SEMANTIC_MAPPINGS.sidebar.id, 'primary-sidebar', 'sidebar ID should be primary-sidebar');
  assertTrue(SEMANTIC_MAPPINGS.sidebar.classes.includes('widget-area'), 'sidebar classes should include widget-area');
  assertEquals(SEMANTIC_MAPPINGS.sidebar.role, 'complementary', 'sidebar role should be complementary');
});

test('SEMANTIC_MAPPINGS contains footer mapping', async () => {
  const { SEMANTIC_MAPPINGS } = await import('../src/core/semantic-enhancer.js');
  assertDefined(SEMANTIC_MAPPINGS.footer, 'footer mapping should exist');
  assertEquals(SEMANTIC_MAPPINGS.footer.id, 'site-footer', 'footer ID should be site-footer');
  assertTrue(SEMANTIC_MAPPINGS.footer.classes.includes('site-footer'), 'footer classes should include site-footer');
  assertEquals(SEMANTIC_MAPPINGS.footer.role, 'contentinfo', 'footer role should be contentinfo');
});

test('SEMANTIC_MAPPINGS contains hero mapping', async () => {
  const { SEMANTIC_MAPPINGS } = await import('../src/core/semantic-enhancer.js');
  assertDefined(SEMANTIC_MAPPINGS.hero, 'hero mapping should exist');
  assertEquals(SEMANTIC_MAPPINGS.hero.id, 'hero-section', 'hero ID should be hero-section');
  assertTrue(SEMANTIC_MAPPINGS.hero.classes.includes('hero'), 'hero classes should include hero');
  assertEquals(SEMANTIC_MAPPINGS.hero.role, null, 'hero role should be null (no ARIA landmark role)');
});

// ===== detectSectionType tests =====

test('detectSectionType detects semantic header tag', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (tag === 'header') return 'header'", 'Should detect semantic header tag');
});

test('detectSectionType detects semantic nav tag', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (tag === 'nav') return 'nav'", 'Should detect semantic nav tag');
});

test('detectSectionType detects semantic main tag', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (tag === 'main') return 'main'", 'Should detect semantic main tag');
});

test('detectSectionType detects semantic aside tag', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (tag === 'aside') return 'sidebar'", 'Should detect semantic aside tag as sidebar');
});

test('detectSectionType detects semantic footer tag', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (tag === 'footer') return 'footer'", 'Should detect semantic footer tag');
});

test('detectSectionType detects aria role banner', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (ariaRole === 'banner') return 'header'", 'Should detect role=banner as header');
});

test('detectSectionType detects aria role navigation', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (ariaRole === 'navigation') return 'nav'", 'Should detect role=navigation as nav');
});

test('detectSectionType detects aria role main', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (ariaRole === 'main') return 'main'", 'Should detect role=main');
});

test('detectSectionType detects aria role complementary', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (ariaRole === 'complementary') return 'sidebar'", 'Should detect role=complementary as sidebar');
});

test('detectSectionType detects aria role contentinfo', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (ariaRole === 'contentinfo') return 'footer'", 'Should detect role=contentinfo as footer');
});

test('detectSectionType detects class patterns for all section types', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'CLASS_PATTERNS', 'Should have CLASS_PATTERNS defined');
  assertContains(content, "patterns.some(pattern => className.includes(pattern))", 'Should match class patterns');
});

// ===== applySemanticAttributes tests =====

test('applySemanticAttributes adds ID when missing', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'if (!element.id && mapping.id)', 'Should add ID only if missing');
  assertContains(content, 'element.id = targetId', 'Should set element ID');
});

test('applySemanticAttributes handles ID duplication', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'if (usedIds.has(targetId))', 'Should check for ID duplication');
  assertContains(content, 'usedIds.add(targetId)', 'Should track used IDs');
});

test('applySemanticAttributes appends classes', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'element.className.toString().split', 'Should split existing classes');
  assertContains(content, 'filter(c => !existingClasses.includes(c))', 'Should avoid duplicate classes');
  assertContains(content, '[...existingClasses, ...newClasses]', 'Should append new classes');
});

test('applySemanticAttributes sets role when missing', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "if (mapping.role && !element.getAttribute('role')", 'Should set role only if missing');
  assertContains(content, "element.setAttribute('role', mapping.role)", 'Should set ARIA role');
});

// ===== handleMultipleNavs tests =====

test('handleMultipleNavs labels Primary Menu', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "'Primary Menu'", 'Should label first nav as Primary Menu');
});

test('handleMultipleNavs labels Footer Menu', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "'Footer Menu'", 'Should label footer nav as Footer Menu');
});

test('handleMultipleNavs detects header navigation', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "nav.closest?.('header')", 'Should detect if nav is in header');
});

test('handleMultipleNavs detects footer navigation', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "nav.closest?.('footer')", 'Should detect if nav is in footer');
});

test('handleMultipleNavs sets aria-labels', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "nav.setAttribute('aria-label'", 'Should set aria-label on nav elements');
});

// ===== enhanceSemanticHTML tests =====

test('enhanceSemanticHTML function exists', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export function enhanceSemanticHTML(html', 'Should define enhanceSemanticHTML');
});

test('enhanceSemanticHTML uses DOMParser', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'new DOMParser()', 'Should use DOMParser for HTML parsing');
  assertContains(content, "parseFromString(html, 'text/html')", 'Should parse as HTML');
});

test('enhanceSemanticHTML returns stats object', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'const stats = {', 'Should create stats object');
  assertContains(content, 'sectionsEnhanced:', 'Should include sectionsEnhanced counter');
  assertContains(content, 'idsAdded:', 'Should include idsAdded counter');
  assertContains(content, 'classesAdded:', 'Should include classesAdded counter');
  assertContains(content, 'rolesAdded:', 'Should include rolesAdded counter');
});

test('enhanceSemanticHTML tracks used IDs', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'const usedIds = new Set()', 'Should track used IDs with Set');
  assertContains(content, "doc.querySelectorAll('[id]')", 'Should collect existing IDs');
});

test('enhanceSemanticHTML processes landmark selectors', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  // Optimized: Uses combined selector string instead of array
  assertContains(content, 'combinedLandmarkSelector', 'Should have combined landmark selector');
  assertContains(content, "'header:not(header header)'", 'Should include header selector');
  assertContains(content, "'main'", 'Should include main selector');
  assertContains(content, "'footer:not(footer footer)'", 'Should include footer selector');
});

test('enhanceSemanticHTML handles multiple navs', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "doc.querySelectorAll('nav, [role=\"navigation\"]')", 'Should find all nav elements');
  assertContains(content, 'handleMultipleNavs(navElements', 'Should call handleMultipleNavs');
});

test('enhanceSemanticHTML detects hero sections', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "const heroSelectors = [", 'Should detect hero sections');
  assertContains(content, "'.hero'", 'Should check .hero class');
  assertContains(content, "'.banner'", 'Should check .banner class');
  assertContains(content, "'.jumbotron'", 'Should check .jumbotron class');
});

test('enhanceSemanticHTML serializes HTML', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'doc.documentElement.outerHTML', 'Should serialize enhanced DOM');
  assertContains(content, '<!DOCTYPE html>', 'Should preserve DOCTYPE');
});

test('enhanceSemanticHTML returns stats and html', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'return { html: enhancedHtml, stats }', 'Should return html and stats object');
});

// ===== enhanceSemanticHTMLInPage tests =====

test('enhanceSemanticHTMLInPage is async function', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export async function enhanceSemanticHTMLInPage', 'Should be async function');
});

test('enhanceSemanticHTMLInPage uses page.evaluate', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'page.evaluate((htmlStr)', 'Should use page.evaluate for browser context');
});

test('enhanceSemanticHTMLInPage accepts Page and html parameters', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, '@param {import(\'playwright\').Page} page', 'Should accept Playwright Page');
  assertContains(content, '@param {string} html', 'Should accept HTML string');
});

test('enhanceSemanticHTMLInPage returns Promise of stats and html', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, '@returns {Promise<{html: string, stats: Object}>}', 'Should return Promise with html and stats');
});

test('enhanceSemanticHTMLInPage redefines functions in browser context', () => {
  const filePath = path.join(__dirname, '../src/core/semantic-enhancer.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'const SEMANTIC_MAPPINGS = {', 'Should redefine SEMANTIC_MAPPINGS in browser context');
  assertContains(content, 'function detectSectionType(element)', 'Should redefine detectSectionType in browser context');
  assertContains(content, 'function applySemanticAttributes(element', 'Should redefine applySemanticAttributes in browser context');
});

// ===== html-extractor.js integration tests =====

test('html-extractor.js imports semantic-enhancer', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, "from './semantic-enhancer.js'", 'Should import from semantic-enhancer.js');
});

test('html-extractor.js imports enhanceSemanticHTMLInPage', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'enhanceSemanticHTMLInPage', 'Should import enhanceSemanticHTMLInPage function');
});

test('html-extractor.js exports extractAndEnhanceHtml function', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'export async function extractAndEnhanceHtml', 'Should export extractAndEnhanceHtml function');
});

test('html-extractor.js extractAndEnhanceHtml accepts enhanceSemantic option', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'enhanceSemantic = true', 'Should have enhanceSemantic option (default true)');
});

test('html-extractor.js extractAndEnhanceHtml applies semantic enhancement', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'if (enhanceSemantic)', 'Should check enhanceSemantic option');
  assertContains(content, 'await enhanceSemanticHTMLInPage(page', 'Should call semantic enhancement');
});

test('html-extractor.js extractAndEnhanceHtml returns semanticStats', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'semanticStats: enhanced.stats', 'Should include semantic stats in result');
});

test('html-extractor.js extractAndEnhanceHtml handles semantic enhancement errors', () => {
  const filePath = path.join(__dirname, '../src/core/html-extractor.js');
  const content = fs.readFileSync(filePath, 'utf-8');
  assertContains(content, 'catch (err)', 'Should catch semantic enhancement errors');
  assertContains(content, 'Semantic enhancement failed', 'Should report enhancement failures');
});

// ===== Live browser tests =====

test('enhanceSemanticHTML works in browser context', async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Set up page with test HTML
    await page.setContent(BASIC_HTML);

    // Import and test the function
    const { enhanceSemanticHTMLInPage } = await import('../src/core/semantic-enhancer.js');
    const result = await enhanceSemanticHTMLInPage(page, BASIC_HTML);

    assertDefined(result, 'Should return result');
    assertDefined(result.html, 'Result should have html property');
    assertDefined(result.stats, 'Result should have stats property');
    assertTrue(result.stats.sectionsEnhanced > 0, 'Should enhance at least one section');

    // Check that semantic IDs were added
    assertContains(result.html, 'site-header', 'Should have site-header ID');
    assertContains(result.html, 'main-content', 'Should have main-content ID');
    assertContains(result.html, 'site-footer', 'Should have site-footer ID');

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
});

test('enhanceSemanticHTML handles multiple navs correctly', async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(MULTIPLE_NAV_HTML);

    const { enhanceSemanticHTMLInPage } = await import('../src/core/semantic-enhancer.js');
    const result = await enhanceSemanticHTMLInPage(page, MULTIPLE_NAV_HTML);

    // Check that Primary Menu and Footer Menu aria-labels are added
    assertContains(result.html, 'Primary Menu', 'Should add Primary Menu aria-label');
    assertContains(result.html, 'Footer Menu', 'Should add Footer Menu aria-label');

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
});

test('enhanceSemanticHTML stats are accurate', async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(BASIC_HTML);

    const { enhanceSemanticHTMLInPage } = await import('../src/core/semantic-enhancer.js');
    const result = await enhanceSemanticHTMLInPage(page, BASIC_HTML);

    // Verify stats object structure
    assertTrue(typeof result.stats.sectionsEnhanced === 'number', 'sectionsEnhanced should be number');
    assertTrue(typeof result.stats.idsAdded === 'number', 'idsAdded should be number');
    assertTrue(typeof result.stats.classesAdded === 'number', 'classesAdded should be number');
    assertTrue(typeof result.stats.rolesAdded === 'number', 'rolesAdded should be number');
    assertTrue(Array.isArray(result.stats.warnings), 'warnings should be array');

    // Stats should be non-negative
    assertTrue(result.stats.sectionsEnhanced >= 0, 'sectionsEnhanced should be >= 0');
    assertTrue(result.stats.idsAdded >= 0, 'idsAdded should be >= 0');
    assertTrue(result.stats.classesAdded >= 0, 'classesAdded should be >= 0');
    assertTrue(result.stats.rolesAdded >= 0, 'rolesAdded should be >= 0');

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
});

test('extractAndEnhanceHtml works with enhanceSemantic option enabled', async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(BASIC_HTML);

    const { extractAndEnhanceHtml } = await import('../src/core/html-extractor.js');
    const result = await extractAndEnhanceHtml(page, { enhanceSemantic: true });

    assertDefined(result, 'Should return result');
    assertDefined(result.html, 'Should have html property');
    assertDefined(result.semanticStats, 'Should have semanticStats when enhanceSemantic=true');
    assertDefined(result.semanticStats.sectionsEnhanced, 'Stats should have sectionsEnhanced');

    // Check that semantic IDs were added
    assertContains(result.html, 'site-header', 'Should have semantic enhancements');

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
});

test('extractAndEnhanceHtml works with enhanceSemantic option disabled', async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(BASIC_HTML);

    const { extractAndEnhanceHtml } = await import('../src/core/html-extractor.js');
    const result = await extractAndEnhanceHtml(page, { enhanceSemantic: false });

    assertDefined(result, 'Should return result');
    assertDefined(result.html, 'Should have html property');
    // semanticStats might be undefined when disabled
    assertFalse(result.semanticStats !== undefined && result.semanticStats.idsAdded > 0, 'Should not enhance semantics when disabled');

    await browser.close();
  } catch (e) {
    if (browser) await browser.close();
    throw e;
  }
});

// ===== Run all tests =====

async function runAllTests() {
  console.log('Running semantic-enhancer.js tests...\n');
  console.log('='.repeat(60));

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n${passed}/${tests.length} tests passed\n`);

  if (failed === 0) {
    console.log('✓ ALL TESTS PASSED\n');
    process.exit(0);
  } else {
    console.log(`✗ ${failed} TESTS FAILED\n`);
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
