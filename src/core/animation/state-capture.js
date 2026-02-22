/**
 * State Capture Module
 *
 * Capture hover states for interactive elements using Playwright.
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
import { logInfo } from '../../utils/log.js';

import {
  detectInteractiveElements,
  extractHoverSelectorsFromCss,
  detectInteractiveElementsFromDom,
  isValidSelector
} from './state-capture-detection.js';

/** Delay after hover for CSS transitions to complete (ms) */
const HOVER_SETTLE_DELAY = 100;

/** Delay after mouse reset for state to clear (ms) */
const MOUSE_RESET_DELAY = 50;

/** Padding around element for screenshots (px) */
const SCREENSHOT_PADDING = 20;

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

/** Convert camelCase to kebab-case (e.g. backgroundColor → background-color). */
function toKebabCase(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Logging via centralized utils/log.js

/** Capture computed styles for STYLE_PROPERTIES on a given selector. */
async function captureElementStyles(page, selector) {
  return await page.evaluate(({ sel, props }) => {
    const el = document.querySelector(sel);
    if (!el) return null;

    const style = getComputedStyle(el);
    const result = {};
    for (const prop of props) {
      result[prop] = style[prop];
    }
    return result;
  }, { sel: selector, props: STYLE_PROPERTIES });
}

/**
 * Capture hover state for a single element (normal + hover screenshots + style diff).
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} outputDir
 * @param {number} index - used in output filename
 * @returns {Promise<{selector, success, normalScreenshot, hoverScreenshot, styleDiff, error?}>}
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

  if (!isValidSelector(selector)) {
    result.error = 'Invalid selector';
    return result;
  }

  try {
    const locator = page.locator(selector);
    const isVisible = await locator.isVisible().catch(() => false);
    if (!isVisible) { result.error = 'Element not visible'; return result; }
    const box = await locator.boundingBox();
    if (!box) { result.error = 'No bounding box'; return result; }

    const clip = {
      x: Math.max(0, box.x - SCREENSHOT_PADDING), y: Math.max(0, box.y - SCREENSHOT_PADDING),
      width: box.width + SCREENSHOT_PADDING * 2, height: box.height + SCREENSHOT_PADDING * 2
    };

    result.normalStyles = await captureElementStyles(page, selector);
    const normalPath = path.join(outputDir, `hover-${index}-normal.png`);
    await page.screenshot({ path: normalPath, clip });
    result.normalScreenshot = normalPath;

    await locator.hover();
    await new Promise(r => setTimeout(r, HOVER_SETTLE_DELAY));

    result.hoverStyles = await captureElementStyles(page, selector);
    const hoverPath = path.join(outputDir, `hover-${index}-hover.png`);
    await page.screenshot({ path: hoverPath, clip });
    result.hoverScreenshot = hoverPath;

    if (result.normalStyles && result.hoverStyles) {
      for (const [prop, normalVal] of Object.entries(result.normalStyles)) {
        const hoverVal = result.hoverStyles[prop];
        if (hoverVal !== normalVal) result.styleDiff[prop] = { from: normalVal, to: hoverVal };
      }
    }
    await page.mouse.move(0, 0);
    await new Promise(r => setTimeout(r, MOUSE_RESET_DELAY));
    result.success = Object.keys(result.styleDiff).length > 0;
  } catch (e) {
    result.error = e.message;
  }

  return result;
}

/**
 * Capture hover states for all detected interactive elements.
 * Writes screenshots to hover-states/ subdir and hover-diff.json summary.
 * @param {import('playwright').Page} page
 * @param {string|null} cssString - Raw CSS for :hover detection
 * @param {string} outputDir
 * @returns {Promise<{directory, detected, captured, summaryPath, elements}>}
 */
export async function captureAllHoverStates(page, cssString, outputDir) {
  if (!page) throw new Error('Page parameter is required');
  if (!outputDir || typeof outputDir !== 'string') throw new Error('Output directory parameter is required');

  const hoverDir = path.join(outputDir, 'hover-states');
  await fs.mkdir(hoverDir, { recursive: true });
  const interactive = await detectInteractiveElements(page, cssString);
  const elements = [];
  let capturedCount = 0;

  for (let i = 0; i < interactive.combined.length; i++) {
    const selector = interactive.combined[i];
    const result = await captureHoverState(page, selector, hoverDir, i);
    elements.push(result);
    if (result.success) { capturedCount++; logInfo(`[hover] ${capturedCount}: ${selector}`); }
  }

  const summaryPath = path.join(hoverDir, 'hover-diff.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    detected: interactive.combined.length, captured: capturedCount,
    fromCss: interactive.fromCss.length, fromDom: interactive.fromDom.length,
    elements: elements.filter(e => e.success).map(r => ({
      selector: r.selector, styleDiff: r.styleDiff,
      normalScreenshot: r.normalScreenshot ? path.basename(r.normalScreenshot) : null,
      hoverScreenshot: r.hoverScreenshot ? path.basename(r.hoverScreenshot) : null
    }))
  }, null, 2), 'utf-8');

  return { directory: hoverDir, detected: interactive.combined.length, captured: capturedCount, summaryPath, elements };
}

/** Generate :hover CSS rules from captured style diffs. */
export function generateHoverCss(results) {
  if (!results || !Array.isArray(results)) return '/* No hover style changes detected */\n';
  const successful = results.filter(r => r.success && Object.keys(r.styleDiff).length > 0);
  if (successful.length === 0) return '/* No hover style changes detected */\n';

  const lines = ['/**', ' * Generated :hover Styles', ' * Captured by design-clone state-capture', ' */\n'];
  for (const result of successful) {
    lines.push(`/* Element: ${result.selector} */`, `${result.selector}:hover {`);
    for (const [prop, diff] of Object.entries(result.styleDiff)) {
      lines.push(`  ${toKebabCase(prop)}: ${diff.to};`);
    }
    lines.push('}\n');
  }
  return lines.join('\n');
}

// Re-exports for backward compatibility
export { detectInteractiveElements, extractHoverSelectorsFromCss, detectInteractiveElementsFromDom };
