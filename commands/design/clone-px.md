---
description: Pixel-perfect clone with full asset extraction, hover states, and AI structure analysis
argument-hint: [url]
---

Create a pixel-perfect clone of this page with full asset extraction and AI analysis:
<url>$ARGUMENTS</url>

## Required Skills (Priority Order)
1. **`chrome-devtools`** - Multi-viewport screenshot + hover capture
2. **`ui-ux-pro-max`** - Quality validation (accessibility, hover states, z-index, contrast)

## Pipeline Overview

```
URL -> Page Prep -> Capture + Hover -> CSS Filter -> Section/Framework Detection -> Dimensions -> Assets -> AI Analysis -> Tokens -> Verify Suite -> Quality Score -> Output
```

## Workflow

### STEP 1: Page Preparation

```bash
node ~/.claude/skills/design-clone/src/core/page-prep/page-readiness.js \
  --url "$ARGUMENTS"
```

Handles cookie banners, triggers lazy loading, ensures page fully loaded.

### STEP 2: Capture + Extract (with Hover States)

```bash
node ~/.claude/skills/design-clone/src/core/capture/screenshot.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html --extract-css \
  --capture-hover true \
  --full-page
```

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, hover-states/, hover.css

### STEP 3: Filter CSS

```bash
node ~/.claude/skills/design-clone/src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

### STEP 4: Section Detection

```bash
node ~/.claude/skills/design-clone/src/core/section/section-detector.js \
  --html ./output/source.html \
  --screenshots ./output \
  --output ./output
```

**Output:** sections.json, section crop images

### STEP 5: Framework Detection

```bash
node ~/.claude/skills/design-clone/src/core/detection/framework-detector.js \
  --url "$ARGUMENTS" \
  --output ./output
```

**Output:** framework-info.json (framework name, version, routing type)

### STEP 6: Dimension Extraction

```bash
node ~/.claude/skills/design-clone/src/core/dimension/dimension-extractor.js \
  --url "$ARGUMENTS" \
  --html ./output/source.html \
  --output ./output
```

**Output:** dimensions-summary.json, dom-hierarchy.json

### STEP 7: Content Counting

```bash
node ~/.claude/skills/design-clone/src/core/content/content-counter.js \
  --html ./output/source.html \
  --output ./output
```

**Output:** content-summary.md

### STEP 8: Semantic Enhancement

```bash
node ~/.claude/skills/design-clone/src/core/html/semantic-enhancer.js \
  --html ./output/source.html \
  --output ./output/source.html
```

### STEP 9: Extract Assets (Images, Fonts, Icons)

```bash
node ~/.claude/skills/design-clone/src/core/media/extract-assets.js \
  --url "$ARGUMENTS" \
  --output ./output
```

### STEP 10: AI Structure Analysis (Claude Code Vision)

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
Write result to `output/structure.md`.

### STEP 11: Extract Design Tokens (Claude Code Vision)

- **If** `source.css` exists: Read `~/.claude/skills/design-clone/src/ai/prompts/design-tokens/with-css.md` + `output/source.css` (first 15KB)
- **Else:** Read `~/.claude/skills/design-clone/src/ai/prompts/design-tokens/basic.md`

Read all viewport screenshots. Write JSON to `output/design-tokens.json`, CSS to `output/tokens.css`.

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

### STEP 15: Quality Check with ui-ux-pro-max (REQUIRED)

```bash
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "accessibility" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "animation hover" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "z-index" --domain ux
```

### STEP 16: Build the Clone

Read structure.md, design-tokens.json, source.html, source.css, hover.css, and screenshots. Build production HTML/CSS matching the original.

## Output Structure

```
output/
├── desktop.png, tablet.png, mobile.png  # Viewport screenshots
├── source.html, source-raw.css, source.css, hover-states/, hover.css
├── assets/, structure.md, design-tokens.json, tokens.css
├── sections.json, framework-info.json, dimensions-summary.json
├── content-summary.md, audit-report.md, quality-score.json
```
