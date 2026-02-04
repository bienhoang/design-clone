# Codebase Summary

## Overview

Design Clone is a comprehensive design extraction toolkit that captures website designs through multi-viewport screenshots, extracts HTML/CSS, analyzes structure with AI, and enhances semantic HTML for WordPress compatibility.

## Core Architecture

### Directory Structure

```
design-clone/
├── src/
│   ├── core/                          # Core extraction & processing modules
│   │   ├── screenshot.js              # Multi-viewport screenshot capture
│   │   ├── html-extractor.js          # HTML extraction + semantic enhancement
│   │   ├── semantic-enhancer.js       # WordPress semantic HTML injection (Phase 3)
│   │   ├── css-extractor.js           # CSS extraction & property tracking
│   │   ├── filter-css.js              # Unused CSS selector removal
│   │   ├── animation-extractor.js     # @keyframes & transition extraction
│   │   ├── state-capture.js           # Hover state capture
│   │   ├── extract-assets.js          # Image/font/icon downloading
│   │   ├── design-tokens.js           # Design token extraction
│   │   ├── dom-tree-analyzer.js       # DOM hierarchy for structure analysis
│   │   ├── dimension-extractor.js     # Component dimension measurement
│   │   ├── section-cropper.js         # Section extraction for AI analysis
│   │   ├── page-readiness.js          # Page stability detection
│   │   ├── lazy-loader.js             # Lazy loading trigger & wait
│   │   ├── cookie-handler.js          # Cookie banner dismissal
│   │   ├── content-counter.js         # Content statistics
│   │   ├── video-capture.js           # Scroll animation recording
│   │   └── app-state-snapshot.js      # App state persistence
│   ├── ai/                            # AI analysis modules
│   │   ├── ux-audit.js                # UX audit runner
│   │   └── prompts/                   # AI prompts
│   ├── verification/                  # Verification scripts
│   └── utils/                         # Shared utilities
│       ├── browser.js                 # Browser abstraction facade
│       ├── env.js                     # Environment resolution
│       └── helpers.js                 # CLI utilities
├── tests/                             # Unit tests
│   ├── test-semantic-enhancer.js      # Semantic enhancer tests (59 tests)
│   └── [other test files]
└── package.json
```

## Key Modules

### 1. semantic-enhancer.js (Phase 3)

**Purpose**: Inject WordPress-compatible semantic IDs, classes, and ARIA roles into extracted HTML while preserving original styling.

**Key Exports**:
- `SEMANTIC_MAPPINGS` - Mapping definitions for header, nav, main, sidebar, footer, hero
- `detectSectionType(element)` - Detect section type via semantic tags (priority 1), ARIA roles (priority 2), class patterns (priority 3)
- `applySemanticAttributes(element, sectionType, options)` - Add ID/classes/roles to element
- `handleMultipleNavs(navElements, usedIds)` - Handle multiple nav elements with aria-label
- `enhanceSemanticHTML(html, domHierarchy)` - Browser-context enhancement (uses DOMParser)
- `enhanceSemanticHTMLInPage(page, html)` - Playwright-context enhancement (recommended for Node.js)

**Semantic Mappings**:
```javascript
header: { id: 'site-header', classes: ['site-header'], role: 'banner' }
nav: { id: 'site-navigation', classes: ['main-navigation', 'nav-menu'], role: 'navigation' }
main: { id: 'main-content', classes: ['site-main', 'content-area'], role: 'main' }
sidebar: { id: 'primary-sidebar', classes: ['widget-area', 'sidebar'], role: 'complementary' }
footer: { id: 'site-footer', classes: ['site-footer'], role: 'contentinfo' }
hero: { id: 'hero-section', classes: ['hero'], role: null }
```

**Detection Priority**:
1. Semantic HTML tags (header, nav, main, aside, footer)
2. ARIA role attributes (banner, navigation, main, complementary, contentinfo)
3. Class pattern matching (header, nav, main, sidebar, footer, hero)

**Rules**:
- Add ID only if none exists (avoid duplicates)
- Append classes (never replace existing)
- Set role only if not present
- Handle multiple navs with proper aria-label (Primary Menu, Footer Menu, etc.)

### 2. html-extractor.js (Modified)

**New Function**: `extractAndEnhanceHtml(page, options)`

Extracts clean HTML and optionally applies semantic enhancement via semantic-enhancer.js.

**Options**:
```javascript
{
  enhanceSemantic: true,           // Enable semantic enhancement (default: true)
  frameworkPatterns: [...]         // Custom framework patterns to remove
}
```

**Returns**:
```javascript
{
  html: string,                    // Enhanced HTML
  warnings: string[],              // Processing warnings
  elementCount: number,            // DOM element count
  semanticStats: {                 // Only if enhanceSemantic=true
    sectionsEnhanced: number,
    idsAdded: number,
    classesAdded: number,
    rolesAdded: number,
    warnings: string[]
  }
}
```

**Existing Functions**:
- `extractCleanHtml(page, frameworkPatterns)` - Remove scripts, event handlers, framework attributes

### 3. screenshot.js (Modified)

**New Flag**: `--no-semantic`

Disable WordPress semantic HTML enhancement in extracted HTML. By default, semantic enhancement is enabled.

**Usage**:
```bash
node src/core/screenshot.js --url https://example.com --output ./out --extract-html --no-semantic
```

### 4. multi-page-screenshot.js (Modified)

Uses `extractAndEnhanceHtml()` instead of separate extraction steps.

## Processing Pipeline

### Multi-Viewport Screenshot Flow

