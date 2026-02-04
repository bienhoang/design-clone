# Design Clone Skill Architecture

Technical architecture of the design-clone skill for Claude Code.

## Overview

```
design-clone/
├── SKILL.md                 # Entry point
├── bin/                     # npm CLI tool
│   ├── cli.js
│   ├── commands/
│   └── utils/
├── src/
│   ├── core/                # Core scripts
│   ├── ai/                  # AI analysis
│   ├── verification/        # Verification scripts
│   ├── post-process/        # Post-processing
│   └── utils/               # Shared utilities
├── docs/                    # Documentation
├── templates/               # Output templates
└── tests/                   # Test files
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
| animation-extractor.js | src/core/ | Node.js | Extract @keyframes, transitions, animation properties |
| state-capture.js | src/core/ | Node.js | Capture hover states for interactive elements |
| framework-detector.js | src/core/ | Node.js | Detect framework (Next.js, Nuxt, Vue, React, Angular, Svelte, Astro) |
| filter-css.js | src/core/ | Node.js | Remove unused CSS selectors |
| extract-assets.js | src/core/ | Node.js | Download images, fonts, icons |
| dom-tree-analyzer.js | src/core/ | Node.js | DOM hierarchy extraction with semantic landmarks and heading tree |
| analyze-structure.py | src/ai/ | Python | Gemini AI structure analysis |
| extract-design-tokens.py | src/ai/ | Python | Color, typography, spacing extraction |
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

### 6. CLI Tool

```
bin/
├── cli.js               # Entry point (bin: design-clone)
├── commands/
│   ├── init.js          # Install skill to ~/.claude/skills/
│   ├── verify.js        # Check installation status
│   └── help.js          # Usage information
└── utils/
    ├── copy.js          # Recursive file copy
    └── validate.js      # Environment checks
```

## Data Flow

### design:clone

```
URL → src/core/screenshot.js       → Screenshots (3 viewports)
                                   → source.html (cleaned)
                                   → source-raw.css
    → src/core/filter-css.js       → source.css (filtered)
    → src/core/animation-extractor → animations.css
                                   → animation-tokens.json
    → src/core/state-capture.js*   → hover-states/ (hover screenshots)
                                   → hover.css (generated :hover rules)
```

*Enabled with `--capture-hover true` flag

### design:clone-px

```
URL → src/core/screenshot.js           → Screenshots + HTML/CSS
    → src/core/filter-css.js           → Filtered CSS
    → src/core/animation-extractor     → animations.css, animation-tokens.json
    → src/core/state-capture.js*       → hover-states/, hover.css
    → src/core/extract-assets.js       → assets/ (images, fonts, icons)
    → src/ai/analyze-structure.py      → structure.md (AI analysis)
    → src/ai/extract-design-tokens.py  → tokens.json, tokens.css
    → src/verification/verify-menu.js  → Menu validation report
```

*Hover state capture enabled by default in design:clone-px workflow

## Output Structure

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

**Hover State Output** (when `--capture-hover true`):
- `hover-states/`: Directory containing hover state captures
  - `hover-N-normal.png`: Screenshot of element in normal state
  - `hover-N-hover.png`: Screenshot of element with hover state applied
  - `hover-diff.json`: Summary with detected count, captured count, and style differences for each element
- `hover.css`: Generated CSS rules with `:hover` selectors extracted from style diffs

## Dependencies

### Node.js (package.json)
- `css-tree`: CSS parsing and filtering
- `playwright` or `playwright-core`: Browser automation (peerDep, optional)

### Python (requirements.txt)
- `google-genai`: Gemini AI for vision analysis

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
