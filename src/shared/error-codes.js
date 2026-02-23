/**
 * Structured error catalog for design-clone.
 * Descriptive codes for easy parsing by LLM agents.
 */

export const ERROR_CODES = {
  CSS_SIZE_EXCEEDED: { message: 'CSS file exceeds size limit', suggestion: 'Split CSS or increase SIZE_LIMITS.MAX_CSS_INPUT in config.js' },
  CSS_PARSE_FAILED: { message: 'CSS parse failed', suggestion: 'Check for syntax errors in source CSS. Try --verbose for details' },
  CSS_CORS_BLOCKED: { message: 'Stylesheet blocked by CORS', suggestion: 'Site restricts cross-origin CSS access. Inline styles still captured' },
  HTML_EXTRACTION_FAILED: { message: 'HTML extraction failed', suggestion: 'Page may use heavy JS rendering. Try increasing --scroll-delay' },
  ASSET_DOWNLOAD_FAILED: { message: 'Asset download failed', suggestion: 'Check network connectivity. CORS or auth may block downloads' },
  BROWSER_LAUNCH_FAILED: { message: 'Browser launch failed', suggestion: 'Run: npx playwright install chromium' },
  NAV_TIMEOUT: { message: 'Page navigation timeout', suggestion: 'Site may be slow. Try increasing timeout or check URL' },
  FILE_IO_FAILED: { message: 'File read/write failed', suggestion: 'Check file permissions and disk space' },
  DISCOVERY_FAILED: { message: 'Page discovery failed', suggestion: 'Site may block bots. Try with --no-spa-detect' },
  SCREENSHOT_FAILED: { message: 'Screenshot capture failed', suggestion: 'Page may have infinite scroll. Try --full-page false' },
  INVALID_ARGS: { message: 'Invalid arguments', suggestion: 'Run: design-clone help' },
};

export class DesignCloneError extends Error {
  constructor(code, context = {}) {
    const def = ERROR_CODES[code] || { message: 'Unknown error', suggestion: '' };
    super(def.message);
    this.code = code;
    this.suggestion = def.suggestion;
    this.context = context;
    this.name = 'DesignCloneError';
  }
}

export function createError(code, context) { return new DesignCloneError(code, context); }
