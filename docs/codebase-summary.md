# Design Clone Codebase Summary

**Version:** 3.0.0 (v3.0 Improvement Roadmap Complete)
**Last Updated:** February 23, 2026

## Overview

Design Clone is a comprehensive design extraction and code generation tool for Claude Code. It captures website designs with multi-viewport screenshots, extracts clean HTML/CSS, and can convert Figma designs to production-ready code.

**v3.0 Achievement:** 13 performance and UX improvements across 5 phases: parallel viewport capture fast-path, download concurrency tuning, progress reporting, error diagnostics, dry-run mode, responsive breakpoint detection, asset integrity verification, two-pass CSS filtering, parallel multi-page capture with memory guards, streaming CSS processing, computed style extraction, output quality scoring, and test framework upgrade (c8 coverage).

## Key Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-viewport screenshots | Active | Desktop (1920px), tablet (768px), mobile (375px), parallel fast-path for headless |
| HTML/CSS extraction | Active | Clean source with unused CSS removal, streaming processing for 50MB+ |
| Design token extraction | Active | Automatic color, typography, spacing detection, computed style gap-fill |
| Figma-to-code conversion | v3.0 | Convert Figma designs to HTML/CSS or Tailwind |
| Responsive breakpoint detection | v3.0 | Auto-detect @media queries, capture at actual breakpoints |
| Asset integrity verification | v3.0 | Magic byte validation, SVG sanitization |
| Dead code CSS filtering | v3.0 | Two-pass removal of @media/@keyframes/unused vars |
| Hover state capture | Active | Interactive element state documentation |
| AI structure analysis | Active | Built-in Claude Code vision |
| Asset extraction | v3.0 | Images, fonts, icons with concurrency tuning (5→10) |
| Multi-page cloning | v3.0 | Parallel capture with browser context pool, memory guards |
| Progress reporting | v3.0 | TTY-aware stderr output, discovery + estimate in dry-run |
| Error diagnostics | v3.0 | Structured error catalog with actionable suggestions |
| Output quality scoring | v3.0 | 5-metric weighted system (CSS, assets, responsive, HTML, A11y) |

## Architecture Overview

```
design-clone/
├── bin/                          # CLI entry points
│   ├── cli.js                    # Main CLI router
│   └── commands/                 # Command implementations (6 modules)
│       ├── clone-site.js         # Multi-page site cloning
│       ├── init.js               # Installation setup
│       ├── verify.js             # Verification checks
│       ├── help.js               # Usage help
│       ├── update.js             # Version update
│       └── uninstall.js          # Skill removal
├── src/
│   ├── core/                     # Core extraction engines (13 subdirectories)
│   │   ├── capture/              # Screenshot pipeline (8 modules)
│   │   ├── css/                  # CSS processing (12 modules)
│   │   ├── html/                 # HTML extraction (5 modules)
│   │   ├── animation/            # Animation & hover states (5 modules)
│   │   ├── discovery/            # Page discovery (6 modules)
│   │   ├── detection/            # Framework detection (3 modules)
│   │   ├── dimension/            # DOM structure analysis (6 modules)
│   │   ├── section/              # Section detection (5 modules)
│   │   ├── media/                # Video & asset extraction (6 modules)
│   │   ├── page-prep/            # Page readiness (3 modules)
│   │   ├── content/              # Content analysis (2 modules)
│   │   ├── links/                # URL rewriting (2 modules)
│   │   └── tests/                # Core tests
│   │
│   ├── figma/                    # Figma-to-code integration (Phase 3)
│   │   ├── parse-url.js          # Figma URL parser (Phase 1)
│   │   ├── figma-client.py       # Figma API client (Phase 1)
│   │   ├── extract-figma.py      # Token extraction (Phase 2)
│   │   ├── generate-css.py       # BEM CSS generator (Phase 3)
│   │   └── generate-tailwind.py  # Tailwind generator (Phase 3)
│   │
│   ├── ai/                       # AI analysis (Claude Code vision)
│   │   └── prompts/              # Prompt templates (markdown)
│   │       ├── structure-analysis/  # Layout analysis prompts
│   │       ├── design-tokens/       # Token extraction prompts
│   │       └── ux-audit/            # UX audit prompts
│   │
│   ├── verification/             # Quality assurance
│   │   ├── verify-menu.js        # Navigation validation
│   │   ├── verify-layout.js      # Layout consistency
│   │   ├── verify-header.js      # Header structure
│   │   ├── verify-footer.js      # Footer structure
│   │   └── [more verifications]
│   │
│   ├── post-process/             # Asset enhancement (6 modules)
│   │   ├── fetch-images.js       # Image downloading
│   │   ├── fetch-images-unsplash-client.js  # Unsplash API client
│   │   ├── inject-icons.js       # Font Awesome injection
│   │   ├── inject-icons-svg-replacer.js     # SVG replacement logic
│   │   ├── inject-gosnap.js      # GoSnap widget injection
│   │   └── enhance-assets.js     # Asset optimization (3 steps)
│   │
│   ├── route-discoverers/        # Framework-aware routing (11 modules)
│   │   ├── index.js              # Discoverer registry
│   │   ├── base-discoverer.js
│   │   ├── base-discoverer-utils.js  # Shared discovery utilities
│   │   ├── react-discoverer.js
│   │   ├── vue-discoverer.js
│   │   ├── angular-discoverer.js
│   │   ├── svelte-discoverer.js
│   │   ├── next-discoverer.js
│   │   ├── nuxt-discoverer.js
│   │   ├── astro-discoverer.js
│   │   └── universal-discoverer.js
│   │
│   └── utils/                    # Shared utilities
│       ├── browser.js            # Playwright browser management
│       ├── playwright.js         # Playwright configuration
│       ├── env.js       # Environment variable handling
│       ├── helpers.js
│       ├── log.js                # Centralized logging (NEW Feb 23)
│
├── templates/                    # HTML/CSS base templates
│   ├── base.html                 # HTML scaffold
│   └── base.css                  # CSS foundation
│
├── tests/                        # Test suite (50+ tests)
├── docs/                         # Documentation site (VitePress)
├── prd/                          # Project requirements docs
├── landing-page/                 # Landing page HTML
└── SKILL.md                      # Skill definition for Claude Code
```

