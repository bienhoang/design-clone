# Pixel-Perfect Clone Workflow

## Overview

Full extraction pipeline: screenshots with hover states, asset extraction, AI structure analysis, and design token extraction via Claude Code vision.

## Prerequisites

- Node.js 18+
- Playwright browsers (auto-installed)

## Complete Pipeline

### 1. Capture + Extract (with Hover, Breakpoints, Computed Styles)

```bash
node src/capture.js \
  --url "URL" \
  --output ./output \
  --extract-html true --extract-css true \
  --capture-hover true \
  --full-page true \
  --detect-breakpoints true \
  --extract-computed true \
  --aggressive-filter true
```

Single-session capture: multi-viewport screenshots + HTML/CSS + hover state captures. Handles cookie banners, lazy loading, and page readiness automatically.

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css, hover-states/, hover.css, breakpoints.json, computed-gap.css

### 2. Extract Assets

```bash
node src/extract-assets.js \
  --url "URL" \
  --output ./output
```

Downloads images, fonts, icons with rate-limited batch downloads. Inline SVGs saved automatically.

**Output:** assets/images/, assets/fonts/, assets/icons/, assets/url-mapping.json

### 3. AI Structure Analysis (Claude Code Vision)

Read screenshots and source code, then analyze layout structure:

1. Read desktop.png, tablet.png, mobile.png
2. Read source.html and source.css
3. If breakpoints.json exists, include responsive breakpoint data
4. If hover.css exists, include hover CSS
5. Write result to output/structure.md

Prompt selection (4 tiers based on available data):
- `src/ai/prompts/structure-analysis/with-hierarchy.md` — Best: has DOM hierarchy + dimensions
- `src/ai/prompts/structure-analysis/with-dimensions.md` — Good: has dimension data
- `src/ai/prompts/structure-analysis/with-context.md` — OK: has HTML/CSS source
- `src/ai/prompts/structure-analysis/basic.md` — Minimal: screenshot only

**Output:** structure.md

### 4. Design Token Extraction (Claude Code Vision)

Extract colors, typography, spacing from source CSS and screenshots:

- If source.css exists: use `src/ai/prompts/design-tokens/with-css.md` + first 15KB of CSS
- Else: use `src/ai/prompts/design-tokens/basic.md`

**Output:** design-tokens.json, tokens.css (CSS custom properties)

### 5. Build the Clone

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

## Capture Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--extract-html` | false | Extract page HTML |
| `--extract-css` | false | Extract + filter CSS |
| `--capture-hover` | false | Capture hover state screenshots |
| `--full-page` | false | Full-page screenshots |
| `--detect-breakpoints` | false | Auto-detect CSS breakpoints |
| `--extract-computed` | false | Extract JS-applied computed styles |
| `--aggressive-filter` | false | Two-pass CSS dead code removal |
