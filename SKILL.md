---
name: design-clone
description: Clone website designs via multi-viewport screenshots, HTML/CSS extraction, and Gemini AI analysis. Generates production HTML/CSS with Font Awesome icons, direct Unsplash images, and Japanese design principles. Commands - design:clone (basic), design:clone-px (pixel-perfect).
---

# Design Clone Skill

Clone website designs with multi-viewport screenshots, HTML/CSS extraction, CSS filtering, and Gemini AI structure analysis.

## Features

- **Font Awesome 6 Icons** - All icons use Font Awesome CDN (no inline SVG)
- **Direct Unsplash Images** - Real images without API key needed
- **Japanese Design Principles** - Ma, Kanso, Shibui, Seijaku for elegant designs
- **Multi-viewport Screenshots** - Desktop, tablet, mobile captures
- **Hover State Capture** - Interactive element screenshots and :hover CSS generation
- **Gemini Vision Analysis** - AI-powered design token extraction
- **ui-ux-pro-max Quality Check** - Accessibility, hover states, contrast validation

## Prerequisites

- Node.js 18+ with npm
- Python 3.9+ (for AI analysis)
- Chrome/Chromium browser

## Quick Setup

```bash
npm install
pip install -r requirements.txt
# Optional: Set GEMINI_API_KEY in .env for AI analysis
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
│   ├── ai/                 # AI analysis scripts
│   │   ├── analyze-structure.py
│   │   └── extract-design-tokens.py
│   ├── verification/       # Verification scripts
│   │   ├── verify-menu.js
│   │   └── verify-layout.js
│   ├── utils/              # Shared utilities
│   │   ├── browser.js
│   │   ├── puppeteer.js
│   │   ├── env.js
│   │   └── env.py
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
node src/core/screenshot.js \
  --url "URL" \
  --output ./output \
  --extract-html \
  --extract-css

# Step 2: Filter unused CSS
node src/core/filter-css.js \
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

Multi-page site cloning with shared CSS and working navigation.

```bash
/design:clone-site https://example.com
```

**Workflow:**
```bash
# Auto-discover pages from navigation
design-clone clone-site https://example.com

# Or specify pages manually
design-clone clone-site https://example.com --pages /,/about,/contact

# Options:
#   --pages <paths>     Comma-separated paths
#   --max-pages <n>     Limit pages (default: 10)
#   --viewports <list>  Viewports (default: desktop,tablet,mobile)
#   --yes               Skip confirmation
#   --output <dir>      Custom output directory
```

**Output Structure:**
```
cloned-designs/{timestamp}-{domain}/
├── analysis/           # Screenshots by viewport
│   ├── desktop/*.png
│   ├── tablet/*.png
│   └── mobile/*.png
├── pages/              # HTML with rewritten links
│   ├── index.html
│   ├── about.html
│   └── contact.html
├── styles.css          # Merged + deduplicated CSS
└── manifest.json       # Page metadata + mapping
```

**Features:**
- Auto-discovers pages from navigation (SPA-aware)
- Shared CSS with deduplication (15-30% reduction)
- Working internal links
- Progress reporting
- Graceful error handling (continues on page failures)

---

### design:clone-px

Pixel-perfect clone with full asset extraction and AI analysis.

**Full Workflow:**

```bash
# Step 1: Capture + Extract
node src/core/screenshot.js \
  --url "URL" \
  --output ./output \
  --extract-html --extract-css \
  --capture-hover true \
  --full-page

# Step 2: Filter CSS
node src/core/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css

# Step 3: Extract Assets (images, fonts, icons)
node src/core/extract-assets.js \
  --url "URL" \
  --output ./output

# Step 4: AI Structure Analysis (requires GEMINI_API_KEY)
python src/ai/analyze-structure.py \
  -s ./output/desktop.png \
  -o ./output \
  --html ./output/source.html \
  --css ./output/source.css

# Step 5: Extract Design Tokens
python src/ai/extract-design-tokens.py \
  -s ./output/desktop.png \
  -o ./output

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

## Environment Variables

Create `.env` file (see `.env.example`):

```bash
GEMINI_API_KEY=your-key    # Optional: enables AI structure analysis
```

## Script Reference

| Script | Location | Purpose |
|--------|----------|---------|
| screenshot.js | src/core/ | Capture screenshots + extract HTML/CSS |
| filter-css.js | src/core/ | Filter unused CSS rules |
| state-capture.js | src/core/ | Capture hover states for interactive elements |
| extract-assets.js | src/core/ | Download images, fonts, icons |
| discover-pages.js | src/core/ | Discover navigation links |
| multi-page-screenshot.js | src/core/ | Capture multiple pages |
| merge-css.js | src/core/ | Merge + deduplicate CSS |
| rewrite-links.js | src/core/ | Rewrite internal links |
| clone-site.js | bin/commands/ | Multi-page clone CLI |
| analyze-structure.py | src/ai/ | AI-powered structure analysis |
| extract-design-tokens.py | src/ai/ | Extract colors, typography, spacing |
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
