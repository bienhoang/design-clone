/**
 * Section detection strategies for page analysis.
 *
 * Four progressive strategies: semantic HTML, class patterns,
 * large direct children, viewport chunking fallback.
 * Used by section-detector.js (main orchestrator).
 */

import { SECTION_CLASS_PATTERNS } from './section-detector-utils.js';

/** @param {Object} rect @param {number} scrollY @returns {Object} */
function toBounds(rect, scrollY) {
  return { x: Math.round(rect.x), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) };
}

/**
 * Find semantic HTML sections (header, main, section, footer)
 * @param {import('playwright').Page} page
 * @param {Object} pageDimensions
 * @param {Object} config
 * @returns {Promise<Array>}
 */
export async function findSemanticSections(page, pageDimensions, config) {
  return await page.evaluate(({ minHeight }) => {
    const sections = [];
    const processed = new Set();
    const selectors = [
      'header:not(header header)', 'main > section', 'main > article',
      'body > section', 'body > article', '[data-section]', 'footer:not(footer footer)'
    ];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (processed.has(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.height < minHeight) continue;
        let name = el.tagName.toLowerCase();
        if (el.hasAttribute('data-section')) name = el.getAttribute('data-section');
        else if (el.id) name = el.id;
        else if (el.className) {
          const m = el.className.toString().toLowerCase()
            .match(/\b(hero|about|services|features|contact|footer|header|nav|cta|testimonials|pricing|faq|team|blog|news)\b/);
          if (m) name = m[1];
        }
        sections.push({ name, role: el.tagName.toLowerCase(),
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          bounds: { x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) } });
        processed.add(el);
      }
    }
    return sections;
  }, { minHeight: config.minSectionHeight });
}

/**
 * Find sections by class pattern matching
 * @param {import('playwright').Page} page
 * @param {Object} pageDimensions
 * @param {Object} config
 * @returns {Promise<Array>}
 */
export async function findClassPatternSections(page, pageDimensions, config) {
  return await page.evaluate(({ patterns, minHeight }) => {
    const sections = [];
    const processed = new Set();
    const elements = document.querySelectorAll(patterns.map(p => `[class*="${p}"]`).join(', '));
    for (const el of elements) {
      const parent = el.parentElement;
      if (!parent || (parent.tagName !== 'BODY' && parent.tagName !== 'MAIN')) continue;
      if (processed.has(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < minHeight) continue;
      const cls = el.className.toString().toLowerCase();
      let name = patterns.find(p => cls.includes(p)) || 'section';
      sections.push({ name, role: 'class-pattern',
        selector: el.id ? `#${el.id}` : `.${el.className.toString().split(' ')[0]}`,
        bounds: { x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY), width: Math.round(rect.width), height: Math.round(rect.height) } });
      processed.add(el);
    }
    return sections;
  }, { patterns: SECTION_CLASS_PATTERNS, minHeight: config.minSectionHeight });
}

/**
 * Find large direct children of main/body as sections
 * @param {import('playwright').Page} page
 * @param {Object} pageDimensions
 * @param {Object} config
 * @returns {Promise<Array>}
 */
export async function findLargeChildSections(page, pageDimensions, config) {
  return await page.evaluate(({ minHeight }) => {
    const sections = [];
    const skip = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'];
    const skipSemantic = ['HEADER', 'FOOTER', 'SECTION', 'ARTICLE'];
    const generic = ['sd', 'container', 'wrapper', 'div', 'block', 'row', 'col', 'section'];
    for (const container of [document.querySelector('main'), document.body].filter(Boolean)) {
      for (const child of container.children) {
        if (skip.includes(child.tagName) || skipSemantic.includes(child.tagName)) continue;
        const rect = child.getBoundingClientRect();
        const absoluteY = rect.y + window.scrollY;
        if (rect.height < Math.max(300, window.innerHeight * 0.2)) continue;
        let name = child.id || '';
        if (!name && child.className) {
          const first = child.className.toString().split(' ')[0].toLowerCase();
          if (!generic.includes(first)) name = first;
        }
        if (!name) {
          const r = absoluteY / (document.body.scrollHeight || 1);
          name = r < 0.15 ? 'top-section' : r < 0.35 ? 'upper-content' : r < 0.55 ? 'middle-content' : r < 0.75 ? 'lower-content' : 'bottom-section';
          name = `${name}-${sections.length}`;
        }
        sections.push({ name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'), role: 'large-block',
          selector: child.id ? `#${child.id}` : child.tagName.toLowerCase(),
          bounds: { x: Math.round(rect.x), y: Math.round(absoluteY), width: Math.round(rect.width), height: Math.round(rect.height) } });
      }
      if (sections.length > 0 && container.tagName === 'MAIN') break;
    }
    return sections;
  }, { minHeight: config.minSectionHeight });
}

/**
 * Generate viewport chunks as fallback when no sections found.
 * @param {Object} pageDimensions - { width, height }
 * @param {Object} config - { viewportHeight, overlapRatio }
 * @returns {Array}
 */
export function generateViewportChunks(pageDimensions, config) {
  const { width, height } = pageDimensions;
  const step = config.viewportHeight - Math.round(config.viewportHeight * config.overlapRatio);
  const sections = [];
  let y = 0;
  for (let i = 0; y < height && i < 50; i++) {
    sections.push({ name: `viewport-${i}`, role: 'viewport-chunk', selector: null,
      bounds: { x: 0, y, width, height: Math.min(config.viewportHeight, height - y) } });
    y += step;
  }
  return sections;
}
