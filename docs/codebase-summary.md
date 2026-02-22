# Design Clone Codebase Summary

**Version:** 2.1.0 (Phase 3 Complete)
**Last Updated:** February 23, 2026

## Overview

Design Clone is a comprehensive design extraction and code generation tool for Claude Code. It captures website designs with multi-viewport screenshots, extracts clean HTML/CSS, and can convert Figma designs to production-ready code.

**Phase 3 Achievement:** Full Figma-to-code pipeline with CSS (BEM) and Tailwind CSS output modes.

## Key Capabilities

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-viewport screenshots | Active | Desktop (1920px), tablet (768px), mobile (375px) |
| HTML/CSS extraction | Active | Clean source with unused CSS removal |
| Design token extraction | Active | Automatic color, typography, spacing detection |
| Figma-to-code conversion | Phase 3 | Convert Figma designs to HTML/CSS or Tailwind |
| Hover state capture | Active | Interactive element state documentation |
| AI structure analysis | Active | Built-in Claude Code vision |
| Asset extraction | Active | Images, fonts, icons download |
| Multi-page cloning | Active | Site-wide cloning with shared CSS |

## Architecture Overview

```
design-clone/
├── bin/                          # CLI entry points
│   ├── cli.js                    # Main CLI router
│   └── commands/                 # Command implementations
│       ├── clone-site.js         # Multi-page site cloning
│       ├── init.js               # Installation setup
│       └── verify.js             # Verification checks
├── src/
│   ├── core/                     # Core extraction engines (11 semantic subdirectories)
│   │   ├── capture/              # Screenshot pipeline (7 modules + index)
│   │   ├── css/                  # CSS processing (7 modules + index)
│   │   ├── html/                 # HTML extraction (5 modules + index)
│   │   ├── animation/            # Animation & hover states (5 modules + index)
│   │   ├── discovery/            # Page & framework discovery (9 modules + index)
│   │   ├── dimension/            # DOM structure analysis (6 modules + index)
│   │   ├── section/              # Section detection (5 modules + index)
│   │   ├── media/                # Video & asset extraction (5 modules + index)
│   │   ├── page-prep/            # Page readiness (3 modules + index)
│   │   ├── content/              # Content analysis (2 modules + index)
│   │   ├── links/                # URL rewriting (2 modules + index)
│   │   └── tests/                # Core tests (2 modules)
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
│   ├── post-process/             # Asset enhancement
│   │   ├── fetch-images.js       # Image downloading
│   │   ├── inject-icons.js       # Font Awesome injection
│   │   ├── inject-gosnap.js      # GoSnap widget injection
│   │   └── enhance-assets.js     # Asset optimization (3 steps)
│   │
│   ├── route-discoverers/        # Framework-aware routing
│   │   ├── base-discoverer.js
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
│       ├── env.js / env.py       # Environment variable handling
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
Multi-viewport screenshot capture with Playwright (7 modules).

**Key Modules:**
- `screenshot.js` - Multi-viewport capture orchestrator
- `screenshot-helpers.js` - Viewport setup and utilities
- `screenshot-extraction.js` - HTML/CSS extraction
- `screenshot-viewport.js` - Individual viewport capture
- `screenshot-orchestrator.js` - Batch processing
- `multi-page-screenshot.js` - Multi-page orchestration
- `multi-page-screenshot-page.js` - Per-page capture logic

**Key Functions:**
- `captureViewports()` - Capture at 3 viewports
- `extractHTML()` - Preserve semantic HTML, remove scripts
- `extractCSS()` - Full stylesheet extraction

**Output:** `desktop.png`, `tablet.png`, `mobile.png`, `source.html`, `source.css`

### css/ - CSS Processing
Remove unused CSS rules and handle stylesheet optimization (7 modules).

**Key Modules:**
- `filter-css.js` - Main CSS filtering orchestrator
- `merge-css.js` - CSS deduplication
- `filter-css-selector-matcher.js` - Selector matching logic
- `filter-css-html-analyzer.js` - HTML selector extraction
- `filter-css-atrule-processor.js` - @media/@keyframe handling
- `filter-css-file-io.js` - File I/O utilities

**Process:**
1. Parse HTML for used selectors
2. Analyze CSS rules
3. Remove unused declarations
4. Preserve media queries, animations
5. Output deduplicated CSS

**Impact:** 40-60% CSS size reduction on average

### media/ - Asset Extraction
Download images, fonts, and icons from websites (5 modules).

**Key Modules:**
- `extract-assets.js` - Orchestrator
- `extract-assets-downloader.js` - Download logic
- `extract-assets-page-scraper.js` - Asset discovery
- `video-capture.js` - Video extraction
- `video-capture-convert.js` - Video conversion

**Asset Types:**
- Images (WebP, JPG, PNG)
- Web fonts (WOFF2, TTF)
- Icon sets (SVG, Font Awesome)
- Data URIs (embedded graphics)
- Videos (MP4, WebM)

**Output:** `assets/images/`, `assets/fonts/`, `assets/icons/`, `assets/videos/`

### discovery/ - Page & Framework Detection
Discover pages and detect framework routing patterns (9 modules).

**Key Modules:**
- `discover-pages.js` - Navigation discovery orchestrator
- `discover-pages-utils.js` - Discovery utilities
- `discover-pages-routes.js` - Route extraction
- `framework-detector.js` - Framework detection
- `framework-detector-signals.js` - Detection signal analysis
- `framework-detector-routing.js` - Routing pattern detection
- `app-state-snapshot.js` - State capture
- `app-state-snapshot-utils.js` - State utilities
- `app-state-snapshot-capture.js` - Capture logic

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

### AI Prompt Templates (src/ai/prompts/)
Claude Code vision-based design analysis via markdown prompt templates.

**Categories:**
- `structure-analysis/` -- Layout and hierarchy analysis (4 variants by context)
- `design-tokens/` -- Design system extraction (4 variants)
- `ux-audit/` -- UX quality assessment (3 viewports + aggregation)

**Output:** `structure.md`, `design-tokens.json`, `tokens.css`, `ux-audit.json`

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
URL → Screenshot 3 viewports → Extract HTML/CSS → Filter CSS → Output
```
**Time:** ~10-15 seconds

### /design:clone-px (Pixel-Perfect)
```
URL → Screenshot 3 viewports → Extract HTML/CSS → Filter CSS
  → Extract assets → AI analysis → Design tokens → Verify menu → Output
```
**Time:** ~45-60 seconds (depends on asset count)

### /design:clone-site (Multi-Page)
```
URL → Discover pages → Screenshot all pages (3 viewports each) → Generate manifest → Output
```
**Time:** ~1-3 minutes (depends on page count)

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
