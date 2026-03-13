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
│   ├── commands/                # CLI commands (init, help, update, uninstall)
│   └── utils/                   # CLI utilities
├── src/
│   ├── utils.js                 # Shared utilities, browser management, constants
│   ├── capture.js               # Screenshot pipeline + HTML/CSS extraction
│   ├── filter-css.js            # CSS filtering + dead code removal
│   ├── extract-assets.js        # Asset extraction (images, fonts, icons)
│   ├── clone-site.js            # Multi-page clone with route discovery
│   └── ai/                      # AI analysis prompt templates
│       └── prompts/             # Markdown prompts for Claude Code vision
│           ├── structure-analysis/
│           ├── design-tokens/
│           └── ux-audit/
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
node src/capture.js \
  --url "URL" \
  --output ./output \
  --extract-html true \
  --extract-css true

# Step 2 (optional): Standalone CSS filter
node src/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css

# Step 3: Review output + build clone
```

**Output:** desktop.png, tablet.png, mobile.png, source.html, source.css, source-raw.css

### design:clone-site

Multi-page clone with shared CSS and working navigation.

```bash
/design:clone-site https://example.com
/design:clone-site https://example.com --pages /,/about,/contact
/design:clone-site https://example.com --max-pages 5
```

**Usage:**
```bash
node src/clone-site.js \
  --url "URL" \
  --output ./cloned-designs \
  --max-pages 10
```

**Options:** `--url`, `--pages`, `--max-pages`, `--output`, `--detect-breakpoints`, `--aggressive-filter`, `--dry-run`

### design:clone-px

Pixel-perfect clone with full asset extraction and AI analysis.

```bash
/design:clone-px https://example.com
```

**Workflow:**
```bash
# Step 1: Capture + Extract (with hover, breakpoints, computed styles)
node src/capture.js \
  --url "URL" \
  --output ./output \
  --extract-html true --extract-css true \
  --capture-hover true \
  --full-page true \
  --detect-breakpoints true \
  --extract-computed true \
  --aggressive-filter true

# Step 2: Extract Assets
node src/extract-assets.js \
  --url "URL" \
  --output ./output

# Step 3: AI Structure Analysis (Claude Code vision)
# Step 4: Extract Design Tokens (Claude Code vision)
# Step 5: Build the clone
```

## Quality Checklist

After generating HTML/CSS, verify:

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

## Capture Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--extract-html` | false | Extract page HTML |
| `--extract-css` | false | Extract + filter CSS |
| `--capture-hover` | false | Capture hover state screenshots |
| `--full-page` | false | Full-page screenshots |
| `--detect-breakpoints` | false | Auto-detect CSS breakpoints |
| `--extract-computed` | false | Extract computed styles |
| `--aggressive-filter` | false | Two-pass CSS dead code removal |

## Script Reference

| Script | Purpose |
|--------|---------|
| src/utils.js | Shared utilities, browser management, constants, progress reporting |
| src/capture.js | Screenshot pipeline + HTML/CSS extraction + hover + breakpoints |
| src/filter-css.js | CSS filtering + dead code removal + chunked processing |
| src/extract-assets.js | Download images, fonts, icons with rate limiting |
| src/clone-site.js | Multi-page clone with route discovery + CSS merge + link rewriting |

## References

- [Basic Clone](docs/basic-clone.md) - Step-by-step basic workflow
- [Pixel Perfect](docs/pixel-perfect.md) - Full pixel-perfect workflow
- [CLI Reference](docs/cli-reference.md) - All script options
- [Troubleshooting](docs/troubleshooting.md) - Common issues and fixes
