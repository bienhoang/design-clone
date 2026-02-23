---
name: design-clone
description: Clone website designs via multi-viewport screenshots, HTML/CSS extraction, and built-in AI analysis. Generates production HTML/CSS with Font Awesome icons, direct Unsplash images, and Japanese design principles. Commands - design:clone (basic), design:clone-site (multi-page), design:clone-px (pixel-perfect).
user-invocable: false
---

# Design Clone Skill

Clone website designs with multi-viewport screenshots, HTML/CSS extraction, CSS filtering, and built-in AI structure analysis.

## Features

- **Font Awesome 6 Icons** - All icons use Font Awesome CDN (no inline SVG)
- **Direct Unsplash Images** - Real images without API key needed
- **Japanese Design Principles** - Ma, Kanso, Shibui, Seijaku for elegant designs
- **Multi-viewport Screenshots** - Desktop, tablet, mobile captures
- **Hover State Capture** - Interactive element screenshots and :hover CSS generation
- **Built-in AI Analysis** - Design token extraction via Claude Code vision
- **ui-ux-pro-max Quality Check** - Accessibility, hover states, contrast validation

## Prerequisites

- Node.js 18+ with npm
- Chrome/Chromium browser

## Quick Setup

```bash
npm install
```

## Project Structure

```
design-clone/
├── bin/                         # CLI entry point
│   ├── cli.js
│   ├── commands/                # CLI commands (clone-site, init, verify, help, update, uninstall)
│   └── utils/                   # CLI utilities
├── src/
│   ├── core/                    # Core extraction (13 subdirectories)
│   │   ├── capture/             # Screenshot pipeline (8 modules)
│   │   ├── css/                 # CSS processing (12 modules)
│   │   ├── html/                # HTML extraction & semantic enhancement (5 modules)
│   │   ├── animation/           # Animation & hover states (5 modules)
│   │   ├── discovery/           # Page discovery (6 modules)
│   │   ├── detection/           # Framework detection (3 modules)
│   │   ├── dimension/           # DOM structure analysis (6 modules)
│   │   ├── section/             # Section detection & cropping (5 modules)
│   │   ├── media/               # Asset extraction & validation (6 modules)
│   │   ├── page-prep/           # Page readiness (3 modules)
│   │   ├── content/             # Content analysis (2 modules)
│   │   ├── links/               # URL rewriting (2 modules)
│   │   └── tests/               # Core tests
│   ├── shared/                  # Cross-module shared code (config, error-codes, viewports)
│   ├── ai/                      # AI analysis prompt templates
│   │   └── prompts/             # Markdown prompts for Claude Code vision
│   │       ├── structure-analysis/
│   │       ├── design-tokens/
│   │       └── ux-audit/
│   ├── verification/            # Quality assurance (19 modules)
│   ├── post-process/            # Asset enhancement (6 modules)
│   ├── route-discoverers/       # Framework-specific routing (11 modules)
│   └── utils/                   # Shared utilities (7 modules)
├── templates/                   # HTML/CSS base templates
├── tests/                       # Test suite
├── docs/                        # Documentation
└── package.json
```

## Commands

### design:clone

Basic design capture with Font Awesome icons and Unsplash images.

```bash
/design:clone https://example.com
```

**Workflow:**
```bash
# Step 1: Capture screenshots + HTML/CSS
node src/core/capture/screenshot.js \
  --url "URL" \
  --output ./output \
  --extract-html \
  --extract-css

# Step 2: Filter unused CSS
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css

# Step 3: Quality Check with ui-ux-pro-max (REQUIRED)
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "accessibility" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "animation hover" --domain ux
```

**Key Features:**
- Screenshots + HTML/CSS extraction
- Font Awesome 6 CDN icons
- Direct Unsplash image URLs (no API)
- Japanese design principles (Ma, Kanso, Shibui, Seijaku)
- Mobile-first responsive CSS
- **ui-ux-pro-max quality validation**

