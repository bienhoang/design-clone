#!/usr/bin/env node
/**
 * Slider/Carousel Verification Script
 *
 * Tests slider components:
 * - Library detection (Swiper, Slick, Owl, native)
 * - Arrow/navigation visibility
 * - Pagination dots presence
 * - Autoplay detection (requires 2 slide changes in 6s)
 * - Current slide indicator
 *
 * Usage:
 *   node verify-slider.js --html <path> [--verbose]
 *   node verify-slider.js --url <url> [--verbose]
 *
 * Options:
 *   --html      Path to local HTML file
 *   --url       URL to test
 *   --output    Output directory for screenshots
 *   --verbose   Show detailed progress
 */

import fs from 'fs/promises';
import path from 'path';

import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Viewport configurations
const VIEWPORTS = {
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 }
};

// Slider library patterns
const SLIDER_PATTERNS = {
  swiper: {
    container: '[class*="swiper"]',
    slide: '.swiper-slide',
    active: '.swiper-slide-active',
    prev: '.swiper-button-prev',
    next: '.swiper-button-next',
    pagination: '.swiper-pagination'
  },
  slick: {
    container: '[class*="slick"]',
    slide: '.slick-slide',
    active: '.slick-active, .slick-current',
    prev: '.slick-prev',
    next: '.slick-next',
    pagination: '.slick-dots'
  },
  owl: {
    container: '[class*="owl"]',
    slide: '.owl-item',
    active: '.owl-item.active',
    prev: '.owl-prev',
    next: '.owl-next',
    pagination: '.owl-dots'
  },
  splide: {
    container: '.splide',
    slide: '.splide__slide',
    active: '.splide__slide.is-active',
    prev: '.splide__arrow--prev',
    next: '.splide__arrow--next',
    pagination: '.splide__pagination'
  },
  glide: {
    container: '.glide',
    slide: '.glide__slide',
    active: '.glide__slide--active',
    prev: '[data-glide-dir="<"]',
    next: '[data-glide-dir=">"]',
    pagination: '.glide__bullets'
  },
  native: {
    container: '[style*="scroll-snap"], [class*="carousel"], [class*="slider"]',
    slide: '[style*="scroll-snap"] > *, .carousel-item, .slider-item',
    active: '.active, [aria-current="true"]',
    prev: '[class*="prev"], [aria-label*="prev" i]',
    next: '[class*="next"], [aria-label*="next" i]',
    pagination: '[class*="indicator"], [class*="dot"], [role="tablist"]'
  }
};

// Autoplay detection config
const AUTOPLAY_CONFIG = {
  waitTime: 6000,        // Total wait time in ms
  checkInterval: 1000,   // Check every 1s
  requiredChanges: 2     // Require 2 slide changes (per validation)
};

/**
 * Detect which slider library is used
 */
async function detectSliderLibrary(page) {
  for (const [name, patterns] of Object.entries(SLIDER_PATTERNS)) {
    try {
      const count = await page.locator(patterns.container).count();
      if (count > 0) {
        return { library: name, patterns };
      }
    } catch (err) { /* continue - selector not found */ }
  }
  return null;
}

/**
 * Check element visibility
 */
async function isElementVisible(page, selector) {
  try {
    const element = await page.$(selector);
    if (!element) return false;

    return await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }, selector);
  } catch {
    return false;
  }
}

/**
 * Count visible elements
 */
async function countVisibleElements(page, selector) {
  try {
    return await page.evaluate((sel) => {
      const items = document.querySelectorAll(sel);
      let visible = 0;
      items.forEach(item => {
        const style = window.getComputedStyle(item);
        const rect = item.getBoundingClientRect();
        if (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          visible++;
        }
      });
      return visible;
    }, selector);
  } catch {
    return 0;
  }
}

/**
 * Get current active slide index
 */
async function getActiveSlideIndex(page, patterns) {
  try {
    return await page.evaluate((selectors) => {
      // Try active selector
      const active = document.querySelector(selectors.active);
      if (active) {
        const slides = document.querySelectorAll(selectors.slide);
        for (let i = 0; i < slides.length; i++) {
          if (slides[i] === active || slides[i].contains(active)) {
            return i;
          }
        }
      }

      // Fallback: check transform or scroll position
      const container = document.querySelector(selectors.container);
      if (container) {
        const slides = container.querySelectorAll(selectors.slide);
        for (let i = 0; i < slides.length; i++) {
          const rect = slides[i].getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          // Check if slide is in view
          if (rect.left >= containerRect.left - 10 && rect.left < containerRect.right) {
            return i;
          }
        }
      }

      return -1;
    }, patterns);
  } catch {
    return -1;
  }
}

