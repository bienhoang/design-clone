/**
 * Section Detector
 *
 * Detect semantic page sections from DOM hierarchy for section-based
 * screenshot analysis. Returns bounding boxes for cropping.
 *
 * Usage:
 *   import { detectSections } from './section-detector.js';
 *   const sections = await detectSections(page, { padding: 40 });
 *
 * Strategies (in order):
 * 1. Semantic HTML: <header>, <main>, <section>, <footer>
 * 2. data-section attributes
 * 3. Class patterns: hero, services, features, about, contact
 * 4. Large direct children of <main> or <body> (>200px height)
 * 5. Fallback: viewport chunking if <minSections detected
 */

import { extractDOMHierarchy } from './dom-tree-analyzer.js';

// Section class patterns to match
const SECTION_CLASS_PATTERNS = [
  'hero', 'banner', 'header', 'navigation', 'nav',
  'services', 'features', 'about', 'team', 'portfolio',
  'testimonials', 'reviews', 'pricing', 'plans',
  'faq', 'questions', 'blog', 'news', 'articles',
  'contact', 'cta', 'call-to-action', 'newsletter',
  'footer', 'partners', 'clients', 'gallery', 'showcase'
];

// Default configuration
const DEFAULT_OPTIONS = {
  minSections: 3,
  maxSections: 20,
  padding: 40,
  fallbackToViewport: true,
  viewportHeight: 900,
  minSectionHeight: 150,
  overlapRatio: 0.1  // 10% overlap for viewport fallback
};

/**
 * Detect page sections from DOM hierarchy
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of section objects with bounds
 */
export async function detectSections(page, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Get page dimensions
  const pageDimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    )
  }));

  // Strategy 1: Find semantic sections directly from page
  let sections = await findSemanticSections(page, pageDimensions, config);

  // Strategy 2: If not enough sections, try class pattern matching
  if (sections.length < config.minSections) {
    const classSections = await findClassPatternSections(page, pageDimensions, config);
    sections = mergeSections(sections, classSections);
  }

  // Strategy 3: If still not enough, find large direct children
  if (sections.length < config.minSections) {
    const largeSections = await findLargeChildSections(page, pageDimensions, config);
    sections = mergeSections(sections, largeSections);
  }

  // Strategy 4: Fallback to viewport chunking
  if (sections.length < config.minSections && config.fallbackToViewport) {
    sections = generateViewportChunks(pageDimensions, config);
  }

  // Apply padding and validate bounds
  sections = sections.map((section, idx) => ({
    ...section,
    index: idx,
    bounds: applyPadding(section.bounds, config.padding, pageDimensions)
  }));

  // Sort by Y position and limit
  sections = sections
    .sort((a, b) => a.bounds.y - b.bounds.y)
    .slice(0, config.maxSections);

  // Re-index after sort
  return sections.map((section, idx) => ({ ...section, index: idx }));
}

/**
 * Find semantic HTML sections (header, main, section, footer)
 */
