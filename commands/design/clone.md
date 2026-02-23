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
URL -> Screenshots + HTML/CSS (+ Breakpoints) -> CSS Filtering (+ Dead Code) -> [Optional Steps] -> Quality Check -> Output
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

**Enhanced capture (optional):**

```bash
node ~/.claude/skills/design-clone/src/core/capture/screenshot.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html --extract-css \
  --detect-breakpoints \
  --aggressive-filter
```

When: Site has complex responsive layouts or heavy CSS (>2MB).

**Additional output:** breakpoints.json, source.css (with dead code removed)

### STEP 2: Filter Unused CSS

```bash
node ~/.claude/skills/design-clone/src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

> **Skip if** `--aggressive-filter` was used in Step 1 — it runs both basic filtering AND dead code removal (unused @media, @keyframes, CSS vars). For CSS files >5MB, chunked processing activates automatically.

### STEP 3 (OPTIONAL): Dimension Extraction

When: Complex layouts where AI needs explicit dimension data.

```bash
node ~/.claude/skills/design-clone/src/core/dimension/dimension-extractor.js \
  --url "$ARGUMENTS" \
  --html ./output/source.html \
  --output ./output
```

**Output:** dimensions-summary.json, dom-hierarchy.json

### STEP 4 (OPTIONAL): Content Counting

When: Understand content volume before building clone.

```bash
node ~/.claude/skills/design-clone/src/core/content/content-counter.js \
  --html ./output/source.html \
  --output ./output
```

**Output:** content-summary.md

### STEP 5 (OPTIONAL): Semantic Enhancement

When: Extracted HTML needs better semantic structure.

```bash
node ~/.claude/skills/design-clone/src/core/html/semantic-enhancer.js \
  --html ./output/source.html \
  --output ./output/source.html
```

### STEP 6: Review Output

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
- Japanese design principles (Ma, Kanso, Shibui, Seijaku)
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
