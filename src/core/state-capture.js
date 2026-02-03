/**
 * State Capture Module
 *
 * Capture hover states for interactive elements using Puppeteer.
 * Screenshots before/after, computes style differences, generates :hover CSS.
 *
 * Usage:
 *   import { captureAllHoverStates, generateHoverCss } from './state-capture.js';
 *   const result = await captureAllHoverStates(page, cssString, outputDir);
 *   const hoverCss = generateHoverCss(result.elements);
 *
 * @module state-capture
 */

import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// Constants
// ============================================================================

/** Delay after hover for CSS transitions to complete (ms) */
const HOVER_SETTLE_DELAY = 100;

/** Delay after mouse reset for state to clear (ms) */
const MOUSE_RESET_DELAY = 50;

/** Padding around element for screenshots (px) */
const SCREENSHOT_PADDING = 20;

/** Maximum number of elements to capture (performance limit) */
const MAX_ELEMENTS = 50;

/** Maximum elements to scan in DOM for transitions (performance limit) */
const MAX_DOM_SCAN = 200;

/** Maximum selector depth when generating unique selectors */
const MAX_SELECTOR_DEPTH = 3;

/** Interactive element selectors for DOM query */
const INTERACTIVE_SELECTORS = [
  'button:not(:disabled)',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  'input[type="submit"]',
  'input[type="button"]',
  '.btn',
  '.button',
  '.card',
  '.nav-link'
];

/** CSS properties to capture for style diff */
const STYLE_PROPERTIES = [
  'backgroundColor',
  'color',
  'transform',
  'boxShadow',
  'borderColor',
  'opacity',
  'scale',
  'filter',
  'textDecoration',
  'outline'
];

// ============================================================================
// Dependency Management
// ============================================================================

let csstree = null;
try {
  csstree = await import('css-tree');
} catch {
  console.error(
    '[state-capture] css-tree not available. CSS-based hover detection disabled.\n' +
    '  Fix: Run "npm install css-tree"'
  );
}

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} InteractiveElement
 * @property {string} selector - Unique CSS selector
 * @property {string} tag - HTML tag name
 * @property {string} [text] - First 30 chars of text content
 * @property {boolean} [hasTransition] - True if element has CSS transitions
 */

/**
 * @typedef {Object} StyleDiff
 * @property {string} from - Value in normal state
 * @property {string} to - Value in hover state
 */

/**
 * @typedef {Object} HoverCaptureResult
 * @property {string} selector - CSS selector for the element
 * @property {boolean} success - True if hover state differs from normal
 * @property {string|null} normalScreenshot - Path to normal state screenshot
 * @property {string|null} hoverScreenshot - Path to hover state screenshot
 * @property {Object<string, StyleDiff>} styleDiff - Style differences
 * @property {string} [error] - Error message if capture failed
 */

/**
 * @typedef {Object} HoverCaptureOutput
 * @property {string} directory - Output directory path
 * @property {number} detected - Number of detected interactive elements
 * @property {number} captured - Number of successfully captured elements
 * @property {string} summaryPath - Path to hover-diff.json
 * @property {HoverCaptureResult[]} elements - Captured element results
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract base selector from :hover selector (remove :hover pseudo-class).
 * Handles patterns like ".btn:hover", ".card:hover .title", "button:hover, button:focus"
 *
 * @param {string} selectorText - Full selector text with :hover
 * @returns {string} Base selector without :hover
 */
