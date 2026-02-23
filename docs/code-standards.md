# Design Clone Code Standards & Guidelines

**Version:** 2.1.0
**Last Updated:** February 23, 2026

## Overview

This document establishes code quality standards, architectural patterns, and development guidelines for the Design Clone project. All contributions must follow these standards to maintain consistency, readability, and long-term maintainability.

---

## Table of Contents

1. [JavaScript/Node.js Standards](#javascriptnodejs-standards)
2. [Python Standards](#python-standards)
3. [Project Structure](#project-structure)
4. [Error Handling](#error-handling)
5. [Testing Standards](#testing-standards)
6. [Documentation Standards](#documentation-standards)
7. [Performance Guidelines](#performance-guidelines)
8. [Security Standards](#security-standards)

---

## JavaScript/Node.js Standards

### Code Style

**File Format:**
```javascript
/**
 * Brief description of what this file does.
 * @module moduleName
 */

'use strict';

// Imports (group: external, relative)
const path = require('path');
const fs = require('fs').promises;
const { parseUrl } = require('../utils/url-parser');

// Constants
const DEFAULT_TIMEOUT = 5000;
const SCREENSHOT_WIDTH = 1920;

// Types/Interfaces (JSDoc style)
/**
 * @typedef {Object} ScreenshotOptions
 * @property {string} url - Target URL
 * @property {string} output - Output directory
 * @property {number} timeout - Operation timeout in ms
 */

// Main exports
module.exports = {
  captureScreenshots,
  filterCSS,
  validateOutput,
};

// Implementation
async function captureScreenshots(url, options) {
  // ...
}
```

**Naming Conventions:**
```javascript
// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_VIEWPORT_WIDTH = 1920;

// Functions: camelCase
function extractDesignTokens() {}
const validateUrl = () => {};

// Classes: PascalCase
class PlaywrightBrowser {
  constructor() {}
}

// Private methods: _leadingUnderscore or #privateField
class BrowserPool {
  #browsers = [];
  _initializeBrowser() {}
}

// Variables: camelCase
let currentState = null;
const outputDirectory = './output';
```

**Formatting Rules:**
- Line length: 100 characters maximum
- Indentation: 2 spaces
- Semicolons: Required
- Quotes: Single quotes for strings
- Arrow functions: Use for callbacks
- Async/await: Prefer over .then() chains

```javascript
// Good
const results = await Promise.all(
  screenshots.map(async (shot) => {
    return await processScreenshot(shot);
  })
);

// Bad
const results = await Promise.all(screenshots.map(ss => {
  return processScreenshot(ss);
}));
```

### Function Structure

**Pattern:**
```javascript
/**
 * Brief one-line description.
 *
 * Detailed explanation if needed. Describe the algorithm or key behavior.
 *
 * @param {string} inputPath - Description of param
 * @param {Object} options - Configuration object
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {number} options.timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Returns processed data
 * @throws {Error} When input is invalid
 *
 * @example
 * const result = await processFile('path/to/file.html', { verbose: true });
 */
async function processFile(inputPath, options = {}) {
  // 1. Input validation
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('inputPath must be non-empty string');
  }

  // 2. Setup/initialization
  const config = {
    timeout: 5000,
    ...options,
  };

  // 3. Main logic
  try {
    const data = await readFile(inputPath);
    const processed = transform(data);
    return processed;
  } catch (error) {
    // 4. Error handling
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${inputPath}`);
    }
    throw error;
  }
}
```

### Control Flow

**Conditionals:**
```javascript
// Good: Early return
if (!value) return null;
if (typeof x !== 'string') throw new Error('Must be string');

// Guard clauses
function validate(input) {
  if (!input) return false;
  if (!input.trim()) return false;
  if (input.length > 1000) return false;
  return true;
}

// Ternary for simple logic
const status = isActive ? 'running' : 'stopped';

// Avoid nested ternary
// Bad: status === 'pending' ? 'waiting' : status === 'done' ? 'complete' : 'error'
// Good: Use switch or if-else
```

**Loops & Iteration:**
```javascript
// Prefer forEach for side effects
items.forEach((item) => {
  console.log(item);
});

// Prefer map for transformations
const doubled = numbers.map((n) => n * 2);

// Prefer filter for selection
const active = users.filter((u) => u.isActive);

// Use for-of for breaking early
for (const item of items) {
  if (shouldStop(item)) break;
  processItem(item);
}

// Avoid traditional for loops unless necessary
// Bad: for (let i = 0; i < items.length; i++)
// Good: for (const item of items)
```

### Error Handling

**Pattern:**
```javascript
/**
 * Executes operation with retry logic.
 *
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<*>} Result of successful operation
 */
async function executeWithRetry(operation, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.warn(
          `Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Operation failed after ${maxRetries} attempts: ${lastError.message}`
  );
}
```

**Custom Errors:**
```javascript
class ValidationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}

class TimeoutError extends Error {
  constructor(operation, timeout) {
    super(`${operation} exceeded timeout of ${timeout}ms`);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

// Usage
if (!isValid(input)) {
  throw new ValidationError('Invalid input format', { input, expected });
}
```

### Async/Promises

**Always use async/await:**
```javascript
// Good
async function fetchData() {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Avoid bare promises
// Bad: function fetchData() { return fetch(url).then(...) }
```

**Parallel operations:**
```javascript
// Good: Parallel with Promise.all
const [screenshots, css, html] = await Promise.all([
  captureScreenshots(url),
  extractCSS(url),
  extractHTML(url),
]);

// Sequential when dependent
const tokens = await extractDesignTokens(url);
const css = await generateCSS(tokens);
```

**Timeout handling:**
```javascript
async function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutError('Operation', timeoutMs)), timeoutMs)
    ),
  ]);
}
```

---

## Python Standards

### Code Style

**File Format:**
```python
#!/usr/bin/env python3
"""
Module docstring: Brief description of module purpose.

This module handles [description of main responsibility].
"""

