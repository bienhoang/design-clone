# Design Clone System Architecture

**Version:** 2.1.0 (Phase 3)
**Last Updated:** February 5, 2026

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

**Key Modules:**

| Module | Purpose | Input | Output |
|--------|---------|-------|--------|
| screenshot.js | Viewport capture | URL | PNG screenshots |
| extract-assets.js | Asset downloads | HTML + CSS | images/, fonts/, icons/ |
| filter-css.js | Remove unused rules | HTML + CSS | Optimized CSS |
| discover-pages.js | SPA navigation | URL | Page list |
| merge-css.js | Deduplicate styles | CSS files | Merged CSS |
| animation-extractor.js | Extract animations | CSS | animation-tokens.json |
| semantic-enhancer.js | WordPress optimization | HTML + CSS | Enhanced HTML |

**Critical Features:**

- **Lazy Loading:** Waits for dynamic content via `page.waitForLoadState('networkidle')`
- **JavaScript Removal:** Strips all `<script>` tags, preserves HTML structure
- **CSS Preservation:** Keeps all stylesheets, including animations
- **Asset Integrity:** Downloads with original naming and structure

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

**Location:** `src/ai/`

**Gemini Vision Integration:**

```
Screenshot(s)
    │
    ├─► analyze-structure.py
    │       ├─► Send screenshot to Gemini Vision
    │       ├─► Request structure analysis
    │       ├─► Extract layout information
    │       └─► Output: structure.md
    │
    ├─► extract-design-tokens.py
    │       ├─► Analyze visual styles
    │       ├─► Extract color palette
    │       ├─► Infer spacing patterns
    │       └─► Output: tokens.json, tokens.css
    │
    └─► ux-audit.js (optional)
            ├─► Check accessibility
            ├─► Validate contrast ratios
            ├─► Review hover states
            └─► Generate audit report
```

**Prompts (Framework):**

- `prompts/structure_analysis.py` - Layout and hierarchy analysis
- `prompts/design_tokens.py` - Design system extraction
- `prompts/ux_audit.py` - UX quality checks

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
| fetch-images.js | Download images | Image URLs | assets/images/ |
| inject-icons.js | Replace with Font Awesome | HTML | Updated HTML |
| enhance-assets.js | Optimize images | images/ | Optimized images |

**Pipeline:**
1. Extract image URLs from HTML/CSS
2. Download with original quality
3. Convert to WebP where possible
4. Generate responsive srcset
5. Inject Font Awesome CDN link

---

## Data Flow Diagrams

### Basic Clone Workflow (/design:clone)

```
User Input (URL)
    ↓
CLI Router
    ↓
┌─────────────────────────────────────┐
│ 1. Launch Browser                   │
│    ├─ Initialize Playwright         │
│    └─ Create new context            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. Capture Screenshots              │
│    ├─ Desktop (1920x1080)          │
│    ├─ Tablet (768x1024)            │
│    └─ Mobile (375x812)             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. Extract HTML & CSS               │
│    ├─ Serialize DOM                 │
│    ├─ Remove scripts                │
│    ├─ Collect stylesheets           │
│    └─ Preserve animations           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. Filter Unused CSS                │
│    ├─ Parse selectors from HTML     │
│    ├─ Match against CSS rules       │
│    ├─ Remove unused declarations    │
│    └─ Output optimized CSS          │
└─────────────────────────────────────┘
    ↓
Output Directory
├─ desktop.png
├─ tablet.png
├─ mobile.png
├─ source.html
└─ source.css
```

### Pixel-Perfect Workflow (/design:clone-px)

```
Basic Clone Output
    ↓
┌─────────────────────────────────────┐
│ 5. Extract Assets                   │
│    ├─ Download all images           │
│    ├─ Fetch web fonts               │
│    └─ Cache Font Awesome icons      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 6. AI Analysis (Optional)           │
│    ├─ Send screenshot to Gemini     │
│    ├─ Extract structure             │
│    └─ Generate report               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 7. Design Token Extraction          │
│    ├─ Analyze visual patterns       │
│    ├─ Extract tokens                │
│    └─ Generate CSS custom props     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 8. Verification                     │
│    ├─ Check menu structure          │
│    ├─ Validate layout               │
│    └─ Test navigation               │
└─────────────────────────────────────┘
    ↓
Output + Assets + Analysis
```

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

### Why Python for Figma & AI?
- **Better JSON handling:** Easier design token parsing
- **Gemini SDK mature:** Official Python support
- **Data processing:** NumPy-friendly for image analysis
- **Cross-platform:** Windows/Mac/Linux compatible

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

### Current Limits

| Aspect | Limit | Impact |
|--------|-------|--------|
| Screenshot viewports | 3 fixed | Easy to extend |
| Figma nodes | 1000+ | Tested, performs well |
| CSS file size | 500KB+ | Filtered automatically |
| Images per page | 100+ | Asset extraction handles |
| Pages per site | 50+ | Multi-page CLI works |

### Performance Optimizations

1. **Parallel Processing:** Viewport screenshots in series (Playwright limitation)
2. **CSS Deduplication:** 40-60% size reduction with PurgeCSS
3. **Asset Optimization:** WebP conversion, lazy loading
4. **Caching:** Screenshot reuse between workflows
5. **Streaming:** Large downloads handled in chunks

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
