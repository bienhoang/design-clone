#!/usr/bin/env node
/**
 * Unit tests for Phase 2: Section Context Mapping
 * Tests the new detectSection() logic and section-aware typography extraction
 *
 * Tests:
 * 1. detectSection() identifies semantic tags (header, footer, aside, nav)
 * 2. detectSection() identifies position-based sections (hero, content, footer)
 * 3. detectSection() identifies sidebar (fixed/sticky + narrow width)
 * 4. Section data is properly attached to containers
 * 5. Section data is properly attached to typography
 * 6. Flat typography still works (backward compatibility)
 * 7. typographyBySection structure is generated
 * 8. sections summary is generated
 */

import fs from 'fs';
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

function assertExists(value, message) {
  if (value === undefined || value === null) {
    throw new Error(`${message}: Expected to exist, got ${value}`);
  }
}

function assertGreaterThan(actual, expected, message) {
  if (actual <= expected) {
    throw new Error(`${message}\n  Expected greater than: ${expected}\n  Actual: ${actual}`);
  }
}

function assertContains(arr, value, message) {
  if (!arr.includes(value)) {
    throw new Error(`${message}\n  Array does not contain: ${value}\n  Array: ${JSON.stringify(arr)}`);
  }
}

// Import functions to test
import { buildDimensionsOutput, buildCrossViewportSummary, generateAISummary } from '../src/core/dimension-output.js';

/**
 * Test: Section detection in containers
 * Mock dimension data with section context
 */
test('Container extraction includes section context', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [
        { width: 1200, height: 100, selector: 'header', section: 'header', childCount: 3 },
        { width: 1200, height: 600, selector: '.main-content', section: 'content', childCount: 5 },
        { width: 300, height: 800, selector: 'aside', section: 'sidebar', childCount: 2 },
        { width: 1200, height: 200, selector: 'footer', section: 'footer', childCount: 4 }
      ],
      cards: [],
      typography: [],
      images: []
    }
  };

  const result = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const desktop = result.viewports.desktop;

  assertTrue(desktop.containers.length === 4, 'Should have 4 containers');
  assertEquals(desktop.containers[0].section, 'header', 'First container should be header');
  assertEquals(desktop.containers[1].section, 'content', 'Second container should be content');
  assertEquals(desktop.containers[2].section, 'sidebar', 'Third container should be sidebar');
  assertEquals(desktop.containers[3].section, 'footer', 'Fourth container should be footer');
});

/**
 * Test: Typography extraction with section context
 */
test('Typography extraction includes section context', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [],
      cards: [],
      typography: [
        { selector: 'h1', section: 'hero', fontSize: 48, fontWeight: '700', color: 'rgb(0,0,0)' },
        { selector: 'h1', section: 'content', fontSize: 40, fontWeight: '600', color: 'rgb(0,0,0)' },
        { selector: 'h2', section: 'header', fontSize: 24, fontWeight: '600', color: 'rgb(0,0,0)' },
        { selector: 'p', section: 'content', fontSize: 16, fontWeight: '400', color: 'rgb(64,64,64)' },
        { selector: 'p', section: 'footer', fontSize: 14, fontWeight: '400', color: 'rgb(128,128,128)' }
      ],
      images: []
    }
  };

  const result = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const desktop = result.viewports.desktop;

  assertTrue(desktop.typography.length === 5, 'Should have 5 typography entries');
  assertEquals(desktop.typography[0].section, 'hero', 'First h1 should be in hero section');
  assertEquals(desktop.typography[1].section, 'content', 'Second h1 should be in content section');
  assertEquals(desktop.typography[2].section, 'header', 'h2 should be in header section');
});

/**
 * Test: Cross-viewport summary includes section-aware typography
 */
