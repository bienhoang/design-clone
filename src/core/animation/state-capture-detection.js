/**
 * State Capture Detection
 *
 * CSS-based and DOM-based detection of interactive elements that have
 * hover states. Used by state-capture.js to find elements before
 * screenshot capture.
 *
 * @module state-capture-detection
 */

import { logError } from '../../utils/log.js';

/** Maximum number of elements to capture (performance limit) */
export const MAX_ELEMENTS = 50;

/** Maximum elements to scan in DOM for transitions (performance limit) */
export const MAX_DOM_SCAN = 200;

/** Maximum selector depth when generating unique selectors */
export const MAX_SELECTOR_DEPTH = 3;

/** Interactive element selectors for DOM query */
export const INTERACTIVE_SELECTORS = [
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

let csstree = null;
try {
  csstree = await import('css-tree');
} catch {
  console.error(
    '[state-capture] css-tree not available. CSS-based hover detection disabled.\n' +
    '  Fix: Run "npm install css-tree"'
  );
}

/** Strip :hover from selector text (handles compound selectors). */
export function extractBaseSelector(selectorText) {
  return selectorText.replace(/:hover/g, '').replace(/\s+/g, ' ').trim();
}

/** Basic CSS selector validation (non-empty, no HTML chars, ≤500 chars). */
export function isValidSelector(selector) {
  if (!selector || typeof selector !== 'string') return false;
  const trimmed = selector.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (/[<>{}]/.test(trimmed)) return false;
  return true;
}

/** Extract base selectors that have :hover rules from a CSS string via AST. */
export function extractHoverSelectorsFromCss(cssString) {
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
    logError(`[state-capture] CSS parse error: ${e.message}`);
  }

  return hoverSelectors;
}

/**
 * Detect interactive elements via DOM query + transition scan (CSP-safe, no new Function).
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{selector, tag, text?, hasTransition?}>>}
 */
export async function detectInteractiveElementsFromDom(page) {
  return await page.evaluate(({ selectors, maxScan, maxDepth }) => {
    function getUniqueSelector(element) {
      if (element.id) return '#' + element.id;

      const pathArr = [];
      let current = element;

      while (current && current.nodeType === 1 && pathArr.length < maxDepth) {
        let selector = current.tagName.toLowerCase();

        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).slice(0, 2).filter(c => c);
          if (classes.length) selector += '.' + classes.join('.');
        }

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

    for (const sel of selectors) {
      if (totalScanned >= maxScan) break;

      try {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if (totalScanned >= maxScan) break;
          totalScanned++;

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
  }, { selectors: INTERACTIVE_SELECTORS, maxScan: MAX_DOM_SCAN, maxDepth: MAX_SELECTOR_DEPTH });
}

/**
 * Detect interactive elements via CSS + DOM, deduped and limited to MAX_ELEMENTS.
 * @param {import('playwright').Page} page
 * @param {string|null} cssString
 * @returns {Promise<{fromCss: string[], fromDom: Array, combined: string[]}>}
 */
export async function detectInteractiveElements(page, cssString) {
  if (!page) throw new Error('Page parameter is required');
  const hoverSelectors = extractHoverSelectorsFromCss(cssString);
  const domInteractive = await detectInteractiveElementsFromDom(page);
  const validDomSelectors = domInteractive.map(e => e.selector).filter(s => isValidSelector(s));
  const combined = Array.from(new Set([...hoverSelectors, ...validDomSelectors])).slice(0, MAX_ELEMENTS);
  return { fromCss: Array.from(hoverSelectors), fromDom: domInteractive, combined };
}
