# Design Clone Codebase Summary

**Version:** 4.0.0 (Architecture Simplification)
**Last Updated:** March 13, 2026

## Overview

Design Clone is a website design extraction tool for Claude Code. It captures multi-viewport screenshots, extracts HTML/CSS, and provides AI-powered design analysis via Claude Code vision.

**v4.0 Achievement:** Consolidated ~110 files (14,500 lines) into 5 core files (~1,500 lines) — 90% reduction in codebase size. Claude Code vision replaces all verification/analysis modules.

## Key Capabilities

| Feature | Description |
|---------|-------------|
| Multi-viewport screenshots | Desktop (1440px), tablet (768px), mobile (375px) |
| HTML/CSS extraction | Clean source with unused CSS removal |
| CSS dead code removal | Two-pass removal of unused @media/@keyframes/vars |
| Responsive breakpoint detection | Auto-detect @media queries from CSS |
| Hover state capture | Interactive element screenshots + :hover CSS |
| Computed style gap-fill | JS-applied styles via getComputedStyle() |
| Asset extraction | Images, fonts, icons with rate-limited downloads |
| Multi-page cloning | Route discovery + sequential capture + CSS merge |
| AI structure analysis | Built-in Claude Code vision |

## Architecture (5 Core Files)

```
design-clone/
├── bin/                         # CLI entry point
│   ├── cli.js                   # Main CLI router
│   ├── commands/                # CLI commands
│   │   ├── init.js              # Installation setup
│   │   ├── help.js              # Usage help
│   │   ├── update.js            # Version update
│   │   └── uninstall.js         # Skill removal
│   └── utils/                   # CLI utilities (paths.js, version.js)
├── src/
│   ├── utils.js                 # Shared utilities, browser management, constants (~230 lines)
│   ├── capture.js               # Screenshot pipeline + HTML/CSS extraction (~480 lines)
│   ├── filter-css.js            # CSS filtering + dead code removal (~250 lines)
│   ├── extract-assets.js        # Asset extraction (images, fonts, icons) (~180 lines)
│   ├── clone-site.js            # Multi-page clone + route discovery + CSS merge (~380 lines)
│   └── ai/                      # AI analysis prompt templates
│       └── prompts/
│           ├── structure-analysis/  # Layout analysis (4 variants)
│           ├── design-tokens/       # Token extraction (4 variants)
│           └── ux-audit/            # UX audit (3 viewports + aggregation)
├── templates/                   # HTML/CSS base templates
├── tests/                       # Test suite (6 suites, 54 tests)
├── docs/                        # Documentation
├── commands/design/             # Slash command definitions
│   ├── clone.md
│   ├── clone-px.md
│   └── clone-site.md
└── SKILL.md                     # Skill definition for Claude Code
```

## Core Modules

### src/utils.js — Shared Utilities (~230 lines)

Consolidated from 10 former utility/shared files.

**Exports:**
- **Constants:** VIEWPORTS, VIEWPORTS_HD, VIEWPORT_NAMES, TIMING, SIZE_LIMITS, POOL, CDN, LAYOUT, ERROR_CODES
- **Error handling:** DesignCloneError, createError
- **Logging:** isTTY, logInfo, logWarn, logError
- **CLI:** parseArgs, outputJSON, outputError
- **Progress:** ProgressReporter, createProgress
- **Env:** loadEnv, getEnv, requireEnv, getSkillDir
- **Browser:** detectChromePath, loadPlaywright, getBrowser, getPage, closeBrowser, disconnectBrowser

**Singleton browser pattern:** Single Playwright browser instance reused across all captures in a session.

### src/capture.js — Screenshot Pipeline (~480 lines)

Consolidated from ~17 capture/extraction files.

**Main export:** `capture(url, outputDir, options)`

**Features:**
- Multi-viewport screenshots (desktop, tablet, mobile)
- HTML extraction (semantic, script-stripped)
- CSS extraction with automatic filtering
- Hover state capture (screenshots + CSS generation)
- Cookie banner dismissal
- Lazy loading triggers
- Page readiness detection
- Responsive breakpoint detection
- Computed style gap-fill
- Image compression (via sharp)

**CLI flags:** `--url`, `--output`, `--extract-html`, `--extract-css`, `--capture-hover`, `--full-page`, `--detect-breakpoints`, `--extract-computed`, `--aggressive-filter`

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css, hover-states/, hover.css, breakpoints.json, computed-gap.css

### src/filter-css.js — CSS Filtering (~250 lines)

Consolidated from 5 CSS filtering files. Uses css-tree AST for precise filtering.

**Main export:** `filterCssFile(htmlPath, cssPath, outputPath, verbose, allowedDir, aggressiveFilter)`

**Features:**
- HTML analysis (tags, IDs, classes, attributes)
- CSS selector matching against HTML usage
- Dead code removal (empty @media, orphan @keyframes, unused custom properties)
- Chunked processing for large CSS (>2MB)
- Input sanitization (XSS patterns)
- Path validation (directory traversal prevention)

**CLI flags:** `--html`, `--css`, `--output`, `--verbose`, `--aggressive-filter`

### src/extract-assets.js — Asset Extraction (~180 lines)

Consolidated from 3 asset extraction files.

**Main export:** `extractAssets(url, outputDir, options)`

**Features:**
- Page scraping for images, fonts, icons, inline SVGs
- CSS URL extraction (background images, @font-face)
- Rate-limited batch downloads (10 concurrent, configurable)
- HTTP 429 exponential backoff
- Redirect following
- Safe filename generation

**CLI flags:** `--url`, `--output`, `--verbose`, `--concurrency`

**Output:** assets/images/, assets/fonts/, assets/icons/, assets/url-mapping.json

### src/clone-site.js — Multi-Page Clone (~380 lines)

Consolidated from clone-site command, universal discoverer, multi-page screenshot, CSS merge, link rewriting.

**Main export:** `cloneSite(url, options)`

**Features:**
- Universal page discovery (history interception + nav scraping + sitemap)
- Sequential per-page capture using capture.js
- CSS merge with AST-level deduplication (css-tree)
- Link rewriting (HTML internal links → local files)
- Manifest generation

**CLI flags:** `--url`, `--pages`, `--max-pages`, `--output`, `--detect-breakpoints`, `--aggressive-filter`, `--dry-run`

## Workflows

### /design:clone (Basic)
```
URL → Capture (screenshots + HTML/CSS) → [Optional CSS filter] → Review + Build
```

### /design:clone-px (Pixel-Perfect)
```
URL → Capture (+ hover + breakpoints + computed) → Extract Assets → AI Analysis → Build
```

### /design:clone-site (Multi-Page)
```
URL → Page Discovery → Sequential Capture → CSS Merge → Link Rewriting → Output
```

## Dependencies

| Package | Purpose |
|---------|---------|
| playwright | Browser automation |
| css-tree | CSS AST parsing and generation |
| sharp | Image compression |

## Testing

6 test suites, 54 tests:
- `test-env-js.js` — Environment utility functions
- `test-env-path-order.js` — .env file search path precedence
- `test-filter-css.js` — CSS filtering module structure and exports
- `test-clone-site.js` — URL normalization, domain comparison, path utilities
- `test-integration.js` — Module imports, exports, file structure validation
- `test-cli-utils.js` — CLI paths, version, install/uninstall commands

Run: `npm test` (with c8 coverage)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHROME_PATH` | No | Custom Chrome/Chromium path |
| `PLAYWRIGHT_BROWSERS_PATH` | No | Custom browser install path |
