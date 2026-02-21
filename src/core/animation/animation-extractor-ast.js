/**
 * AST-based CSS animation extraction helpers.
 *
 * Single-pass css-tree AST walker that extracts @keyframes definitions,
 * transition properties, and animation properties from parsed CSS.
 * Used by animation-extractor.js (main module).
 */

// ============================================================================
// Constants
// ============================================================================

/** CSS transition property names (standard + vendor prefixed) */
export const TRANSITION_PROPERTIES = new Set([
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  '-webkit-transition'
]);

/** CSS animation property names (standard + vendor prefixed) */
export const ANIMATION_PROPERTIES = new Set([
  'animation',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-play-state',
  '-webkit-animation',
  '-webkit-animation-name'
]);

// ============================================================================
// Single-Pass AST Extraction (Performance Optimized)
// ============================================================================

/**
 * Extract all animation-related data in a single AST walk.
 * Optimized O(n) traversal instead of O(3n) with separate walks.
 *
 * @param {Object} csstree - css-tree module reference
 * @param {Object} cssAst - css-tree parsed AST
 * @returns {{keyframes: Object, transitions: Array, animatedElements: Array}}
 */
export function extractAllFromAst(csstree, cssAst) {
  const keyframes = {};
  const transitions = [];
  const animatedElements = [];

  if (!csstree) {
    return { keyframes, transitions, animatedElements };
  }

  csstree.walk(cssAst, {
    enter(node) {
      // Handle @keyframes rules
      if (node.type === 'Atrule' &&
          (node.name === 'keyframes' || node.name === '-webkit-keyframes')) {
        const keyframeData = processKeyframeRule(csstree, node);
        if (keyframeData) {
          keyframes[keyframeData.name] = keyframeData.data;
        }
        return; // Don't descend into keyframes block
      }

      // Handle style rules (for transitions and animations)
      if (node.type === 'Rule' && node.prelude && node.block) {
        const ruleData = processStyleRule(csstree, node);
        if (ruleData.transition) {
          transitions.push(ruleData.transition);
        }
        if (ruleData.animation) {
          animatedElements.push(ruleData.animation);
        }
      }
    }
  });

  return { keyframes, transitions, animatedElements };
}

/**
 * Process a @keyframes at-rule node.
 *
 * @param {Object} csstree - css-tree module reference
 * @param {Object} node - css-tree Atrule node
 * @returns {{name: string, data: import('./animation-extractor.js').KeyframeData}|null}
 */
export function processKeyframeRule(csstree, node) {
  // Get keyframe name from prelude
  let name = null;

  if (node.prelude) {
    if (node.prelude.type === 'AtrulePrelude') {
      // Walk prelude to find first Identifier
      csstree.walk(node.prelude, {
        visit: 'Identifier',
        enter(idNode) {
          if (!name) name = idNode.name;
        }
      });
    } else if (node.prelude.type === 'Raw') {
      name = node.prelude.value?.trim();
    }
  }

  if (!name || !node.block) return null;

  // Extract frames from keyframe block
  const frames = [];
  csstree.walk(node.block, {
    visit: 'Rule',
    enter(frameNode) {
      const offset = csstree.generate(frameNode.prelude);
      const properties = {};

      if (frameNode.block) {
        csstree.walk(frameNode.block, {
          visit: 'Declaration',
          enter(declNode) {
            properties[declNode.property] = csstree.generate(declNode.value);
          }
        });
      }

      if (Object.keys(properties).length > 0) {
        frames.push({ offset, properties });
      }
    }
  });

  return {
    name,
    data: {
      frames,
      raw: csstree.generate(node),
      vendorPrefixed: node.name === '-webkit-keyframes'
    }
  };
}

/**
 * Process a style rule for transition and animation properties.
 *
 * @param {Object} csstree - css-tree module reference
 * @param {Object} node - css-tree Rule node
 * @returns {{transition: Object|null, animation: Object|null}}
 */
export function processStyleRule(csstree, node) {
  const selector = csstree.generate(node.prelude);
  const transitionProps = {};
  const animationProps = {};

  // Extract declarations in a single walk
  csstree.walk(node.block, {
    visit: 'Declaration',
    enter(declNode) {
      const prop = declNode.property;
      const value = csstree.generate(declNode.value);

      if (TRANSITION_PROPERTIES.has(prop)) {
        transitionProps[prop] = value;
      }
      if (ANIMATION_PROPERTIES.has(prop)) {
        animationProps[prop] = value;
      }
    }
  });

  return {
    transition: Object.keys(transitionProps).length > 0
      ? { selector, ...transitionProps }
      : null,
    animation: Object.keys(animationProps).length > 0
      ? { selector, ...animationProps }
      : null
  };
}