/**
 * Check autoplay by monitoring slide changes
 * Requires 2 changes in 6 seconds (per validated decision)
 * Early exit when required changes detected (performance optimization)
 */
async function checkAutoplay(page, patterns, verbose) {
  const slideIndices = [];
  const startTime = Date.now();

  // Get initial slide
  const initialIndex = await getActiveSlideIndex(page, patterns);
  slideIndices.push({ time: 0, index: initialIndex });

  if (verbose) console.error(`    Starting autoplay detection (max ${AUTOPLAY_CONFIG.waitTime / 1000}s)...`);

  // Monitor for changes with early exit
  while (Date.now() - startTime < AUTOPLAY_CONFIG.waitTime) {
    await new Promise(r => setTimeout(r, AUTOPLAY_CONFIG.checkInterval));

    const currentIndex = await getActiveSlideIndex(page, patterns);
    const elapsed = Date.now() - startTime;

    if (currentIndex !== slideIndices[slideIndices.length - 1].index) {
      slideIndices.push({ time: elapsed, index: currentIndex });
      if (verbose) console.error(`    Slide changed to ${currentIndex} at ${elapsed}ms`);

      // Early exit: if we have required changes, no need to wait longer
      if (slideIndices.length - 1 >= AUTOPLAY_CONFIG.requiredChanges) {
        if (verbose) console.error(`    Early exit: ${AUTOPLAY_CONFIG.requiredChanges} changes detected`);
        break;
      }
    }
  }

  const changes = slideIndices.length - 1;
  const actualDuration = Date.now() - startTime;

  return {
    hasAutoplay: changes >= AUTOPLAY_CONFIG.requiredChanges,
    changes,
    slideIndices,
    duration: actualDuration
  };
}

/**
 * Test slider at specific viewport
 */
async function testViewport(page, viewportName, verbose = false) {
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

  // Test 1: Detect slider library
  const sliderDetection = await detectSliderLibrary(page);

  if (!sliderDetection) {
    result.tests.push({
      name: 'Slider detection',
      passed: true,
      note: 'No slider/carousel detected on page'
    });
    result.passed++;
    if (verbose) console.error(`  ℹ No slider detected`);
    return result;
  }

  const { library, patterns } = sliderDetection;
  result.sliderInfo = { library };

  result.tests.push({
    name: 'Slider detection',
    passed: true,
    library,
    selector: patterns.container
  });
  result.passed++;
  if (verbose) console.error(`  ✓ Slider detected: ${library}`);

  // Test 2: Slides present
  const slideCount = await countVisibleElements(page, patterns.slide);
  if (slideCount > 0) {
    result.tests.push({
      name: 'Slides present',
      passed: true,
      count: slideCount
    });
    result.passed++;
    result.sliderInfo.slideCount = slideCount;
    if (verbose) console.error(`  ✓ ${slideCount} slides found`);
  } else {
    result.tests.push({
      name: 'Slides present',
      passed: false,
      error: 'No slides found in slider'
    });
    result.failed++;
    if (verbose) console.error(`  ✗ No slides found`);
  }

  // Test 3: Navigation arrows
  const hasPrev = await isElementVisible(page, patterns.prev);
  const hasNext = await isElementVisible(page, patterns.next);

  if (hasPrev || hasNext) {
    result.tests.push({
      name: 'Navigation arrows',
      passed: true,
      hasPrev,
      hasNext
    });
    result.passed++;
    if (verbose) console.error(`  ✓ Navigation arrows: prev=${hasPrev}, next=${hasNext}`);
  } else {
    result.warnings.push('No navigation arrows visible');
    if (verbose) console.error(`  ⚠ No navigation arrows found`);
  }

  // Test 4: Pagination dots
  const hasPagination = await isElementVisible(page, patterns.pagination);
  if (hasPagination) {
    result.tests.push({
      name: 'Pagination dots',
      passed: true,
      selector: patterns.pagination
    });
    result.passed++;
    if (verbose) console.error(`  ✓ Pagination dots found`);
  } else {
    result.warnings.push('No pagination dots visible');
    if (verbose) console.error(`  ⚠ No pagination dots found`);
  }

  // Test 5: Active slide indicator
  const activeIndex = await getActiveSlideIndex(page, patterns);
  if (activeIndex >= 0) {
    result.tests.push({
      name: 'Active slide indicator',
      passed: true,
      activeIndex
    });
    result.passed++;
    result.sliderInfo.currentSlide = activeIndex;
    if (verbose) console.error(`  ✓ Active slide: ${activeIndex}`);
  } else {
    result.warnings.push('Could not determine active slide');
    if (verbose) console.error(`  ⚠ Could not detect active slide`);
  }

  // Test 6: Autoplay detection (only on desktop to save time)
  if (viewportName === 'desktop' && slideCount > 1) {
    if (verbose) console.error(`  Testing autoplay...`);
    const autoplayResult = await checkAutoplay(page, patterns, verbose);

    if (autoplayResult.hasAutoplay) {
      result.tests.push({
        name: 'Autoplay functionality',
        passed: true,
        changes: autoplayResult.changes,
        duration: autoplayResult.duration
      });
      result.passed++;
      result.sliderInfo.hasAutoplay = true;
      if (verbose) console.error(`  ✓ Autoplay detected (${autoplayResult.changes} changes)`);
    } else {
      result.tests.push({
        name: 'Autoplay functionality',
        passed: true,
        note: `No autoplay detected (${autoplayResult.changes} changes in ${autoplayResult.duration}ms)`,
        changes: autoplayResult.changes
      });
      result.passed++;
      result.sliderInfo.hasAutoplay = false;
      if (verbose) console.error(`  ℹ No autoplay (${autoplayResult.changes} changes)`);
    }
  }

  return result;
}

