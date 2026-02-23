# Design Clone System Architecture

**Version:** 3.0.0 (v3.0 Improvement Roadmap)
**Last Updated:** February 23, 2026

## System Design Overview

Design Clone is built as a modular, pipeline-based system where each component handles a specific transformation stage. The architecture supports three main workflows with a shared foundation.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Layer (Node.js)                  │
│  /design:clone | /design:clone-px | /design:clone-site │
│  /design:figma-to-code                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┐
        ▼                     ▼              ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐
│  Web Extraction │  │ Figma Pipeline  │  │ Verification │
│   (Playwright)  │  │  (Python/REST)  │  │ & Quality    │
└────────┬────────┘  └────────┬────────┘  └──────┬───────┘
         │                    │                  │
    ┌────┴────────────────────┴──────────────────┴─────┐
    │                                                   │
    ▼                   ▼                        ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────┐
│ Asset Layer  │  │ Code Generation │  │ Output Store │
│ (Browser)    │  │ (CSS/Tailwind)  │  │ (File System)│
└──────────────┘  └─────────────────┘  └──────────────┘
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
design-clone <url>                    # Basic clone
design-clone clone-px <url>           # Pixel-perfect
design-clone clone-site <url>         # Multi-page
design-clone figma-to-code <url>      # Figma conversion
```

**Flow:**
1. Parse arguments with yargs
2. Validate dependencies (Node, Python, browsers)
3. Load environment variables
4. Execute workflow command
5. Report results to user

---

### 2. Web Extraction Pipeline

**Location:** `src/core/`

**Workflow Diagram:**

```
URL Input
    │
    ├─► Browser Setup (Playwright)
    │       └─► Launch Chrome/Firefox/WebKit
    │
    ├─► Page Loading
    │       ├─► Navigate to URL
    │       ├─► Wait for network idle
    │       └─► Trigger lazy-loading
    │
    ├─► Screenshot Capture (3 viewports)
    │       ├─► Desktop: 1920x1080
    │       ├─► Tablet: 768x1024
    │       └─► Mobile: 375x812
    │
    ├─► HTML Extraction
    │       ├─► Serialize DOM
    │       ├─► Remove <script> tags
    │       ├─► Keep semantic markup
    │       └─► Preserve data attributes
    │
    ├─► CSS Extraction
    │       ├─► Collect all stylesheets
    │       ├─► Inline critical CSS
    │       ├─► Preserve animations
    │       └─► Extract @keyframes
    │
    └─► [Optional] Asset Extraction
            ├─► Images (WebP/JPG/PNG)
            ├─► Fonts (WOFF2/TTF)
            └─► Icons (SVG/Font Awesome)