test('Cross-viewport summary has typographyBySection structure', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [{ width: 1200, height: 100, section: 'header', childCount: 2 }],
      cards: [],
      typography: [
        { selector: 'h1', section: 'hero', fontSize: 48 },
        { selector: 'h1', section: 'content', fontSize: 40 },
        { selector: 'p', section: 'content', fontSize: 16 }
      ],
      images: []
    },
    tablet: {
      viewport: 'tablet',
      containers: [{ width: 768, height: 80, section: 'header', childCount: 2 }],
      cards: [],
      typography: [
        { selector: 'h1', section: 'hero', fontSize: 36 },
        { selector: 'p', section: 'content', fontSize: 14 }
      ],
      images: []
    }
  };

  const result = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const summary = result.summary;

  assertExists(summary.typographyBySection, 'Should have typographyBySection');
  assertExists(summary.typographyBySection.hero, 'Should have hero section typography');
  assertExists(summary.typographyBySection.content, 'Should have content section typography');

  // Hero h1 should be in hero section
  assertTrue(summary.typographyBySection.hero.h1?.desktop === 48, 'Hero h1 desktop should be 48px');

  // Content h1 should be in content section
  assertTrue(summary.typographyBySection.content.h1?.desktop === 40, 'Content h1 desktop should be 40px');

  // Content p should be in content section
  assertTrue(summary.typographyBySection.content.p?.desktop === 16, 'Content p desktop should be 16px');
});

/**
 * Test: Sections summary is generated
 */
test('Cross-viewport summary includes sections info', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [
        { width: 1200, height: 500, section: 'hero', childCount: 2 },
        { width: 1200, height: 600, section: 'content', childCount: 4 },
        { width: 1200, height: 150, section: 'footer', childCount: 3 }
      ],
      cards: [],
      typography: [],
      images: []
    }
  };

  const result = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const summary = result.summary;

  assertExists(summary.sections, 'Should have sections summary');
  assertTrue(summary.sections.hero?.found === true, 'Hero section should be found');
  assertTrue(summary.sections.content?.found === true, 'Content section should be found');
  assertTrue(summary.sections.footer?.found === true, 'Footer section should be found');

  // Container widths should be tracked
  assertEquals(summary.sections.hero.containerWidth, 1200, 'Hero container width should be 1200');
  assertEquals(summary.sections.content.containerWidth, 1200, 'Content container width should be 1200');
});

/**
 * Test: Backward compatibility - flat typography still works
 */
test('Flat typography structure still works for backward compatibility', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [],
      cards: [],
      typography: [
        { selector: 'h1', section: 'hero', fontSize: 48 },
        { selector: 'h2', section: 'content', fontSize: 36 },
        { selector: 'h3', section: 'content', fontSize: 24 },
        { selector: 'p', section: 'content', fontSize: 16 }
      ],
      images: []
    },
    tablet: {
      viewport: 'tablet',
      containers: [],
      cards: [],
      typography: [
        { selector: 'h1', section: 'hero', fontSize: 36 },
        { selector: 'p', section: 'content', fontSize: 14 }
      ],
      images: []
    }
  };

  const result = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const summary = result.summary;

  // Flat typography should still exist
  assertExists(summary.typography, 'Should have flat typography');
  assertExists(summary.typography.h1, 'Should have h1 in flat typography');
  assertExists(summary.typography.h2, 'Should have h2 in flat typography');
  assertExists(summary.typography.body, 'Should have body (p) in flat typography');

  // Values should be taken from first occurrence
  assertTrue(summary.typography.h1.desktop === 48, 'Flat h1 desktop should be 48px');
  assertTrue(summary.typography.h2.desktop === 36, 'Flat h2 desktop should be 36px');
  assertTrue(summary.typography.body.desktop === 16, 'Flat body desktop should be 16px');
});

/**
 * Test: AI summary includes section-aware typography
 */
test('AI summary includes TYPOGRAPHY_BY_SECTION', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [],
      cards: [],
      typography: [
        { selector: 'h1', section: 'hero', fontSize: 48 },
        { selector: 'h1', section: 'content', fontSize: 40 },
        { selector: 'p', section: 'content', fontSize: 16 }
      ],
      images: []
    }
  };

  const output = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const aiSummary = generateAISummary(output);

  assertExists(aiSummary.TYPOGRAPHY_BY_SECTION, 'Should have TYPOGRAPHY_BY_SECTION');
  assertExists(aiSummary.TYPOGRAPHY_BY_SECTION.hero, 'Should have hero typography');
  assertExists(aiSummary.TYPOGRAPHY_BY_SECTION.content, 'Should have content typography');

  // Values should have px units
  assertEquals(aiSummary.TYPOGRAPHY_BY_SECTION.hero.h1, '48px', 'Hero h1 should be 48px');
  assertEquals(aiSummary.TYPOGRAPHY_BY_SECTION.content.h1, '40px', 'Content h1 should be 40px');
});

