# Basic Clone Workflow

## Overview

Quick single-page design extraction: multi-viewport screenshots + HTML/CSS with unused rule filtering.

## Prerequisites

- Node.js 18+
- Playwright browsers (auto-installed with `npm install`)

## Step-by-Step

### 1. Capture Screenshots + HTML/CSS

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --extract-html \
  --extract-css
```

Captures desktop (1440px), tablet (768px), mobile (375px) screenshots and extracts source HTML/CSS.

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, animations.css, animation-tokens.json

### 2. Filter Unused CSS

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

Parses HTML to find used selectors, removes unused CSS rules. Typically 40-60% size reduction.

**Output:** source.css (filtered)

### 3. Optional: Dimension Extraction

When: Complex layouts where AI needs explicit dimension data for structure analysis.

```bash
node src/core/dimension/dimension-extractor.js \
  --url "https://example.com" \
  --html ./output/source.html \
  --output ./output
```

**Output:** dimensions-summary.json (AI-friendly summary), dom-hierarchy.json (full DOM tree with dimensions)

### 4. Optional: Content Counting

When: Understand content volume (headings, paragraphs, images, links) before building clone.

```bash
node src/core/content/content-counter.js \
  --html ./output/source.html \
  --output ./output
```

**Output:** content-summary.md

### 5. Optional: Semantic Enhancement

When: Extracted HTML has poor semantic structure (div soup).

```bash
node src/core/html/semantic-enhancer.js \
  --html ./output/source.html \
  --output ./output/source.html
```

Rewrites generic divs to semantic elements (header, nav, main, section, footer) based on content analysis.

### 6. Quality Check

Use `ui-ux-pro-max` skill for accessibility, hover states, and contrast validation.

## Output Structure

```
output/
├── desktop.png        # Desktop screenshot (1440px)
├── tablet.png         # Tablet screenshot (768px)
├── mobile.png         # Mobile screenshot (375px)
├── source.html        # Extracted HTML (scripts removed)
├── source-raw.css     # Raw extracted CSS
├── source.css         # Filtered CSS (unused rules removed)
├── animations.css     # @keyframes definitions
└── animation-tokens.json  # Animation metadata
```

## v3.0 Flags

| Flag | Description |
|------|-------------|
| `--detect-breakpoints` | Auto-detect CSS breakpoints from media queries |
| `--extract-computed` | Extract computed styles for JS-applied CSS |
| `--aggressive-filter` | Aggressive CSS dead code removal |
| `--quality-score` | Generate quality-score.json |
| `--dry-run` | Preview without capture |

## Tips

- Use `--extract-computed` when sites apply styles via JavaScript (React, Vue, etc.)
- Use `--aggressive-filter` for sites with large CSS frameworks (Bootstrap, Tailwind)
- Run dimension extraction for complex grid/flexbox layouts to help AI understand structure
- Content counting helps AI estimate section count and content volume for accurate cloning
