/**
 * CSS Dead Code Removal (Pass 2)
 *
 * After selector-based filtering (pass 1), removes:
 * - Empty @media blocks with no remaining rules
 * - Orphan @keyframes not referenced by any animation property
 * - Unused custom properties (CSS variables) not referenced by var()
 *
 * Only runs when --aggressive-filter is enabled.
 */

/**
 * Remove @media blocks that contain no rules after pass 1 filtering
 * @param {Object} ast - css-tree AST
 * @param {Object} csstree - css-tree module
 * @returns {number} Count of removed blocks
 */
export function removeEmptyMediaQueries(ast, csstree) {
  const empty = [];
  csstree.walk(ast, {
    visit: 'Atrule',
    enter(node, item, list) {
      if (node.name === 'media' && node.block) {
        let hasChildren = false;
        csstree.walk(node.block, { visit: 'Rule', enter() { hasChildren = true; } });
        if (!hasChildren) empty.push({ item, list });
      }
    }
  });
  for (const { item, list } of empty) {
    if (list) list.remove(item);
  }
  return empty.length;
}

/**
 * Remove @keyframes not referenced by any animation-name or animation property
 * @param {Object} ast - css-tree AST
 * @param {Object} csstree - css-tree module
 * @returns {number} Count of removed keyframes
 */
export function removeOrphanKeyframes(ast, csstree) {
  const usedNames = new Set();
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      if (node.property === 'animation-name' || node.property === 'animation') {
        const value = csstree.generate(node.value);
        // Extract first token (animation-name) from shorthand or direct value
        for (const name of value.split(/[\s,]+/)) {
          if (name && name !== 'none' && name !== 'initial' && name !== 'inherit') {
            usedNames.add(name);
          }
        }
      }
    }
  });

  const orphans = [];
  csstree.walk(ast, {
    visit: 'Atrule',
    enter(node, item, list) {
      if (node.name === 'keyframes' && node.prelude) {
        const kfName = csstree.generate(node.prelude).trim();
        if (!usedNames.has(kfName)) orphans.push({ item, list });
      }
    }
  });
  for (const { item, list } of orphans) {
    if (list) list.remove(item);
  }
  return orphans.length;
}

/**
 * Remove custom property declarations not referenced by var()
 * @param {Object} ast - css-tree AST
 * @param {Object} csstree - css-tree module
 * @returns {number} Count of removed declarations
 */
export function removeUnusedCustomProps(ast, csstree) {
  const usedVars = new Set();
  csstree.walk(ast, {
    visit: 'Function',
    enter(node) {
      if (node.name === 'var' && node.children && node.children.first) {
        const name = csstree.generate(node.children.first);
        if (name.startsWith('--')) usedVars.add(name);
      }
    }
  });

  const unused = [];
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node, item, list) {
      if (node.property.startsWith('--') && !usedVars.has(node.property)) {
        unused.push({ item, list });
      }
    }
  });
  for (const { item, list } of unused) {
    if (list) list.remove(item);
  }
  return unused.length;
}

/**
 * Run all dead code removal passes
 * @param {Object} ast - css-tree AST
 * @param {Object} csstree - css-tree module
 * @returns {{ emptyMediaRemoved: number, orphanKeyframesRemoved: number, unusedCustomPropsRemoved: number }}
 */
export function runDeadCodePass(ast, csstree) {
  return {
    emptyMediaRemoved: removeEmptyMediaQueries(ast, csstree),
    orphanKeyframesRemoved: removeOrphanKeyframes(ast, csstree),
    unusedCustomPropsRemoved: removeUnusedCustomProps(ast, csstree)
  };
}
