---
description: Pixel-perfect clone with full asset extraction, hover states, and AI structure analysis
argument-hint: [url]
---

Create a pixel-perfect clone of this page with full asset extraction and AI analysis:
<url>$ARGUMENTS</url>

## Required Skills (Priority Order)
1. **`chrome-devtools`** - Multi-viewport screenshot + hover capture

## Pipeline Overview

```
URL -> Capture (screenshots + HTML/CSS + hover + breakpoints) -> Extract Assets -> AI Analysis -> Build
```

## Workflow

### STEP 1: Capture + Extract (with Hover, Breakpoints, Computed Styles)

```bash
node ~/.claude/skills/design-clone/src/capture.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html true --extract-css true \
  --capture-hover true \
  --full-page true \
  --detect-breakpoints true \
  --extract-computed true \
  --aggressive-filter true
```

> `--aggressive-filter` runs two-pass CSS dead code removal (unused @media, @keyframes, CSS vars), making standalone filter-css unnecessary. `--detect-breakpoints` detects responsive breakpoints from CSS media queries. `--extract-computed` captures JS-applied styles.

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css, hover-states/, hover.css, breakpoints.json, computed-gap.css

### STEP 2: Extract Assets (Images, Fonts, Icons)

```bash
node ~/.claude/skills/design-clone/src/extract-assets.js \
  --url "$ARGUMENTS" \
  --output ./output
```

**Output:** assets/images/, assets/fonts/, assets/icons/, assets/url-mapping.json

### STEP 3: AI Structure Analysis (Claude Code Vision)

1. **Read screenshots** - View desktop.png, tablet.png, mobile.png
2. **Read source code** - Read output/source.html and output/source.css
3. **Read breakpoints** - If breakpoints.json exists, include responsive data
4. **Read hover states** - If hover.css exists, include hover CSS
5. **Write structure.md** - Document layout structure, sections, component hierarchy

### STEP 4: Extract Design Tokens (Claude Code Vision)

1. **Read source.css** (first 15KB) + all viewport screenshots
2. **Extract tokens** - Colors, typography, spacing, shadows, borders
3. **Write** design-tokens.json and tokens.css

### STEP 5: Build the Clone

Read structure.md, design-tokens.json, source.html, source.css, hover.css, breakpoints.json, computed-gap.css, and screenshots. Build production HTML/CSS matching the original.

## Output Structure

```
output/
├── desktop.png, tablet.png, mobile.png  # Viewport screenshots
├── source.html, source-raw.css, source.css
├── hover-states/, hover.css
├── breakpoints.json                     # Detected responsive breakpoints
├── computed-gap.css                     # JS-applied computed styles
├── structure.md                         # AI-generated layout analysis
├── design-tokens.json, tokens.css       # Extracted design tokens
├── assets/
│   ├── images/
│   ├── fonts/
│   ├── icons/
│   └── url-mapping.json
```

## Examples

```bash
# Pixel-perfect clone
/design:clone-px https://example.com

# Clone a specific page
/design:clone-px https://example.com/pricing
```