/**
 * Capture slider screenshot
 */
async function captureSliderScreenshot(page, outputDir, viewportName) {
  if (!outputDir) return null;

  // Try to scroll slider into view
  await page.evaluate(() => {
    const slider = document.querySelector('[class*="swiper"], [class*="slick"], [class*="owl"], [class*="carousel"], [class*="slider"]');
    if (slider) slider.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 200));

  const screenshotPath = path.join(outputDir, `slider-test-${viewportName}.png`);
  await page.screenshot({
    path: screenshotPath,
    fullPage: false
  });
  return screenshotPath;
}

/**
 * Validate HTML file path (security: prevent path traversal)
 */
function validateHtmlPath(htmlPath) {
  const absolutePath = path.resolve(htmlPath);
  const cwd = process.cwd();

  const allowedPrefixes = [
    cwd,
    path.join(process.env.HOME || '', '.claude'),
    '/tmp',
    path.join(process.env.HOME || '', 'cloned-designs')
  ];

  const isAllowed = allowedPrefixes.some(prefix => absolutePath.startsWith(prefix));
  if (!isAllowed) {
    throw new Error(`Path "${htmlPath}" is outside allowed directories`);
  }

  return absolutePath;
}

/**
 * Main verification function
 */
async function verifySlider() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.html && !args.url) {
    outputError(new Error('Either --html or --url is required'));
    process.exit(1);
  }

  const verbose = args.verbose === 'true';
  const outputDir = args.output;

  try {
    const browser = await getBrowser({ headless: args.headless !== 'false' });
    const page = await getPage(browser);

    let targetUrl;
    if (args.html) {
      const absolutePath = validateHtmlPath(args.html);
      targetUrl = `file://${absolutePath}`;
    } else {
      targetUrl = args.url;
    }

    if (verbose) console.error(`\n🔍 Verifying slider: ${targetUrl}\n`);

    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const results = {
      success: true,
      component: 'slider',
      url: targetUrl,
      viewports: {},
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: []
      },
      screenshots: [],
      sliderDetected: false,
      sliderLibrary: null
    };

    for (const viewportName of ['mobile', 'tablet', 'desktop']) {
      const viewportResult = await testViewport(page, viewportName, verbose);
      results.viewports[viewportName] = viewportResult;

      results.summary.totalTests += viewportResult.tests.length;
      results.summary.passed += viewportResult.passed;
      results.summary.failed += viewportResult.failed;
      results.summary.warnings.push(...viewportResult.warnings);

      if (viewportResult.sliderInfo) {
        results.sliderDetected = true;
        results.sliderLibrary = viewportResult.sliderInfo.library;
      }

      if (outputDir) {
        const screenshotPath = await captureSliderScreenshot(page, outputDir, viewportName);
        if (screenshotPath) results.screenshots.push(screenshotPath);
      }
    }

    results.success = results.summary.failed === 0;

    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    if (verbose) {
      console.error('\n📊 Summary:');
      console.error(`   Slider: ${results.sliderDetected ? results.sliderLibrary : 'Not detected'}`);
      console.error(`   Tests: ${results.summary.passed}/${results.summary.totalTests} passed`);
      if (results.summary.warnings.length > 0) {
        console.error(`   Warnings: ${results.summary.warnings.length}`);
      }
      console.error(`   Status: ${results.success ? '✓ PASS' : '✗ FAIL'}\n`);
    }

    outputJSON(results);
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

verifySlider();
