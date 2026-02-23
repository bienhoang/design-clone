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
URL -> Page Prep -> Capture (+ Hover + Computed + Breakpoints) -> CSS Filter (+ Dead Code) -> Animations -> Section/Framework -> Dimensions -> Assets (+ Validation) -> AI Analysis -> Tokens (Global + Section) -> Verify -> UX Audit -> Quality Score -> Build
```

## Workflow

### STEP 1: Page Preparation

```bash
node ~/.claude/skills/design-clone/src/core/page-prep/page-readiness.js \
  --url "$ARGUMENTS"
```

Handles cookie banners, triggers lazy loading, ensures page fully loaded.

### STEP 2: Capture + Extract (with Hover, Breakpoints, Computed Styles)

```bash
node ~/.claude/skills/design-clone/src/core/capture/screenshot.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html --extract-css \
  --capture-hover true \
  --full-page \
  --detect-breakpoints \
  --extract-computed \
  --aggressive-filter
```

> **v3.0 flags:** `--detect-breakpoints` detects responsive breakpoints from CSS media queries. `--extract-computed` captures JS-applied styles. `--aggressive-filter` runs two-pass CSS dead code removal (unused @media, @keyframes, CSS vars), making a standalone filter-css step unnecessary. Animation extraction is on by default (`--extract-animations` defaults to true).

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css, hover-states/, hover.css, breakpoints.json, computed-gap.css, animations.css, animation-tokens.json

### STEP 3: Section Detection

```bash
node ~/.claude/skills/design-clone/src/core/section/section-detector.js \
  --html ./output/source.html \
  --screenshots ./output \
  --output ./output
```

**Output:** sections.json, section crop images

### STEP 4: Framework Detection

```bash
node ~/.claude/skills/design-clone/src/core/detection/framework-detector.js \
  --url "$ARGUMENTS" \
  --output ./output
```

**Output:** framework-info.json (framework name, version, routing type)

### STEP 5: Dimension Extraction

```bash
node ~/.claude/skills/design-clone/src/core/dimension/dimension-extractor.js \
  --url "$ARGUMENTS" \
  --html ./output/source.html \
  --output ./output
```

**Output:** dimensions-summary.json, dom-hierarchy.json

### STEP 6: Content Counting

```bash
node ~/.claude/skills/design-clone/src/core/content/content-counter.js \
  --html ./output/source.html \
  --output ./output
```

**Output:** content-summary.md

### STEP 7: Semantic Enhancement

```bash
node ~/.claude/skills/design-clone/src/core/html/semantic-enhancer.js \
  --html ./output/source.html \
  --output ./output/source.html
```

### STEP 8: Extract Assets (Images, Fonts, Icons)

```bash
node ~/.claude/skills/design-clone/src/core/media/extract-assets.js \
  --url "$ARGUMENTS" \
  --output ./output
```

> Asset integrity validation runs automatically (v3.0). Magic byte verification for images, SVG sanitization for icons. Warnings logged for corrupt/malicious files.

### STEP 9: AI Structure Analysis (Claude Code Vision)

Select prompt based on available context (highest accuracy first):

- **If** `dom-hierarchy.json` AND `dimensions-summary.json` exist:
  - Read `~/.claude/skills/design-clone/src/ai/prompts/structure-analysis/with-hierarchy.md`
  - Read `output/dom-hierarchy.json` and `output/dimensions-summary.json`
- **Else if** `dimensions-summary.json` exists:
  - Read `~/.claude/skills/design-clone/src/ai/prompts/structure-analysis/with-dimensions.md`
- **Else if** `source.html` AND `source.css` exist:
  - Read `~/.claude/skills/design-clone/src/ai/prompts/structure-analysis/with-context.md`
- **Else:** Read `~/.claude/skills/design-clone/src/ai/prompts/structure-analysis/basic.md`

Then: Read `output/desktop.png`. If `content-summary.md` exists, read it too.
If `breakpoints.json` exists, include responsive breakpoint data in prompt context.
If `animation-tokens.json` exists, include animation data in prompt context.
Write result to `output/structure.md`.

### STEP 10: Extract Design Tokens — Global (Claude Code Vision)

- **If** `source.css` exists: Read `~/.claude/skills/design-clone/src/ai/prompts/design-tokens/with-css.md` + `output/source.css` (first 15KB)
- **Else:** Read `~/.claude/skills/design-clone/src/ai/prompts/design-tokens/basic.md`

Read all viewport screenshots. Write JSON to `output/design-tokens.json`, CSS to `output/tokens.css`.

### STEP 11: Extract Design Tokens — Per-Section (Claude Code Vision)

For each section in `output/sections.json`:
- **If** `source.css` exists: Read `~/.claude/skills/design-clone/src/ai/prompts/design-tokens/section-with-css.md`
- **Else:** Read `~/.claude/skills/design-clone/src/ai/prompts/design-tokens/section.md`

Read section crop image + section HTML context.
Write per-section tokens to `output/section-tokens/{section-name}.json`.

### STEP 12: Verification Suite

```bash
# Menu
node ~/.claude/skills/design-clone/src/verification/verify-menu.js \
  --html ./output/source.html

# Header
node ~/.claude/skills/design-clone/src/verification/verify-header.js \
  --html ./output/source.html

# Footer
node ~/.claude/skills/design-clone/src/verification/verify-footer.js \
  --html ./output/source.html

# Layout
node ~/.claude/skills/design-clone/src/verification/verify-layout.js \
  --html ./output/source.html --css ./output/source.css

# Slider (if detected)
node ~/.claude/skills/design-clone/src/verification/verify-slider.js \
  --html ./output/source.html
```

### STEP 13: Audit Report

```bash
node ~/.claude/skills/design-clone/src/verification/generate-audit-report.js \
  --output ./output
```

**Output:** audit-report.md

### STEP 14: Quality Scoring

```bash
node ~/.claude/skills/design-clone/src/verification/quality-scorer.js \
  --output ./output
```

**Output:** quality-score.json

### STEP 15: UX Audit (Per-Viewport)

Read `~/.claude/skills/design-clone/src/ai/prompts/ux-audit/desktop.md` + view `output/desktop.png`
Read `~/.claude/skills/design-clone/src/ai/prompts/ux-audit/tablet.md` + view `output/tablet.png`
Read `~/.claude/skills/design-clone/src/ai/prompts/ux-audit/mobile.md` + view `output/mobile.png`
Read `~/.claude/skills/design-clone/src/ai/prompts/ux-audit/aggregation.md`

Aggregate per-viewport findings. Write result to `output/ux-audit.md`.

### STEP 16: Build the Clone

Read structure.md, design-tokens.json, section-tokens/, source.html, source.css, hover.css, animations.css, breakpoints.json, computed-gap.css, ux-audit.md, and screenshots. Build production HTML/CSS matching the original.

## Output Structure

```
output/
├── desktop.png, tablet.png, mobile.png  # Viewport screenshots
├── source.html, source-raw.css, source.css
├── hover-states/, hover.css
├── breakpoints.json                     # Detected responsive breakpoints
├── computed-gap.css                     # JS-applied computed styles
├── animations.css                       # Extracted @keyframes definitions
├── animation-tokens.json                # Animation timing/easing data
├── sections.json, framework-info.json, dimensions-summary.json
├── content-summary.md
├── structure.md, design-tokens.json, tokens.css
├── section-tokens/                      # Per-section design tokens
│   ├── header.json
│   ├── hero.json
│   └── ...
├── ux-audit.md                          # Per-viewport UX audit results
├── assets/
├── audit-report.md, quality-score.json
```
