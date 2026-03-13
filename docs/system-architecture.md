# Design Clone System Architecture

**Version:** 4.0.0 (Architecture Simplification)
**Last Updated:** March 13, 2026

## System Design Overview

Design Clone is a simplified, modular pipeline system consolidating ~110 files (14,500 lines) into 5 core modules (~1,500 lines)—a 90% code reduction. Claude Code vision replaces all verification and analysis modules. The architecture supports three main workflows sharing a unified foundation.

## High-Level Architecture

```
┌────────────────────────────────────────────────┐
│        CLI Layer (Node.js)                     │
│  /design:clone | /design:clone-px             │
│  /design:clone-site (Claude Code only)        │
└──────────────┬─────────────────────────────────┘
               │
    ┌──────────┴──────────┬───────────┐
    ▼                     ▼           ▼
┌─────────────────┐  ┌────────────┐  ┌──────────────┐
│  Capture        │  │ Filter CSS │  │ Extract      │
│  (Playwright)   │  │ & Analyze  │  │ Assets       │
│  3 viewports    │  │ (css-tree) │  │ (Concur.)    │
└────────┬────────┘  └────────┬────┘  └──────┬───────┘
         │                    │               │
    ┌────┴────────────────────┴───────────────┘
    │
    ▼
┌──────────────┐
│ AI Analysis  │
│ (Claude Code │
│ Vision)      │
└──────────────┘
```

## Component Layers

### 1. CLI Layer (Entry Points)

**Location:** `bin/cli.js`, `bin/commands/`

**Responsibilities:**
- Parse command-line arguments
- Route to appropriate workflow
- Validate environment setup
- Display progress and results

**Key Commands:**
```
design-clone <url>          # Basic clone
design-clone clone-px <url> # Pixel-perfect
/design:clone-site <url>    # Multi-page (Claude Code only)
```

**Flow:**
1. Parse arguments
2. Load environment variables
3. Execute workflow command
4. Report results to user

---

### 2. Capture Pipeline

**Location:** `src/capture.js` (~480 lines)

**Workflow:**

```
URL Input
    │
    ├─► Browser Setup (Playwright singleton)
    │       └─► Reuse browser instance across session
    │
    ├─► Page Loading
    │       ├─► Navigate to URL
    │       ├─► Wait for network idle
    │       └─► Trigger lazy-loading
    │
    ├─► Page Preparation
    │       ├─► Handle cookie banners
    │       ├─► Trigger lazy loading
    │       └─► Wait for page readiness
    │
    ├─► Screenshot Capture (3 viewports)
    │       ├─► Desktop: 1440x900
    │       ├─► Tablet: 768x1024
    │       └─► Mobile: 375x812
    │
    ├─► HTML Extraction
    │       ├─► Serialize DOM
    │       ├─► Remove <script> tags
    │       └─► Preserve semantic markup
    │
    ├─► CSS Extraction
    │       ├─► Collect all stylesheets
    │       ├─► Preserve animations & @keyframes
    │       └─► Auto-filter with filter-css.js
    │
    ├─► [Optional] Hover State Capture
    │       ├─► Detect interactive elements
    │       ├─► Generate :hover CSS
    │       └─► Screenshot hover states
    │
    └─► [Optional] Enhanced Analysis
            ├─► Detect breakpoints
            ├─► Extract computed styles
            └─► Responsive gap-fill
```

**Key Features:**

| Feature | Implementation | Input | Output |
|---------|---|-------|--------|
| Multi-viewport capture | Playwright 3 headless contexts | URL | PNG screenshots |
| HTML/CSS extraction | DOM serialization + stylesheet collection | Page | HTML + CSS |
| Hover state capture | Interactive detection + :hover CSS gen | Page | Hover states + CSS |
| Breakpoint detection | CSS @media query parsing | CSS | breakpoints.json |
| Computed style extraction | getComputedStyle() gap-fill | Page | computed-gap.css |
| Image compression | sharp library | Images | Optimized PNGs |
| Cookie handling | Banner detection + dismiss clicks | Page | Clean state |
| Lazy loading | network/load event waits | Page | Full-loaded DOM |

---

### 3. CSS Filtering

**Location:** `src/filter-css.js` (~250 lines)

**Algorithm:**

```
HTML + CSS Input
    │
    ├─► HTML Analysis
    │       ├─► Parse DOM tree
    │       ├─► Extract all CSS selectors used
    │       └─► Build usage index (tags, IDs, classes)
    │
    ├─► CSS AST Parsing (css-tree)
    │       ├─► Parse entire stylesheet
    │       └─► Build selector→declaration map
    │
    ├─► Dead Code Removal (2-pass)
    │   Pass 1: Remove unused selectors, declarations
    │   Pass 2: Remove empty @media blocks, orphan @keyframes
    │
    ├─► Sanitization
    │       ├─► Remove XSS patterns
    │       └─► Path validation (prevent traversal)
    │
    └─► Output
            └─ Filtered CSS (40-60% size reduction)
```

**Features:**