## Phase Overview

### Phase 1: Figma URL Parsing & API Access
- Parse Figma URLs to extract file_key and node_id
- Figma REST API authentication and base client
- Low-level node and style data fetching

### Phase 2: Design Token Extraction
- Extract colors, typography, spacing, shadows from Figma
- Download design screenshots
- Normalize tokens to standard scales
- Generate CSS custom properties (tokens.css)

### Phase 3: Code Generation (Current)
- **CSS Mode (default):** BEM naming convention, fully typed CSS
- **Tailwind Mode:** Utility class mapping, arbitrary value support
- Design token integration in both modes
- Output: Production-ready HTML + styling

## Core Modules (Organized by Feature Domain)

### capture/ - Screenshot Pipeline
Multi-viewport screenshot capture with Playwright (8 modules + browser context pool).

**Key Modules:**
- `screenshot.js` - Multi-viewport capture orchestrator (v3.0: viewport fast-path, breakpoint detection, quality score)
- `screenshot-helpers.js` - Viewport setup and utilities (v3.0: new CLI flags)
- `screenshot-extraction.js` - HTML/CSS extraction (v3.0: progress reporting, computed gap-fill, aggressive filter)
- `screenshot-viewport.js` - Individual viewport capture
- `screenshot-orchestrator.js` - Batch processing
- `multi-page-screenshot.js` - Multi-page orchestration (v3.0: context pool parallel, dry-run)
- `multi-page-screenshot-page.js` - Per-page capture logic
- `browser-context-pool.js` - Context reuse with memory guards (v3.0 NEW)

**Key Functions:**
- `captureViewports()` - Capture at 3 viewports, fast-path for headless
- `extractHTML()` - Preserve semantic HTML, remove scripts
- `extractCSS()` - Full stylesheet extraction, streaming for 50MB+

**v3.0 New Flags:**
- `--detect-breakpoints` - Auto-detect @media queries, capture at breakpoints
- `--extract-computed` - Fill gaps via getComputedStyle() diffed vs Chromium defaults
- `--aggressive-filter` - Two-pass CSS dead code removal
- `--quality-score` - Output 5-metric quality score
- `--dry-run` - Show discovery + estimate, no capture

**Output:** `desktop.png`, `tablet.png`, `mobile.png`, `source.html`, `source.css`, `quality-score.json` (optional)

