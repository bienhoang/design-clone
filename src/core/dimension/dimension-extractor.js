/**
 * Component Dimension Extractor
 *
 * Extract exact pixel dimensions from page elements using
 * getBoundingClientRect and getComputedStyle.
 *
 * Split into two page.evaluate passes:
 *  1. Containers, typography, buttons, images  (this file)
 *  2. Card patterns + grid layouts             (second evaluate using card-detector helpers)
 *
 * Card/grid helper sources live in dimension-extractor-card-detector.js.
 */

import { calculateSimilarity, detectLayoutType, calculateGap } from './dimension-extractor-card-detector.js';

// Section detection thresholds (passed into browser context)
const HERO_THRESHOLD = 0.25;
const FOOTER_THRESHOLD = 0.85;
const SIDEBAR_MAX_WIDTH = 400;
const MAX_BUTTONS = 10;
const MAX_IMAGES = 15;

/**
 * Extract component dimensions from page.
 * @param {import('playwright').Page} page
 * @param {string} viewportName - 'desktop' | 'tablet' | 'mobile'
 * @returns {Promise<Object>}
 */
export async function extractComponentDimensions(page, viewportName) {
  const thresholds = { HERO_THRESHOLD, FOOTER_THRESHOLD, SIDEBAR_MAX_WIDTH, MAX_BUTTONS, MAX_IMAGES };

  // Pass 1: containers, typography, buttons, images
  const results = await page.evaluate(({ vpName, th }) => {
    const data = {
      viewport: vpName,
      extractedAt: new Date().toISOString(),
      containers: [], cards: [], typography: [], buttons: [], images: []
    };

    // --- Shared helpers (browser context) ---

    function extractDimensions(el) {
      const r = el.getBoundingClientRect(), cs = window.getComputedStyle(el);
      const pf = v => parseFloat(v) || 0;
      return {
        width: Math.round(r.width), height: Math.round(r.height),
        x: Math.round(r.x), y: Math.round(r.y),
        absoluteX: Math.round(r.x + window.scrollX), absoluteY: Math.round(r.y + window.scrollY),
        paddingTop: pf(cs.paddingTop), paddingRight: pf(cs.paddingRight),
        paddingBottom: pf(cs.paddingBottom), paddingLeft: pf(cs.paddingLeft),
        marginTop: pf(cs.marginTop), marginRight: pf(cs.marginRight),
        marginBottom: pf(cs.marginBottom), marginLeft: pf(cs.marginLeft),
        display: cs.display, position: cs.position,
        flexDirection: cs.flexDirection !== 'row' ? cs.flexDirection : undefined,
        justifyContent: cs.justifyContent !== 'normal' ? cs.justifyContent : undefined,
        alignItems: cs.alignItems !== 'normal' ? cs.alignItems : undefined,
        gap: pf(cs.gap),
        gridTemplateColumns: cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns : undefined,
        gridTemplateRows: cs.gridTemplateRows !== 'none' ? cs.gridTemplateRows : undefined,
        backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined,
        borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : undefined,
        boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : undefined,
        fontSize: pf(cs.fontSize), fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : undefined,
        color: cs.color
      };
    }

    function cleanObject(obj) {
      return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== 0 && v !== '')
      );
    }

    const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    function detectSection(el) {
      const r = el.getBoundingClientRect(), cs = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase(), yr = (r.y + window.scrollY) / pageHeight;
      if (tag === 'header' || el.closest('header')) return 'header';
      if (tag === 'footer' || el.closest('footer')) return 'footer';
      if (tag === 'aside'  || el.closest('aside'))  return 'sidebar';
      if (tag === 'nav'    || el.closest('nav'))     return 'nav';
      if (yr < th.HERO_THRESHOLD && r.height > 300) return 'hero';
      if (yr > th.FOOTER_THRESHOLD) return 'footer';
      if ((cs.position === 'fixed' || cs.position === 'sticky') && r.width < th.SIDEBAR_MAX_WIDTH) return 'sidebar';
      return 'content';
    }

    // --- Extraction functions ---

    function extractContainers() {
      const selectors = [
        'section','main','article','header','footer',
        '[role="main"]','[role="region"]',
        'div[class*="container"]','div[class*="wrapper"]',
        'div[class*="section"]','div[class*="content"]',
        'div[class*="grid"]','div[class*="card"]'
      ];
      const seen = new Set();
      selectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            if (seen.has(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 50) return;
            const children = Array.from(el.children).filter(c => {
              const cr = c.getBoundingClientRect(); return cr.width > 50 && cr.height > 30;
            });
            if (children.length < 2) return;
            seen.add(el);
            const dims = extractDimensions(el);
            dims.selector = el.className
              ? `.${el.className.split(' ').filter(c => c && !c.includes(':')).slice(0, 2).join('.')}`
              : el.tagName.toLowerCase();
            dims.childCount = children.length;
            dims.section    = detectSection(el);
            if (children.length >= 2 && (dims.display === 'flex' || dims.display === 'grid')) {
              const fr = children[0].getBoundingClientRect();
              const sr = children[1].getBoundingClientRect();
              const g  = Math.round(dims.flexDirection === 'column' ? sr.top - fr.bottom : sr.left - fr.right);
              if (g > 0 && g < 200) dims.calculatedGap = g;
            }
            data.containers.push(cleanObject(dims));
          });
        } catch (e) { /* ignore */ }
      });
    }

    function extractTypography() {
      ['h1','h2','h3','h4','h5','h6','p'].forEach(tag => {
        try {
          const els = document.querySelectorAll(tag);
          if (!els.length) return;
          const bySection = {};
          for (const el of els) {
            const rect = el.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 10) continue;
            const section = detectSection(el);
            const dims    = extractDimensions(el);
            if (!bySection[section]) bySection[section] = [];
            if (bySection[section].length < 2) {
              bySection[section].push({
                selector: tag, section, fontSize: dims.fontSize, fontWeight: dims.fontWeight,
                lineHeight: dims.lineHeight, letterSpacing: dims.letterSpacing,
                color: dims.color, marginTop: dims.marginTop, marginBottom: dims.marginBottom,
                textSample: el.textContent?.trim().slice(0, 40),
                y: Math.round(rect.y + window.scrollY)
              });
            }
          }
          for (const items of Object.values(bySection)) data.typography.push(...items);
        } catch (e) { /* ignore */ }
      });
      data.typography.sort((a, b) => a.y - b.y);
    }

    function extractButtons() {
      const seen = new Set();
      ['button','a[class*="btn"]','a[class*="button"]','[role="button"]','input[type="submit"]'].forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            if (seen.has(el) || data.buttons.length >= th.MAX_BUTTONS) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 40 || rect.height < 20) return;
            seen.add(el);
            const dims = extractDimensions(el);
            data.buttons.push({
              width: dims.width, height: dims.height,
              paddingTop: dims.paddingTop, paddingRight: dims.paddingRight,
              paddingBottom: dims.paddingBottom, paddingLeft: dims.paddingLeft,
              fontSize: dims.fontSize, fontWeight: dims.fontWeight,
              borderRadius: dims.borderRadius, backgroundColor: dims.backgroundColor,
              color: dims.color, text: el.textContent?.trim().slice(0, 30)
            });
          });
        } catch (e) { /* ignore */ }
      });
    }

    function extractImages() {
      try {
        document.querySelectorAll('img').forEach(el => {
          if (data.images.length >= th.MAX_IMAGES) return;
          const rect = el.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) return;
          data.images.push({
            width: Math.round(rect.width), height: Math.round(rect.height),
            aspectRatio: (rect.width / rect.height).toFixed(2),
            x: Math.round(rect.x), y: Math.round(rect.y + window.scrollY)
          });
        });
      } catch (e) { /* ignore */ }
    }

    extractContainers();
    extractTypography();
    extractButtons();
    extractImages();
    return data;
  }, { vpName: viewportName, th: thresholds });

  // Pass 2: card patterns + grid layouts (using serialized helpers)
  const helpers = {
    calculateSimilarity: calculateSimilarity.toString(),
    detectLayoutType:    detectLayoutType.toString(),
    calculateGap:        calculateGap.toString()
  };

  const { cards, gridLayouts } = await page.evaluate(({ containers, helpers }) => {
    // eslint-disable-next-line no-new-func
    const calculateSimilarity = new Function('return (' + helpers.calculateSimilarity + ')')();
    // eslint-disable-next-line no-new-func
    const detectLayoutType    = new Function('return (' + helpers.detectLayoutType + ')')();
    // eslint-disable-next-line no-new-func
    const calculateGap        = new Function('return (' + helpers.calculateGap + ')')();

    const cards = [], gridLayouts = [];
    let cardGroupId = 0;

    containers.forEach(container => {
      // Card patterns
      if (container.childCount >= 2) {
        try {
          const parent = document.querySelector(container.selector);
          if (!parent) return;
          const children = Array.from(parent.children).filter(c => {
            const cr = c.getBoundingClientRect(); return cr.width > 80 && cr.height > 60;
          });
          if (children.length < 2) return;

          const childDims = children.map(c => {
            const cr = c.getBoundingClientRect(), cs = window.getComputedStyle(c);
            return {
              width: Math.round(cr.width), height: Math.round(cr.height),
              x: Math.round(cr.x), y: Math.round(cr.y),
              paddingTop: parseFloat(cs.paddingTop) || 0,
              paddingRight: parseFloat(cs.paddingRight) || 0,
              paddingBottom: parseFloat(cs.paddingBottom) || 0,
              paddingLeft: parseFloat(cs.paddingLeft) || 0,
              marginTop: parseFloat(cs.marginTop) || 0,
              marginBottom: parseFloat(cs.marginBottom) || 0,
              borderRadius: cs.borderRadius,
              boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : undefined,
              backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined
            };
          });

          const used = new Set(), groups = [];
          for (let i = 0; i < childDims.length; i++) {
            if (used.has(i)) continue;
            const group = [childDims[i]]; used.add(i);
            for (let j = i + 1; j < childDims.length; j++) {
              if (!used.has(j) && calculateSimilarity(childDims[i], childDims[j]) >= 0.70) {
                group.push(childDims[j]); used.add(j);
              }
            }
            if (group.length >= 2) groups.push(group);
          }

          groups.forEach(group => {
            const avg    = (arr, key) => Math.round(arr.reduce((s, el) => s + (el[key] || 0), 0) / arr.length);
            const layout = detectLayoutType(group);
            cards.push({
              id: `card-group-${++cardGroupId}`, parentSelector: container.selector,
              count: group.length, layout, gap: calculateGap(group, layout),
              avgDimensions: {
                width: avg(group, 'width'), height: avg(group, 'height'),
                paddingTop: avg(group, 'paddingTop'), paddingRight: avg(group, 'paddingRight'),
                paddingBottom: avg(group, 'paddingBottom'), paddingLeft: avg(group, 'paddingLeft')
              },
              borderRadius: group[0].borderRadius !== '0px' ? group[0].borderRadius : undefined,
              boxShadow: group[0].boxShadow, backgroundColor: group[0].backgroundColor
            });
          });
        } catch (e) { /* ignore */ }
      }

      // Grid layouts
      if (container.display === 'grid' || container.display === 'flex') {
        try {
          const parent = document.querySelector(container.selector);
          if (!parent) return;
          const cs = window.getComputedStyle(parent);
          if (parent.children.length < 2) return;

          if (cs.display === 'grid') {
            const cols    = cs.gridTemplateColumns;
            const colCount = cols && cols !== 'none'
              ? cols.split(' ').filter(c => c && c !== 'none').length
              : Math.ceil(parent.children.length / 2);
            gridLayouts.push({
              selector: container.selector, display: 'grid',
              columns: colCount, rows: Math.ceil(parent.children.length / colCount),
              columnGap: parseFloat(cs.columnGap) || parseFloat(cs.gap) || 0,
              rowGap: parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0,
              childCount: parent.children.length
            });
          } else if (cs.display === 'flex') {
            gridLayouts.push({
              selector: container.selector, display: 'flex',
              flexDirection: cs.flexDirection, flexWrap: cs.flexWrap,
              gap: parseFloat(cs.gap) || container.calculatedGap || 0,
              childCount: parent.children.length
            });
          }
        } catch (e) { /* ignore */ }
      }
    });

    return { cards, gridLayouts };
  }, { containers: results.containers, helpers });

  results.cards       = cards;
  results.gridLayouts = gridLayouts;
  return results;
}