function extractBaseSelector(selectorText) {
  return selectorText.replace(/:hover/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Convert camelCase to kebab-case.
 * Example: backgroundColor -> background-color
 *
 * @param {string} str - camelCase string
 * @returns {string} kebab-case string
 */
function toKebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Validate that a selector is valid CSS syntax.
 *
 * @param {string} selector - CSS selector to validate
 * @returns {boolean} True if selector appears valid
 */
function isValidSelector(selector) {
  if (!selector || typeof selector !== 'string') return false;
  // Basic validation: not empty, not just whitespace, has content after trimming
  const trimmed = selector.trim();
  if (!trimmed || trimmed.length > 500) return false;
  // Check for obviously invalid patterns
  if (/[<>{}]/.test(trimmed)) return false;
  return true;
}

/**
 * Log message if running in TTY mode.
 *
 * @param {string} level - Log level (error, warn, info)
 * @param {string} message - Message to log
 */
function log(level, message) {
  if (process.stderr.isTTY) {
    const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]';
    console.error(`${prefix} ${message}`);
  }
}

// ============================================================================
// CSS-Based Detection
// ============================================================================

/**
 * Extract selectors with :hover from CSS using AST.
 *
 * @param {string|null|undefined} cssString - Raw CSS string
 * @returns {Set<string>} Set of base selectors that have :hover rules
 */
function extractHoverSelectorsFromCss(cssString) {
  const hoverSelectors = new Set();

  if (!csstree || !cssString || typeof cssString !== 'string') {
    return hoverSelectors;
  }

  try {
    const ast = csstree.parse(cssString, { parseRulePrelude: true });

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node) {
        if (!node.prelude) return;

        const selectorText = csstree.generate(node.prelude);
        if (selectorText.includes(':hover')) {
          const baseSelector = extractBaseSelector(selectorText);
          if (baseSelector && isValidSelector(baseSelector)) {
            hoverSelectors.add(baseSelector);
          }
        }
      }
    });
  } catch (e) {
    log('error', `[state-capture] CSS parse error: ${e.message}`);
  }

  return hoverSelectors;
}

// ============================================================================
// DOM-Based Detection
// ============================================================================

/**
 * Detect interactive elements on page via DOM query.
 * Uses inline function to avoid new Function() for CSP compliance.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @returns {Promise<InteractiveElement[]>} Array of interactive elements
 */
async function detectInteractiveElementsFromDom(page) {
  return await page.evaluate((selectors, maxScan, maxDepth) => {
    // Inline getUniqueSelector to avoid new Function()
    function getUniqueSelector(element) {
      if (element.id) return '#' + element.id;

      const pathArr = [];
      let current = element;

      while (current && current.nodeType === 1 && pathArr.length < maxDepth) {
        let selector = current.tagName.toLowerCase();

        // Add first 2 class names for specificity
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).slice(0, 2).filter(c => c);
          if (classes.length) selector += '.' + classes.join('.');
        }

        // Add nth-of-type if siblings exist
        const siblings = current.parentNode?.children || [];
        const sameTagSiblings = Array.from(siblings).filter(s => s.tagName === current.tagName);
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          selector += ':nth-of-type(' + index + ')';
        }

        pathArr.unshift(selector);
        current = current.parentElement;
      }

      return pathArr.join(' > ');
    }

    const results = [];
    const seen = new Set();
    let totalScanned = 0;

    // Query by interactive selectors
    for (const sel of selectors) {
      if (totalScanned >= maxScan) break;

      try {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if (totalScanned >= maxScan) break;
          totalScanned++;

          // Skip hidden elements
          if (!el.offsetParent && el.tagName !== 'BODY') continue;

          const uniqueSel = getUniqueSelector(el);
          if (!seen.has(uniqueSel)) {
            seen.add(uniqueSel);
            results.push({
              selector: uniqueSel,
              tag: el.tagName.toLowerCase(),
              text: el.textContent?.slice(0, 30)?.trim() || ''
            });
          }
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Also detect elements with CSS transitions
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      if (totalScanned >= maxScan) break;
      totalScanned++;

      if (!el.offsetParent && el.tagName !== 'BODY') continue;

      const style = getComputedStyle(el);
      const hasTransition = style.transition &&
        style.transition !== 'all 0s ease 0s' &&
        style.transition !== 'none' &&
        !style.transition.startsWith('none');

      if (hasTransition) {
        const uniqueSel = getUniqueSelector(el);
        if (!seen.has(uniqueSel)) {
          seen.add(uniqueSel);
          results.push({
            selector: uniqueSel,
            tag: el.tagName.toLowerCase(),
            hasTransition: true
          });
        }
      }
    }

    return results;
  }, INTERACTIVE_SELECTORS, MAX_DOM_SCAN, MAX_SELECTOR_DEPTH);
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect interactive elements using CSS + DOM analysis.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @param {string|null} cssString - Raw CSS for :hover detection
 * @returns {Promise<{fromCss: string[], fromDom: InteractiveElement[], combined: string[]}>}
 */
