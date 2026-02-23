---
description: Clone single page design with screenshots, HTML/CSS extraction, and quality check
argument-hint: [url]
---

Clone the design of this single page with Font Awesome icons and Unsplash images:
<url>$ARGUMENTS</url>

## Required Skills (Priority Order)
1. **`chrome-devtools`** - Multi-viewport screenshot capture
2. **`ui-ux-pro-max`** - Quality validation (accessibility, hover states, contrast)

## Pipeline Overview

```
URL -> Screenshots + HTML/CSS -> CSS Filtering -> Quality Check -> Output
```

## Workflow

### STEP 1: Capture Screenshots + HTML/CSS

```bash
node ~/.claude/skills/design-clone/src/core/capture/screenshot.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html \
  --extract-css
```

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css

### STEP 2: Filter Unused CSS

```bash
node ~/.claude/skills/design-clone/src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

### STEP 3: Quality Check with ui-ux-pro-max (REQUIRED)

```bash
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "accessibility" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "animation hover" --domain ux
```

### STEP 4: Review Output

After capture:

1. **Check screenshots** - Review desktop.png, tablet.png, mobile.png
2. **Read source HTML/CSS** - Read output/source.html and output/source.css
3. **Build clone** - Use screenshots + extracted code as reference to build the clone

## Key Features

- Multi-viewport screenshots (desktop, tablet, mobile)
- HTML + CSS extraction from live page
- CSS filtering (removes unused rules)
- Font Awesome 6 CDN icons (no inline SVG)
- Direct Unsplash image URLs (no API key)
- Japanese design principles (Ma, Kanso, Shibui, Seijaku)
- Mobile-first responsive CSS
- **ui-ux-pro-max quality validation**

## Output Structure

```
output/
├── desktop.png        # Desktop screenshot (1440px)
├── tablet.png         # Tablet screenshot (768px)
├── mobile.png         # Mobile screenshot (375px)
├── source.html        # Extracted HTML
├── source-raw.css     # Raw extracted CSS
└── source.css         # Filtered CSS (unused rules removed)
```

## Examples

```bash
# Clone a single page
/design:clone https://example.com

# Clone a specific page
/design:clone https://example.com/about
```