**Output:** desktop.png, tablet.png, mobile.png, source.html, source.css, source-raw.css

### design:clone-site

Multi-page screenshot capture for Claude Code vision to generate new HTML/CSS.

```bash
/design:clone-site https://example.com
```

**Usage (Claude Code only):**
```bash
/design:clone-site https://example.com
/design:clone-site https://example.com --pages /,/about,/contact
/design:clone-site https://example.com --max-pages 5
```

**Options:**
- `--pages <paths>` - Comma-separated paths
- `--max-pages <n>` - Limit pages (default: 10)
- `--viewports <list>` - Viewports (default: desktop,tablet,mobile)
- `--yes` - Skip confirmation
- `--output <dir>` - Custom output directory

### design:clone-px

Pixel-perfect clone with full asset extraction and AI analysis.

**Full Workflow:**

```bash
# Step 1: Capture + Extract
node src/core/capture/screenshot.js \
  --url "URL" \
  --output ./output \
  --extract-html --extract-css \
  --capture-hover true \
  --full-page

# Step 2: Filter CSS
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css

# Step 3: Extract Assets (images, fonts, icons)
node src/core/media/extract-assets.js \
  --url "URL" \
  --output ./output

# Step 4: AI Structure Analysis (built-in Claude Code vision)
# Step 5: Extract Design Tokens (built-in Claude Code vision)
# Step 6: Verify Menu
node src/verification/verify-menu.js \
  --html ./output/source.html

# Step 7: Quality Check with ui-ux-pro-max (REQUIRED)
```

**Note:** Step 1 includes `--capture-hover true` to capture interactive element states and generate `:hover` CSS rules.

## Quality Checklist (ui-ux-pro-max)

After generating HTML/CSS, verify using `ui-ux-pro-max` skill:

### Visual Quality
- [ ] No emojis used as icons (use Font Awesome instead)
- [ ] All icons from Font Awesome 6 (consistent sizing)
- [ ] Hover states don't cause layout shift

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] Hover states provide clear visual feedback
- [ ] Transitions are smooth (150-300ms)

### Accessibility
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color is not the only indicator
- [ ] Sufficient text contrast (4.5:1 minimum)

### Layout
- [ ] Floating elements have proper spacing
- [ ] No content hidden behind fixed navbars
- [ ] Responsive at 320px, 768px, 1024px, 1440px

## Icon Usage (Font Awesome 6)

```html
<!-- CDN in <head> -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Icons -->
<i class="fa-solid fa-house"></i>
<i class="fa-solid fa-envelope"></i>
<i class="fa-brands fa-x-twitter"></i>
<i class="fa-brands fa-line"></i>
```

## Image Usage (Direct Unsplash)

```html
<!-- No API needed - direct URL format -->
<img src="https://images.unsplash.com/photo-{PHOTO_ID}?w={WIDTH}&h={HEIGHT}&fit=crop&q=80" alt="Description">
```

## Japanese Design Principles

| Principle | Description | CSS Implementation |
|-----------|-------------|-------------------|
| Ma (間) | Negative space | Generous padding/margins |
| Kanso (簡素) | Simplicity | Limited colors, clean typography |
| Shibui (渋い) | Subtle elegance | Soft shadows, gentle transitions |
| Seijaku (静寂) | Tranquility | Calm colors, visual harmony |

## Animation & Hover Capture

### CSS Animations
Extracts @keyframes and transitions with `--extract-css`. Output: `animations.css`, `animation-tokens.json`

### Hover State Capture
Use `--capture-hover` flag. Output: `hover-states/`, `hover.css`, `hover-diff.json`

### Video Recording (opt-in)
Use `--video` flag. Formats: webm (default), mp4, gif (requires ffmpeg).

