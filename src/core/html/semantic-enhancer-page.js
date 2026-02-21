/**
 * Playwright page.evaluate integration for semantic HTML enhancement.
 *
 * Contains enhanceSemanticHTMLInPage() which runs entirely inside browser
 * context via page.evaluate(). All helper logic must be inlined here since
 * ES module imports are not available inside evaluate callbacks.
 * Used by semantic-enhancer.js (main module).
 */

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