import sys
import json
from pathlib import Path
from typing import Dict, List, Optional

# Constants
DEFAULT_TIMEOUT = 5000
FIGMA_API_BASE = 'https://api.figma.com/v1'

# Helper functions
def validate_token(token: str) -> bool:
    """Check if token format is valid."""
    return bool(token and len(token) > 10)

# Main classes
class FigmaClient:
    """Figma REST API client."""

    def __init__(self, access_token: str):
        """Initialize with access token."""
        if not validate_token(access_token):
            raise ValueError('Invalid access token format')
        self.token = access_token
```

**Naming Conventions:**
```python
# Constants: UPPER_SNAKE_CASE
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 5000

# Functions & methods: snake_case
def extract_design_tokens(file_path):
    pass

def validate_figma_url(url):
    pass

# Classes: PascalCase
class FigmaClient:
    pass

class DesignTokenExtractor:
    pass

# Private: Leading underscore
def _internal_helper():
    pass

class MyClass:
    def _private_method(self):
        pass
```

**Type Hints (Required):**
```python
from typing import Dict, List, Optional, Tuple

def process_tokens(
    data: Dict[str, any],
    output_path: str,
    verbose: bool = False
) -> Dict[str, List[str]]:
    """Process design tokens."""
    return {'colors': [], 'fonts': []}

def extract_color(rgba: Dict[str, float]) -> str:
    """Convert RGBA dict to hex color."""
    pass
```

**Formatting Rules:**
- Line length: 100 characters
- Indentation: 4 spaces
- Docstrings: Google style
- Type hints: All function signatures
- Blank lines: 2 between top-level definitions, 1 within class

### Function Structure

**Pattern (condensed):**
```python
def extract_design_tokens(figma_data: Dict, output_dir: str) -> Dict:
    """Extract colors, typography, spacing from Figma file."""
    if not isinstance(figma_data, dict):
        raise ValueError('figma_data must be dictionary')

    tokens = {'colors': {}, 'typography': {}, 'spacing': {}}
    tokens['colors'] = _extract_colors(figma_data)
    return tokens

def _extract_colors(data: Dict) -> Dict[str, str]:
    """Extract color palette from design."""
    colors = {}
    # Implementation
    return colors
```

### Error Handling

**Pattern:**
```python
class FigmaError(Exception):
    """Base exception for Figma operations."""
    pass

class FigmaAuthError(FigmaError):
    """Raised when authentication fails."""
    pass

class FigmaAPIError(FigmaError):
    """Raised when API request fails."""
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code

def authenticate(token: str) -> bool:
    """Authenticate with Figma API."""
    try:
        response = requests.get(
            'https://api.figma.com/v1/me',
            headers={'X-Figma-Token': token}
        )
        response.raise_for_status()
        return True
    except requests.exceptions.ConnectionError as e:
        raise FigmaError(f'Network error: {e}')
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            raise FigmaAuthError('Invalid token')
        raise FigmaAPIError(str(e), e.response.status_code)
