# Basic Clone Workflow

## Overview

Quick single-page design extraction: multi-viewport screenshots + HTML/CSS with unused rule filtering.

## Prerequisites

- Node.js 18+
- Playwright browsers (auto-installed with `npm install`)

## Step-by-Step

### 1. Capture Screenshots + HTML/CSS

```bash
node src/capture.js \
  --url "https://example.com" \
  --output ./output \
  --extract-html true \
  --extract-css true
```

Captures desktop (1440px), tablet (768px), mobile (375px) screenshots and extracts source HTML/CSS. CSS filtering runs automatically during extraction.

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css

**Enhanced capture (optional):**

```bash
node src/capture.js \
  --url "https://example.com" \
  --output ./output \
  --extract-html true --extract-css true \
  --detect-breakpoints true \
  --aggressive-filter true
```

Additional output: breakpoints.json

### 2. Filter Unused CSS (Standalone)

```bash
node src/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

Skip if capture Step 1 already ran with `--extract-css true` — CSS filtering runs automatically. Use this step only for re-filtering with different options.

### 3. Review + Build

1. **Check screenshots** — Review desktop.png, tablet.png, mobile.png
2. **Read source HTML/CSS** — Read output/source.html and output/source.css
3. **Build clone** — Use screenshots + extracted code as reference

## Output Structure

```
output/
├── desktop.png        # Desktop screenshot (1440px)
├── tablet.png         # Tablet screenshot (768px)
├── mobile.png         # Mobile screenshot (375px)
├── source.html        # Extracted HTML (scripts removed)
├── source-raw.css     # Raw extracted CSS
├── source.css         # Filtered CSS (unused rules removed)
├── breakpoints.json   # (optional) Detected responsive breakpoints
```

## Capture Flags

| Flag | Description |
|------|-------------|
| `--detect-breakpoints` | Auto-detect CSS breakpoints from media queries |
| `--extract-computed` | Extract computed styles for JS-applied CSS |
| `--aggressive-filter` | Two-pass CSS dead code removal |

## Tips

- Use `--extract-computed` when sites apply styles via JavaScript (React, Vue, etc.)
- Use `--aggressive-filter` for sites with large CSS frameworks (Bootstrap, Tailwind)
