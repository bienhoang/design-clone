# Design Clone Skill Architecture

Technical architecture of the design-clone skill for Claude Code.

## Overview

```
design-clone/
├── SKILL.md                 # Entry point
├── bin/                     # npm CLI tool
│   ├── cli.js
│   ├── commands/
│   │   └── clone-site.js    # Multi-page clone with integrated UX audit (Phase 2)
│   └── utils/
├── src/
│   ├── core/                # Core scripts
│   ├── ai/                  # AI analysis
│   │   ├── prompts/
│   │   │   └── ux_audit.py  # UX audit prompts (Phase 2)
│   │   └── ux-audit.js      # UX audit runner with Gemini Vision (Phase 2)
│   ├── verification/        # Verification scripts
│   ├── post-process/        # Post-processing
│   └── utils/               # Shared utilities
├── docs/                    # Documentation
├── templates/               # Output templates
├── tests/
│   └── test-ux-audit.js     # UX audit module tests (Phase 2)
└── package.json             # Now includes @google/generative-ai optionalDependency
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  /design:clone   │  │  /design:clone-px │                    │
│  └────────┬─────────┘  └────────┬─────────┘                     │
└───────────┼─────────────────────┼───────────────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SKILL.md                                  │
│  - Activation triggers: clone, copy, replicate website          │
│  - Commands: design:clone, design:clone-px                      │
│  - References: progressive disclosure                            │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Core Scripts (src/)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ core/            │  │ core/            │  │ core/        │  │
│  │ screenshot.js    │  │ filter-css.js    │  │ framework-   │  │
│  │ animation-       │  │ state-capture.js │  │ detector.js  │  │
│  │ extractor.js     │  │ extract-assets   │  └──────┬───────┘  │
│  └────────┬─────────┘  │ .js              │         │          │
│           │            └────────┬─────────┘         │          │
└───────────┼─────────────────────┼─────────────────────┼─────────┘
            │                    │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   src/utils/ (Shared)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ browser.js  │  │   env.js    │  │   env.py    │             │
│  │  (facade)   │  │  (Node.js)  │  │  (Python)   │             │
│  └──────┬──────┘  └─────────────┘  └─────────────┘             │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Browser Provider Selection                  │   │
│  │  ┌─────────────────┐    ┌─────────────────────────┐    │   │
│  │  │ chrome-devtools │ OR │ playwright.js (standalone)│   │   │
│  │  │   (if exists)   │    │   (bundled fallback)     │   │   │
│  │  └─────────────────┘    └─────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome/Chromium                               │
│  Auto-detected paths:                                            │
│  - macOS: /Applications/Google Chrome.app/...                   │
│  - Linux: /usr/bin/google-chrome, /usr/bin/chromium             │
│  - Windows: C:\Program Files\Google\Chrome\...                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Browser Abstraction Layer

```
src/utils/
├── browser.js      # Facade - auto-selects provider
├── playwright.js   # Standalone Playwright wrapper
├── helpers.js      # CLI utilities (parseArgs, outputJSON)
├── env.js          # Node.js env resolution
└── env.py          # Python env resolution
```

**browser.js** - Facade pattern for browser automation:
```javascript
// Uses Playwright wrapper for browser automation
async function initProvider() {
  if (browserModule) return;

  browserModule = await import('./playwright.js');
  providerName = 'playwright';
  console.error('[browser] Using Playwright wrapper');
}
```

**playwright.js** - Standalone browser wrapper:
- Cross-platform Chrome detection (macOS, Linux, Windows)
- Supports both full `playwright` and lighter `playwright-core`
- Auto-detects Chrome executable path on all platforms

### 2. Environment Resolution

Both Node.js and Python share same resolution order:

```
1. process.env / os.environ (already set)
2. .env in current working directory
3. .env in skill directory
4. .env in ~/.claude/skills/
5. .env in ~/.claude/
```

**Cross-platform support:**
- Windows: Uses `USERPROFILE` when `HOME` unavailable
- Python 3.9+: Uses `List[Path]` from typing module

### 2.3 Semantic HTML Enhancement (Phase 3)

**Purpose**: Inject WordPress-compatible semantic IDs, classes, and ARIA roles into extracted HTML while preserving original styling.

**Location**: `src/core/semantic-enhancer.js`

**Key Functions**:

1. **detectSectionType(element)** - Detect section type via priority:
   - Priority 1: Semantic HTML tags (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`)
   - Priority 2: ARIA role attributes (`banner`, `navigation`, `main`, `complementary`, `contentinfo`)
   - Priority 3: Class pattern matching (header, nav, main, sidebar, footer, hero)

2. **applySemanticAttributes(element, sectionType, options)** - Apply enhancements:
   - Add ID only if none exists (avoid duplicates)
   - Append classes (preserve existing)
   - Set role only if not present

