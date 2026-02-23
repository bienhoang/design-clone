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
URL -> Screenshots + Hover -> CSS Filter -> Assets -> AI Analysis -> Design Tokens -> Verify -> Quality Check -> Output
```

## Workflow

### STEP 1: Capture + Extract (with Hover States)

```bash
node ~/.claude/skills/design-clone/src/core/capture/screenshot.js \
  --url "$ARGUMENTS" \
  --output ./output \
  --extract-html --extract-css \
  --capture-hover true \
  --full-page
```

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, hover-states/, hover.css

### STEP 2: Filter CSS

```bash
node ~/.claude/skills/design-clone/src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

### STEP 3: Extract Assets (Images, Fonts, Icons)

```bash
node ~/.claude/skills/design-clone/src/core/media/extract-assets.js \
  --url "$ARGUMENTS" \
  --output ./output
```

### STEP 4: AI Structure Analysis (Claude Code Vision)

Select prompt based on available context (highest accuracy first):

- **If** `dom-hierarchy.json` AND `dimensions-summary.json` exist:
  - Read `src/ai/prompts/structure-analysis/with-hierarchy.md`
  - Read `output/dom-hierarchy.json` and `output/dimensions-summary.json`
- **Else if** `dimensions-summary.json` exists:
  - Read `src/ai/prompts/structure-analysis/with-dimensions.md`
  - Read `output/dimensions-summary.json`
- **Else if** `source.html` AND `source.css` exist:
  - Read `src/ai/prompts/structure-analysis/with-context.md`
  - Read `output/source.html` (first 100KB) and `output/source.css` (first 100KB)
- **Else:**
  - Read `src/ai/prompts/structure-analysis/basic.md`

Then: Read `output/desktop.png` (Claude vision analyzes the screenshot).
If `content-summary.md` exists: Read `output/content-summary.md`.
Analyze following prompt instructions. Write result to `output/structure.md`.

### STEP 5: Extract Design Tokens (Claude Code Vision)

Select prompt:
- **If** `source.css` exists:
  - Read `src/ai/prompts/design-tokens/with-css.md`
  - Read `output/source.css` (first 15KB)
- **Else:**
  - Read `src/ai/prompts/design-tokens/basic.md`

Read `output/desktop.png`, `output/tablet.png`, `output/mobile.png`.
Analyze following prompt instructions.
Write JSON result to `output/design-tokens.json`.
Generate CSS custom properties and write to `output/tokens.css`.

**Token CSS generation rules:**
- Map colors to `--color-*` variables
- Map typography to `--font-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`
- Map spacing to `--space-*` variables
- Map border-radius to `--radius-*` variables
- Map shadows to `--shadow-*` variables
- Use `:root {}` selector

### STEP 6: Verify Menu

```bash
node ~/.claude/skills/design-clone/src/verification/verify-menu.js \
  --html ./output/source.html
```

### STEP 7: Quality Check with ui-ux-pro-max (REQUIRED)

```bash
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "accessibility" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "animation hover" --domain ux
python3 $HOME/.claude/skills/ui-ux-pro-max/scripts/search.py "z-index" --domain ux
```

### STEP 8: Build the Clone

Using all extracted data:

1. **Read structure.md** - Understand layout and component hierarchy
2. **Read design-tokens.json** - Apply exact colors, typography, spacing
3. **Read source.html + source.css** - Reference for HTML structure and CSS
4. **Read hover.css** - Apply hover state interactions
5. **Check screenshots** - Visual reference for pixel-perfect accuracy
6. **Build HTML/CSS** - Produce production-ready code matching the original

## Output Structure

```
output/
├── desktop.png           # Desktop screenshot (1440px)
├── tablet.png            # Tablet screenshot (768px)
├── mobile.png            # Mobile screenshot (375px)
├── source.html           # Extracted HTML
├── source-raw.css        # Raw extracted CSS
├── source.css            # Filtered CSS
├── hover-states/         # Hover state screenshots
├── hover.css             # Generated :hover rules
├── hover-diff.json       # Style diff data
├── assets/               # Downloaded images, fonts, icons
├── structure.md          # AI structure analysis
├── design-tokens.json    # Extracted design tokens
└── tokens.css            # CSS custom properties
```

## Key Features

- **Full asset extraction** - Images, fonts, icons downloaded locally
- **Hover state capture** - Before/after screenshots + generated CSS
- **AI structure analysis** - Layout hierarchy via Claude Code vision
- **Design tokens** - Colors, typography, spacing as CSS variables
- **Menu verification** - Navigation structure validation
- **ui-ux-pro-max quality check** - Comprehensive quality validation

## Examples

```bash
# Pixel-perfect clone of a page
/design:clone-px https://example.com

# Clone a specific page
/design:clone-px https://example.com/landing
```
