/**
 * Footer Viewport Checks
 *
 * Orchestrates all per-viewport footer checks using helpers.
 * Separated from verify-footer-helpers.js to keep each file under 200 lines.
 */

import {
  FOOTER_SELECTORS,
  findElement,
  countElements,
  countVisibleElements,
  checkFooterPosition,
  checkCopyright
} from './verify-footer-helpers.js';

/**
 * Test footer at a specific viewport — runs all footer checks
 * @param {import('playwright').Page} page
 * @param {string} viewportName
 * @param {Object} VIEWPORTS - Viewport map
 * @param {boolean} verbose
 * @returns {Promise<Object>} Viewport result object
 */
export async function testFooterViewport(page, viewportName, VIEWPORTS, verbose = false) {
  const viewport = VIEWPORTS[viewportName];
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await new Promise(r => setTimeout(r, 300));

  const result = { viewport: viewportName, dimensions: viewport, tests: [], passed: 0, failed: 0, warnings: [] };
  if (verbose) console.error(`\n📱 Testing ${viewportName} (${viewport.width}x${viewport.height})...`);

  const footerResult = await findElement(page, FOOTER_SELECTORS.container);
  if (!footerResult) {
    result.tests.push({ name: 'Footer container exists', passed: false, error: 'No footer container found' });
    result.failed++;
    if (verbose) console.error(`  ✗ Footer not found`);
    return result;
  }

  result.tests.push({ name: 'Footer container exists', passed: true, selector: footerResult.selector });
  result.passed++;
  if (verbose) console.error(`  ✓ Footer found: ${footerResult.selector}`);

  const positionInfo = await checkFooterPosition(page, footerResult.selector);
  if (positionInfo) {
    if (positionInfo.isAtBottom) {
      result.tests.push({ name: 'Footer at page bottom', passed: true, y: positionInfo.y, pageHeight: positionInfo.pageHeight });
      result.passed++;
      if (verbose) console.error(`  ✓ Footer at bottom (y: ${Math.round(positionInfo.y)})`);
    } else {
      result.tests.push({ name: 'Footer at page bottom', passed: false, y: positionInfo.y, footerBottom: positionInfo.footerBottom, pageHeight: positionInfo.pageHeight, error: 'Footer not at page bottom' });
      result.failed++;
      if (verbose) console.error(`  ✗ Footer not at bottom (gap: ${positionInfo.pageHeight - positionInfo.footerBottom}px)`);
    }
    result.footerDimensions = { height: positionInfo.height, width: positionInfo.width, backgroundColor: positionInfo.backgroundColor, color: positionInfo.color };
  }

  if (viewportName !== 'mobile') {
    const columns = await countElements(page, FOOTER_SELECTORS.columns);
    if (columns.count >= 1) {
      result.tests.push({ name: 'Multi-column layout', passed: true, count: columns.count, selector: columns.selector, note: columns.count === 1 ? 'Single column layout' : undefined });
      result.passed++;
      if (verbose) console.error(`  ✓ ${columns.count} column(s) found`);
    } else {
      result.warnings.push('No clear column structure detected');
      if (verbose) console.error(`  ⚠ No column structure detected`);
    }
  }

  const links = await countVisibleElements(page, FOOTER_SELECTORS.links);
  if (links.count >= 1) {
    result.tests.push({ name: 'Footer links present', passed: true, count: links.count, selector: links.selector });
    result.passed++;
    if (verbose) console.error(`  ✓ ${links.count} links found`);
  } else {
    result.warnings.push('No links found in footer');
    if (verbose) console.error(`  ⚠ No links found`);
  }

  const copyrightInfo = await checkCopyright(page);
  if (copyrightInfo && (copyrightInfo.hasCopyright || copyrightInfo.hasYear)) {
    result.tests.push({ name: 'Copyright text present', passed: true, hasCopyright: copyrightInfo.hasCopyright, hasCurrentYear: copyrightInfo.hasCurrentYear });
    result.passed++;
    if (verbose) console.error(`  ✓ Copyright found (current year: ${copyrightInfo.hasCurrentYear})`);
  } else {
    result.warnings.push('No copyright text found');
    if (verbose) console.error(`  ⚠ No copyright text`);
  }

  const socialIcons = await countVisibleElements(page, FOOTER_SELECTORS.socialIcons);
  if (socialIcons.count > 0) {
    result.tests.push({ name: 'Social icons present', passed: true, count: socialIcons.count });
    result.passed++;
    if (verbose) console.error(`  ✓ ${socialIcons.count} social icons found`);
  } else {
    if (verbose) console.error(`  ℹ No social icons found`);
  }

  return result;
}
