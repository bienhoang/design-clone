/**
 * CSS At-Rule Processor for Merging
 *
 * Handles extraction and deduplication of @font-face, @keyframes,
 * @charset, @import, and @media rules during CSS merging.
 * All functions receive the css-tree module as a parameter (no top-level import)
 * so this module stays side-effect free.
 */

/**
 * Generate a hash key for a CSS rule (selector + declarations).
 * @param {Object} node - css-tree Rule node
 * @param {Object} csstree - css-tree module
 * @returns {string}
 */
export function getRuleHash(node, csstree) {
  const selector     = csstree.generate(node.prelude);
  const declarations = csstree.generate(node.block);
  return `${selector}|${declarations}`;
}

/**
 * Extract font-family value from a @font-face rule.
 * @param {Object} node - css-tree Atrule node
 * @param {Object} csstree - css-tree module
 * @returns {string}
 */
export function extractFontFamily(node, csstree) {
  let family = '';
  csstree.walk(node, {
    visit: 'Declaration',
    enter(decl) {
      if (decl.property === 'font-family') {
        family = csstree.generate(decl.value).replace(/["']/g, '').trim();
      }
    }
  });
  return family;
}

/**
 * Extract src value from a @font-face rule.
 * @param {Object} node - css-tree Atrule node
 * @param {Object} csstree - css-tree module
 * @returns {string}
 */
export function extractFontSrc(node, csstree) {
  let src = '';
  csstree.walk(node, {
    visit: 'Declaration',
    enter(decl) {
      if (decl.property === 'src') {
        src = csstree.generate(decl.value);
      }
    }
  });
  return src;
}

/**
 * Extract animation name from a @keyframes rule.
 * @param {Object} node - css-tree Atrule node
 * @param {Object} csstree - css-tree module
 * @returns {string}
 */
export function extractKeyframeName(node, csstree) {
  return node.prelude ? csstree.generate(node.prelude).trim() : '';
}

/**
 * Process a single at-rule node, updating the shared collections.
 * Handles: @charset, @import, @font-face, @keyframes, @media, and others.
 *
 * @param {Object} node          - css-tree Atrule node
 * @param {Object} csstree       - css-tree module
 * @param {Object} opts          - Merge options (deduplicateFontFaces, deduplicateKeyframes, combineMediaQueries)
 * @param {Object} collections   - Shared mutable state:
 *   { seenFontFaces, seenKeyframes, seenCharset, imports, mediaGroups, outputNodes, stats }
 */
export function processAtrule(node, csstree, opts, collections) {
  const { seenFontFaces, seenKeyframes, seenCharset, imports, mediaGroups, outputNodes, stats } = collections;
  const name = node.name.toLowerCase();

  if (name === 'charset') {
    if (!seenCharset.found) {
      seenCharset.found = true;
      seenCharset.node  = node;
    }
    return;
  }

  if (name === 'import') {
    imports.push(node);
    return;
  }

  if (name === 'font-face') {
    stats.inputRules++;
    if (opts.deduplicateFontFaces) {
      const family = extractFontFamily(node, csstree);
      const src    = extractFontSrc(node, csstree);
      const key    = `${family}|${src}`;
      if (!seenFontFaces.has(key)) {
        seenFontFaces.set(key, node);
        outputNodes.push({ type: 'fontface', node });
      } else {
        stats.fontFacesDeduped++;
      }
    } else {
      outputNodes.push({ type: 'fontface', node });
    }
    return;
  }

  if (name === 'keyframes' || name === '-webkit-keyframes') {
    stats.inputRules++;
    if (opts.deduplicateKeyframes) {
      const animName = extractKeyframeName(node, csstree);
      if (!seenKeyframes.has(animName)) {
        seenKeyframes.set(animName, node);
        outputNodes.push({ type: 'keyframes', node });
      } else {
        stats.keyframesDeduped++;
      }
    } else {
      outputNodes.push({ type: 'keyframes', node });
    }
    return;
  }

  if (name === 'media') {
    const condition = node.prelude ? csstree.generate(node.prelude) : '';

    if (opts.combineMediaQueries && condition) {
      if (!mediaGroups.has(condition)) mediaGroups.set(condition, []);

      csstree.walk(node.block, {
        visit: 'Rule',
        enter(rule) {
          stats.inputRules++;
          const hash       = getRuleHash(rule, csstree);
          const groupRules = mediaGroups.get(condition);
          if (!groupRules.some(r => r.hash === hash)) {
            groupRules.push({ hash, node: rule });
          } else {
            stats.duplicateRulesRemoved++;
          }
        }
      });
    } else {
      outputNodes.push({ type: 'atrule', node });
    }
    return;
  }

  // @supports, @page, etc. — keep as-is
  outputNodes.push({ type: 'atrule', node });
}
