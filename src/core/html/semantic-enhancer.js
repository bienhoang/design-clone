/**
 * Semantic HTML Enhancer
 *
 * Injects WordPress-compatible semantic IDs, classes, and ARIA roles
 * into extracted HTML while preserving original styling.
 *
 * Key features:
 * - Detects sections via semantic tags, ARIA roles, class patterns
 * - Adds IDs only if none exist
 * - Appends classes (never replaces)
 * - Sets roles only if not present
 * - Handles multiple navs with aria-labels
 */


// ============================================================================
// Constants
// ============================================================================

/**
 * WordPress-compatible semantic mappings
 */
export const SEMANTIC_MAPPINGS = {
  header: {
    id: 'site-header',
    classes: ['site-header'],
    role: 'banner'
  },
  nav: {
    id: 'site-navigation',
    classes: ['main-navigation', 'nav-menu'],
    role: 'navigation'
  },
  main: {
    id: 'main-content',
    classes: ['site-main', 'content-area'],
    role: 'main'
  },
  sidebar: {
    id: 'primary-sidebar',
    classes: ['widget-area', 'sidebar'],
    role: 'complementary'
  },
  footer: {
    id: 'site-footer',
    classes: ['site-footer'],
    role: 'contentinfo'
  },
  hero: {
    id: 'hero-section',
    classes: ['hero'],
    role: null  // No ARIA landmark role for hero
  }
};

/**
 * Class patterns for section detection (case-insensitive)
 */
export const CLASS_PATTERNS = {
  header: ['header', 'masthead', 'site-header', 'page-header'],
  nav: ['nav', 'menu', 'navigation'],
  main: ['main', 'content', 'page-content'],
  sidebar: ['sidebar', 'aside', 'widget-area'],
  footer: ['footer', 'site-footer', 'page-footer'],
  hero: ['hero', 'banner', 'jumbotron', 'splash']
};

// ============================================================================
// Detection & Application
// ============================================================================

/**
 * Detect section type from element.
 *
 * Priority:
 * 1. Semantic HTML tags
 * 2. ARIA role attributes
 * 3. Class pattern matching
 *
 * @param {Element} element - DOM element to analyze
 * @returns {string|null} Section type or null
 */
export function detectSectionType(element) {
  const tag = element.tagName?.toLowerCase();
  const ariaRole = element.getAttribute?.('role');

  // Priority 1: Semantic HTML tags
  if (tag === 'header') return 'header';
  if (tag === 'nav') return 'nav';
  if (tag === 'main') return 'main';
  if (tag === 'aside') return 'sidebar';
  if (tag === 'footer') return 'footer';

  // Priority 2: ARIA roles
  if (ariaRole === 'banner') return 'header';
  if (ariaRole === 'navigation') return 'nav';
  if (ariaRole === 'main') return 'main';
  if (ariaRole === 'complementary') return 'sidebar';
  if (ariaRole === 'contentinfo') return 'footer';

  // Priority 3: Class patterns
  const className = (element.className || '').toString().toLowerCase();
  if (!className) return null;

  for (const [sectionType, patterns] of Object.entries(CLASS_PATTERNS)) {
    if (patterns.some(pattern => className.includes(pattern))) {
      // Avoid false positives: ensure it's a container element
      if (tag === 'div' || tag === 'section' || tag === 'article') {
        return sectionType;
      }
    }
  }

  return null;
}

/**
 * Apply semantic attributes to element.
 *
 * Rules:
 * - Add ID only if none exists
 * - Append classes (preserve existing)
 * - Set role only if none exists
 *
 * @param {Element} element - DOM element to enhance
 * @param {string} sectionType - Type from SEMANTIC_MAPPINGS
 * @param {Object} options - Configuration options
 * @param {Set} options.usedIds - Track used IDs to avoid duplicates
 * @param {number} options.navIndex - Index for multiple nav labeling
 */
export function applySemanticAttributes(element, sectionType, options = {}) {
  const mapping = SEMANTIC_MAPPINGS[sectionType];
  if (!mapping) return;

  const { usedIds = new Set(), navIndex = 0 } = options;

  // Add ID only if not present and not already used
  if (!element.id && mapping.id) {
    let targetId = mapping.id;

    if (usedIds.has(targetId)) {
      targetId = `${mapping.id}-${navIndex + 1}`;
    }

    if (!usedIds.has(targetId)) {
      element.id = targetId;
      usedIds.add(targetId);
    }
  }

  // Append classes (preserve existing)
  if (mapping.classes && mapping.classes.length > 0) {
    const existingClasses = element.className
      ? element.className.toString().split(/\s+/).filter(Boolean)
      : [];
    const newClasses = mapping.classes.filter(c => !existingClasses.includes(c));

    if (newClasses.length > 0) {
      element.className = [...existingClasses, ...newClasses].join(' ').trim();
    }
  }

  // Set role only if not present
  if (mapping.role && !element.getAttribute('role')) {
    element.setAttribute('role', mapping.role);
  }
}

