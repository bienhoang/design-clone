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
├── bin/                    # CLI entry point
│   ├── cli.js
│   ├── commands/           # CLI commands
│   └── utils/              # CLI utilities
├── src/
│   ├── core/               # Core extraction scripts
│   │   ├── screenshot.js   # Multi-viewport screenshots
│   │   ├── filter-css.js   # CSS filtering
│   │   └── extract-assets.js
│   ├── ai/                 # AI analysis prompt templates
│   │   └── prompts/         # Markdown prompts for Claude Code vision
│   │       ├── structure-analysis/
│   │       ├── design-tokens/
│   │       └── ux-audit/
│   ├── verification/       # Verification scripts
│   │   ├── verify-menu.js
│   │   └── verify-layout.js
│   ├── utils/              # Shared utilities
│   │   ├── browser.js
│   │   ├── puppeteer.js
│   │   └── env.js
│   └── post-process/       # Post-processing
│       ├── fetch-images.js
│       ├── inject-icons.js
│       └── enhance-assets.js
├── tests/                  # Test files
├── templates/              # HTML/CSS templates
├── docs/                   # Documentation
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

**Output Structure:**
```
cloned-designs/{timestamp}-{domain}/
├── analysis/           # Screenshots by viewport
│   ├── desktop/*.png
│   ├── tablet/*.png
│   └── mobile/*.png
├── manifest.json       # Page metadata + screenshot paths
└── capture-results.json
```

**Features:**
- Auto-discovers pages from navigation (SPA-aware)
- Multi-viewport screenshots (desktop, tablet, mobile)
- Progress reporting
- Graceful error handling (continues on page failures)

---

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
# Select prompt based on available context (highest accuracy first):
#   - If dom-hierarchy.json AND dimensions-summary.json exist:
#       Read src/ai/prompts/structure-analysis/with-hierarchy.md
#       Read output/dom-hierarchy.json
#       Read output/dimensions-summary.json
#   - Else if dimensions-summary.json exists:
#       Read src/ai/prompts/structure-analysis/with-dimensions.md
#       Read output/dimensions-summary.json
#   - Else if source.html AND source.css exist:
#       Read src/ai/prompts/structure-analysis/with-context.md
#       Read output/source.html (first 100KB)
#       Read output/source.css (first 100KB)
#   - Else:
#       Read src/ai/prompts/structure-analysis/basic.md
#
# Then: Read output/desktop.png (Claude vision analyzes the screenshot)
# If content-summary.md exists: Read output/content-summary.md
# Analyze following prompt instructions
# Write result to output/structure.md

# Step 5: Extract Design Tokens (built-in Claude Code vision)
# Select prompt:
#   - If source.css exists:
#       Read src/ai/prompts/design-tokens/with-css.md
#       Read output/source.css (first 15KB)
#   - Else:
#       Read src/ai/prompts/design-tokens/basic.md
#
# Read output/desktop.png, output/tablet.png, output/mobile.png
# Analyze following prompt instructions
# Write JSON result to output/design-tokens.json
# Generate CSS custom properties and write to output/tokens.css
#
# Token CSS generation rules:
#   - Map colors to --color-* variables
#   - Map typography to --font-*, --font-size-*, --font-weight-*, --line-height-*
#   - Map spacing to --space-* variables
#   - Map border-radius to --radius-* variables
#   - Map shadows to --shadow-* variables
#   - Use :root {} selector

# Step 6: Verify Menu
node src/verification/verify-menu.js \
  --html ./output/source.html

# Step 7: Quality Check with ui-ux-pro-max (REQUIRED)
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "accessibility" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "animation hover" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "z-index" --domain ux
```

**Note:** Step 1 includes `--capture-hover true` to capture interactive element states and generate `:hover` CSS rules. Outputs include `hover-states/` directory and `hover.css`.

## Quality Checklist (ui-ux-pro-max)

After generating HTML/CSS, verify these items using `ui-ux-pro-max` skill:

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

<!-- Example -->
<img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=600&fit=crop&q=80" alt="Students">
```

## Japanese Design Principles

