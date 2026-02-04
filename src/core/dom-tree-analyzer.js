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
 */

// Constants
const MAX_DEPTH = 8;
const LANDMARK_TAGS = ['header', 'main', 'footer', 'nav', 'aside', 'section', 'article'];
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Section detection thresholds (ratios of page height/width)
const HERO_THRESHOLD = 0.15;    // Top 15% of page is considered hero area
const FOOTER_THRESHOLD = 0.85; // Bottom 15% of page is considered footer area
const SIDEBAR_MAX_WIDTH = 400; // Max width in px for sidebar detection
const Y_POSITION_TOLERANCE = 5; // Tolerance in px for heading Y-position matching

/**
 * Extract DOM tree hierarchy from page
 * @param {import('playwright').Page} page - Playwright page
 * @param {Object} options - Configuration options
 * @param {number} [options.maxDepth=8] - Maximum traversal depth
 * @param {boolean} [options.includeHidden=false] - Include hidden elements (useful for accessibility audits)
 * @returns {Promise<Object>} DOMHierarchy with root, landmarks, headingTree, stats
 */
export async function extractDOMHierarchy(page, options = {}) {
  const { maxDepth = MAX_DEPTH, includeHidden = false } = options;
  const startTime = Date.now();

  const result = await page.evaluate(({ maxDepth, includeHidden, LANDMARK_TAGS, HEADING_TAGS, HERO_THRESHOLD, FOOTER_THRESHOLD, SIDEBAR_MAX_WIDTH }) => {
    // Page dimensions for section context
    const pageHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const pageWidth = document.documentElement.clientWidth;

    /**
     * Detect semantic role of element
     * Priority: ARIA role > semantic tag > class patterns
     */
    function detectRole(el) {
      const tag = el.tagName.toLowerCase();
      const ariaRole = el.getAttribute('role');

      // ARIA role takes precedence
      if (ariaRole) return ariaRole;

      // W3C landmarks - check nesting context
      if (LANDMARK_TAGS.includes(tag)) {
        const isTopLevel = !el.closest('main, section, article, aside');
        if (tag === 'header' || tag === 'footer') {
          return isTopLevel ? `${tag}-landmark` : `${tag}-section`;
        }
        return tag;
      }

      // Headings
      if (HEADING_TAGS.includes(tag)) {
        return `heading-${tag.slice(1)}`;
      }

      // Content containers via class patterns
      if (tag === 'div' || tag === 'span') {
        const cls = (el.className || '').toString().toLowerCase();
        if (cls.includes('container')) return 'container';
        if (cls.includes('wrapper')) return 'wrapper';
        if (cls.includes('card')) return 'card';
        if (cls.includes('grid')) return 'grid';
        if (cls.includes('hero')) return 'hero';
      }

      return null;
    }

    /**
     * Detect section context based on semantic tags (priority) and position
     */
    function detectSectionContext(el, yPos) {
      // Semantic tags have priority (per validation)
      const tag = el.tagName.toLowerCase();
      if (tag === 'header' || el.closest('header')) return 'header';
      if (tag === 'footer' || el.closest('footer')) return 'footer';
      if (tag === 'aside' || el.closest('aside')) return 'sidebar';
      if (tag === 'nav' || el.closest('nav')) return 'nav';

      // Position-based fallback (when no semantic tag found)
      const yRatio = yPos / pageHeight;
      if (yRatio < HERO_THRESHOLD) return 'hero';
      if (yRatio > FOOTER_THRESHOLD) return 'footer';

      // Check for narrow fixed/sticky elements (sidebar pattern)
      const computed = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if ((computed.position === 'fixed' || computed.position === 'sticky') && rect.width < SIDEBAR_MAX_WIDTH) {
        return 'sidebar';
      }

      return 'content';
    }

    /**
     * PreOrder DOM traversal
     */
    function traverseDOM(el, depth, parentId, path) {
      if (depth > maxDepth) return null;

      const rect = el.getBoundingClientRect();
      // Skip hidden elements unless includeHidden
      if (!includeHidden && (rect.width === 0 && rect.height === 0)) return null;

      const id = path.join('-');
      const computed = window.getComputedStyle(el);
      const yPos = rect.y + window.scrollY;

      const node = {
        id,
        tagName: el.tagName.toLowerCase(),
        depth,
        role: detectRole(el),
        section: detectSectionContext(el, yPos),
        attributes: {
          id: el.id || null,
          className: el.className ? el.className.toString().split(' ').slice(0, 3).join(' ') : null,
          role: el.getAttribute('role')
        },
        dimensions: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          x: Math.round(rect.x),
          y: Math.round(yPos)
        },
        layout: {
          display: computed.display,
          position: computed.position !== 'static' ? computed.position : undefined,
          flexDirection: computed.flexDirection !== 'row' ? computed.flexDirection : undefined,
          gridTemplateColumns: computed.gridTemplateColumns !== 'none' ? computed.gridTemplateColumns : undefined
        },
        children: [],
        parentId
      };

      // Recurse children (PreOrder)
      let childIdx = 0;
      for (const child of el.children) {
        const childNode = traverseDOM(child, depth + 1, id, [...path, childIdx]);
        if (childNode) {
          node.children.push(childNode);
          childIdx++;
        }
      }

      return node;
    }

    /**
     * Build landmarks map from traversed tree
     */
    function buildLandmarksMap(root) {
      const landmarks = {
        header: null,
        main: null,
        footer: null,
        nav: [],
        aside: []
      };

      function walk(node) {
        if (!node) return;

        switch (node.role) {
          case 'header-landmark': landmarks.header = node; break;
          case 'main': landmarks.main = node; break;
          case 'footer-landmark': landmarks.footer = node; break;
          case 'nav': landmarks.nav.push(node); break;
          case 'aside': landmarks.aside.push(node); break;
        }

        node.children.forEach(walk);
      }

      walk(root);
      return landmarks;
    }

    /**
     * Build heading tree with section context and text
     */
    function buildHeadingTree(root) {
      const headings = [];

      function walk(node, sectionContext) {
        if (!node) return;

        // Update section context based on landmarks
        let ctx = sectionContext;
        if (node.role === 'header-landmark') ctx = 'header';
        else if (node.role === 'main') ctx = 'content';
        else if (node.role === 'footer-landmark') ctx = 'footer';
        else if (node.role === 'aside') ctx = 'sidebar';
        else if (node.role === 'hero') ctx = 'hero';

        // Use node's detected section as fallback
        if (!ctx) ctx = node.section || 'content';

        // Collect headings
        if (node.role?.startsWith('heading-')) {
          headings.push({
            level: parseInt(node.role.slice(-1)),
            section: ctx,
            nodeId: node.id,
            y: node.dimensions.y,
            fontSize: null, // Set separately for perf
            text: null      // Set separately for perf
          });
        }

        node.children.forEach(c => walk(c, ctx));
      }

      walk(root, null);
      return headings.sort((a, b) => a.y - b.y);
    }

    // Execute traversal
    const root = traverseDOM(document.body, 0, null, [0]);
    const landmarks = buildLandmarksMap(root);
    const headingTree = buildHeadingTree(root);

    // Calculate stats
    let totalNodes = 0, maxActualDepth = 0;
    function countNodes(n) {
      if (!n) return;
      totalNodes++;
      maxActualDepth = Math.max(maxActualDepth, n.depth);
      n.children.forEach(countNodes);
    }
    countNodes(root);

    return {
      root,
      landmarks,
      headingTree,
      stats: {
        totalNodes,
        maxDepth: maxActualDepth,
        landmarkCount: [landmarks.header, landmarks.main, landmarks.footer].filter(Boolean).length +
                       landmarks.nav.length + landmarks.aside.length,
        pageHeight,
        pageWidth
      }
    };
  }, { maxDepth, includeHidden, LANDMARK_TAGS, HEADING_TAGS, HERO_THRESHOLD, FOOTER_THRESHOLD, SIDEBAR_MAX_WIDTH });

  // Extract heading text and fontSize separately (reduces main traversal complexity)
  const headingData = await page.evaluate(({ headingTree, yTolerance }) => {
    return headingTree.map(h => {
      // Find heading by its position (nodeId is path-based, harder to query)
      const headings = document.querySelectorAll(`h${h.level}`);
      for (const el of headings) {
        const rect = el.getBoundingClientRect();
        const yPos = Math.round(rect.y + window.scrollY);
        // Match by Y position (within tolerance)
        if (Math.abs(yPos - h.y) < yTolerance) {
          const computed = window.getComputedStyle(el);
          return {
            ...h,
            text: el.textContent?.trim().slice(0, 60) || null,
            fontSize: parseFloat(computed.fontSize) || null
          };
        }
      }
      return h;
    });
  }, { headingTree: result.headingTree, yTolerance: Y_POSITION_TOLERANCE });

  result.headingTree = headingData;

  // Performance tracking
  const duration = Date.now() - startTime;
  if (duration > 500) {
    console.error(`[WARN] DOM hierarchy extraction took ${duration}ms (>500ms target)`);
  }

  result.stats.extractionTimeMs = duration;

  return result;
}

export { MAX_DEPTH, LANDMARK_TAGS, HEADING_TAGS };