### css/ - CSS Processing
Remove unused CSS rules and handle stylesheet optimization (12 modules).

**Key Modules:**
- `filter-css.js` - Main CSS filtering orchestrator (v3.0: error codes, chunked processing, aggressive filter pass)
- `merge-css.js` - CSS deduplication
- `filter-css-selector-matcher.js` - Selector matching logic (v3.0: async filterCssRules, dead code pass)
- `filter-css-html-analyzer.js` - HTML selector extraction
- `merge-css-atrule-processor.js` - @media/@keyframe handling for CSS merge
- `merge-css-file-io.js` - File I/O utilities for CSS merge
- `css-extractor.js` - CSS extraction from pages
- `chromium-defaults.json` - Chromium default computed style reference
- `breakpoint-detector.js` - Parse @media queries, detect actual breakpoints (v3.0 NEW)
- `filter-css-dead-code.js` - Two-pass removal of unused @media, @keyframes, CSS vars (v3.0 NEW)
- `css-chunker.js` - Chunk-based streaming for large stylesheets (v3.0 NEW)
- `computed-style-extractor.js` - getComputedStyle() gap-fill with Chromium defaults (v3.0 NEW)

**v3.0 Streaming & Performance:**
- MAX_CSS_INPUT raised to 50MB (from 500KB)
- Chunk threshold: 5MB per operation
- Streaming parser for stylesheets

**Process (v3.0):**
1. Chunk input CSS if >5MB
2. Parse HTML for used selectors
3. Analyze CSS rules
4. Pass 1: Remove unused declarations
5. Pass 2 (if --aggressive-filter): Remove dead @media/@keyframes/unused vars
6. (If --extract-computed): Fill gaps via computed styles
7. Preserve critical animations
8. Output deduplicated CSS

**Impact:** 40-60% CSS size reduction on average, up to 80% with aggressive filter

### media/ - Asset Extraction & Video
Download images, fonts, and icons with integrity verification; video recording (6 modules).

**Key Modules:**
- `extract-assets.js` - Orchestrator (v3.0: concurrency flag, asset validation)
- `extract-assets-downloader.js` - Download logic (v3.0: maxConcurrent 5→10, adaptive 429 throttling with exponential backoff)
- `extract-assets-page-scraper.js` - Asset discovery
- `asset-validator.js` - Magic byte validation, SVG sanitization (v3.0 NEW)
- `video-capture.js` - Video extraction
- `video-capture-convert.js` - Video conversion

**v3.0 Concurrency & Throttling:**
- maxConcurrent: 5→10 (configurable via --max-concurrent flag)
- HTTP 429 handling: Exponential backoff (1s, 2s, 4s, 8s)
- Asset validation prevents corrupted/malicious files

**Asset Types:**
- Images (WebP, JPG, PNG) - validated via magic bytes
- Web fonts (WOFF2, TTF)
- Icon sets (SVG, Font Awesome) - SVG sanitized
- Data URIs (embedded graphics)
- Videos (MP4, WebM)

**Output:** `assets/images/`, `assets/fonts/`, `assets/icons/`, `assets/videos/`

### discovery/ - Page Discovery
Discover pages and extract navigation patterns (6 modules).

**Key Modules:**
- `discover-pages.js` - Navigation discovery orchestrator
- `discover-pages-utils.js` - Discovery utilities
- `discover-pages-routes.js` - Route extraction
- `app-state-snapshot.js` - State capture
- `app-state-snapshot-utils.js` - State utilities
- `app-state-snapshot-capture.js` - Capture logic

### detection/ - Framework Detection
Detect JavaScript frameworks via global objects and DOM patterns (3 modules).

**Key Modules:**
- `framework-detector.js` - Framework detection orchestrator
- `framework-detector-signals.js` - Detection signal analysis
- `framework-detector-routing.js` - Routing pattern detection

**Framework Support:** React, Vue, Angular, Svelte, Next.js, Nuxt.js, Astro

### animation/ - Animation & Hover States
Extract and manage animations and interactive states (5 modules).

**Key Modules:**
- `animation-extractor.js` - Orchestrator
- `animation-extractor-ast.js` - AST processing
- `animation-extractor-output.js` - Output generation
- `state-capture.js` - State capture orchestrator
- `state-capture-detection.js` - Interactive element detection

### html/ - HTML Processing
Extract and enhance HTML semantics (5 modules, refactored).