/**
 * Handle multiple navigation elements with proper labeling.
 *
 * @param {NodeList|Array} navElements - All nav elements
 * @param {Set} usedIds - Track used IDs
 */
export function handleMultipleNavs(navElements, usedIds = new Set()) {
  const navs = Array.from(navElements);
  if (navs.length === 0) return;

  navs.forEach((nav, index) => {
    const isInHeader = nav.closest?.('header') !== null;
    const isInFooter = nav.closest?.('footer') !== null;

    if (isInHeader && index === 0) {
      applySemanticAttributes(nav, 'nav', { usedIds, navIndex: 0 });
      if (!nav.getAttribute('aria-label')) {
        nav.setAttribute('aria-label', 'Primary Menu');
      }
    } else if (isInFooter) {
      if (!nav.id) {
        nav.id = usedIds.has('footer-navigation')
          ? `footer-navigation-${index}`
          : 'footer-navigation';
        usedIds.add(nav.id);
      }
      nav.setAttribute('role', 'navigation');
      if (!nav.getAttribute('aria-label')) {
        nav.setAttribute('aria-label', 'Footer Menu');
      }
    } else {
      applySemanticAttributes(nav, 'nav', { usedIds, navIndex: index });
      if (!nav.getAttribute('aria-label')) {
        nav.setAttribute('aria-label', `Navigation ${index + 1}`);
      }
    }
  });
}

// ============================================================================
// Main enhancer (browser context)
// ============================================================================

/**
 * Enhance HTML string with semantic attributes.
 *
 * **IMPORTANT:** Requires browser context (uses DOMParser).
 * For Node.js/Playwright, use `enhanceSemanticHTMLInPage()` instead.
 *
 * @param {string} html - Original HTML string (must be valid HTML)
 * @param {Object} [domHierarchy=null] - Optional DOM hierarchy from dom-tree-analyzer
 * @returns {{html: string, stats: Object}} Enhanced HTML and stats
 * @throws {Error} If html is empty or DOMParser is unavailable
 */
export function enhanceSemanticHTML(html, domHierarchy = null) {
  if (!html || typeof html !== 'string') {
    throw new Error('enhanceSemanticHTML requires a valid HTML string');
  }
  if (typeof DOMParser === 'undefined') {
    throw new Error('enhanceSemanticHTML requires browser context (DOMParser). Use enhanceSemanticHTMLInPage() for Playwright.');
  }

  const stats = {
    sectionsEnhanced: 0,
    idsAdded: 0,
    classesAdded: 0,
    rolesAdded: 0,
    warnings: []
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const usedIds = new Set();

  doc.querySelectorAll('[id]').forEach(el => usedIds.add(el.id));

  const combinedLandmarkSelector = [
    'header:not(header header)',
    'footer:not(footer footer)',
    'main',
    'aside',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="main"]',
    '[role="complementary"]'
  ].join(', ');

  const processedElements = new Set();

  try {
    doc.querySelectorAll(combinedLandmarkSelector).forEach(el => {
      if (processedElements.has(el)) return;
      processedElements.add(el);

      const sectionType = detectSectionType(el);
      if (sectionType) {
        const hadId = !!el.id;
        const hadRole = !!el.getAttribute('role');
        const oldClasses = el.className;

        applySemanticAttributes(el, sectionType, { usedIds });

        if (!hadId && el.id) stats.idsAdded++;
        if (!hadRole && el.getAttribute('role')) stats.rolesAdded++;
        if (oldClasses !== el.className) stats.classesAdded++;
        stats.sectionsEnhanced++;
      }
    });
  } catch (err) {
    stats.warnings.push(`Landmark selector error: ${err.message}`);
  }

  const navElements = doc.querySelectorAll('nav, [role="navigation"]');
  let newNavCount = 0;
  navElements.forEach(nav => {
    if (!processedElements.has(nav)) {
      processedElements.add(nav);
      newNavCount++;
    }
  });
  if (navElements.length > 0) {
    handleMultipleNavs(navElements, usedIds);
    stats.sectionsEnhanced += newNavCount;
  }

  const heroSelectors = [
    '.hero', '.banner', '.jumbotron', '.splash',
    '[class*="hero"]', '[class*="banner"]'
  ];
  heroSelectors.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => {
        if (!el.closest('header') && !el.closest('footer')) {
          const hadId = !!el.id;
          applySemanticAttributes(el, 'hero', { usedIds });
          if (!hadId && el.id) stats.idsAdded++;
          stats.sectionsEnhanced++;
        }
      });
    } catch (err) {
      // Some selectors may not be valid in all contexts
    }
  });

  const enhancedHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  return { html: enhancedHtml, stats };
}

// ============================================================================
// Playwright page integration
// ============================================================================

/**
 * Enhance HTML using page.evaluate (for Playwright integration).
 *
 * This is the recommended method for Node.js/Playwright usage.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} html - Original HTML string (must be valid HTML)
 * @returns {Promise<{html: string, stats: Object}>}
 * @throws {Error} If page is null or html is invalid
 */