| Flag | Default | Description |
|------|---------|-------------|
| `--extract-animations` | true (with --extract-css) | Extract @keyframes and transitions |
| `--capture-hover` | false | Capture hover state screenshots |
| `--video` | false | Record scroll preview video |
| `--video-format` | webm | Video format: webm, mp4, gif |
| `--video-duration` | 12000 | Video duration in ms |
| `--detect-breakpoints` | false | Auto-detect CSS breakpoints (v3.0) |
| `--extract-computed` | false | Extract computed styles (v3.0) |
| `--aggressive-filter` | false | Aggressive CSS dead code removal (v3.0) |
| `--quality-score` | false | Generate quality score (v3.0) |
| `--dry-run` | false | Preview discovery without capture (v3.0) |

## Script Reference

| Script | Location | Purpose |
|--------|----------|---------|
| screenshot.js | src/core/capture/ | Capture screenshots + extract HTML/CSS |
| multi-page-screenshot.js | src/core/capture/ | Capture multiple pages |
| browser-context-pool.js | src/core/capture/ | Browser context pooling with memory guards |
| filter-css.js | src/core/css/ | Filter unused CSS rules |
| merge-css.js | src/core/css/ | Merge + deduplicate CSS |
| breakpoint-detector.js | src/core/css/ | Auto-detect CSS breakpoints |
| computed-style-extractor.js | src/core/css/ | Extract computed styles |
| css-chunker.js | src/core/css/ | Stream-process large CSS files |
| filter-css-dead-code.js | src/core/css/ | Aggressive CSS dead code removal |
| animation-extractor.js | src/core/animation/ | Extract @keyframes and transitions |
| state-capture.js | src/core/animation/ | Capture hover states |
| video-capture.js | src/core/media/ | Record scroll preview video |
| extract-assets.js | src/core/media/ | Download images, fonts, icons |
| asset-validator.js | src/core/media/ | Validate assets with magic bytes |
| discover-pages.js | src/core/discovery/ | Discover navigation links |
| html-extractor.js | src/core/html/ | HTML extraction |
| semantic-enhancer.js | src/core/html/ | HTML semantic enhancement |
| section-detector.js | src/core/section/ | Section detection & cropping |
| dimension-extractor.js | src/core/dimension/ | DOM structure analysis |
| framework-detector.js | src/core/detection/ | Framework detection (SPA routing) |
| page-readiness.js | src/core/page-prep/ | Cookie handling, lazy loading |
| content-counter.js | src/core/content/ | Content metrics |
| rewrite-links.js | src/core/links/ | Rewrite internal links |
| clone-site.js | bin/commands/ | Multi-page clone module |
| playwright.js | src/utils/ | Playwright configuration |
| playwright-loader.js | src/utils/ | Playwright browser loader |
| progress.js | src/utils/ | TTY-aware progress reporter |
| error-codes.js | src/shared/ | Structured error catalog |
| quality-scorer.js | src/verification/ | 5-metric quality scoring |
| generate-audit-report.js | src/verification/ | Clone audit report generation |
| verify-menu.js | src/verification/ | Validate navigation structure |
| verify-header.js | src/verification/ | Validate header structure |
| verify-footer.js | src/verification/ | Validate footer structure |
| verify-layout.js | src/verification/ | Verify layout consistency |
| verify-slider.js | src/verification/ | Validate slider/carousel |
| fetch-images.js | src/post-process/ | Fetch and optimize images |
| inject-icons.js | src/post-process/ | Replace icons with Font Awesome |
| enhance-assets.js | src/post-process/ | Enhance extracted assets |
| inject-gosnap.js | src/post-process/ | GoSnap integration |
| prompts/structure-analysis/*.md | src/ai/ | AI structure analysis prompts |
| prompts/design-tokens/*.md | src/ai/ | Design token extraction prompts |
| prompts/ux-audit/*.md | src/ai/ | UX audit prompts |

## References

- [Basic Clone](docs/basic-clone.md) - Step-by-step basic workflow
- [Pixel Perfect](docs/pixel-perfect.md) - Full pixel-perfect workflow
- [CLI Reference](docs/cli-reference.md) - All script options
- [Troubleshooting](docs/troubleshooting.md) - Common issues and fixes
