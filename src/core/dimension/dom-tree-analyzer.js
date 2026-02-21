/**
 * DOM Tree Analyzer
 *
 * Traverse DOM tree hierarchically to capture structure,
 * semantic landmarks, and parent-child relationships.
 *
 * Key features:
 * - PreOrder traversal (parent before children)
 * - W3C landmark detection (header, main, footer, nav, aside)
 * - Section context mapping (hero, content, sidebar, footer)
 * - Bidirectional parent-child refs
 * - Configurable max depth (default: 8)
 *
 * Post-processing (landmarks map, heading tree, stats) lives in
 * dom-tree-analyzer-tree-builders.js and runs in Node context.
 */

import { buildLandmarksMap, buildHeadingTree, countTreeStats } from './dom-tree-analyzer-tree-builders.js';

// Constants
export const MAX_DEPTH = 8;
export const LANDMARK_TAGS = ['header', 'main', 'footer', 'nav', 'aside', 'section', 'article'];
export const HEADING_TAGS  = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Section detection thresholds
const HERO_THRESHOLD     = 0.15;
const FOOTER_THRESHOLD   = 0.85;
const SIDEBAR_MAX_WIDTH  = 400;
const Y_POSITION_TOLERANCE = 5;

/**
 * Extract DOM tree hierarchy from page.
 * @param {import('playwright').Page} page - Playwright page
 * @param {Object} options
 * @param {number} [options.maxDepth=8] - Maximum traversal depth
 * @param {boolean} [options.includeHidden=false] - Include hidden elements
 * @returns {Promise<Object>} DOMHierarchy with root, landmarks, headingTree, stats
 */
export async function extractDOMHierarchy(page, options = {}) {
  const { maxDepth = MAX_DEPTH, includeHidden = false } = options;
  const startTime = Date.now();

  // Run DOM traversal inside browser context
  const result = await page.evaluate(
    ({ maxDepth, includeHidden, LANDMARK_TAGS, HEADING_TAGS, HERO_THRESHOLD, FOOTER_THRESHOLD, SIDEBAR_MAX_WIDTH }) => {
      const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const pageWidth  = document.documentElement.clientWidth;

      function detectRole(el) {
        const tag      = el.tagName.toLowerCase();
        const ariaRole = el.getAttribute('role');
        if (ariaRole) return ariaRole;

        if (LANDMARK_TAGS.includes(tag)) {
          const isTopLevel = !el.closest('main, section, article, aside');
          if (tag === 'header' || tag === 'footer') {
            return isTopLevel ? `${tag}-landmark` : `${tag}-section`;
          }
          return tag;
        }

        if (HEADING_TAGS.includes(tag)) return `heading-${tag.slice(1)}`;

        if (tag === 'div' || tag === 'span') {
          const cls = (el.className || '').toString().toLowerCase();
          if (cls.includes('container')) return 'container';
          if (cls.includes('wrapper'))   return 'wrapper';
          if (cls.includes('card'))      return 'card';
          if (cls.includes('grid'))      return 'grid';
          if (cls.includes('hero'))      return 'hero';
        }

        return null;
      }

      function detectSectionContext(el, yPos) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'header' || el.closest('header')) return 'header';
        if (tag === 'footer' || el.closest('footer')) return 'footer';
        if (tag === 'aside'  || el.closest('aside'))  return 'sidebar';
        if (tag === 'nav'    || el.closest('nav'))     return 'nav';

        const yRatio = yPos / pageHeight;
        if (yRatio < HERO_THRESHOLD)   return 'hero';
        if (yRatio > FOOTER_THRESHOLD) return 'footer';

        const computed = window.getComputedStyle(el);
        const rect     = el.getBoundingClientRect();
        if ((computed.position === 'fixed' || computed.position === 'sticky') && rect.width < SIDEBAR_MAX_WIDTH) {
          return 'sidebar';
        }

        return 'content';
      }

      function traverseDOM(el, depth, parentId, path) {
        if (depth > maxDepth) return null;
        const rect = el.getBoundingClientRect();
        if (!includeHidden && rect.width === 0 && rect.height === 0) return null;

        const id       = path.join('-');
        const computed = window.getComputedStyle(el);
        const yPos     = rect.y + window.scrollY;

        const node = {
          id,
          tagName:  el.tagName.toLowerCase(),
          depth,
          role:     detectRole(el),
          section:  detectSectionContext(el, yPos),
          attributes: {
            id:        el.id || null,
            className: el.className ? el.className.toString().split(' ').slice(0, 3).join(' ') : null,
            role:      el.getAttribute('role')
          },
          dimensions: {
            width:  Math.round(rect.width),
            height: Math.round(rect.height),
            x:      Math.round(rect.x),
            y:      Math.round(yPos)
          },
          layout: {
            display:             computed.display,
            position:            computed.position !== 'static' ? computed.position : undefined,
            flexDirection:       computed.flexDirection !== 'row' ? computed.flexDirection : undefined,
            gridTemplateColumns: computed.gridTemplateColumns !== 'none' ? computed.gridTemplateColumns : undefined
          },
          children: [],
          parentId
        };

        let childIdx = 0;
        for (const child of el.children) {
          const childNode = traverseDOM(child, depth + 1, id, [...path, childIdx]);
          if (childNode) { node.children.push(childNode); childIdx++; }
        }

        return node;
      }

      const root = traverseDOM(document.body, 0, null, [0]);
      return { root, pageHeight, pageWidth };
    },
    { maxDepth, includeHidden, LANDMARK_TAGS, HEADING_TAGS, HERO_THRESHOLD, FOOTER_THRESHOLD, SIDEBAR_MAX_WIDTH }
  );

  // Post-process in Node context using tree-builder helpers
  const landmarks   = buildLandmarksMap(result.root);
  const headingTree = buildHeadingTree(result.root);
  const { totalNodes, maxDepth: maxActualDepth } = countTreeStats(result.root);

  // Enrich headings with text + fontSize (separate evaluate for perf)
  const headingData = await page.evaluate(({ headingTree, yTolerance }) => {
    return headingTree.map(h => {
      const headings = document.querySelectorAll(`h${h.level}`);
      for (const el of headings) {
        const rect = el.getBoundingClientRect();
        const yPos = Math.round(rect.y + window.scrollY);
        if (Math.abs(yPos - h.y) < yTolerance) {
          const computed = window.getComputedStyle(el);
          return {
            ...h,
            text:     el.textContent?.trim().slice(0, 60) || null,
            fontSize: parseFloat(computed.fontSize) || null
          };
        }
      }
      return h;
    });
  }, { headingTree, yTolerance: Y_POSITION_TOLERANCE });

  const duration = Date.now() - startTime;
  if (duration > 500) {
    console.error(`[WARN] DOM hierarchy extraction took ${duration}ms (>500ms target)`);
  }

  return {
    root:        result.root,
    landmarks,
    headingTree: headingData,
    stats: {
      totalNodes,
      maxDepth:        maxActualDepth,
      landmarkCount:   [landmarks.header, landmarks.main, landmarks.footer].filter(Boolean).length +
                       landmarks.nav.length + landmarks.aside.length,
      pageHeight:      result.pageHeight,
      pageWidth:       result.pageWidth,
      extractionTimeMs: duration
    }
  };
}
