// Barrel exports for html
export {
  MAX_HTML_SIZE,
  MAX_DOM_ELEMENTS,
  JS_FRAMEWORK_PATTERNS,
  INLINE_LAYOUT_PROPS,
  CRITICAL_DISPLAY,
  CRITICAL_POSITION,
  extractCleanHtml,
  extractAndEnhanceHtml,
} from './html-extractor.js';
export { computeAndApplyInlineStyles } from './html-extractor-inline-styler.js';
export {
  enhanceSemanticHTML,
  enhanceSemanticHTMLInPage,
  detectSectionType,
  applySemanticAttributes,
  handleMultipleNavs,
  SEMANTIC_MAPPINGS,
  CLASS_PATTERNS,
} from './semantic-enhancer.js';