**Key Modules:**
- `html-extractor.js` - Main extractor
- `html-extractor-inline-styler.js` - Inline style handling
- `semantic-enhancer.js` - Orchestrator (refactored Feb 23)
- `semantic-enhancer-page.js` - Per-page enhancement
- `semantic-enhancer-mappings.js` - Semantic mapping rules

**Change (Feb 23):** semantic-enhancer decomposed into 3 modules to reduce duplication across filter-css.js and other modules.

### dimension/ - DOM Structure Analysis
Analyze layout and dimensional properties (6 modules, refactored).

**Key Modules:**
- `dimension-extractor.js` - Orchestrator (refactored Feb 23)
- `dimension-extractor-card-detector.js` - Card/component detection
- `dimension-output.js` - Output formatting
- `dimension-output-ai-summary.js` - AI-powered summaries
- `dom-tree-analyzer.js` - DOM tree analysis
- `dom-tree-analyzer-tree-builders.js` - Tree building logic

**Change (Feb 23):** dimension-extractor decomposed into 4 modules + supporting files to reduce code smell and improve maintainability.

### section/ - Section Detection & Cropping
Detect page sections and generate section-based crops (5 modules).

**Key Modules:**
- `section-detector.js` - Detection orchestrator
- `section-detector-strategies.js` - Detection algorithms
- `section-detector-utils.js` - Utility functions
- `section-cropper.js` - Cropping logic
- `section-cropper-helpers.js` - Helper functions

### page-prep/ - Page Readiness
Prepare pages for extraction (3 modules).

**Key Modules:**
- `page-readiness.js` - Readiness checks
- `cookie-handler.js` - Cookie management
- `lazy-loader.js` - Lazy loading triggers

### content/ - Content Analysis
Analyze page content (2 modules).

**Key Modules:**
- `content-counter.js` - Content metrics
- `content-counter-dom.js` - DOM-based counting

### links/ - Link Rewriting (dormant)
Link rewriting utilities, not used by current pipelines (2 modules).

**Key Modules:**
- `rewrite-links.js` - Orchestrator
- `rewrite-links-css-rewriter.js` - CSS link rewriting

### utils/ - Shared Utilities
Centralized utilities and helpers (v3.0).

**Key Modules:**
- `progress.js` - ProgressReporter class for TTY-aware output (v3.0 NEW)
- `log.js` - Centralized logging with TTY detection (existing)
- `browser.js` - Playwright browser management
- `playwright.js` - Playwright configuration
- `playwright-loader.js` - Playwright browser instance loader
- `env.js` - Environment variable handling
- `helpers.js` - General utility functions

**v3.0 Progress Reporting:**
- ProgressReporter: TTY-aware, writes to stderr (keeps stdout clean)
- Tracks: current step, total steps, operation label
- Methods: start(), step(), complete()

### shared/ - Shared Code
Cross-module shared definitions (3 modules).

**Key Modules:**
- `error-codes.js` - DesignCloneError with structured codes (v3.0 NEW)
- `config.js` - SIZE_LIMITS, CHUNK_THRESHOLD, BROWSER_POOL constants (v3.0: updated limits)
- `viewports.js` - Viewport definitions (desktop, tablet, mobile) shared across capture modules

**v3.0 Error Catalog:**
- ERROR_CODES map: CSS_SIZE_EXCEEDED, CSS_PARSE_FAILED, CSS_CORS_BLOCKED, HTML_EXTRACTION_FAILED, ASSET_DOWNLOAD_FAILED, BROWSER_LAUNCH_FAILED, NAV_TIMEOUT, FILE_IO_FAILED, DISCOVERY_FAILED, SCREENSHOT_FAILED, INVALID_ARGS
- DesignCloneError class: extends Error, includes code + suggestion + context

### verification/ - Quality Assurance
Quality checks and scoring (19 modules).