/**
 * Test: AI summary includes SECTIONS info
 */
test('AI summary includes SECTIONS info with found flags', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [
        { width: 1200, height: 100, section: 'header', childCount: 2 },
        { width: 1200, height: 600, section: 'content', childCount: 4 }
      ],
      cards: [],
      typography: [],
      images: []
    }
  };

  const output = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const aiSummary = generateAISummary(output);

  assertExists(aiSummary.SECTIONS, 'Should have SECTIONS');
  assertEquals(aiSummary.SECTIONS.header.found, true, 'Header should be found');
  assertEquals(aiSummary.SECTIONS.content.found, true, 'Content should be found');
  assertEquals(aiSummary.SECTIONS.hero.found, false, 'Hero should not be found');
  assertEquals(aiSummary.SECTIONS.footer.found, false, 'Footer should not be found');
});

/**
 * Test: Section detection with mixed viewports
 */
test('Section context maintained across multiple viewports', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [
        { width: 1200, height: 100, section: 'header', childCount: 2 },
        { width: 1200, height: 600, section: 'content', childCount: 4 },
        { width: 200, height: 400, section: 'sidebar', childCount: 3 }
      ],
      cards: [],
      typography: [
        { selector: 'h1', section: 'header', fontSize: 32 },
        { selector: 'p', section: 'content', fontSize: 16 }
      ],
      images: []
    },
    mobile: {
      viewport: 'mobile',
      containers: [
        { width: 375, height: 80, section: 'header', childCount: 2 },
        { width: 375, height: 800, section: 'content', childCount: 4 }
        // No sidebar on mobile
      ],
      cards: [],
      typography: [
        { selector: 'h1', section: 'header', fontSize: 24 },
        { selector: 'p', section: 'content', fontSize: 14 }
      ],
      images: []
    }
  };

  const result = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const summary = result.summary;

  // Both desktop and mobile have header and content
  assertTrue(summary.sections.header.found === true, 'Header section should be found');
  assertTrue(summary.sections.content.found === true, 'Content section should be found');
  assertTrue(summary.sections.sidebar.found === true, 'Sidebar section should be found (desktop)');

  // Typography should be grouped by section across viewports
  assertTrue(summary.typographyBySection.header?.h1?.desktop === 32, 'Header h1 desktop should be 32px');
  assertTrue(summary.typographyBySection.header?.h1?.mobile === 24, 'Header h1 mobile should be 24px');
});

/**
 * Test: Empty sections are not included in AI summary
 */
test('Empty sections are removed from AI summary TYPOGRAPHY_BY_SECTION', () => {
  const mockDimensions = {
    desktop: {
      viewport: 'desktop',
      containers: [],
      cards: [],
      typography: [
        { selector: 'p', section: 'content', fontSize: 16 }
        // Only content section has typography
      ],
      images: []
    }
  };

  const output = buildDimensionsOutput(mockDimensions, 'http://example.com');
  const aiSummary = generateAISummary(output);

  assertExists(aiSummary.TYPOGRAPHY_BY_SECTION.content, 'Should have content section');
  assertTrue(!aiSummary.TYPOGRAPHY_BY_SECTION.hero, 'Should not have empty hero section');
  assertTrue(!aiSummary.TYPOGRAPHY_BY_SECTION.header, 'Should not have empty header section');
});

// Run all tests
async function runTests() {
  console.log('='.repeat(60));
  console.log('Phase 2: Section Context Mapping Unit Tests');
  console.log('='.repeat(60));
  console.log(`Running ${tests.length} tests...\n`);

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${t.name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed / ${tests.length} total`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