3. **handleMultipleNavs(navElements, usedIds)** - Label multiple navigations:
   - Primary nav in header: `aria-label="Primary Menu"`
   - Footer navs: `aria-label="Footer Menu"`
   - Other navs: `aria-label="Navigation 2"`, etc.

4. **enhanceSemanticHTML(html, domHierarchy)** - Browser-context enhancement:
   - Uses DOMParser (requires browser environment)
   - Optimized selector combining 8 queries → 1
   - Detects hero sections via class patterns

5. **enhanceSemanticHTMLInPage(page, html)** - Playwright-context enhancement:
   - Recommended for Node.js/Playwright workflows
   - Uses page.evaluate() for secure execution
   - Returns enhancement stats (sections enhanced, IDs/classes/roles added)

**Semantic Mappings**:
```javascript
{
  header: { id: 'site-header', classes: ['site-header'], role: 'banner' },
  nav: { id: 'site-navigation', classes: ['main-navigation', 'nav-menu'], role: 'navigation' },
  main: { id: 'main-content', classes: ['site-main', 'content-area'], role: 'main' },
  sidebar: { id: 'primary-sidebar', classes: ['widget-area', 'sidebar'], role: 'complementary' },
  footer: { id: 'site-footer', classes: ['site-footer'], role: 'contentinfo' },
  hero: { id: 'hero-section', classes: ['hero'], role: null }
}
```

**Integration**: Used by `extractAndEnhanceHtml()` in html-extractor.js when `enhanceSemantic=true`

### 2.5 DOM Tree Analyzer

**Purpose**: Extract DOM tree hierarchy with semantic landmarks and heading structure.

**Location**: `src/core/dom-tree-analyzer.js`

**Key Features**:
- PreOrder DOM traversal (parent before children)
- W3C landmark detection (`<header>`, `<main>`, `<footer>`, `<nav>`, `<aside>`)
- Section context mapping (hero, header, content, sidebar, footer)
- Heading tree with section context and Y-position
- Configurable max depth (default: 8 levels)
- Hidden element filtering (optional inclusion)
- Performance tracking with warnings for extraction >500ms

**API**:
```javascript
export async function extractDOMHierarchy(page, options = {})
// @param {Object} options - { maxDepth: 8, includeHidden: false }
// @returns {Promise<Object>} - { root, landmarks, headingTree, stats }
```

**Output Structure**:
- `root`: Complete DOM tree starting from `<body>`
- `landmarks`: Object with header, main, footer, nav[], aside[]
- `headingTree`: Array of headings with level, section, text, fontSize, Y-position
- `stats`: Metrics (totalNodes, maxDepth, landmarkCount, pageHeight, pageWidth, extractionTimeMs)

**Detection Priority**:
- **Role**: ARIA role attribute > semantic tag > class pattern
- **Section**: Semantic tag (header/footer/aside/nav) > Y-position > computed style
- **Landmarks**: Only top-level header/footer elements marked as "-landmark" role

### 3. Core Scripts

| Script | Location | Language | Purpose |
|--------|----------|----------|---------|
| screenshot.js | src/core/ | Node.js | Screenshot capture, HTML/CSS extraction |
| html-extractor.js | src/core/ | Node.js | Extract and clean HTML, optionally enhance with semantic structure |
| semantic-enhancer.js | src/core/ | Node.js | WordPress semantic HTML enhancement (Phase 3) |
| animation-extractor.js | src/core/ | Node.js | Extract @keyframes, transitions, animation properties |
| state-capture.js | src/core/ | Node.js | Capture hover states for interactive elements |
| framework-detector.js | src/core/ | Node.js | Detect framework (Next.js, Nuxt, Vue, React, Angular, Svelte, Astro) |
| filter-css.js | src/core/ | Node.js | Remove unused CSS selectors |
| extract-assets.js | src/core/ | Node.js | Download images, fonts, icons |
| dom-tree-analyzer.js | src/core/ | Node.js | DOM hierarchy extraction with semantic landmarks and heading tree |
| analyze-structure.py | src/ai/ | Python | Gemini AI structure analysis |
| extract-design-tokens.py | src/ai/ | Python | Color, typography, spacing extraction |
| ux-audit.js | src/ai/ | Node.js | UX quality assessment via Gemini Vision (Phase 2) |
| ux_audit.py | src/ai/prompts/ | Python | UX audit prompts for viewport-specific analysis (Phase 2) |
| verify-header.js | src/verification/ | Node.js | Verify header components (logo, nav, CTA, sticky behavior) |
| verify-footer.js | src/verification/ | Node.js | Verify footer layout, links, copyright, social icons |
| verify-slider.js | src/verification/ | Node.js | Detect slider library, test navigation and autoplay |
| verify-menu.js | src/verification/ | Node.js | Test responsive navigation functionality |
| verify-layout.js | src/verification/ | Node.js | Verify layout consistency across viewports |
| generate-audit-report.js | src/verification/ | Node.js | Aggregate verification results into markdown report |