**Key Modules:**
- `quality-scorer.js` - 5-metric weighted scoring (v3.0 NEW)
- `verify-menu.js` - Navigation validation
- `verify-menu-checks.js` - Menu test logic
- `verify-menu-helpers.js` - Menu DOM utilities
- `verify-layout.js` - Layout consistency
- `verify-layout-report.js` - Layout report generation
- `verify-header.js` - Header structure
- `verify-header-checks.js` - Header test logic
- `verify-header-helpers.js` - Header DOM utilities
- `verify-footer.js` - Footer structure
- `verify-footer-checks.js` - Footer test logic
- `verify-footer-helpers.js` - Footer DOM utilities
- `verify-slider.js` - Slider/carousel detection
- `verify-slider-checks.js` - Slider test logic
- `verify-slider-constants.js` - Slider selector constants
- `verify-slider-helpers.js` - Slider DOM utilities
- `generate-audit-report.js` - Audit report generation
- `generate-audit-report-css-fixes.js` - CSS fix suggestions
- `generate-audit-report-sections.js` - Section analysis

**v3.0 Quality Scoring:**
- Metrics: cssCoverage (30%), assetCompleteness (25%), responsiveFidelity (20%), htmlSemantics (15%), accessibility (10%)
- Scale: 0-100
- Auto-runs for clone-px, opt-in for basic clone

### AI Prompt Templates (src/ai/prompts/)
Claude Code vision-based design analysis via markdown prompt templates.

**Categories:**
- `structure-analysis/` -- Layout and hierarchy analysis (4 variants by context)
- `design-tokens/` -- Design system extraction (4 variants)
- `ux-audit/` -- UX quality assessment (3 viewports + aggregation)

**Output:** `structure.md`, `design-tokens.json`, `tokens.css`, `ux-audit.json`, `quality-score.json` (v3.0)

### figma/extract-figma.py (Phase 2)
Extract design system from Figma files.

**Pipeline:**
1. Parse Figma URL → extract file_key, node_id
2. Authenticate with FIGMA_ACCESS_TOKEN
3. Fetch file data via REST API
4. Extract nodes, styles, components
5. Normalize to design tokens
6. Generate design-tokens.json and tokens.css

**Output:**
- `figma-export.png` - Screenshot
- `figma-nodes.json` - Raw nodes
- `design-tokens.json` - Structured tokens
- `tokens.css` - CSS variables

### figma/generate-css.py (Phase 3)
Generate semantic HTML with BEM CSS.

**BEM Convention:**
- Block: `.component-name`
- Element: `.component-name__element`
- Modifier: `.component-name--modifier`

**Process:**
1. Read figma-nodes.json and design-tokens.json
2. Traverse node hierarchy
3. Generate semantic HTML with BEM classes
4. Create CSS rules using design tokens as variables
5. Output index.html and styles.css

### figma/generate-tailwind.py (Phase 3)
Generate HTML with Tailwind utility classes.

**Mapping Strategy:**
1. Match values to Tailwind default scale
2. Use arbitrary values `[value]` for custom matches
3. Generate tailwind.config.js extensions if needed
4. Preserve semantic HTML structure

**Process:**
1. Read figma-nodes.json and design-tokens.json
2. Build Tailwind class mapping table
3. Generate HTML with utility classes
4. Output index.html (optional tailwind.config.js)

### enhance-assets.js (Post-Processing Orchestrator)
Manages 3-step asset enhancement pipeline.

**Steps:**
1. **Fetch Images** - Download real images from Unsplash (requires UNSPLASH_ACCESS_KEY)
2. **Inject Icons** - Replace placeholders with Japanese-style SVG icons
3. **Inject GoSnap** - Add gosnap-widget Web Component (clone-px only)

**Flags:**
- `--skip-images` - Skip image fetching
- `--skip-icons` - Skip icon injection
- `--skip-gosnap` - Skip gosnap-widget injection

### inject-gosnap.js
Injects gosnap-widget Web Component into HTML files.

**Features:**
- Scans HTML directory for HTML files
- Adds `<go-snap>` element with embed script before `</body>`
- Idempotent (skips files that already contain widget)
- Supports position, theme, and persist configuration

**Output:**
- `<script src="https://unpkg.com/gosnap-widget@1.0.1/dist/embed.global.js"></script>`
- `<go-snap position="bottom-right" theme="dark" persist></go-snap>`

## Workflow Integration

### /design:clone (Basic)
```
URL → Screenshot 3 viewports (fast-path for headless) → Extract HTML/CSS (streaming) → Filter CSS (chunked) → Output
```
**Time:** ~8-12 seconds (v3.0: faster with fast-path)