```

**Key Modules (by Domain):**

| Module | Location | Purpose | v3.0 Changes | Input | Output |
|--------|----------|---------|-------------|-------|--------|
| screenshot.js | capture/ | Viewport capture | Fast-path, breakpoint detect, quality score | URL | PNG screenshots |
| screenshot-extraction.js | capture/ | HTML/CSS extract | Progress reporting, computed gap-fill, aggressive filter | Page | HTML + CSS |
| browser-context-pool.js | capture/ | Context reuse | NEW: Parallel multi-page, memory guards | - | Browser contexts |
| extract-assets.js | media/ | Asset downloads | Concurrency 5→10, validation | HTML + CSS | images/, fonts/, icons/ |
| asset-validator.js | media/ | Asset verification | NEW: Magic bytes, SVG sanitize | Assets | Valid/invalid report |
| filter-css.js | css/ | Remove unused rules | Chunked streaming, error codes, aggressive pass | HTML + CSS | Optimized CSS |
| breakpoint-detector.js | css/ | Breakpoint detection | NEW: Parse @media, actual breakpoints | CSS | Breakpoint list |
| filter-css-dead-code.js | css/ | Dead code removal | NEW: Two-pass @media/@keyframes removal | CSS | Cleaned CSS |
| css-chunker.js | css/ | Streaming chunks | NEW: 50MB limit, 5MB chunks | CSS | Chunked stream |
| computed-style-extractor.js | css/ | Style gap-fill | NEW: getComputedStyle vs Chromium defaults | Page | Gap-filled CSS |
| quality-scorer.js | verification/ | Quality metrics | NEW: 5-metric weighted score | Extraction | quality-score.json |
| progress.js | utils/ | Progress reporting | NEW: TTY-aware stderr output | - | Progress events |
| error-codes.js | shared/ | Error catalog | NEW: Structured codes + suggestions | - | DesignCloneError |
| discover-pages.js | discovery/ | SPA navigation | Progress reporting added | URL | Page list |
| multi-page-screenshot.js | capture/ | Multi-page capture | Context pool, memory guards, dry-run | Page list | Screenshots |
| animation-extractor.js | animation/ | Extract animations | - | CSS | animation-tokens.json |
| semantic-enhancer.js | html/ | HTML optimization | - | HTML + CSS | Enhanced HTML |
| dimension-extractor.js | dimension/ | Structure analysis | - | DOM tree | layout-analysis.json |
| section-detector.js | section/ | Section detection | - | HTML + viewport | sections.json |
| clone-site.js | bin/commands/ | Multi-page clone CLI | Dry-run, progress, parallel | URL | Screenshots + manifest |

**Critical Features:**

- **Lazy Loading:** Waits for dynamic content via `page.waitForLoadState('networkidle')`
- **JavaScript Removal:** Strips all `<script>` tags, preserves HTML structure
- **CSS Preservation:** Keeps all stylesheets, including animations
- **Asset Integrity:** Validates magic bytes, sanitizes SVG (v3.0)
- **Centralized Logging:** TTY-aware output via src/utils/log.js
- **Progress Reporting:** Real-time feedback via ProgressReporter (v3.0)
- **Streaming CSS:** Processes 50MB+ stylesheets in chunks (v3.0)
- **Parallel Context Pool:** Multi-page capture with memory guards (v3.0)

**Recent Refactoring (Feb 23):**

Two major modules were decomposed to reduce code duplication and code smells:
- **semantic-enhancer.js:** Now uses 3 companion modules (semantic-enhancer-page.js, semantic-enhancer-mappings.js)
- **dimension-extractor.js:** Now uses 5 companion modules (dimension-extractor-card-detector.js, dimension-output.js, dimension-output-ai-summary.js, dom-tree-analyzer.js, dom-tree-analyzer-tree-builders.js)

---

### 3. Figma-to-Code Pipeline (Phase 3)

**Location:** `src/figma/`

**Architecture:**

```
Figma URL
    │
    ├─► URL Parser (parse-url.js)
    │       └─► Extract file_key, node_id
    │
    ├─► API Authentication (figma-client.py)
    │       └─► Validate FIGMA_ACCESS_TOKEN
    │
    ├─► Design Extraction (extract-figma.py)
    │       ├─► Fetch file metadata
    │       ├─► Traverse node hierarchy
    │       ├─► Extract design tokens
    │       │   ├─ Colors (fills, strokes, opacity)
    │       │   ├─ Typography (family, size, weight, line-height)
    │       │   ├─ Spacing (gaps, padding, margins)
    │       │   ├─ Shadows (blur, offset, spread, color)
    │       │   └─ Border radius (uniform, per-corner)
    │       └─► Download screenshot
    │
    ├─► Output: design-tokens.json, tokens.css, figma-nodes.json
    │
    ├─► Code Generation (branching)
    │   │
    │   ├─ CSS Mode (default)
    │   │   └─► generate-css.py
    │   │       ├─► Build BEM class structure
    │   │       ├─► Generate semantic HTML
    │   │       ├─► Create CSS rules
    │   │       └─► Output: index.html, styles.css
    │   │
    │   └─ Tailwind Mode (--tailwindcss)
    │       └─► generate-tailwind.py
    │           ├─► Map values to Tailwind scale
    │           ├─► Generate utility classes
    │           ├─► Generate HTML with classes
    │           └─► Output: index.html, [tailwind.config.js]
    │
    └─► Final Output
            ├─ index.html
            ├─ styles.css (CSS mode) OR tailwind utilities
            ├─ tokens.css (CSS custom properties)
            ├─ design-tokens.json (machine-readable)
            └─ analysis/ (figma-export.png, figma-nodes.json)