async function findSemanticSections(page, pageDimensions, config) {
  return await page.evaluate(({ minHeight }) => {
    const sections = [];
    const processed = new Set();

    // Selectors for semantic sections
    const selectors = [
      'header:not(header header)',  // Top-level header only
      'main > section',
      'main > article',
      'body > section',
      'body > article',
      '[data-section]',
      'footer:not(footer footer)'   // Top-level footer only
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);

      for (const el of elements) {
        // Skip if already processed (nested elements)
        if (processed.has(el)) continue;

        const rect = el.getBoundingClientRect();
        const absoluteY = rect.y + window.scrollY;

        // Skip tiny sections
        if (rect.height < minHeight) continue;

        // Determine section name
        let name = el.tagName.toLowerCase();
        if (el.hasAttribute('data-section')) {
          name = el.getAttribute('data-section');
        } else if (el.id) {
          name = el.id;
        } else if (el.className) {
          // Try to extract meaningful class name
          const cls = el.className.toString().toLowerCase();
          const match = cls.match(/\b(hero|about|services|features|contact|footer|header|nav|cta|testimonials|pricing|faq|team|blog|news)\b/);
          if (match) name = match[1];
        }

        sections.push({
          name,
          role: el.tagName.toLowerCase(),
          selector: el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}`,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(absoluteY),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        });

        processed.add(el);
      }
    }

    return sections;
  }, { minHeight: config.minSectionHeight });
}

/**
 * Find sections by class pattern matching
 */
async function findClassPatternSections(page, pageDimensions, config) {
  return await page.evaluate(({ patterns, minHeight }) => {
    const sections = [];
    const processed = new Set();

    // Build selector from patterns
    const classSelectors = patterns.map(p => `[class*="${p}"]`).join(', ');
    const elements = document.querySelectorAll(classSelectors);

    for (const el of elements) {
      // Only consider direct children of body or main
      const parent = el.parentElement;
      if (!parent || (parent.tagName !== 'BODY' && parent.tagName !== 'MAIN')) {
        continue;
      }

      // Skip if inside another matched element
      if (processed.has(el)) continue;

      const rect = el.getBoundingClientRect();
      const absoluteY = rect.y + window.scrollY;

      if (rect.height < minHeight) continue;

      // Extract pattern name from class
      const cls = el.className.toString().toLowerCase();
      let name = 'section';
      for (const pattern of patterns) {
        if (cls.includes(pattern)) {
          name = pattern;
          break;
        }
      }

      sections.push({
        name,
        role: 'class-pattern',
        selector: el.id ? `#${el.id}` : `.${el.className.toString().split(' ')[0]}`,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(absoluteY),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      });

      processed.add(el);
    }

    return sections;
  }, { patterns: SECTION_CLASS_PATTERNS, minHeight: config.minSectionHeight });
}

/**
 * Find large direct children of main/body as sections
 */
async function findLargeChildSections(page, pageDimensions, config) {
  return await page.evaluate(({ minHeight }) => {
    const sections = [];

    // Check direct children of main, then body
    const containers = [
      document.querySelector('main'),
      document.body
    ].filter(Boolean);

    for (const container of containers) {
      const children = Array.from(container.children);

      for (const child of children) {
        // Skip script, style, noscript
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'].includes(child.tagName)) {
          continue;
        }

        const rect = child.getBoundingClientRect();
        const absoluteY = rect.y + window.scrollY;

        // Only large sections (>300px or >20% viewport height)
        const threshold = Math.max(300, window.innerHeight * 0.2);
        if (rect.height < threshold) continue;

        // Skip if already covered by semantic detection
        if (child.tagName === 'HEADER' || child.tagName === 'FOOTER' ||
            child.tagName === 'SECTION' || child.tagName === 'ARTICLE') {
          continue;
        }

        // Generate descriptive name based on position
        let name = child.id || '';
        if (!name && child.className) {
          const cls = child.className.toString();
          const firstClass = cls.split(' ')[0].toLowerCase();
          // Skip generic framework classes
          const genericPatterns = ['sd', 'container', 'wrapper', 'div', 'block', 'row', 'col', 'section'];
          if (!genericPatterns.includes(firstClass)) {
            name = firstClass;
          }
        }
        if (!name) {
          // Name based on Y position relative to page
          const yRatio = absoluteY / (document.body.scrollHeight || 1);
          if (yRatio < 0.15) name = 'top-section';
          else if (yRatio < 0.35) name = 'upper-content';
          else if (yRatio < 0.55) name = 'middle-content';
          else if (yRatio < 0.75) name = 'lower-content';
          else name = 'bottom-section';
          name = `${name}-${sections.length}`;
        }

        sections.push({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          role: 'large-block',
          selector: child.id ? `#${child.id}` : child.tagName.toLowerCase(),
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(absoluteY),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        });
      }

      // If we found sections in main, don't check body
      if (sections.length > 0 && container.tagName === 'MAIN') break;
    }

    return sections;
  }, { minHeight: config.minSectionHeight });
}

/**
 * Generate viewport chunks as fallback
 */
function generateViewportChunks(pageDimensions, config) {
  const { width, height } = pageDimensions;
  const { viewportHeight, overlapRatio } = config;

  const sections = [];
  const overlap = Math.round(viewportHeight * overlapRatio);
  const step = viewportHeight - overlap;

  let y = 0;
  let index = 0;

  while (y < height) {
    const chunkHeight = Math.min(viewportHeight, height - y);

    sections.push({
      name: `viewport-${index}`,
      role: 'viewport-chunk',
      selector: null,
      bounds: {
        x: 0,
        y: y,
        width: width,
        height: chunkHeight
      }
    });

    y += step;
    index++;

    // Safety limit
    if (index > 50) break;
  }

  return sections;
}

/**
 * Merge sections, removing duplicates based on Y overlap
 */
function mergeSections(existing, newSections) {
  const result = [...existing];

  for (const section of newSections) {
    // Check if this section overlaps significantly with existing
    const overlaps = result.some(s => {
      const yOverlap = Math.max(0,
        Math.min(s.bounds.y + s.bounds.height, section.bounds.y + section.bounds.height) -
        Math.max(s.bounds.y, section.bounds.y)
      );
      const minHeight = Math.min(s.bounds.height, section.bounds.height);
      return yOverlap > minHeight * 0.5;  // >50% overlap
    });

    if (!overlaps) {
      result.push(section);
    }
  }

  return result;
}

/**
 * Apply padding to bounds, clamping to page dimensions
 */
function applyPadding(bounds, padding, pageDimensions) {
  return {
    x: Math.max(0, bounds.x - padding),
    y: Math.max(0, bounds.y - padding),
    width: Math.min(pageDimensions.width, bounds.width + padding * 2),
    height: Math.min(
      pageDimensions.height - Math.max(0, bounds.y - padding),
      bounds.height + padding * 2
    )
  };
}

/**
 * Get section summary for logging
 */
export function getSectionSummary(sections) {
  return {
    count: sections.length,
    names: sections.map(s => s.name),
    totalHeight: sections.reduce((sum, s) => sum + s.bounds.height, 0),
    hasViewportFallback: sections.some(s => s.role === 'viewport-chunk')
  };
}

export { DEFAULT_OPTIONS, SECTION_CLASS_PATTERNS };