```
Input URL
├─ Desktop (1440x900)
├─ Tablet (768x1024)
└─ Mobile (375x812)
      │
      ├── Wait for page readiness (DOM stable, fonts loaded, styles stable)
      ├── Dismiss cookie banners
      ├── Trigger lazy loading
      ├── Force lazy images visible
      ├── Capture screenshots
      │
      ├── Optional: Extract HTML
      │   ├─ Clean HTML (remove scripts, framework attrs)
      │   └─ Semantic enhance (add WordPress IDs/classes/roles)
      │
      ├── Optional: Extract CSS
      │   ├─ Collect all stylesheet rules
      │   ├─ Extract @keyframes & transitions
      │   └─ Filter unused selectors
      │
      ├── Optional: Capture hover states
      │   ├─ Identify interactive elements
      │   ├─ Screenshot before/during hover
      │   └─ Generate :hover CSS rules
      │
      └── Output: Screenshots + metadata

Output Files
├── desktop.png, tablet.png, mobile.png
├── source.html (cleaned + optionally semantically enhanced)
├── source.css, source-raw.css
├── animations.css, animation-tokens.json
├── hover.css (if --capture-hover)
├── structure.md (if GEMINI_API_KEY set)
└── tokens.json
```

## Testing

### Test Files

- `tests/test-semantic-enhancer.js` - 59 unit tests covering:
  - SEMANTIC_MAPPINGS exports
  - Section type detection (header, nav, main, sidebar, footer, hero)
  - Semantic attribute application
  - Multiple nav handling with aria-labels
  - HTML enhancement stats
  - Page.evaluate integration

**Run Tests**:
```bash
node tests/test-semantic-enhancer.js
```

## Data Flow

### Semantic Enhancement Data Flow

```
extractAndEnhanceHtml()
├─ extractCleanHtml(page)
│  └─ page.evaluate()
│     ├─ Clone document
│     ├─ Remove scripts/noscript
│     ├─ Remove malicious CSS links
│     ├─ Remove event handlers
│     ├─ Remove framework attributes
│     ├─ Inline critical layout styles
│     └─ Return cleaned HTML + warnings
│
└─ enhanceSemanticHTMLInPage(page, html)
   └─ page.evaluate(enhancementLogic)
      ├─ Parse HTML with DOMParser
      ├─ Detect sections (semantic tags → ARIA roles → class patterns)
      ├─ Apply IDs/classes/roles
      ├─ Handle multiple navs with aria-labels
      ├─ Detect hero sections
      └─ Return enhanced HTML + stats
```

## Configuration & Environment

### CLI Options (screenshot.js)

| Option | Default | Phase | Description |
|--------|---------|-------|-------------|
| --url | required | - | Target URL |
| --output | required | - | Output directory |
| --viewports | all | - | Comma-separated viewport names |
| --full-page | true | - | Capture full page height |
| --max-size | 5 | - | Max file size (MB) before compression |
| --headless | false | - | Run in headless mode |
| --scroll-delay | 1500 | - | Pause time (ms) between scroll steps |
| --extract-html | false | - | Extract cleaned HTML |
| --extract-css | false | - | Extract CSS |
| --filter-unused | true | - | Filter unused CSS selectors |
| --capture-hover | false | 2 | Capture hover states |
| --section-mode | false | - | Enable section-based capture |
| --no-semantic | false | 3 | Disable semantic HTML enhancement |
| --video | false | - | Record scroll animation |

### Environment Variables

```bash
GEMINI_API_KEY=...      # For AI structure analysis
```

## Design Patterns

### Error Handling

All modules use try-catch with warning accumulation. Failed processing steps return partial results rather than throwing.

### Idempotency

Semantic enhancement is idempotent—running on already-enhanced HTML produces same result (IDs/classes/roles already present are skipped).

### Performance

- Combined landmark selector reduces querySelectorAll calls (8 → 1)
- Processed element tracking prevents double-counting from overlapping selectors
- Index-based element matching for reliability during DOM cloning

### Validation

- Input validation on HTML strings (non-empty, valid string type)
- Browser context validation (DOMParser vs page.evaluate)
- ID uniqueness tracking with usedIds Set
- DOM size warnings (>50k elements)

## Version History

### Phase 1
- Multi-viewport screenshots
- HTML/CSS extraction
- Asset extraction

### Phase 2
- Hover state capture
- UX audit with Gemini
- Design token extraction
- DOM tree analysis

### Phase 3
- WordPress semantic HTML enhancement (CURRENT)
- Semantic ID/class/role injection
- ARIA landmark support
- Multiple nav handling

## Integration Points

### With screenshot.js
- New `--no-semantic` flag to disable enhancement
- Automatic semantic enhancement when extracting HTML (unless disabled)

### With html-extractor.js
- New `extractAndEnhanceHtml()` function wraps extraction + enhancement
- `enhanceSemantic` option controls semantic injection

### With multi-page-screenshot.js
- Uses `extractAndEnhanceHtml()` for HTML extraction

## Dependencies

- **playwright** - Browser automation
- **sharp** - Image compression (optional)
- **google-genai** - AI analysis (optional, for Phase 2 features)

## Limitations & Considerations

1. **Browser Context Required**: `enhanceSemanticHTML()` requires DOMParser (browser). Use `enhanceSemanticHTMLInPage()` for Playwright.
2. **Non-Invasive**: Semantic enhancement never removes existing attributes, only adds/appends.
3. **False Positive Prevention**: Class pattern detection limited to container elements (div, section, article) to avoid false positives.
4. **Multiple Landing Pages**: Each nav gets unique aria-label (Primary Menu, Footer Menu, Navigation 2, etc.)
5. **Hero Section Detection**: Only top-level hero elements (not within header/footer) are detected.