### 4. Post-Processing

```
src/post-process/
├── fetch-images.js     # Fetch and optimize images
├── inject-icons.js     # Replace icons with Font Awesome
└── enhance-assets.js   # Enhance extracted assets
```

### 5. Progressive Disclosure

SKILL.md kept concise. Detailed docs in docs/:

```
docs/
├── basic-clone.md       # design:clone workflow
├── pixel-perfect.md     # design:clone-px workflow
├── cli-reference.md     # All script options
├── design-clone-architecture.md  # This file
└── troubleshooting.md   # Common issues
```

### 6. AI Analysis - UX Audit (Phase 2)

**Purpose**: Automated UX quality assessment across multiple viewports using Gemini Vision AI.

**Architecture**:
```
src/ai/ux-audit.js             # Main runner (Node.js)
├── parseArgs()                # CLI argument parsing
├── analyzeViewport()          # Gemini Vision analysis per viewport
├── aggregateResults()         # Weighted score aggregation
├── generateReport()           # Markdown report generation
└── runUXAudit() [export]      # Main async function

src/ai/prompts/ux_audit.py     # Prompt templates (Python)
├── UX_AUDIT_PROMPT            # Base 6-category evaluation
├── VIEWPORT_CONTEXT{}         # Mobile/tablet/desktop specific checks
├── AGGREGATION_PROMPT         # Viewport result combining
├── build_ux_audit_prompt()    # Build viewport-specific prompt
└── build_aggregation_prompt() # Build aggregation prompt

bin/commands/clone-site.js     # Integration point
├── parseArgs() --ux-audit     # New flag support
└── cloneSite()                # Step 5: Run UX audit if enabled
```

**Evaluation Model**:
- **Categories** (0-100 each): Visual Hierarchy, Navigation, Typography, Spacing, Interactive Elements, Responsive
- **Viewports**: Desktop (1920×1080), Tablet (768×1024), Mobile (375×812)
- **Weighting**: Desktop 40%, Tablet 30%, Mobile 30%
- **Severity Levels**: Critical (0-30), Major (31-60), Minor (61-80)
- **Output**: Markdown report + JSON results with aggregated scores, per-viewport breakdown, prioritized issues

**Integration with clone-site Workflow**:
```
clone-site workflow (7 steps):
  Step 1: Discover pages
  Step 2: Capture screenshots
  Step 3: Merge CSS
  Step 4: Extract tokens (--ai)
  Step 5: Run UX audit (--ux-audit) ← NEW
  Step 6: Rewrite links
  Step 7: Generate manifest
```

**Dependencies**:
- `@google/generative-ai`: Gemini API client (added to optionalDependencies)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable required

### 7. CLI Tool

```
bin/
├── cli.js               # Entry point (bin: design-clone)
├── commands/
│   ├── init.js          # Install skill to ~/.claude/skills/
│   ├── verify.js        # Check installation status
│   ├── help.js          # Usage information
│   └── clone-site.js    # Multi-page clone with UX audit (Phase 2)
└── utils/
    ├── copy.js          # Recursive file copy
    └── validate.js      # Environment checks
```

## Data Flow

### design:clone

```
URL → src/core/screenshot.js            → Screenshots (3 viewports)
                                        → source-raw.css
    → src/core/html-extractor.js        → source.html (cleaned + enhanced)
       ├─ extractCleanHtml()            → Remove scripts, framework attrs
       └─ enhanceSemanticHTMLInPage()   → Add WordPress semantic IDs/classes/roles
              (via semantic-enhancer.js)
    → src/core/filter-css.js            → source.css (filtered)
    → src/core/animation-extractor.js   → animations.css
                                        → animation-tokens.json
    → src/core/state-capture.js*        → hover-states/ (hover screenshots)
                                        → hover.css (generated :hover rules)
```

*Enabled with `--capture-hover true` flag
**Note**: Semantic enhancement enabled by default, disable with `--no-semantic` flag

### design:clone-px

```
URL → src/core/screenshot.js               → Screenshots + HTML/CSS
    → src/core/html-extractor.js           → Clean + semantic enhancement
       ├─ extractCleanHtml()               → Remove scripts, framework attrs
       └─ enhanceSemanticHTMLInPage()      → Add WordPress semantic structure
    → src/core/filter-css.js               → Filtered CSS
    → src/core/animation-extractor.js      → animations.css, animation-tokens.json
    → src/core/state-capture.js*           → hover-states/, hover.css
    → src/core/extract-assets.js           → assets/ (images, fonts, icons)
    → src/ai/analyze-structure.py          → structure.md (AI analysis)
    → src/ai/extract-design-tokens.py      → tokens.json, tokens.css
    → src/verification/verify-menu.js      → Menu validation report
```

