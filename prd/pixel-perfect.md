# Pixel-Perfect Clone Workflow

Full design replication with asset extraction, AI analysis, and verification.

## When to Use

- Production-ready design implementation
- Complete asset and structure extraction
- Sites with complex navigation or interactions

## Full Workflow

### Step 1: Capture + Extract

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./clone \
  --extract-html --extract-css \
  --full-page
```

### Step 2: Filter CSS

```bash
node src/core/filter-css.js \
  --html ./clone/source.html \
  --css ./clone/source-raw.css \
  --output ./clone/source.css
```

### Step 3: Extract Assets

```bash
node src/core/extract-assets.js \
  --url "https://example.com" \
  --output ./clone
```

Downloads: images, fonts, icons, SVGs to `./clone/assets/`

### Step 4: AI Structure Analysis

Requires `GEMINI_API_KEY` in environment.

```bash
python src/ai/analyze-structure.py \
  -s ./clone/desktop.png \
  -o ./clone \
  --html ./clone/source.html \
  --css ./clone/source.css
```

Output: `./clone/structure.md` with section breakdown and BEM suggestions.

### Step 5: Extract Design Tokens

```bash
python src/ai/extract-design-tokens.py \
  -s ./clone/desktop.png \
  -o ./clone
```

Output: `./clone/tokens.json` with colors, typography, spacing.

### Step 6: Component Verification

**Verify Menu**
```bash
node src/verification/verify-menu.js --html ./clone/source.html
```
Reports: missing links, broken structure, accessibility issues.

**Verify Header** (Phase 1)
```bash
node src/verification/verify-header.js --html ./clone/source.html
```
Tests: logo, navigation, CTA buttons, sticky behavior, z-index, height consistency.

**Verify Footer** (Phase 1)
```bash
node src/verification/verify-footer.js --html ./clone/source.html
```
Tests: position, layout, link sections, copyright, social icons, contrast.

**Verify Slider** (Phase 1)
```bash
node src/verification/verify-slider.js --html ./clone/source.html
```
Tests: library detection (Swiper, Slick, Owl), navigation, pagination, autoplay.

### Step 7: Generate Audit Report

```bash
node src/verification/generate-audit-report.js --dir ./clone
```

Aggregates all verification results into `component-audit.md` with summary table, side-by-side screenshots, and CSS fix suggestions.

## Output Structure

```
./clone/
├── desktop.png, tablet.png, mobile.png
├── source.html, source.css
├── structure.md              # AI analysis
├── tokens.json               # Design tokens
├── component-audit.md        # Verification report (Phase 1)
├── header-results.json       # Header verification details
├── footer-results.json       # Footer verification details
├── slider-results.json       # Slider verification details
├── menu-results.json         # Menu verification details
└── assets/
    ├── images/
    ├── fonts/
    └── icons/
```