```

---

## Project Structure

### Directory Organization

```
design-clone/
├── bin/
│   ├── cli.js                  # Main CLI entry
│   ├── commands/
│   │   ├── clone-site.js       # Multi-page command
│   │   ├── init.js             # Setup command
│   │   └── verify.js           # Verification command
│   └── utils/
│       ├── copy.js             # Utility functions
│       └── validate.js
│
├── src/
│   ├── core/                   # Core extraction engines (12 semantic subdirectories)
│   │   ├── capture/            # Screenshot pipeline (7 modules)
│   │   ├── css/                # CSS processing (7 modules)
│   │   ├── html/               # HTML extraction (5 modules)
│   │   ├── animation/          # Animation & hover states (5 modules)
│   │   ├── discovery/          # Page discovery (6 modules)
│   │   ├── detection/          # Framework detection (3 modules)
│   │   ├── dimension/          # DOM analysis (6 modules)
│   │   ├── section/            # Section detection (5 modules)
│   │   ├── media/              # Asset extraction (5 modules)
│   │   ├── page-prep/          # Page readiness (3 modules)
│   │   ├── content/            # Content analysis (2 modules)
│   │   ├── links/              # URL rewriting (2 modules)
│   │   └── tests/              # Core tests (2 modules)
│   │
│   ├── figma/                  # Figma-to-code pipeline
│   │   ├── parse-url.js        # URL parsing
│   │   ├── figma-client.py     # API client
│   │   ├── extract-figma.py    # Token extraction
│   │   ├── generate-css.py     # BEM generation
│   │   └── generate-tailwind.py # Tailwind generation
│   │
│   ├── ai/                     # AI analysis
│   │   ├── analyze-structure.py
│   │   ├── extract-design-tokens.py
│   │   └── prompts/
│   │       ├── structure_analysis.py
│   │       ├── design_tokens.py
│   │       └── ux_audit.py
│   │
│   ├── verification/           # Quality checks
│   │   ├── verify-menu.js
│   │   ├── verify-layout.js
│   │   └── [other verifications]
│   │
│   ├── post-process/           # Asset processing
│   │   ├── fetch-images.js
│   │   ├── inject-icons.js
│   │   └── enhance-assets.js
│   │
│   ├── utils/                  # Shared utilities
│   │   ├── browser.js
│   │   ├── env.js / env.py
│   │   ├── helpers.js
│   │   ├── playwright.js
│   │   └── log.js              # Centralized logging (Feb 23)
│   │
│   └── route-discoverers/      # Framework detection
│       ├── base-discoverer.js
│       ├── react-discoverer.js
│       └── [other frameworks]
│
├── tests/                      # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── templates/                  # HTML/CSS templates
│   ├── base.html
│   └── base.css
│
├── docs/                       # Documentation
└── prd/                        # Product requirements
```

### Module Dependencies

**Guidelines:**
- Minimize circular dependencies
- Organize imports: external → local
- Separate concerns across modules
- Use dependency injection for testability
- Import directly from module files using relative paths
- Use centralized logging (src/utils/log.js) instead of console.log

**Companion Module Pattern (Feb 23):**

When a module grows beyond 150-200 LOC with repetitive logic, decompose using companion modules:
- `module.js` - Main orchestrator (stable API)
- `module-feature.js` - Specific feature extraction
- `module-output.js` - Output formatting
- `module-mappings.js` - Mapping tables/rules

**Examples:**
- `semantic-enhancer.js` → `semantic-enhancer-page.js`, `semantic-enhancer-mappings.js`
- `dimension-extractor.js` → `dimension-extractor-card-detector.js`, `dimension-output.js`, `dimension-output-ai-summary.js`

**Example Dependency Structure:**
```
CLI Layer
  ↓
Workflow Layer (clone, clone-px, clone-site, figma-to-code)
  ↓
Core Engines (capture/, css/, discovery/, detection/, etc. via direct imports)
  ↓
Utilities (browser, env, helpers, log, playwright)
```

---

## Error Handling

### Error Classification

**User Errors (exit code 1):**
```javascript
// Invalid input
if (!isValidUrl(url)) {
  console.error(`Error: Invalid URL format: ${url}`);
  process.exit(1);
}

// Missing configuration
if (!process.env.FIGMA_ACCESS_TOKEN) {
  console.error('Error: FIGMA_ACCESS_TOKEN environment variable not set');
  process.exit(1);
}
```

**System Errors (exit code 2):**
```javascript
// Browser crash
if (!browser || !browser.isConnected()) {
  console.error('Error: Browser disconnected unexpectedly');
  process.exit(2);
}