*Hover state capture enabled by default in design:clone-px workflow
**Note**: Semantic enhancement enabled by default, disable with `--no-semantic` flag

### clone-site (with --ux-audit, Phase 2)

```
URL → discover pages
    → capture multi-page screenshots (all viewports)
    → merge CSS
    → extract design tokens (--ai)
    → src/ai/ux-audit.js                      → analysis/ux-audit.md
       (analyzes homepage screenshots)         → analysis/ux-audit.json
       ├─ desktop.png  → Gemini Vision        → Overall UX score
       ├─ tablet.png   → Gemini Vision        → Per-category scores
       └─ mobile.png   → Gemini Vision        → Viewport breakdown
                                                → Issues & recommendations
    → rewrite links
    → generate manifest
```

**Requires**: GEMINI_API_KEY environment variable, `--ux-audit` flag

## Output Structure

### Single Page Clone (design:clone, design:clone-px)

```
cloned-design/
├── desktop.png              # 1920x1080
├── tablet.png               # 768x1024
├── mobile.png               # 375x812
├── source.html              # Cleaned HTML
├── source.css               # Filtered CSS
├── source-raw.css           # Original CSS
├── animations.css           # Extracted @keyframes definitions
├── animation-tokens.json    # Animation metadata (keyframes, transitions, timings)
├── hover.css                # Generated :hover CSS rules (when --capture-hover)
├── structure.md             # AI analysis (optional)
├── tokens.json              # Design tokens
├── tokens.css               # CSS variables
├── hover-states/            # Hover state captures (when --capture-hover)
│   ├── hover-0-normal.png   # Element before hover
│   ├── hover-0-hover.png    # Element during hover
│   ├── hover-1-normal.png   # ...
│   ├── hover-1-hover.png
│   └── hover-diff.json      # Summary of detected and captured elements
└── assets/
    ├── images/
    ├── fonts/
    └── icons/
```

### Multi-Page Clone (clone-site, Phase 2)

```
cloned-site/
├── screenshots/
│   ├── index-desktop.png
│   ├── index-tablet.png
│   ├── index-mobile.png
│   ├── about-desktop.png
│   ├── about-tablet.png
│   ├── about-mobile.png
│   └── ... (more pages)
├── html/
│   ├── index.html
│   ├── about.html
│   └── ... (source HTML files)
├── pages/
│   ├── index.html            # Rewritten with proper links
│   ├── about.html
│   └── ... (final HTML with nav working)
├── styles.css                # Merged and optimized CSS
├── tokens.json               # Design tokens (with --ai)
├── tokens.css                # CSS variables (with --ai)
├── manifest.json             # Page manifest and metadata
├── analysis/                 # UX Audit output (with --ux-audit, Phase 2)
│   ├── ux-audit.md           # Markdown report with scores & recommendations
│   └── ux-audit.json         # Structured audit results
│       ├── overall_scores (6 categories)
│       ├── overall_ux_score (0-100)
│       ├── accessibility_score (0-100)
│       ├── viewport_breakdown {desktop, tablet, mobile}
│       ├── top_issues (with severity)
│       └── prioritized_recommendations
└── assets/                   # Extracted images, fonts, icons
    ├── images/
    ├── fonts/
    └── icons/
```

**Hover State Output** (when `--capture-hover true`):
- `hover-states/`: Directory containing hover state captures
  - `hover-N-normal.png`: Screenshot of element in normal state
  - `hover-N-hover.png`: Screenshot of element with hover state applied
  - `hover-diff.json`: Summary with detected count, captured count, and style differences for each element
- `hover.css`: Generated CSS rules with `:hover` selectors extracted from style diffs

## Dependencies

### Node.js (package.json)
- `css-tree`: CSS parsing and filtering
- `sharp`: Image processing and optimization
- `playwright` or `playwright-core`: Browser automation (peerDep, optional)
- `@google/generative-ai`: Gemini API client (optionalDep, required for UX audit, Phase 2)
- `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg`: Video/animation processing (optional)

### Python (requirements.txt)
- `google-genai`: Gemini AI for vision analysis
- Standard: `os`, `sys`, `json`, `subprocess`, `re`, `pathlib`

## Installation Methods

### npm (Recommended)
```bash
npm install -g design-clone
design-clone init
```

### Manual
```bash
cp -r design-clone ~/.claude/skills/design-clone
cd ~/.claude/skills/design-clone
npm install && pip install -r requirements.txt
```

## Security Considerations

1. **Path validation**: Prevents directory traversal
2. **CSS sanitization**: Removes XSS vectors (expression(), javascript:)
3. **Size limits**: 10MB max CSS input
4. **No secrets in output**: Scripts don't expose env vars