```

**Key Features:**

1. **Design Token Extraction (Phase 2)**
   - Automatic color detection from fills/strokes
   - Typography extraction from TEXT nodes
   - Spacing normalization to Tailwind scale
   - Shadow and border-radius mapping

2. **BEM CSS Generation (Phase 3)**
   - Semantic HTML structure
   - Block-Element-Modifier naming
   - Design token variable integration
   - Responsive breakpoint support

3. **Tailwind Generation (Phase 3)**
   - Utility-first class generation
   - Arbitrary value support for custom values
   - Scale matching (spacing, colors, sizing)
   - Config extension generation when needed

---

### 4. AI Analysis Layer

**Location:** `src/ai/prompts/`

**Claude Code Built-in Vision:**

Claude Code reads prompt templates + screenshots directly. No external API calls.

```
Screenshot(s) + Context Files
    │
    ├─► Read prompt template (markdown)
    │       ├─► Select best variant based on available context
    │       └─► Highest accuracy: with-hierarchy > with-dimensions > with-context > basic
    │
    ├─► Claude Code vision analyzes screenshots
    │       ├─► Structure analysis → structure.md
    │       ├─► Design tokens → design-tokens.json, tokens.css
    │       └─► UX audit → ux-audit.json, ux-audit.md
    │
    └─► Results written to output directory
