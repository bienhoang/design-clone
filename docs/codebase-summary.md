# Design Clone Codebase Summary

**Version:** 2.1.0 (Phase 3 Complete)
**Last Updated:** February 5, 2026

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
| AI structure analysis | Active | Optional Gemini Vision integration |
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
│   ├── core/                     # Core extraction engines
│   │   ├── screenshot.js         # Multi-viewport capture
│   │   ├── filter-css.js         # CSS unused rule removal
│   │   ├── extract-assets.js     # Image/font/icon downloads
│   │   ├── discover-pages.js     # Navigation discovery (SPA-aware)
│   │   ├── multi-page-screenshot.js  # Batch viewport capture
│   │   ├── merge-css.js          # CSS deduplication
│   │   ├── rewrite-links.js      # Internal link rewriting
│   │   ├── semantic-enhancer.js  # WordPress semantic HTML
│   │   ├── animation-extractor.js # @keyframes extraction
│   │   ├── design-tokens.js      # Token extraction
│   │   ├── dom-tree-analyzer.js  # DOM structure analysis
│   │   └── [9 more core utilities]
│   │
│   ├── figma/                    # Figma-to-code integration (Phase 3)
│   │   ├── parse-url.js          # Figma URL parser (Phase 1)
│   │   ├── figma-client.py       # Figma API client (Phase 1)
│   │   ├── extract-figma.py      # Token extraction (Phase 2)
│   │   ├── generate-css.py       # BEM CSS generator (Phase 3)
│   │   └── generate-tailwind.py  # Tailwind generator (Phase 3)
│   │
│   ├── ai/                       # AI analysis engines
│   │   ├── analyze-structure.py  # Gemini Vision structure analysis
│   │   ├── extract-design-tokens.py  # Design token extraction
│   │   ├── ux-audit.js           # UX quality checks
│   │   └── prompts/              # AI prompt engineering
│   │       ├── design_tokens.py
│   │       ├── structure_analysis.py
│   │       └── ux_audit.py
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
│   │   └── enhance-assets.js     # Asset optimization
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
│       └── helpers.js
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

## Core Modules

### screenshot.js
Multi-viewport screenshot capture with Playwright.

**Key Functions:**
- `captureViewports()` - Capture at 3 viewports
- `extractHTML()` - Preserve semantic HTML, remove scripts
- `extractCSS()` - Full stylesheet extraction
- `extractAnimations()` - Extract @keyframes and transitions

**Output:** `desktop.png`, `tablet.png`, `mobile.png`, `source.html`, `source.css`

### filter-css.js
Remove unused CSS rules using PurgeCSS integration.

**Process:**
1. Parse HTML for used selectors
2. Analyze CSS rules
3. Remove unused declarations
4. Preserve media queries, animations
5. Output deduplicated CSS

**Impact:** 40-60% CSS size reduction on average

### extract-assets.js
Download images, fonts, and icons from websites.

**Asset Types:**
- Images (WebP, JPG, PNG)
- Web fonts (WOFF2, TTF)
- Icon sets (SVG, Font Awesome)
- Data URIs (embedded graphics)

**Output:** `assets/images/`, `assets/fonts/`, `assets/icons/`

### analyze-structure.py
Gemini Vision powered design analysis.

**Analyzes:**
- Page layout and sections
- Component hierarchy
- Design token patterns
- Accessibility issues
- UX patterns

**Output:** `structure.md` (markdown report)

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
URL → Discover pages → Screenshot all pages (3 viewports each)
  → Merge CSS → Rewrite internal links → Verify navigation → Output
```
**Time:** ~2-5 minutes (depends on page count)

### /design:figma-to-code (Figma Conversion)
```
Figma URL → Parse URL → Extract nodes & tokens → Generate HTML+CSS/Tailwind → Output
```
**Time:** ~5-10 seconds

## Environment Variables

**Required:**
- `FIGMA_ACCESS_TOKEN` - Figma API access (Phase 3)

**Optional:**
- `GEMINI_API_KEY` - Enable AI structure analysis
- `CHROME_PATH` - Chrome/Chromium binary path
- `PLAYWRIGHT_BROWSERS_PATH` - Playwright browser cache location

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| CLI | Node.js, yargs | Command-line interface |
| Browsers | Playwright | Multi-browser automation |
| Parsing | cheerio, jsdom | HTML/DOM manipulation |
| CSS | PostCSS, PurgeCSS | CSS processing |
| AI | Gemini Vision API | Design analysis |
| Python | Python 3.9+ | AI scripts, Figma processing |
| Templates | HTML5, CSS3 | Output templates |

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
5. **AI:** Requires valid GEMINI_API_KEY for structure analysis
6. **JavaScript:** Dynamic content may not be fully captured

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