| Principle | Description | CSS Implementation |
|-----------|-------------|-------------------|
| Ma (間) | Negative space | Generous padding/margins |
| Kanso (簡素) | Simplicity | Limited colors, clean typography |
| Shibui (渋い) | Subtle elegance | Soft shadows, gentle transitions |
| Seijaku (静寂) | Tranquility | Calm colors, visual harmony |

## Animation & Interaction Capture (v1.2+)

### CSS Animations

Automatically extracts @keyframes and transition properties when using `--extract-css`:

```bash
node src/core/capture/screenshot.js --url https://example.com --output ./out --extract-css true
```

**Output:**
- `animations.css` - All @keyframes definitions with frame data
- `animation-tokens.json` - Detailed animation metadata (durations, timing functions)

### Hover State Capture

Capture interactive element hover states:

```bash
node src/core/capture/screenshot.js --url https://example.com --output ./out --capture-hover
```

**Output:**
- `hover-states/` - Before/after screenshots for each interactive element
- `hover.css` - Generated :hover rules from computed style differences
- `hover-diff.json` - Style diff data

**Detection Methods:**
1. CSS-based: Parses :hover selectors from extracted CSS
2. DOM-based: Queries buttons, links, and interactive elements

### Video Recording

Record scroll preview video (opt-in due to 3-5x capture time increase):

```bash
# WebM (native, no extra deps)
node src/core/capture/screenshot.js --url https://example.com --output ./out --video

# MP4 (requires ffmpeg)
node src/core/capture/screenshot.js --url https://example.com --output ./out --video --video-format mp4

# GIF (requires ffmpeg)
node src/core/capture/screenshot.js --url https://example.com --output ./out --video --video-format gif

# Custom duration (default: 12000ms)
node src/core/capture/screenshot.js --url https://example.com --output ./out --video --video-duration 8000
```

**Output:**
- `preview.webm` (default) or `preview.mp4` / `preview.gif`

**ffmpeg Setup (for MP4/GIF):**
```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

### Feature Flags Reference

| Flag | Default | Description |
|------|---------|-------------|
| `--extract-animations` | true (with --extract-css) | Extract @keyframes and transitions |
| `--capture-hover` | false | Capture hover state screenshots |
| `--video` | false | Record scroll preview video |
| `--video-format` | webm | Video format: webm, mp4, gif |
| `--video-duration` | 12000 | Video duration in ms |

## Environment Variables

Create `.env` file (see `.env.example`):

```bash
# No API keys required for AI analysis (uses Claude Code built-in vision)
```

## Script Reference

| Script | Location | Purpose |
|--------|----------|---------|
| screenshot.js | src/core/ | Capture screenshots + extract HTML/CSS |
| filter-css.js | src/core/ | Filter unused CSS rules |
| animation-extractor.js | src/core/ | Extract @keyframes and transitions from CSS |
| state-capture.js | src/core/ | Capture hover states for interactive elements |
| video-capture.js | src/core/ | Record scroll preview video with optional ffmpeg conversion |
| extract-assets.js | src/core/ | Download images, fonts, icons |
| discover-pages.js | src/core/ | Discover navigation links |
| multi-page-screenshot.js | src/core/ | Capture multiple pages |
| merge-css.js | src/core/ | Merge + deduplicate CSS |
| rewrite-links.js | src/core/ | Rewrite internal links |
| clone-site.js | bin/commands/ | Multi-page clone module (slash command only) |
| prompts/structure-analysis/*.md | src/ai/ | AI structure analysis prompts (Claude Code vision) |
| prompts/design-tokens/*.md | src/ai/ | Design token extraction prompts (Claude Code vision) |
| prompts/ux-audit/*.md | src/ai/ | UX audit prompts (Claude Code vision) |
| verify-menu.js | src/verification/ | Validate navigation structure |
| verify-layout.js | src/verification/ | Verify layout consistency |
| fetch-images.js | src/post-process/ | Fetch and optimize images |
| inject-icons.js | src/post-process/ | Replace icons with Font Awesome |
| enhance-assets.js | src/post-process/ | Enhance extracted assets |

## References

- [Basic Clone](docs/basic-clone.md) - Step-by-step basic workflow
- [Pixel Perfect](docs/pixel-perfect.md) - Full pixel-perfect workflow
- [CLI Reference](docs/cli-reference.md) - All script options
- [Troubleshooting](docs/troubleshooting.md) - Common issues and fixes