export async function detectInteractiveElements(page, cssString) {
  // Validate input
  if (!page) {
    throw new Error('Page parameter is required');
  }

  // Method 1: CSS-based detection (faster, more accurate for :hover)
  const hoverSelectors = extractHoverSelectorsFromCss(cssString);

  // Method 2: DOM-based detection
  const domInteractive = await detectInteractiveElementsFromDom(page);

  // Merge and dedupe, prioritizing CSS selectors
  // Filter invalid selectors before merging
  const validDomSelectors = domInteractive
    .map(e => e.selector)
    .filter(s => isValidSelector(s));

  const allSelectors = new Set([
    ...hoverSelectors,
    ...validDomSelectors
  ]);

  // Limit to MAX_ELEMENTS
  const combined = Array.from(allSelectors).slice(0, MAX_ELEMENTS);

  return {
    fromCss: Array.from(hoverSelectors),
    fromDom: domInteractive,
    combined
  };
}

// ============================================================================
// Hover State Capture
// ============================================================================

/**
 * Capture computed styles for an element.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @param {string} selector - CSS selector
 * @returns {Promise<Object<string, string>|null>} Style object or null
 */
async function captureElementStyles(page, selector) {
  return await page.evaluate((sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;

    const style = getComputedStyle(el);
    const result = {};
    for (const prop of props) {
      result[prop] = style[prop];
    }
    return result;
  }, selector, STYLE_PROPERTIES);
}

/**
 * Capture hover state for a single element.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @param {string} selector - CSS selector for element
 * @param {string} outputDir - Directory for screenshots
 * @param {number} index - Element index for filename
 * @returns {Promise<HoverCaptureResult>}
 */
export async function captureHoverState(page, selector, outputDir, index) {
  const result = {
    selector,
    success: false,
    normalScreenshot: null,
    hoverScreenshot: null,
    normalStyles: null,
    hoverStyles: null,
    styleDiff: {}
  };

  // Validate selector before attempting capture
  if (!isValidSelector(selector)) {
    result.error = 'Invalid selector';
    return result;
  }

  try {
    // Find element
    const element = await page.$(selector);
    if (!element) {
      result.error = 'Element not found';
      return result;
    }

    // Check visibility
    const isVisible = await element.isVisible().catch(() => false);
    if (!isVisible) {
      result.error = 'Element not visible';
      return result;
    }

    // Get bounding box
    const box = await element.boundingBox();
    if (!box) {
      result.error = 'No bounding box';
      return result;
    }

    // Calculate clip area with padding
    const clip = {
      x: Math.max(0, box.x - SCREENSHOT_PADDING),
      y: Math.max(0, box.y - SCREENSHOT_PADDING),
      width: box.width + SCREENSHOT_PADDING * 2,
      height: box.height + SCREENSHOT_PADDING * 2
    };

    // Capture normal state using helper
    result.normalStyles = await captureElementStyles(page, selector);
    const normalPath = path.join(outputDir, `hover-${index}-normal.png`);
    await page.screenshot({ path: normalPath, clip });
    result.normalScreenshot = normalPath;

    // Hover and wait for transition
    await page.hover(selector);
    await new Promise(r => setTimeout(r, HOVER_SETTLE_DELAY));

    // Capture hover state using same helper
    result.hoverStyles = await captureElementStyles(page, selector);
    const hoverPath = path.join(outputDir, `hover-${index}-hover.png`);
    await page.screenshot({ path: hoverPath, clip });
    result.hoverScreenshot = hoverPath;

    // Compute style diff
    if (result.normalStyles && result.hoverStyles) {
      for (const [prop, normalVal] of Object.entries(result.normalStyles)) {
        const hoverVal = result.hoverStyles[prop];
        if (hoverVal !== normalVal) {
          result.styleDiff[prop] = { from: normalVal, to: hoverVal };
        }
      }
    }

    // Reset mouse position
    await page.mouse.move(0, 0);
    await new Promise(r => setTimeout(r, MOUSE_RESET_DELAY));

    // Success if any style changed
    result.success = Object.keys(result.styleDiff).length > 0;

  } catch (e) {
    result.error = e.message;
  }

  return result;
}

