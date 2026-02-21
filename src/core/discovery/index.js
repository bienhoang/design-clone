// Barrel exports for discovery
export {
  discoverPages,
  normalizeUrl,
  isSameDomain,
  extractPageName,
} from './discover-pages.js';
export { detectFramework, formatDetectionResult } from './framework-detector.js';
export {
  captureAppState,
  formatStateSnapshot,
} from './app-state-snapshot.js';
