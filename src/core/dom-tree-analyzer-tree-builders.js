/**
 * DOM Tree Post-Processors
 *
 * Node-side functions that operate on the traversed DOM tree result
 * returned from page.evaluate. Builds the landmarks map and heading
 * tree from the raw root node structure.
 */

/**
 * Build a landmarks map from the traversed DOM tree.
 * @param {Object} root - Root node from traverseDOM
 * @returns {{ header, main, footer, nav: Array, aside: Array }}
 */
export function buildLandmarksMap(root) {
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
      case 'main':            landmarks.main   = node; break;
      case 'footer-landmark': landmarks.footer = node; break;
      case 'nav':             landmarks.nav.push(node); break;
      case 'aside':           landmarks.aside.push(node); break;
    }
    node.children.forEach(walk);
  }

  walk(root);
  return landmarks;
}

/**
 * Build a heading tree with section context and position, sorted by Y.
 * Text and fontSize are filled separately (see extractHeadingData).
 * @param {Object} root - Root node from traverseDOM
 * @returns {Array<{ level, section, nodeId, y, fontSize, text }>}
 */
export function buildHeadingTree(root) {
  const headings = [];

  function walk(node, sectionContext) {
    if (!node) return;

    let ctx = sectionContext;
    if (node.role === 'header-landmark') ctx = 'header';
    else if (node.role === 'main')        ctx = 'content';
    else if (node.role === 'footer-landmark') ctx = 'footer';
    else if (node.role === 'aside')       ctx = 'sidebar';
    else if (node.role === 'hero')        ctx = 'hero';
    if (!ctx) ctx = node.section || 'content';

    if (node.role?.startsWith('heading-')) {
      headings.push({
        level:    parseInt(node.role.slice(-1)),
        section:  ctx,
        nodeId:   node.id,
        y:        node.dimensions.y,
        fontSize: null,
        text:     null
      });
    }

    node.children.forEach(c => walk(c, ctx));
  }

  walk(root, null);
  return headings.sort((a, b) => a.y - b.y);
}

/**
 * Count total nodes and max depth in the traversed tree.
 * @param {Object} root - Root node
 * @returns {{ totalNodes: number, maxDepth: number }}
 */
export function countTreeStats(root) {
  let totalNodes = 0;
  let maxActualDepth = 0;

  function count(n) {
    if (!n) return;
    totalNodes++;
    maxActualDepth = Math.max(maxActualDepth, n.depth);
    n.children.forEach(count);
  }

  count(root);
  return { totalNodes, maxDepth: maxActualDepth };
}
