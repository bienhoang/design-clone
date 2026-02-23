/**
 * Computed Style Gap-Fill Extractor
 *
 * Extracts computed styles for visible elements that aren't covered by
 * stylesheet CSS. Diffs against Chromium defaults to produce minimal
 * gap-fill rules for styles set via JS or inline attributes.
 */

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let defaults = null;

async function loadDefaults() {
  if (!defaults) {
    const raw = await fs.readFile(path.join(__dirname, 'chromium-defaults.json'), 'utf-8');
    defaults = JSON.parse(raw);
  }
  return defaults;
}

const KEY_PROPERTIES = [
  'display', 'position', 'margin', 'padding', 'width', 'height',
  'font-size', 'font-weight', 'font-family', 'color', 'background-color',
  'border', 'border-radius', 'flex-direction', 'justify-content',
  'align-items', 'gap', 'grid-template-columns', 'overflow',
  'text-align', 'line-height', 'text-decoration', 'opacity', 'z-index',
  'box-shadow', 'transform'
];

const MAX_ELEMENTS = 1000;

/**
 * Extract computed styles that fill gaps in stylesheet CSS
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} existingCssContent - Already-extracted CSS content
 * @returns {Promise<{css: string, rules: number, stats: Object}>}
 */
export async function extractComputedGapFill(page, existingCssContent) {
  const baseline = await loadDefaults();

  const elementStyles = await page.evaluate(({ maxEls, props }) => {
    const visible = [...document.querySelectorAll('*')]
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight * 2;
      })
      .slice(0, maxEls);

    return visible.map(el => {
      const cs = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string'
        ? `.${[...el.classList].join('.')}` : '';
      const id = el.id ? `#${el.id}` : '';
      const selector = id || (tag + cls) || tag;
      const styles = {};
      for (const prop of props) {
        const val = cs.getPropertyValue(prop);
        if (val) styles[prop] = val;
      }
      return { tag, selector, styles };
    });
  }, { maxEls: MAX_ELEMENTS, props: KEY_PROPERTIES });

  // Diff against baseline
  const gapRules = [];
  for (const el of elementStyles) {
    const baseStyles = baseline[el.tag] || {};
    const gaps = {};
    let hasGap = false;
    for (const [prop, val] of Object.entries(el.styles)) {
      if (val !== baseStyles[prop] && !existingCssContent.includes(val)) {
        gaps[prop] = val;
        hasGap = true;
      }
    }
    if (hasGap) gapRules.push({ selector: el.selector, properties: gaps });
  }

  // Deduplicate by selector
  const merged = new Map();
  for (const rule of gapRules) {
    const existing = merged.get(rule.selector);
    if (existing) Object.assign(existing.properties, rule.properties);
    else merged.set(rule.selector, rule);
  }

  const rules = [...merged.values()];
  const css = rules.map(r => {
    const props = Object.entries(r.properties).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    return `${r.selector} {\n${props}\n}`;
  }).join('\n\n');

  return {
    css,
    rules: rules.length,
    stats: { elementsAnalyzed: elementStyles.length, gapRulesGenerated: rules.length }
  };
}