| Feature | Behavior |
|---------|----------|
| Selector matching | Exact + complex selectors (pseudo-elements, :nth-child) |
| Media queries | Keep used breakpoints, remove empty blocks |
| Animations | Keep @keyframes referenced by HTML elements |
| Custom properties | Remove unused CSS variables |
| Chunked processing | Stream >2MB files in 2MB chunks |
| Aggressive mode | Extra pass on @media, :hover states, animations |

---

### 4. Asset Extraction

**Location:** `src/extract-assets.js` (~180 lines)

**Workflow:**

```
HTML + CSS Input
    │
    ├─► Image Extraction
    │       ├─► Parse <img> src, srcset, picture
    │       ├─► Parse CSS background-image URLs
    │       └─► Extract inline SVGs
    │
    ├─► Font Extraction
    │       ├─► Find @font-face declarations
    │       └─► Extract src URLs (WOFF2, TTF)
    │
    ├─► Rate-Limited Downloads
    │       ├─► Batch queue (10 concurrent)
    │       ├─► HTTP 429 exponential backoff
    │       └─► Redirect following
    │
    └─► Output
            ├─ assets/images/
            ├─ assets/fonts/
            ├─ assets/icons/
            └─ assets/url-mapping.json
```

**Features:**

- 10 concurrent downloads (configurable)
- Safe filename generation
- CORS-aware requests
- Exponential backoff on rate limits
- URL mapping for src rewriting

---

### 5. Multi-Page Clone

**Location:** `src/clone-site.js` (~380 lines)

**Workflow:**

```
URL Input
    │
    ├─► Page Discovery
    │       ├─► History state interception
    │       ├─► Navigation scraping (anchor tags)
    │       ├─► Sitemap parsing (if available)
    │       └─► Generate page list
    │
    ├─► Sequential Capture
    │       ├─► For each page:
    │       │   ├─ Navigate + wait
    │       │   ├─ Capture (via capture.js)
    │       │   └─ Report progress
    │       └─ Collect all CSS
    │
    ├─► CSS Merge & Dedup
    │       ├─► Combine all stylesheets
    │       ├─► AST-level deduplication
    │       └─► Filter unused rules
    │
    ├─► Link Rewriting
    │       ├─► Rewrite internal links → local files
    │       └─► Generate relative paths
    │
    └─► Output
            ├─ Per-page screenshots
            ├─ Merged CSS (all pages)
            ├─ HTML files (link-rewritten)
            └─ manifest.json
```

**Features:**

- Universal page discovery (framework-agnostic)
- Parallel context pool (memory-safe)
- CSS deduplication (AST-level, 60-80% reduction)
- Manifest generation with metadata
- Dry-run mode (discovery only)

---

### 6. AI Analysis Layer

**Location:** `src/ai/prompts/`

**Claude Code Built-in Vision:**

Claude Code reads prompt templates + screenshots directly. No external API calls or Python pipelines.

```
Screenshot(s) + Context Files
    │
    ├─► Load prompt template (markdown)
    │       ├─► Select variant based on available data
    │       └─► Variants: basic, with-context, with-dimensions, with-hierarchy
    │
    ├─► Claude Code vision analyzes
    │       ├─► Structure analysis → structure.md
    │       ├─► Design tokens → design-tokens.json
    │       └─► UX audit → ux-audit.json
    │
    └─► Results written to output
```

**Prompt Templates:**

- `prompts/structure-analysis/` (4 variants) — Layout & hierarchy analysis
- `prompts/design-tokens/` (4 variants) — Design system extraction
- `prompts/ux-audit/` (3 viewport + 1 aggregation) — Quality checks

Replaces 19 verification modules from v3.0. Vision-powered analysis provides superior accuracy and flexibility.

---

## Data Flow Diagrams

### Basic Clone Workflow (/design:clone)

```
URL Input
    ↓
┌──────────────────────┐
│ Browser Setup        │
│ (Playwright)         │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Capture              │
│ (3 viewports)        │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Extract HTML + CSS   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Filter Unused CSS    │
│ (css-tree AST)       │
└──────────┬───────────┘
           ↓
Output Directory
├─ desktop.png
├─ tablet.png
├─ mobile.png
├─ source.html
└─ source.css
```

**Options:**
- `--detect-breakpoints` — Capture at actual @media queries
- `--extract-computed` — Fill gaps via getComputedStyle()
- `--aggressive-filter` — Stronger dead code removal
- `--capture-hover` — Include hover state snapshots

### Pixel-Perfect Workflow (/design:clone-px)

```
Basic Clone Output
    ↓
┌──────────────────────┐
│ Extract Assets       │
│ (Images, fonts,      │
│  icons with 429 BOE) │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ AI Analysis          │
│ (Claude Code Vision) │
│ • Structure analysis  │
│ • Design tokens      │
│ • UX audit           │
└──────────┬───────────┘
           ↓
Output + Assets + Analysis
```

**Full Pipeline Options:**
- `--capture-hover` — Interactive state screenshots
- `--detect-breakpoints` — Responsive breakpoint analysis
- `--extract-computed` — getComputedStyle() gap-fill
- `--aggressive-filter` — Enhanced CSS dead code removal

### Multi-Page Clone Workflow (/design:clone-site)