### /design:clone-px (Pixel-Perfect)
```
URL → Screenshot 3 viewports → Extract HTML/CSS → Filter CSS
  → Extract assets (concurrency 10) → Asset validation → AI analysis → Design tokens → Verify menu → Quality score → Output
```
**Time:** ~50-90 seconds (v3.0: improved with parallel context pool, optimized download)

### /design:clone-site (Multi-Page)
```
URL → Discover pages (with progress) → Parallel context pool capture → Merge CSS → Generate manifest → Output
```
**Time:** ~1-3 minutes (v3.0: faster with parallel contexts, memory guards)

**v3.0 Additions (Opt-In):**
- `--detect-breakpoints` - Detect @media queries, capture at actual breakpoints
- `--aggressive-filter` - Two-pass CSS dead code removal
- `--extract-computed` - Gap-fill via computed styles
- `--quality-score` - Output quality metrics
- `--dry-run` - Show discovery + estimate (no capture)

### /design:figma-to-code (Figma Conversion)
```
Figma URL → Parse URL → Extract nodes & tokens → Generate HTML+CSS/Tailwind → Output
```
**Time:** ~5-10 seconds

## Environment Variables

**Required:**
- `FIGMA_ACCESS_TOKEN` - Figma API access (Phase 3)

**Optional:**
- `CHROME_PATH` - Chrome/Chromium binary path
- `PLAYWRIGHT_BROWSERS_PATH` - Playwright browser cache location

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| CLI | Node.js, yargs | Command-line interface |
| Browsers | Playwright (dependency) | Multi-browser automation |
| Parsing | cheerio, jsdom | HTML/DOM manipulation |
| CSS | PostCSS, PurgeCSS | CSS processing |
| AI | Claude Code Vision (built-in) | Design analysis |
| Python | Python 3.9+ | Figma processing |
| Templates | HTML5, CSS3 | Output templates |
| Logging | log.js (TTY-aware) | Centralized output (NEW Feb 23) |

## Quality Standards

### Code Quality
- Modular architecture (single responsibility)
- Comprehensive error handling
- Environment variable validation
- Type hints in Python, JSDoc in JavaScript

### Output Quality
- Semantic HTML5 structure
- Valid CSS (no vendor prefixes unless needed)
- Responsive design patterns (mobile-first)
- Accessibility compliance (WCAG 2.1)
- Japanese design principles (Ma, Kanso, Shibui, Seijaku)

### Testing
- 50+ unit and integration tests
- Screenshot regression testing
- HTML/CSS validation
- Accessibility checks (axe-core)

## Performance Characteristics

| Operation | Time | Variables |
|-----------|------|-----------|
| Single screenshot | 3-5s | Network latency, page size |
| Multi-viewport (3x) | 8-12s | Asset count, JavaScript |
| CSS filtering | 1-2s | Stylesheet size |
| Asset extraction | 15-45s | Image count, sizes |
| AI analysis | 10-20s | Screenshot quality, API latency |
| Figma extraction | 5-10s | Design complexity |

## Maintenance & Updates

**Regular Updates:**
- Font Awesome 6 CDN (hardcoded, update quarterly)
- Unsplash API (direct URL format, no auth needed)
- Tailwind CSS scale mappings (update with major versions)

**Breaking Changes:**
- Phase 3 added `generate-css.py` and `generate-tailwind.py`
- Figma output structure now includes `analysis/` subdirectory
- FIGMA_ACCESS_TOKEN now required for /design:figma-to-code

## Known Limitations

1. **Figma:** Only works with public links or files user has access to
2. **Screenshots:** Limited by browser automation capabilities
3. **CSS:** Cannot extract stylesheet origin (external vs inline)
4. **Assets:** Some CDN images may be blocked by CORS
5. **JavaScript:** Dynamic content may not be fully captured

## Future Roadmap

- [ ] Phase 4: Component library generation from Figma
- [ ] Storybook integration for component documentation
- [ ] Real-time Figma file synchronization
- [ ] Design system validation and enforcement
- [ ] Advanced CSS variable mapping for complex designs
- [ ] Video animation extraction and documentation

## Contributing

The codebase follows these principles:
- **Modularity:** Each script has single responsibility
- **Error Handling:** Graceful failures with clear messages
- **Documentation:** Code comments for complex logic
- **Testing:** New features include tests
- **Performance:** Optimize for speed without sacrificing quality

See contributing guidelines in root CONTRIBUTING.md.
