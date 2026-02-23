# Pixel-Perfect Clone Workflow

## Overview

Full extraction pipeline: screenshots, hover states, assets, section/framework detection, AI analysis, verification, and quality scoring.

## Prerequisites

- Node.js 18+
- Playwright browsers (auto-installed)

## Complete Pipeline

### 1. Page Preparation

```bash
node src/core/page-prep/page-readiness.js --url "URL"
```

Handles cookie banners (`cookie-handler.js`), triggers lazy loading (`lazy-loader.js`), waits for full page render.

### 2. Capture + Extract

```bash
node src/core/capture/screenshot.js \
  --url "URL" --output ./output \
  --extract-html --extract-css --capture-hover true --full-page
```

Multi-viewport screenshots + HTML/CSS + hover state captures. Uses `browser-context-pool.js` for parallel contexts with memory guards.

### 3. CSS Processing

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html --css ./output/source-raw.css --output ./output/source.css
```

Pipeline: `filter-css-html-analyzer.js` parses HTML selectors, `filter-css-selector-matcher.js` matches against CSS, `filter-css-dead-code.js` removes unreachable rules.

### 4. Section Detection

```bash
node src/core/section/section-detector.js \
  --html ./output/source.html --screenshots ./output --output ./output
```

Detects page sections (hero, features, pricing, footer) using `section-detector-strategies.js`. Crops screenshots per section via `section-cropper.js`.

**Output:** sections.json, section crop images

### 5. Framework Detection

```bash
node src/core/detection/framework-detector.js --url "URL" --output ./output
```

Detects frontend framework (React, Vue, Angular, Svelte, Next.js, etc.) via `framework-detector-signals.js`. Identifies routing type for SPA handling via `framework-detector-routing.js`.

**Output:** framework-info.json

### 6. Dimension Extraction

```bash
node src/core/dimension/dimension-extractor.js \
  --url "URL" --html ./output/source.html --output ./output
```

Analyzes DOM structure. `dom-tree-analyzer.js` builds hierarchy, `dimension-extractor-card-detector.js` finds repeated card patterns, `dimension-output-ai-summary.js` generates AI-friendly summary.

**Output:** dimensions-summary.json, dom-hierarchy.json

### 7. Content Counting

```bash
node src/core/content/content-counter.js --html ./output/source.html --output ./output
```

Counts headings, paragraphs, images, links, forms. `content-counter-dom.js` handles DOM traversal.

**Output:** content-summary.md

### 8. Semantic Enhancement

```bash
node src/core/html/semantic-enhancer.js --html ./output/source.html --output ./output/source.html
```

Upgrades div soup to semantic HTML5. Uses `semantic-enhancer-mappings.js` for element mapping rules, `semantic-enhancer-page.js` for page-level structure.

### 9. Asset Extraction

```bash
node src/core/media/extract-assets.js --url "URL" --output ./output
```

Downloads images, fonts, icons. `extract-assets-page-scraper.js` discovers assets, `extract-assets-downloader.js` handles download with retry. `asset-validator.js` validates with magic byte verification and SVG sanitization.

### 10. AI Structure Analysis

Claude Code vision analyzes screenshots. Prompt selection (4 tiers):
1. `with-hierarchy.md` - Best: has DOM hierarchy + dimensions
2. `with-dimensions.md` - Good: has dimension data
3. `with-context.md` - OK: has HTML/CSS source
4. `basic.md` - Minimal: screenshot only

**Output:** structure.md

### 11. Design Token Extraction

Claude Code vision extracts colors, typography, spacing. Prompts: `with-css.md` (if CSS available) or `basic.md`.

**Output:** design-tokens.json, tokens.css (CSS custom properties)

### 12. Verification Suite

| Verifier | Script | Checks |
|----------|--------|--------|
| Menu | verify-menu.js | Navigation links, mobile hamburger, dropdowns |
| Header | verify-header.js | Logo, nav, CTA, sticky behavior |
| Footer | verify-footer.js | Links, social icons, copyright |
| Layout | verify-layout.js | Grid/flex structure, overflow, z-index |
| Slider | verify-slider.js | Carousel controls, autoplay, indicators |

Each verifier has `-checks.js` (test logic) and `-helpers.js` (DOM utilities) modules.

### 13. Audit Report

```bash
node src/verification/generate-audit-report.js --output ./output
```

Consolidates all verification results. Uses `generate-audit-report-sections.js` for section analysis and `generate-audit-report-css-fixes.js` for CSS fix suggestions.

**Output:** audit-report.md

### 14. Quality Scoring

```bash
node src/verification/quality-scorer.js --output ./output
```

5-metric scoring: structural fidelity, CSS coverage, asset completeness, responsive behavior, accessibility. Weighted composite score 0-100.

**Output:** quality-score.json

## v3.0 Enhancements

- `breakpoint-detector.js` - Auto-detect responsive breakpoints from media queries
- `computed-style-extractor.js` - Extract JS-applied computed styles
- `css-chunker.js` - Stream-process CSS files >50MB
- `browser-context-pool.js` - Parallel browser contexts with memory guards
- `error-codes.js` - Structured error catalog with actionable suggestions
- `progress.js` - TTY-aware progress reporting
