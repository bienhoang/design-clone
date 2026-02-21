/**
 * Slider Viewport Checks
 *
 * Orchestrates all per-viewport slider checks using helpers.
 * Separated from verify-slider-helpers.js to keep each file under 200 lines.
 */

import {
  detectSliderLibrary,
  isElementVisible,
  countVisibleElements,
  getActiveSlideIndex,
  checkAutoplay
} from './verify-slider-helpers.js';

/**
 * Test slider at a specific viewport — runs all slider checks
 * @param {import('playwright').Page} page
 * @param {string} viewportName
 * @param {Object} VIEWPORTS - Viewport map
 * @param {boolean} verbose
 * @returns {Promise<Object>} Viewport result object
 */
export async function testSliderViewport(page, viewportName, VIEWPORTS, verbose = false) {
  const viewport = VIEWPORTS[viewportName];
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500));

  const result = {
    viewport: viewportName,
    dimensions: viewport,
    tests: [],
    passed: 0,
    failed: 0,
    warnings: [],
    sliderInfo: null
  };

  if (verbose) console.error(`\n📱 Testing ${viewportName} (${viewport.width}x${viewport.height})...`);

  const sliderDetection = await detectSliderLibrary(page);
  if (!sliderDetection) {
    result.tests.push({ name: 'Slider detection', passed: true, note: 'No slider/carousel detected on page' });
    result.passed++;
    if (verbose) console.error(`  ℹ No slider detected`);
    return result;
  }

  const { library, patterns } = sliderDetection;
  result.sliderInfo = { library };
  result.tests.push({ name: 'Slider detection', passed: true, library, selector: patterns.container });
  result.passed++;
  if (verbose) console.error(`  ✓ Slider detected: ${library}`);

  const slideCount = await countVisibleElements(page, patterns.slide);
  if (slideCount > 0) {
    result.tests.push({ name: 'Slides present', passed: true, count: slideCount });
    result.passed++;
    result.sliderInfo.slideCount = slideCount;
    if (verbose) console.error(`  ✓ ${slideCount} slides found`);
  } else {
    result.tests.push({ name: 'Slides present', passed: false, error: 'No slides found in slider' });
    result.failed++;
    if (verbose) console.error(`  ✗ No slides found`);
  }

  const hasPrev = await isElementVisible(page, patterns.prev);
  const hasNext = await isElementVisible(page, patterns.next);
  if (hasPrev || hasNext) {
    result.tests.push({ name: 'Navigation arrows', passed: true, hasPrev, hasNext });
    result.passed++;
    if (verbose) console.error(`  ✓ Navigation arrows: prev=${hasPrev}, next=${hasNext}`);
  } else {
    result.warnings.push('No navigation arrows visible');
    if (verbose) console.error(`  ⚠ No navigation arrows found`);
  }

  const hasPagination = await isElementVisible(page, patterns.pagination);
  if (hasPagination) {
    result.tests.push({ name: 'Pagination dots', passed: true, selector: patterns.pagination });
    result.passed++;
    if (verbose) console.error(`  ✓ Pagination dots found`);
  } else {
    result.warnings.push('No pagination dots visible');
    if (verbose) console.error(`  ⚠ No pagination dots found`);
  }

  const activeIndex = await getActiveSlideIndex(page, patterns);
  if (activeIndex >= 0) {
    result.tests.push({ name: 'Active slide indicator', passed: true, activeIndex });
    result.passed++;
    result.sliderInfo.currentSlide = activeIndex;
    if (verbose) console.error(`  ✓ Active slide: ${activeIndex}`);
  } else {
    result.warnings.push('Could not determine active slide');
    if (verbose) console.error(`  ⚠ Could not detect active slide`);
  }

  if (viewportName === 'desktop' && slideCount > 1) {
    if (verbose) console.error(`  Testing autoplay...`);
    const autoplayResult = await checkAutoplay(page, patterns, verbose);
    result.tests.push({
      name: 'Autoplay functionality',
      passed: true,
      note: autoplayResult.hasAutoplay ? undefined : `No autoplay detected (${autoplayResult.changes} changes in ${autoplayResult.duration}ms)`,
      changes: autoplayResult.changes,
      duration: autoplayResult.duration
    });
    result.passed++;
    result.sliderInfo.hasAutoplay = autoplayResult.hasAutoplay;
    if (verbose) console.error(`  ${autoplayResult.hasAutoplay ? '✓ Autoplay detected' : 'ℹ No autoplay'} (${autoplayResult.changes} changes)`);
  }

  return result;
}