```
URL Input
    ↓
┌──────────────────────┐
│ Discover Pages       │
│ (Anchors + nav +     │
│  sitemap + history)  │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Sequential Capture   │
│ (Per-page capture    │
│  via capture.js)     │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ CSS Merge & Dedup    │
│ (AST-level, 60-80%   │
│  reduction)          │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Link Rewriting       │
│ (Internal links →    │
│  local file refs)    │
└──────────┬───────────┘
           ↓
Output Directory
├─ manifest.json
├─ Per-page HTML
├─ Merged CSS
└─ Screenshots/
   ├─ desktop/
   ├─ tablet/
   └─ mobile/
```

**Options:**
- `--dry-run` — Discovery only, no capture
- `--max-pages` — Limit pages to capture
- `--detect-breakpoints` — Per-page breakpoint analysis

## Output & State Management

File-system-based output only (no database).

### Output Structure

```
output/
├── desktop.png                 # Screenshots (3 viewports)
├── tablet.png
├── mobile.png
├── source.html                 # Extracted code
├── source.css                  # Filtered CSS
├── source-raw.css              # Pre-filter CSS
├── hover-states/               # Interactive captures
│   └── hover-*.png
├── breakpoints.json            # Detected @media queries
├── computed-gap.css            # getComputedStyle() fill
├── assets/                      # Downloaded assets
│   ├── images/
│   ├── fonts/
│   ├── icons/
│   └── url-mapping.json
├── structure.md                # AI analysis
├── ux-audit.json               # Quality metrics
└── design-tokens.json          # Token extraction
```

**Multi-page output includes manifest.json mapping pages to screenshots.**

---

## Technology Decisions

### Why Playwright?
- Multi-browser support (Chrome, Firefox, WebKit)
- Modern async/await API
- Accurate viewport handling
- Reusable browser instance pattern

### Why css-tree for CSS Filtering?
- AST-level precision (handles complex selectors)
- Preserves source structure
- Dead code detection (@media/@keyframes/@imports)
- Chunked streaming for large CSS (>50MB)

### Why Claude Code Vision (not Python)?
- No external dependencies beyond Node.js
- Superior image understanding
- Direct prompt template system
- Easier maintenance and updates
- Replaces 19+ verification modules

---

## Scalability & Performance

### Current Limits

| Aspect | Limit | Handling |
|--------|-------|----------|
| Screenshot viewports | 3 fixed | Desktop, tablet, mobile |
| CSS file size | 50MB+ | Streaming chunks (2MB blocks) |
| Images per page | 100+ | 10 concurrent downloads + 429 backoff |
| Pages per site | 50+ | Sequential capture + context pool |
| Stylesheets | 100+ | Chunked + AST dedup (60-80% reduction) |

### Key Optimizations

1. **Singleton Browser:** Reuse Playwright instance across entire session
2. **Context Pool:** Multi-page capture with memory guards
3. **CSS Streaming:** 2MB chunks for large stylesheets
4. **Concurrent Downloads:** 10 parallel + exponential backoff on 429
5. **AST Deduplication:** 60-80% CSS reduction across multi-page sites
6. **Dead Code Removal:** Two-pass (@media/@keyframes/unused vars)
7. **Computed Style Extraction:** Gap-fill via getComputedStyle()
8. **Progress Reporting:** TTY-aware real-time feedback

---

## Error Handling

**Structured error codes:**

| Error | Cause | Recovery |
|-------|-------|----------|
| NETWORK_TIMEOUT | Page load stalled | Retry with backoff |
| CSS_FILTER_ERROR | Malformed CSS | Skip filter, use raw CSS |
| ASSET_DOWNLOAD_429 | Rate limited | Exponential backoff |
| BROWSER_CRASH | Page timeout/memory | Restart browser, clear cache |
| INVALID_URL | Bad input | Validate & retry |
| PAGE_NOT_FOUND | 404 response | Log & continue |

---

## Security

1. **No Credential Storage:** Environment variables only
2. **URL Validation:** HTTP(S) only, no file:// or javascript:
3. **HTML Sanitization:** Remove `<script>` tags, XSS patterns
4. **Path Traversal Prevention:** Validate asset download paths
5. **Asset Size Limits:** Prevent memory exhaustion from huge files

---

## Testing

**6 test suites, 54 tests:**

- `test-env-js.js` — Environment utility functions
- `test-env-path-order.js` — .env file search path
- `test-filter-css.js` — CSS filtering module
- `test-clone-site.js` — URL normalization, path utils
- `test-integration.js` — Module imports & exports
- `test-cli-utils.js` — CLI paths, version, commands

**Run tests:**
```bash
npm test                    # All tests (with c8 coverage)
```

---

## Documentation References

- **Codebase Summary:** [codebase-summary.md](./codebase-summary.md)
- **Code Standards:** [code-standards.md](./code-standards.md)
- **Project Overview PDR:** [project-overview-pdr.md](./project-overview-pdr.md)
- **CLI Reference:** [cli-reference.md](./cli-reference.md)
- **Troubleshooting:** [troubleshooting.md](./troubleshooting.md)
