---
description: Clone single page design with screenshots, HTML/CSS extraction, and quality check
argument-hint: [url]
---

Clone the design of this single page with Font Awesome icons and Unsplash images:
<url>$ARGUMENTS</url>

## Required Skills (Priority Order)
1. **`chrome-devtools`** - Multi-viewport screenshot capture

## Pipeline Overview

```
URL -> Screenshots + HTML/CSS -> CSS Filtering -> Review + Build
```

## Workflow

### STEP 1: Capture Screenshots + HTML/CSS

```bash
node ~/.claude/skills/design-clone/src/capture.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html true \
  --extract-css true
```

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css

**Enhanced capture (optional):**

```bash
node ~/.claude/skills/design-clone/src/capture.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html true --extract-css true \
  --detect-breakpoints true \
  --aggressive-filter true
```

When: Site has complex responsive layouts or heavy CSS (>2MB).

**Additional output:** breakpoints.json, computed-styles.json

### STEP 2: Filter Unused CSS (standalone)

```bash
node ~/.claude/skills/design-clone/src/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

> **Skip if** capture Step 1 already ran with `--extract-css true` — CSS filtering runs automatically during capture. Use this step only for re-filtering with different options.

### STEP 3: Review Output + Build

After capture:

1. **Check screenshots** - Review desktop.png, tablet.png, mobile.png
2. **Read source HTML/CSS** - Read output/source.html and output/source.css
3. **Build clone** - Use screenshots + extracted code as reference to build the clone

## Key Features

- Multi-viewport screenshots (desktop, tablet, mobile)
- HTML + CSS extraction from live page
- CSS filtering (removes unused rules)
- Responsive breakpoint detection (optional, via `--detect-breakpoints`)
- Two-pass CSS dead code removal (optional, via `--aggressive-filter`)
- Large CSS streaming (automatic for files >5MB)
- Font Awesome 6 CDN icons (no inline SVG)
- Direct Unsplash image URLs (no API key)
- Mobile-first responsive CSS

## Output Structure

```
output/
├── desktop.png        # Desktop screenshot (1440px)
├── tablet.png         # Tablet screenshot (768px)
├── mobile.png         # Mobile screenshot (375px)
├── source.html        # Extracted HTML
├── source-raw.css     # Raw extracted CSS
├── source.css         # Filtered CSS (unused rules removed)
├── breakpoints.json   # (optional) Detected responsive breakpoints
```

## Examples

```bash
# Clone a single page
/design:clone https://example.com

# Clone a specific page
/design:clone https://example.com/about
```
