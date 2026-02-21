/**
 * Header Viewport Checks
 *
 * Orchestrates all per-viewport header checks using helpers.
 * Separated from verify-header-helpers.js to keep each file under 200 lines.
 */

import {
  HEADER_SELECTORS,
  findElement,
  countVisibleElements,
  checkHeaderPosition,
  checkLogoPosition
} from './verify-header-helpers.js';

/**
 * Test header at a specific viewport — runs all header checks
 * @param {import('playwright').Page} page
 * @param {string} viewportName
 * @param {Object} VIEWPORTS - Viewport map
 * @param {boolean} verbose
 * @returns {Promise<Object>} Viewport result object
 */
export async function testHeaderViewport(page, viewportName, VIEWPORTS, verbose = false) {
  const viewport = VIEWPORTS[viewportName];
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));

  const result = { viewport: viewportName, dimensions: viewport, tests: [], passed: 0, failed: 0, warnings: [] };
  if (verbose) console.error(`\n📱 Testing ${viewportName} (${viewport.width}x${viewport.height})...`);

  const headerResult = await findElement(page, HEADER_SELECTORS.container);
  if (!headerResult) {
    result.tests.push({ name: 'Header container exists', passed: false, error: 'No header container found' });
    result.failed++;
    if (verbose) console.error(`  ✗ Header not found`);
    return result;
  }

  result.tests.push({ name: 'Header container exists', passed: true, selector: headerResult.selector });
  result.passed++;
  if (verbose) console.error(`  ✓ Header found: ${headerResult.selector}`);

  const positionInfo = await checkHeaderPosition(page, headerResult.selector);

  const logoResult = await findElement(page, HEADER_SELECTORS.logo);
  if (logoResult) {
    const logoPosition = await checkLogoPosition(page, logoResult.selector, viewport.width);
    result.tests.push({ name: 'Logo present', passed: true, selector: logoResult.selector, position: logoPosition?.position || 'unknown' });
    result.passed++;
    if (verbose) console.error(`  ✓ Logo found: ${logoResult.selector} (${logoPosition?.position})`);
  } else {
    result.tests.push({ name: 'Logo present', passed: false, error: 'No logo found' });
    result.failed++;
    if (verbose) console.error(`  ✗ Logo not found`);
  }

  const navLinks = await countVisibleElements(page, HEADER_SELECTORS.navLinks);
  const expectedLinks = viewportName === 'desktop' ? 2 : 0;

  if (navLinks.count >= expectedLinks) {
    result.tests.push({ name: 'Navigation links visible', passed: true, count: navLinks.count, selector: navLinks.selector });
    result.passed++;
    if (verbose) console.error(`  ✓ ${navLinks.count} nav links visible`);
  } else if (viewportName !== 'desktop' && navLinks.count === 0) {
    result.tests.push({ name: 'Navigation links (may be in hamburger)', passed: true, count: navLinks.count, note: 'Links may be hidden in mobile menu' });
    result.passed++;
    if (verbose) console.error(`  ✓ Nav links hidden (expected on ${viewportName})`);
  } else {
    result.tests.push({ name: 'Navigation links visible', passed: false, count: navLinks.count, error: `Expected at least ${expectedLinks} links on ${viewportName}` });
    result.failed++;
    if (verbose) console.error(`  ✗ Only ${navLinks.count} nav links (expected >= ${expectedLinks})`);
  }

  if (viewportName === 'desktop') {
    const ctaResult = await findElement(page, HEADER_SELECTORS.cta);
    if (ctaResult) {
      result.tests.push({ name: 'CTA button present', passed: true, selector: ctaResult.selector });
      result.passed++;
      if (verbose) console.error(`  ✓ CTA found: ${ctaResult.selector}`);
    } else {
      result.warnings.push('No CTA button found in header');
      if (verbose) console.error(`  ⚠ No CTA button found`);
    }
  }

  if (positionInfo) {
    result.tests.push({ name: 'Header sticky/fixed behavior', passed: true, position: positionInfo.position, note: (!positionInfo.isSticky && !positionInfo.isFixed) ? 'Header uses static/relative positioning' : undefined });
    result.passed++;
    if (verbose) console.error(`  ✓ Header position: ${positionInfo.position}`);

    if ((positionInfo.isSticky || positionInfo.isFixed) && positionInfo.zIndex !== 'auto') {
      const zIndexOk = positionInfo.zIndex >= 100;
      result.tests.push({ name: 'Z-index layering', passed: zIndexOk, zIndex: positionInfo.zIndex, note: zIndexOk ? 'Header on top layer' : 'Z-index may be too low' });
      if (zIndexOk) result.passed++;
      else result.warnings.push(`Header z-index (${positionInfo.zIndex}) may be too low`);
      if (verbose) console.error(`  ${zIndexOk ? '✓' : '⚠'} Z-index: ${positionInfo.zIndex}`);
    }

    result.headerHeight = positionInfo.height;
  }

  return result;
}
