/**
 * Semantic HTML mappings and section detection logic.
 *
 * Contains WordPress-compatible semantic mappings (IDs, classes, ARIA roles),
 * class pattern definitions, and the detectSectionType / applySemanticAttributes
 * / handleMultipleNavs functions used in Node.js context.
 * Used by semantic-enhancer.js (main module).
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