```

**Prompt Templates:**

- `prompts/structure-analysis/*.md` - Layout and hierarchy analysis (4 variants)
- `prompts/design-tokens/*.md` - Design system extraction (4 variants)
- `prompts/ux-audit/*.md` - UX quality checks (3 viewports + aggregation)

---

### 5. Verification & Quality Layer

**Location:** `src/verification/`

**Quality Checks:**

| Check | Module | Validates |
|-------|--------|-----------|
| Menu Verification | verify-menu.js | Navigation structure, links |
| Layout Consistency | verify-layout.js | Grid, flexbox, positioning |
| Header Structure | verify-header.js | Logo, nav, search presence |
| Footer Structure | verify-footer.js | Links, copyright, social |
| Slider Detection | verify-slider.js | Carousel elements |
| Semantic HTML | semantic-enhancer.js | Proper heading hierarchy |

**Execution:**
```bash
# Part of /design:clone-px workflow
node src/verification/verify-menu.js --html output/source.html
```

---

### 6. Post-Processing Layer

**Location:** `src/post-process/`

**Asset Enhancement:**

| Module | Function | Input | Output |
|--------|----------|-------|--------|
| fetch-images.js | Download images from Unsplash | Image URLs | assets/images/ |
| inject-icons.js | Replace with Japanese-style icons | HTML | Updated HTML |
| inject-gosnap.js | Add gosnap-widget Web Component | HTML dir | HTML with widget |
| enhance-assets.js | Orchestrate 3-step enhancement | output/ | Enhanced HTML |

**Pipeline:**
1. Fetch images from Unsplash (if UNSPLASH_ACCESS_KEY set)
2. Inject Japanese-style SVG icons
3. Inject gosnap-widget (clone-px only)
4. Generate responsive srcset
5. Inject Font Awesome CDN link (step 2)

---

## Data Flow Diagrams

### Basic Clone Workflow (/design:clone)

```
User Input (URL)
    ↓
CLI Router
    ↓
┌─────────────────────────────────────────────────────┐
│ 1. Launch Browser                                   │
│    ├─ Initialize Playwright                         │
│    └─ Create context (or reuse from pool if exists) │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 2. Capture Screenshots (v3.0: Fast-path)           │
│    ├─ Desktop (1920x1080)                          │
│    ├─ Tablet (768x1024)                            │
│    └─ Mobile (375x812)                             │
│    └─ (If all headless: skip browser restart)      │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 3. Extract HTML & CSS (v3.0: Streaming)             │
│    ├─ Report progress via TTY-aware stderr          │
│    ├─ Serialize DOM, remove scripts                │
│    ├─ Collect stylesheets (stream if >5MB)         │
│    └─ Preserve animations                          │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 4. Filter Unused CSS (v3.0: Chunked + Errors)      │
│    ├─ Parse selectors from HTML                    │
│    ├─ Chunk CSS (5MB threshold)                    │
│    ├─ Match rules against selectors                │
│    ├─ Remove unused declarations (Pass 1)          │
│    └─ (Optional --aggressive-filter: Pass 2)       │
└─────────────────────────────────────────────────────┘
    ↓
Output Directory
├─ desktop.png
├─ tablet.png
├─ mobile.png
├─ source.html
└─ source.css
```

**v3.0 Additions:**
- Use `--detect-breakpoints` to capture at actual @media breakpoints
- Use `--extract-computed` to fill style gaps via getComputedStyle()
- Use `--aggressive-filter` for stronger CSS dead code removal
- Use `--quality-score` to output quality metrics
- Use `--skip-gosnap` flag in `/design:clone-px` to disable gosnap injection

### Pixel-Perfect Workflow (/design:clone-px)

```
Basic Clone Output
    ↓
┌─────────────────────────────────────────────────────┐
│ 5. Extract Assets (v3.0: Validated, Concurrent)    │
│    ├─ Download images (maxConcurrent: 10)           │
│    ├─ Validate magic bytes (v3.0)                   │
│    ├─ Fetch web fonts                              │
│    ├─ Sanitize SVG icons (v3.0)                     │
│    ├─ Retry on 429 with exponential backoff (v3.0)  │
│    └─ Cache Font Awesome icons                     │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 6. AI Analysis (Built-in)                           │
│    ├─ Read prompt template                         │
│    ├─ Claude Code vision analysis                  │
│    └─ Generate structure report                    │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 7. Design Token Extraction                          │
│    ├─ Analyze visual patterns                      │
│    ├─ Extract tokens                               │
│    └─ Generate CSS custom props                    │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 8. Verification & Quality Scoring (v3.0)           │
│    ├─ Check menu structure                         │
│    ├─ Validate layout                              │
│    ├─ Score: CSS coverage, asset completeness      │
│    ├─ Score: responsive fidelity, HTML semantics   │
│    └─ Score: accessibility compliance              │
└─────────────────────────────────────────────────────┘
    ↓
Output + Assets + Analysis + Quality Score
```

### Multi-Page Clone Workflow (/design:clone-site)

```
User Input (URL + options)
    ↓
┌─────────────────────────────────────────────────────┐
│ 1. Discover Pages (v3.0: Progress reporting)       │
│    ├─ Report progress via TTY-aware stderr          │
│    ├─ Parse site navigation                         │
│    ├─ Detect SPA framework (React, Vue, etc)        │
│    └─ Generate page list (--dry-run stops here)     │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 2. Capture Screenshots (v3.0: Parallel Pool)       │
│    ├─ Initialize browser context pool               │
│    ├─ Reuse contexts across pages (memory guards)   │
│    ├─ Desktop (1920x1080)                          │
│    ├─ Tablet (768x1024)                            │
│    └─ Mobile (375x812)                             │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ 3. Generate Manifest (v3.0)                         │
│    ├─ Create manifest.json                          │
│    ├─ Map pages to screenshot paths                 │
│    ├─ Include capture stats & estimates             │
│    └─ Document pool efficiency metrics              │
└─────────────────────────────────────────────────────┘
    ↓
Output Directory
├─ manifest.json
├─ capture-results.json
└─ analysis/
   ├─ desktop/
   ├─ tablet/
   └─ mobile/
```

**v3.0 Key Features:**
- Discovery with automatic progress reporting
- Parallel capture with context pool (reuses browser contexts, reduces memory)
- Memory guards prevent context leaks
- `--dry-run` shows discovery + estimates without capturing
- Per-page status updates
- Pool efficiency metrics in manifest

### Figma-to-Code Workflow (/design:figma-to-code)

```
User Input (Figma URL + flags)
    ↓
┌─────────────────────────────────────┐
│ 1. Parse URL                        │
│    ├─ Extract file_key              │
│    └─ Extract node_id               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. Figma API Connection             │
│    ├─ Load FIGMA_ACCESS_TOKEN       │
│    └─ Authenticate                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. Extract Design Data              │
│    ├─ Fetch file metadata           │
│    ├─ Traverse nodes                │
│    ├─ Extract components            │
│    └─ Collect all styles            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. Design Token Extraction          │
│    ├─ Colors (fills, strokes)       │
│    ├─ Typography (size, weight)     │
│    ├─ Spacing (gaps, padding)       │
│    ├─ Shadows (blur, offset)        │
│    └─ Border radius                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. Generate Code (Branch)           │
│                                     │
│ IF --tailwindcss:                   │
│   → generate-tailwind.py            │
│   → Output: HTML + classes          │
│                                     │
│ ELSE (default):                     │
│   → generate-css.py                 │
│   → Output: HTML + BEM CSS          │
└─────────────────────────────────────┘
    ↓
Output Directory
├─ index.html
├─ styles.css (CSS mode only)
├─ tokens.css
├─ design-tokens.json
└─ analysis/
   ├─ figma-export.png
   └─ figma-nodes.json
```

---

## Database & State Management

**No Traditional Database.** Design Clone uses file-system-based storage:

### Output Structure

```
cloned-designs/
├── {timestamp}-{domain}/           # Per-session directory
│   ├── desktop.png                 # Screenshots
│   ├── tablet.png
│   ├── mobile.png
│   ├── source.html                 # Extracted code
│   ├── source.css
│   ├── source-raw.css
│   ├── tokens.json                 # Design tokens
│   ├── animation-tokens.json
│   ├── structure.md                # AI analysis
│   ├── assets/
│   │   ├── images/                 # Downloaded images
│   │   ├── fonts/                  # Web fonts
│   │   └── icons/                  # Icon sets
│   └── hover-states/               # Hover captures
│       ├── hover-1-normal.png
│       └── hover-1-hover.png
│
└── {timestamp}-figma/              # Figma conversions
    ├── index.html
    ├── styles.css
    ├── tokens.css
    ├── design-tokens.json
    └── analysis/
```

### Manifest Files

**Multi-page cloning generates manifest.json:**

```json
{
  "generated": "2026-02-05T08:00:00Z",
  "source": "https://example.com",
  "pages": [
    {
      "path": "/",
      "filename": "index.html",
      "screenshots": {
        "desktop": "analysis/desktop/index.png",
        "tablet": "analysis/tablet/index.png",
        "mobile": "analysis/mobile/index.png"
      }
    }
  ]
}
```

---

## Technology Decisions

### Why Playwright (not Puppeteer)?
- **Multi-browser support:** Chrome, Firefox, WebKit
- **Modern async/await API:** Cleaner code
- **Better viewport handling:** More accurate mobile testing
- **Native video recording:** Built-in screen capture

### Why Python for Figma?
- **Better JSON handling:** Easier design token parsing
- **Stdlib sufficient:** urllib, json, argparse cover all needs
- **Cross-platform:** Windows/Mac/Linux compatible

### Playwright as Regular Dependency (Feb 23)
- **Before:** Optional peerDependency, required manual install
- **After:** Regular dependency, auto-installed with `npm install`
- **Benefit:** Simpler setup, guaranteed availability, init.js simplified (20 lines removed)

### Why CSS Custom Properties for Tokens?
- **Runtime flexibility:** Change values without compilation
- **CSS native:** No build step required
- **Fallback support:** Works with older browsers
- **Easy override:** Component-level customization

### Why BEM for CSS Mode?
- **Predictable naming:** No namespace collisions
- **Scalability:** Maintains clarity at large scale
- **Maintainability:** Clear element relationships
- **Compatibility:** Works with any CSS architecture

### Why Tailwind Utilities as Alternative?
- **Smaller output:** Utility classes compress well
- **Consistency:** Enforced design system
- **Developer UX:** Rapid prototyping
- **Industry standard:** Familiar to most developers

---

## Scalability Considerations

### Current Limits (v3.0)

| Aspect | Limit | v3.0 Impact |
|--------|-------|-------------|
| Screenshot viewports | 3 fixed | Easy to extend |
| Figma nodes | 1000+ | Tested, performs well |
| CSS file size | 50MB+ | Streaming chunks at 5MB threshold |
| Images per page | 100+ | Concurrent downloads (5→10), adaptive throttling |
| Pages per site | 50+ | Multi-page CLI with context pool |
| Stylesheets | 100+ | Chunked processing, dead code removal |

### Performance Optimizations (v3.0)

1. **Parallel Viewport:** Fast-path when all headless (skip browser restart)
2. **Parallel Multi-Page:** Context pool reuse with memory guards
3. **CSS Streaming:** Chunk-based processing for 50MB+ files
4. **Download Concurrency:** Increased 5→10, adaptive 429 backoff
5. **CSS Deduplication:** 40-60% baseline, up to 80% with aggressive filter
6. **Asset Validation:** Early detection prevents corrupted downloads
7. **Dead Code Removal:** Two-pass filtering of @media/@keyframes/unused vars
8. **Computed Style Gap-Fill:** getComputedStyle() extraction for complete styling
9. **Caching:** Screenshot reuse between workflows
10. **Progress Reporting:** TTY-aware updates keep user informed

---

## Error Handling & Recovery

**Multi-Level Error Strategy:**

```javascript
try {
  // 1. Input validation
  validateUrl(url);
  validateEnvironment();

  // 2. Operation with retry logic
  try {
    result = await executeWithRetry(operation, 3);
  } catch (e) {
    // 3. Graceful degradation
    if (isOptional(operation)) {
      console.warn(`Skipping ${operation}: ${e.message}`);
    } else {
      throw e;  // Fatal error
    }
  }
} catch (error) {
  // 4. User-friendly error messages
  reportError(error);
  suggestResolution(error);
  process.exit(1);
}
```

**Common Failure Modes:**

| Error | Handling | Recovery |
|-------|----------|----------|
| Network timeout | Retry 3x with exponential backoff | Skip if optional |
| Missing FIGMA_ACCESS_TOKEN | Check environment vars | Provide setup guide |
| Browser crash | Restart Playwright | Clear cache, retry |
| API rate limit | Wait and retry | Queue requests |
| Malformed HTML | Fallback to text nodes | Continue |

---

## Security Considerations

1. **No Credential Storage:** Environment variables only, no .env files in output
2. **URL Validation:** Only HTTP(S) URLs, no file:// or javascript:
3. **HTML Sanitization:** Remove `<script>`, event handlers in AI analysis
4. **Asset Validation:** CORS checks, size limits on downloads
5. **API Token:** FIGMA_ACCESS_TOKEN never logged or exposed

---

## Testing Strategy

**Test Coverage (50+ tests):**

- Unit tests for individual modules (screenshot, filter-css, etc.)
- Integration tests for complete workflows
- Regression tests with snapshot comparisons
- Performance benchmarks
- Accessibility validation (axe-core)

**Test Execution:**

```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Workflow tests
npm run test:accessibility # A11y checks
```

---

## Future Architecture Enhancements

### Phase 4: Component Library Generation
- Extract reusable components from Figma
- Generate Storybook-compatible stories
- Document component API and variants

### Real-Time Sync
- Webhook support for Figma file changes
- Automatic code generation on file updates
- Design system consistency checking

### Advanced CSS Generation
- CSS-in-JS support (styled-components, emotion)
- Shadow DOM component wrapping
- CSS Module generation for scoping

---

## Documentation References

- **Codebase Summary:** [codebase-summary.md](./codebase-summary.md)
- **Code Standards:** [code-standards.md](./code-standards.md)
- **Project Overview PDR:** [project-overview-pdr.md](./project-overview-pdr.md)