// ============================================================================
// Batch Capture
// ============================================================================

/**
 * Capture all hover states for detected interactive elements.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @param {string|null} cssString - Raw CSS for detection
 * @param {string} outputDir - Base output directory
 * @returns {Promise<HoverCaptureOutput>}
 */
export async function captureAllHoverStates(page, cssString, outputDir) {
  // Validate inputs
  if (!page) {
    throw new Error('Page parameter is required');
  }
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('Output directory parameter is required');
  }

  // Create hover-states directory
  const hoverDir = path.join(outputDir, 'hover-states');
  await fs.mkdir(hoverDir, { recursive: true });

  // Detect interactive elements
  const interactive = await detectInteractiveElements(page, cssString);
  const elements = [];
  let capturedCount = 0;

  // Capture each element
  for (let i = 0; i < interactive.combined.length; i++) {
    const selector = interactive.combined[i];

    const result = await captureHoverState(page, selector, hoverDir, i);
    elements.push(result);

    if (result.success) {
      capturedCount++;
      log('info', `[hover] ${capturedCount}: ${selector}`);
    }
  }

  // Write summary JSON
  const summaryPath = path.join(hoverDir, 'hover-diff.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    detected: interactive.combined.length,
    captured: capturedCount,
    fromCss: interactive.fromCss.length,
    fromDom: interactive.fromDom.length,
    elements: elements.filter(e => e.success).map(r => ({
      selector: r.selector,
      styleDiff: r.styleDiff,
      normalScreenshot: r.normalScreenshot ? path.basename(r.normalScreenshot) : null,
      hoverScreenshot: r.hoverScreenshot ? path.basename(r.hoverScreenshot) : null
    }))
  }, null, 2), 'utf-8');

  return {
    directory: hoverDir,
    detected: interactive.combined.length,
    captured: capturedCount,
    summaryPath,
    elements
  };
}

// ============================================================================
// CSS Generation
// ============================================================================

/**
 * Generate :hover CSS from captured style diffs.
 *
 * @param {HoverCaptureResult[]} results - Array of capture results
 * @returns {string} Generated CSS string
 */
export function generateHoverCss(results) {
  // Validate input
  if (!results || !Array.isArray(results)) {
    return '/* No hover style changes detected */\n';
  }

  const lines = [
    '/**',
    ' * Generated :hover Styles',
    ' * Captured by design-clone state-capture',
    ' */\n'
  ];

  const successfulResults = results.filter(r => r.success && Object.keys(r.styleDiff).length > 0);

  if (successfulResults.length === 0) {
    return '/* No hover style changes detected */\n';
  }

  for (const result of successfulResults) {
    lines.push(`/* Element: ${result.selector} */`);
    lines.push(`${result.selector}:hover {`);

    for (const [prop, diff] of Object.entries(result.styleDiff)) {
      const cssProp = toKebabCase(prop);
      lines.push(`  ${cssProp}: ${diff.to};`);
    }

    lines.push('}\n');
  }

  return lines.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export { extractHoverSelectorsFromCss, detectInteractiveElementsFromDom };