export async function enhanceSemanticHTMLInPage(page, html) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new Error('enhanceSemanticHTMLInPage requires a valid Playwright page');
  }
  if (!html || typeof html !== 'string') {
    throw new Error('enhanceSemanticHTMLInPage requires a valid HTML string');
  }

  return await page.evaluate((htmlStr) => {
    // All logic inlined: browser serialization boundary prevents imports
    const SEMANTIC_MAPPINGS = {
      header: { id: 'site-header', classes: ['site-header'], role: 'banner' },
      nav: { id: 'site-navigation', classes: ['main-navigation', 'nav-menu'], role: 'navigation' },
      main: { id: 'main-content', classes: ['site-main', 'content-area'], role: 'main' },
      sidebar: { id: 'primary-sidebar', classes: ['widget-area', 'sidebar'], role: 'complementary' },
      footer: { id: 'site-footer', classes: ['site-footer'], role: 'contentinfo' },
      hero: { id: 'hero-section', classes: ['hero'], role: null }
    };

    const CLASS_PATTERNS = {
      header: ['header', 'masthead', 'site-header', 'page-header'],
      nav: ['nav', 'menu', 'navigation'],
      sidebar: ['sidebar', 'aside', 'widget-area'],
      footer: ['footer', 'site-footer', 'page-footer'],
      hero: ['hero', 'banner', 'jumbotron', 'splash']
    };

    function detectSectionType(element) {
      const tag = element.tagName?.toLowerCase();
      const ariaRole = element.getAttribute?.('role');

      if (tag === 'header') return 'header';
      if (tag === 'nav') return 'nav';
      if (tag === 'main') return 'main';
      if (tag === 'aside') return 'sidebar';
      if (tag === 'footer') return 'footer';

      if (ariaRole === 'banner') return 'header';
      if (ariaRole === 'navigation') return 'nav';
      if (ariaRole === 'main') return 'main';
      if (ariaRole === 'complementary') return 'sidebar';
      if (ariaRole === 'contentinfo') return 'footer';

      const className = (element.className || '').toString().toLowerCase();
      if (!className) return null;

      for (const [sectionType, patterns] of Object.entries(CLASS_PATTERNS)) {
        if (patterns.some(pattern => className.includes(pattern))) {
          if (['div', 'section', 'article'].includes(tag)) return sectionType;
        }
      }
      return null;
    }

    function applySemanticAttributes(element, sectionType, usedIds, navIndex = 0) {
      const mapping = SEMANTIC_MAPPINGS[sectionType];
      if (!mapping) return;

      if (!element.id && mapping.id) {
        let targetId = mapping.id;
        if (usedIds.has(targetId)) targetId = `${mapping.id}-${navIndex + 1}`;
        if (!usedIds.has(targetId)) {
          element.id = targetId;
          usedIds.add(targetId);
        }
      }

      if (mapping.classes?.length > 0) {
        const existing = element.className
          ? element.className.toString().split(/\s+/).filter(Boolean)
          : [];
        const added = mapping.classes.filter(c => !existing.includes(c));
        if (added.length > 0) element.className = [...existing, ...added].join(' ').trim();
      }

      if (mapping.role && !element.getAttribute('role')) {
        element.setAttribute('role', mapping.role);
      }
    }

    const stats = { sectionsEnhanced: 0, idsAdded: 0, classesAdded: 0, rolesAdded: 0, warnings: [] };
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    const usedIds = new Set();

    doc.querySelectorAll('[id]').forEach(el => usedIds.add(el.id));

    ['header:not(header header)', 'footer:not(footer footer)', 'main', 'aside'].forEach(sel => {
      try {
        doc.querySelectorAll(sel).forEach(el => {
          const type = detectSectionType(el);
          if (type) {
            const hadId = !!el.id;
            const hadRole = !!el.getAttribute('role');
            applySemanticAttributes(el, type, usedIds);
            if (!hadId && el.id) stats.idsAdded++;
            if (!hadRole && el.getAttribute('role')) stats.rolesAdded++;
            stats.sectionsEnhanced++;
          }
        });
      } catch (err) {
        stats.warnings.push(`Selector error: ${sel}`);
      }
    });

    doc.querySelectorAll('nav, [role="navigation"]').forEach((nav, index) => {
      const isInHeader = nav.closest('header') !== null;
      const isInFooter = nav.closest('footer') !== null;

      if (isInHeader && index === 0) {
        applySemanticAttributes(nav, 'nav', usedIds, 0);
        if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Primary Menu');
      } else if (isInFooter) {
        if (!nav.id) {
          nav.id = usedIds.has('footer-navigation')
            ? `footer-navigation-${index}` : 'footer-navigation';
          usedIds.add(nav.id);
        }
        nav.setAttribute('role', 'navigation');
        if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Footer Menu');
      } else {
        applySemanticAttributes(nav, 'nav', usedIds, index);
        if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', `Navigation ${index + 1}`);
      }
      stats.sectionsEnhanced++;
    });

    return { html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, stats };
  }, html);
}
