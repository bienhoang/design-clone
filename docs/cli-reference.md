# CLI Reference

All script options and parameters.

## screenshot.js

Core screenshot and extraction tool.

```bash
node src/core/screenshot.js [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| --url | string | required | Target URL |
| --output | string | required | Output directory |
| --viewports | string | all | Comma-separated: desktop,tablet,mobile |
| --full-page | bool | true | Capture full page height |
| --max-size | number | 5 | Max file size in MB before compression |
| --headless | bool | false | Run in headless mode (desktop always uses headless) |
| --scroll-delay | number | 1500 | Pause time in ms between scroll steps for lazy content |
| --close | bool | false | Close browser after capture (false keeps session) |
| --extract-html | bool | false | Extract cleaned HTML |
| --extract-css | bool | false | Extract all CSS from page |
| --extract-animations | bool | true* | Extract @keyframes and transitions (enabled with --extract-css) |
| --filter-unused | bool | true | Filter CSS to remove unused selectors |
| --capture-hover | bool | false | Capture hover state screenshots and generate :hover CSS |
| --verbose | bool | false | Verbose logging |

*Default true when --extract-css is enabled, can be disabled with `--extract-animations false`

**Output**: JSON with screenshot paths and metadata. Includes `browserRestarts` count tracking for stability monitoring. When `--capture-hover` is enabled, also includes hover state results in output.

## filter-css.js

Remove unused CSS selectors.

```bash
node src/core/filter-css.js --html FILE --css FILE --output FILE [--verbose]
```

| Option | Required | Description |
|--------|----------|-------------|
| --html | yes | Source HTML file |
| --css | yes | Raw CSS file |
| --output | yes | Filtered CSS output |
| --verbose | no | Show stats |

## analyze-structure.py

AI structure analysis with Gemini.

```bash
python src/ai/analyze-structure.py -s SCREENSHOT -o OUTPUT [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| -s, --screenshot | yes | Desktop screenshot |
| -o, --output | yes | Output directory |
| --html | no | Source HTML (improves accuracy) |
| --css | no | Source CSS (improves accuracy) |
| --model | no | Gemini model (default: gemini-2.5-flash) |
| -v, --verbose | no | Verbose output |

## extract-design-tokens.py

Extract colors, typography, spacing.

```bash
python src/ai/extract-design-tokens.py -s SCREENSHOT -o OUTPUT [options]
```

Same options as analyze-structure.py.

## extract-assets.js

Download images, fonts, icons.

```bash
node src/core/extract-assets.js --url URL --output DIR
```

## verify-menu.js

Validate navigation structure.

```bash
node src/verification/verify-menu.js --html FILE [--url URL] [--output DIR] [--verbose]
```

| Option | Description |
|--------|-------------|
| --html | Path to HTML file |
| --url | URL to test (alternative to --html) |
| --output | Output directory for screenshots |
| --verbose | Show detailed progress |

## verify-header.js

Verify header components (Phase 1).

```bash
node src/verification/verify-header.js --html FILE [--url URL] [--output DIR] [--verbose]
```

Tests: logo presence, navigation visibility, CTA buttons, sticky/fixed behavior, z-index layering, height consistency.

## verify-footer.js

Verify footer components (Phase 1).

```bash
node src/verification/verify-footer.js --html FILE [--url URL] [--output DIR] [--verbose]
```

Tests: position at bottom, multi-column layout, link sections, copyright text, social icons, background contrast.

## verify-slider.js

Verify slider/carousel components (Phase 1).

```bash
node src/verification/verify-slider.js --html FILE [--url URL] [--output DIR] [--verbose]
```

Tests: library detection (Swiper, Slick, Owl, native), navigation arrows, pagination dots, autoplay behavior, current slide indicator.

## generate-audit-report.js

Aggregate verification results into consolidated report (Phase 1).

```bash
node src/verification/generate-audit-report.js --dir DIR [--output FILE] [--verbose]
```

| Option | Description |
|--------|-------------|
| --dir | Directory containing verification JSON results |
| --output | Output path for report (default: component-audit.md) |
| --verbose | Show detailed progress |

Output: Markdown report with summary table, side-by-side screenshots, responsive analysis, CSS suggestions.

## verify-layout.js

Verify layout consistency.

```bash
node src/verification/verify-layout.js --html FILE
```

## state-capture.js

Capture hover states for interactive elements.

Used internally by screenshot.js with `--capture-hover` flag.

| Export | Description |
|--------|-------------|
| `captureAllHoverStates(page, cssString, outputDir)` | Detect interactive elements and capture normal/hover screenshots |
| `captureHoverState(page, selector, outputDir, index)` | Capture hover state for a single element |
| `generateHoverCss(results)` | Generate `:hover` CSS rules from captured style diffs |
| `detectInteractiveElements(page, cssString)` | Detect interactive elements via CSS analysis and DOM query |

**Key Features:**
- Dual detection: CSS-based (`:hover` selectors) and DOM-based (interactive elements, transitions)
- Per-element style diff capture (backgroundColor, color, transform, boxShadow, etc.)
- Automatic screenshot pair generation (normal + hover states)
- CSS rule generation from detected style changes
- Validates selectors and skips hidden/invisible elements

## ux-audit.js

UX quality assessment using Gemini Vision AI (Phase 2).

```bash
node src/ai/ux-audit.js --screenshots <dir> [--output <dir>] [--url <url>] [--verbose]
```

| Option | Required | Description |
|--------|----------|-------------|
| --screenshots | yes | Directory containing viewport screenshots (desktop.png, tablet.png, mobile.png) |
| --output | no | Output directory for report and JSON results (default: same as screenshots) |
| --url | no | Original URL (for report metadata) |
| --verbose | no | Show detailed progress |

**Requires**: GEMINI_API_KEY or GOOGLE_API_KEY environment variable

**Output**:
- `ux-audit.md`: Markdown report with scores, issues, and recommendations
- `ux-audit.json`: Structured results (aggregated scores, viewport breakdown, issues, recommendations)

**Evaluation Categories** (0-100 score each):
1. Visual Hierarchy - Content prominence, scanning patterns, call-to-action visibility
2. Navigation - Touch targets, menu discoverability, current page indicator
3. Typography - Text size, line height, contrast ratio, readability
4. Spacing - Padding/margins, element breathing room, touch target spacing
5. Interactive Elements - Button affordance, link distinguishability, focus states
6. Responsive - Content reflow, no horizontal scroll, text truncation, breakpoint transitions

**Viewport Analysis**: Evaluates all three viewports (desktop: 1920×1080, tablet: 768×1024, mobile: 375×812) and generates weighted scores (desktop 40%, tablet 30%, mobile 30%).

**Issue Severity Levels**:
- Critical (0-30 score): Blocks tasks or causes confusion
- Major (31-60 score): Degrades experience significantly
- Minor (61-80 score): Polish improvements

**Scoring Scale**:
- 90-100: Excellent, industry-leading UX
- 70-89: Good, meets modern standards
- 50-69: Adequate, room for improvement
- 30-49: Poor, significant issues
- 0-29: Critical, requires immediate attention

## clone-site.js

Clone multiple pages from website with integrated UX audit (Phase 2).

```bash
design-clone clone-site <url> [options]
```

| Option | Description |
|--------|-------------|
| --pages <paths> | Comma-separated paths (e.g., /,/about,/contact) |
| --max-pages <n> | Maximum pages to auto-discover (default: 10) |
| --viewports <list> | Viewport list (default: desktop,tablet,mobile) |
| --output <dir> | Custom output directory |
| --ai | Extract design tokens using Gemini AI (requires GEMINI_API_KEY) |
| --ux-audit | Run UX audit using Gemini Vision (requires GEMINI_API_KEY) |
| --yes, -y | Skip confirmation prompt |

**Integrated Workflow** (when using --ux-audit):
1. Discover or use manual pages
2. Capture screenshots across viewports
3. Merge CSS files
4. Extract design tokens (with --ai)
5. **Run UX audit** (with --ux-audit) - Analyzes homepage screenshots via Gemini Vision
6. Rewrite links
7. Generate manifest

**UX Audit Output**: When enabled, generates `analysis/ux-audit.md` and `analysis/ux-audit.json` in output directory.

**Examples**:
```bash
design-clone clone-site https://example.com --ux-audit
design-clone clone-site https://example.com --pages /,/about,/contact --ux-audit
design-clone clone-site https://example.com --ai --ux-audit
```

## ux_audit.py

Python module providing UX audit prompts for Gemini Vision integration.

```python
from src.ai.prompts.ux_audit import build_ux_audit_prompt, build_aggregation_prompt

# Build viewport-specific prompt
prompt = build_ux_audit_prompt(viewport='mobile')

# Build aggregation prompt for multiple viewports
aggregation = build_aggregation_prompt(desktop_results, tablet_results, mobile_results)
```

**Functions**:
- `build_ux_audit_prompt(viewport)` - Build prompt with viewport-specific checks (mobile/tablet/desktop)
- `build_aggregation_prompt(desktop, tablet, mobile)` - Combine viewport results into unified assessment

**Constants**:
- `UX_AUDIT_PROMPT` - Base UX evaluation prompt (6 categories)
- `VIEWPORT_CONTEXT` - Dictionary of viewport-specific evaluation criteria
- `AGGREGATION_PROMPT` - Template for combining viewport results with weighted averaging

**Viewport Weighting**:
- Desktop: 40% (primary interaction model)
- Tablet: 30% (hybrid interaction)
- Mobile: 30% (touch-first)