// Disk I/O failure
catch (error) {
  if (error.code === 'ENOSPC') {
    console.error('Error: Disk space exhausted');
    process.exit(2);
  }
}
```

**Unknown Errors (exit code 3):**
```javascript
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(3);
});
```

### Error Messages

**Format:**
```
Error: [Brief description]
  Context: [Relevant details]
  Suggestion: [How to fix]

Example:
Error: Invalid Figma URL format
  Context: URL must contain /design/ or /file/ path
  Suggestion: Use: figma.com/design/{file_key}/...
```

---

## Testing Standards

### Test Structure

**File naming:** `src/core/capture/screenshot.js` → `tests/unit/screenshot.test.js`

**Template (JavaScript):**
```javascript
describe('ScreenshotCapture', () => {
  it('should capture all three viewports', async () => {
    const screenshots = await captureViewports('https://example.com');
    expect(screenshots).toHaveLength(3);
  });
});
```

**Template (Python):**
```python
def test_extract_colors(self):
    tokens = extract_design_tokens(sample_data)
    assert 'colors' in tokens
```

**Coverage:** Minimum 85% statement coverage, 100% for critical paths, integration tests for workflows

---

## Documentation Standards

### Code Comments

**Use comments for WHY, not WHAT:**
```javascript
// Bad
// Increment counter
counter++;

// Good
// Reset counter for next batch processing cycle
counter++;

// Good: Explaining non-obvious logic
// Playwright requires minimum 100ms delay between viewport changes
// to avoid race conditions in CSS media query evaluation
await page.waitForTimeout(100);
```

**Block comments for complex algorithms:**
```python
def extract_colors(nodes):
    """
    Extract unique colors from Figma nodes.

    Algorithm:
    1. Traverse all nodes recursively
    2. For each node, check fills and strokes
    3. Convert RGBA to hex, normalize to #RRGGBB
    4. Deduplicate using case-insensitive matching
    5. Categorize by brightness (light/dark)
    6. Assign semantic names (primary, secondary, etc.)
    """
    colors = {}
    # Implementation...
    return colors
```

### JSDoc/Docstrings

**Required for all public APIs:**
```javascript
/**
 * Extract CSS rules used in HTML.
 *
 * Analyzes HTML for all used selectors and matches them against
 * CSS rules. Removes declarations that don't match any selector
 * while preserving media queries and keyframes.
 *
 * @param {string} html - HTML content
 * @param {string} css - CSS stylesheet
 * @param {Object} options - Configuration
 * @param {boolean} options.preserveAnimations - Keep @keyframes (default: true)
 * @param {boolean} options.verbose - Log removals (default: false)
 * @returns {string} Filtered CSS
 * @throws {Error} If HTML or CSS is invalid
 */
function filterUnusedCSS(html, css, options = {}) {}
```

### README Structure

Each module with public APIs should have:
- One-line description
- Key functions/classes
- Usage examples
- Error handling
- Configuration options

---

## Performance Guidelines

**Rules:**
- Profile before optimizing (use `console.time()`)
- Use `Promise.all()` for parallel work, sequence only when dependent
- Stream large files, batch writes with `fs.promises`
- Release large objects: `obj = null`

**Target Performance:**
- Screenshot: 3-5s per viewport
- CSS filtering: 1-2s
- Asset extraction: 5-10s per 10 images
- Full workflow: <120s

---

## Security Standards

**Input Validation:** Always validate external input (URLs, tokens, files)

```javascript
function validateUrl(url) {
  if (typeof url !== 'string' || !url.trim()) throw new Error('Invalid URL');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('HTTP only');
  return url;
}
```

**Credentials:** Use environment variables only, never log tokens

```javascript
const token = process.env.FIGMA_ACCESS_TOKEN;
if (!token) throw new Error('FIGMA_ACCESS_TOKEN required');
console.log('Using token:', 'REDACTED'); // Good
```

**HTML Sanitization:** Remove `<script>`, event handlers, `javascript:` URLs

---

## Code Review Standards

Before submitting code:
- Code follows naming conventions & project structure
- Functions have JSDoc/docstring comments
- Error handling is comprehensive
- No credentials or secrets
- Tests added/updated (maintain 85%+ coverage)
- No console.log in production
- Documentation updated

**References:** [Google JS Style Guide](https://google.github.io/styleguide/tsguide.html), [PEP 8](https://pep8.org), OWASP Top 10
