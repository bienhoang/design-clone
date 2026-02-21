// Barrel exports for dimension
export { extractComponentDimensions } from './dimension-extractor.js';
export {
  buildDimensionsOutput,
  sanitizeViewportData,
  buildCrossViewportSummary,
  generateAISummary,
} from './dimension-output.js';
export {
  extractDOMHierarchy,
  MAX_DEPTH,
  LANDMARK_TAGS,
  HEADING_TAGS,
} from './dom-tree-analyzer.js';
