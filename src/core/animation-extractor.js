/**
 * Animation Extractor
 *
 * Extract @keyframes definitions, animation properties, and transition values
 * from CSS using css-tree AST walking.
 *
 * Usage:
 *   import { extractAnimations, generateAnimationsCss } from './animation-extractor.js';
 *   const animations = await extractAnimations(cssString);
 *   const animCss = generateAnimationsCss(animations);
 *
 * @module animation-extractor
 */

// ============================================================================
// Constants
// ============================================================================

/** CSS transition property names (standard + vendor prefixed) */
const TRANSITION_PROPERTIES = new Set([
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  '-webkit-transition'
]);

/** CSS animation property names (standard + vendor prefixed) */
const ANIMATION_PROPERTIES = new Set([
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

/** Pattern to extract duration values (e.g., "200ms", "1.5s") */
const DURATION_PATTERN = /(\d+(?:\.\d+)?(?:ms|s))/g;

/** Pattern to extract cubic-bezier timing functions */
const CUBIC_BEZIER_PATTERN = /cubic-bezier\([^)]+\)/g;

/** Common timing function keywords to detect in shorthand values */
const TIMING_KEYWORDS = ['ease', 'linear', 'ease-in-out', 'ease-in', 'ease-out'];

// ============================================================================
// Dependency Management
// ============================================================================

/**
 * css-tree module reference
 * Loaded dynamically to handle missing dependency gracefully
 * @type {Object|null}
 */
let csstree = null;

try {
  csstree = await import('css-tree');
} catch (importError) {
  // Log detailed error for debugging while keeping user message simple
  const errorDetails = importError.code === 'ERR_MODULE_NOT_FOUND'
    ? 'Module not found in node_modules'
    : importError.message;

  console.error(
    '[animation-extractor] Failed to load css-tree dependency.\n' +
    `  Error: ${errorDetails}\n` +
    '  Fix: Run "npm install css-tree" to install the required dependency.\n' +
    '  Note: Animation extraction will be disabled until css-tree is available.'
  );
}

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * @typedef {Object} KeyframeFrame
 * @property {string} offset - Keyframe selector (e.g., "0%", "50%", "100%", "from", "to")
 * @property {Object<string, string>} properties - CSS properties and their values
 */

/**
 * @typedef {Object} KeyframeData
 * @property {KeyframeFrame[]} frames - Array of keyframe frames
 * @property {string} raw - Original CSS text for regeneration
 * @property {boolean} vendorPrefixed - True if @-webkit-keyframes
 */

/**
 * @typedef {Object} TransitionData
 * @property {string} selector - CSS selector for the rule
 * @property {string} [transition] - Shorthand transition value
 * @property {string} [transition-property] - Transition property
 * @property {string} [transition-duration] - Transition duration
 * @property {string} [transition-timing-function] - Timing function
 * @property {string} [transition-delay] - Transition delay
 */

/**
 * @typedef {Object} AnimatedElementData
 * @property {string} selector - CSS selector for the rule
 * @property {string} [animation] - Shorthand animation value
 * @property {string} [animation-name] - Animation name
 * @property {string} [animation-duration] - Animation duration
 * @property {string} [animation-timing-function] - Timing function
 * @property {string} [animation-delay] - Animation delay
 * @property {string} [animation-iteration-count] - Iteration count
 * @property {string} [animation-direction] - Animation direction
 * @property {string} [animation-fill-mode] - Fill mode
 * @property {string} [animation-play-state] - Play state
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {Object<string, KeyframeData>} keyframes - Map of keyframe name to data
 * @property {TransitionData[]} transitions - Array of transition rules
 * @property {AnimatedElementData[]} animatedElements - Array of animated element rules
 * @property {string} [error] - Error message if extraction failed
 */

/**
 * @typedef {Object} AnimationTokens
 * @property {string[]} keyframes - List of keyframe names
 * @property {number} keyframeCount - Total number of keyframes
 * @property {number} transitions - Total number of transition rules
 * @property {number} animatedElements - Total number of animated elements
 * @property {string[]} durations - Unique duration values found
 * @property {string[]} timingFunctions - Unique timing functions found
 */

// ============================================================================
// Single-Pass AST Extraction (Performance Optimized)
// ============================================================================

/**
 * Extract all animation-related data in a single AST walk.
 * Optimized O(n) traversal instead of O(3n) with separate walks.
 *
 * @param {Object} cssAst - css-tree parsed AST
 * @returns {{keyframes: Object<string, KeyframeData>, transitions: TransitionData[], animatedElements: AnimatedElementData[]}}
 */
function extractAllFromAst(cssAst) {
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
        const keyframeData = processKeyframeRule(node);
        if (keyframeData) {
          keyframes[keyframeData.name] = keyframeData.data;
        }
        return; // Don't descend into keyframes block
      }

      // Handle style rules (for transitions and animations)
      if (node.type === 'Rule' && node.prelude && node.block) {
        const ruleData = processStyleRule(node);
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
 * Process a @keyframes at-rule node
 *
 * @param {Object} node - css-tree Atrule node
 * @returns {{name: string, data: KeyframeData}|null}
 */
function processKeyframeRule(node) {
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
 * Process a style rule for transition and animation properties
 *
 * @param {Object} node - css-tree Rule node
 * @returns {{transition: TransitionData|null, animation: AnimatedElementData|null}}
 */
function processStyleRule(node) {
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

// ============================================================================
// Legacy Individual Extractors (Kept for Testing/Backwards Compatibility)
// ============================================================================

/**
 * Extract @keyframes from CSS AST
 * Handles both standard and -webkit- prefixed keyframes
 *
 * @param {Object} cssAst - css-tree AST
 * @returns {Object<string, KeyframeData>} Map of keyframe name to data
 */
function extractKeyframes(cssAst) {
  if (!csstree) return {};
  const { keyframes } = extractAllFromAst(cssAst);
  return keyframes;
}

/**
 * Extract transition properties from CSS rules
 *
 * @param {Object} cssAst - css-tree AST
 * @returns {TransitionData[]} Array of transition rules
 */
function extractTransitions(cssAst) {
  if (!csstree) return [];
  const { transitions } = extractAllFromAst(cssAst);
  return transitions;
}

/**
 * Extract animation-* properties from CSS rules
 *
 * @param {Object} cssAst - css-tree AST
 * @returns {AnimatedElementData[]} Array of animated element rules
 */
function extractAnimationProps(cssAst) {
  if (!csstree) return [];
  const { animatedElements } = extractAllFromAst(cssAst);
  return animatedElements;
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Main extraction function - extract all animation-related CSS data.
 *
 * Uses single-pass AST walking for optimal performance.
 * Falls back to lenient parsing if strict parsing fails.
 *
 * @param {string} cssString - Raw CSS string to parse
 * @returns {Promise<ExtractionResult>} Extraction result with keyframes, transitions, and animated elements
 *
 * @example
 * const css = '@keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }';
 * const result = await extractAnimations(css);
 * console.log(result.keyframes.fadeIn.frames.length); // 2
 */
export async function extractAnimations(cssString) {
  // Early return for null/undefined/empty input
  if (!cssString || typeof cssString !== 'string') {
    return {
      keyframes: {},
      transitions: [],
      animatedElements: []
    };
  }

  if (!csstree) {
    return {
      keyframes: {},
      transitions: [],
      animatedElements: [],
      error: 'css-tree dependency not available. Run: npm install css-tree'
    };
  }

  let ast;
  try {
    ast = csstree.parse(cssString, {
      parseRulePrelude: true,
      parseValue: true,
      parseAtrulePrelude: true
    });
  } catch (parseError) {
    // Try lenient parse without value/prelude parsing
    try {
      ast = csstree.parse(cssString, {
        parseRulePrelude: true,
        parseValue: false,
        parseAtrulePrelude: false
      });
    } catch (lenientError) {
      return {
        keyframes: {},
        transitions: [],
        animatedElements: [],
        error: `CSS parse error: ${parseError.message}. Lenient parse also failed: ${lenientError.message}`
      };
    }
  }

  return extractAllFromAst(ast);
}

// ============================================================================
// CSS Generation
// ============================================================================

/**
 * Generate animations.css from extracted keyframes.
 *
 * @param {ExtractionResult} animationData - Result from extractAnimations()
 * @returns {string} CSS string with @keyframes definitions
 *
 * @example
 * const result = await extractAnimations(css);
 * const animCss = generateAnimationsCss(result);
 * fs.writeFileSync('animations.css', animCss);
 */
export function generateAnimationsCss(animationData) {
  const { keyframes } = animationData || {};

  if (!keyframes || Object.keys(keyframes).length === 0) {
    return '/* No @keyframes found */\n';
  }

  const lines = [
    '/**',
    ' * Extracted CSS Animations',
    ' * Generated by design-clone animation-extractor',
    ' */\n'
  ];

  for (const [name, data] of Object.entries(keyframes)) {
    const frameCount = data.frames?.length || 0;
    lines.push(`/* Keyframes: ${name} (${frameCount} frames) */`);
    lines.push(data.raw);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Extract timing values from shorthand transition/animation strings.
 *
 * Limitations:
 * - Only extracts first duration from shorthand (CSS allows multiple)
 * - Timing function detection is keyword-based, may miss complex values
 * - Does not resolve CSS variables (e.g., var(--duration))
 *
 * @param {string} shorthand - Shorthand property value
 * @param {Set<string>} durations - Set to add durations to
 * @param {Set<string>} timings - Set to add timing functions to
 */
function extractTimingFromShorthand(shorthand, durations, timings) {
  if (!shorthand) return;

  // Extract all duration values
  const durationMatches = shorthand.match(DURATION_PATTERN);
  if (durationMatches) {
    durationMatches.forEach(d => durations.add(d));
  }

  // Extract cubic-bezier functions
  const bezierMatches = shorthand.match(CUBIC_BEZIER_PATTERN);
  if (bezierMatches) {
    bezierMatches.forEach(b => timings.add(b));
  }

  // Check for timing keywords
  const lowerShorthand = shorthand.toLowerCase();
  for (const keyword of TIMING_KEYWORDS) {
    if (lowerShorthand.includes(keyword)) {
      timings.add(keyword);
    }
  }
}

/**
 * Generate animation tokens for design-tokens.json.
 *
 * @param {ExtractionResult} animationData - Result from extractAnimations()
 * @returns {AnimationTokens} Animation tokens structure
 *
 * @example
 * const result = await extractAnimations(css);
 * const tokens = generateAnimationTokens(result);
 * console.log(tokens.durations); // ['200ms', '300ms', '1s']
 */
export function generateAnimationTokens(animationData) {
  const { keyframes = {}, transitions = [], animatedElements = [] } = animationData || {};

  const durations = new Set();
  const timings = new Set();

  // Extract from transitions
  for (const t of transitions) {
    if (t['transition-duration']) {
      t['transition-duration'].split(',').forEach(d => durations.add(d.trim()));
    }
    if (t['transition-timing-function']) {
      t['transition-timing-function'].split(',').forEach(tf => timings.add(tf.trim()));
    }
    if (t.transition) {
      extractTimingFromShorthand(t.transition, durations, timings);
    }
  }

  // Extract from animated elements
  for (const a of animatedElements) {
    if (a['animation-duration']) {
      a['animation-duration'].split(',').forEach(d => durations.add(d.trim()));
    }
    if (a['animation-timing-function']) {
      a['animation-timing-function'].split(',').forEach(tf => timings.add(tf.trim()));
    }
    if (a.animation) {
      extractTimingFromShorthand(a.animation, durations, timings);
    }
  }

  return {
    keyframes: Object.keys(keyframes),
    keyframeCount: Object.keys(keyframes).length,
    transitions: transitions.length,
    animatedElements: animatedElements.length,
    durations: [...durations].sort(),
    timingFunctions: [...timings].sort()
  };
}

// ============================================================================
// Exports
// ============================================================================

// Export individual functions for testing and advanced use
export { extractKeyframes, extractTransitions, extractAnimationProps };
