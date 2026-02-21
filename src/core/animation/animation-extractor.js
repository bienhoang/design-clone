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

import { extractAllFromAst, processKeyframeRule, processStyleRule, TRANSITION_PROPERTIES, ANIMATION_PROPERTIES } from './animation-extractor-ast.js';
import { generateAnimationsCss, generateAnimationTokens, extractTimingFromShorthand } from './animation-extractor-output.js';

// Re-export for backward compatibility
export { generateAnimationsCss, generateAnimationTokens };

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
 * @typedef {Object} ExtractionResult
 * @property {Object<string, KeyframeData>} keyframes - Map of keyframe name to data
 * @property {Array} transitions - Array of transition rules
 * @property {Array} animatedElements - Array of animated element rules
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
// Dependency Management
// ============================================================================

/**
 * css-tree module reference - loaded dynamically to handle missing dependency
 * @type {Object|null}
 */
let csstree = null;

try {
  csstree = await import('css-tree');
} catch (importError) {
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
// Legacy Individual Extractors (Kept for Testing/Backwards Compatibility)
// ============================================================================

/**
 * Extract @keyframes from CSS AST
 * @param {Object} cssAst - css-tree AST
 * @returns {Object<string, KeyframeData>}
 */
function extractKeyframes(cssAst) {
  if (!csstree) return {};
  const { keyframes } = extractAllFromAst(csstree, cssAst);
  return keyframes;
}

/**
 * Extract transition properties from CSS rules
 * @param {Object} cssAst - css-tree AST
 * @returns {Array}
 */
function extractTransitions(cssAst) {
  if (!csstree) return [];
  const { transitions } = extractAllFromAst(csstree, cssAst);
  return transitions;
}

/**
 * Extract animation-* properties from CSS rules
 * @param {Object} cssAst - css-tree AST
 * @returns {Array}
 */
function extractAnimationProps(cssAst) {
  if (!csstree) return [];
  const { animatedElements } = extractAllFromAst(csstree, cssAst);
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
 * @returns {Promise<ExtractionResult>}
 *
 * @example
 * const css = '@keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }';
 * const result = await extractAnimations(css);
 * console.log(result.keyframes.fadeIn.frames.length); // 2
 */
export async function extractAnimations(cssString) {
  if (!cssString || typeof cssString !== 'string') {
    return { keyframes: {}, transitions: [], animatedElements: [] };
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

  return extractAllFromAst(csstree, ast);
}

// Export individual functions for testing and advanced use
export { extractKeyframes, extractTransitions, extractAnimationProps };
