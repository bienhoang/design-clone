# CLI Reference

## Main Commands

### design-clone init [--force]

Install skill to `~/.claude/skills/design-clone`. Use `--force` to overwrite existing installation.

### design-clone verify

Check installation status: Node.js version, Playwright browsers, skill files.

### design-clone update [--force]

Update to latest version from npm. `--force` skips version check.

### design-clone uninstall [--yes]

Remove skill installation. `--yes` skips confirmation.

### design-clone help

Show usage help with all available commands.

### design-clone --version

Show installed version.

## Slash Commands (Claude Code)

| Command | Description |
|---------|-------------|
| `/design:clone <url>` | Basic single-page clone |
| `/design:clone-px <url>` | Pixel-perfect clone with full extraction |
| `/design:clone-site <url>` | Multi-page clone with shared CSS |

## Core Scripts

### Capture

| Script | Location | Flags |
|--------|----------|-------|
| screenshot.js | src/core/capture/ | `--url`, `--output`, `--extract-html`, `--extract-css`, `--capture-hover`, `--full-page`, `--video`, `--video-format`, `--video-duration`, `--detect-breakpoints`, `--extract-computed` |
| multi-page-screenshot.js | src/core/capture/ | `--url`, `--output`, `--pages`, `--viewports` |
| browser-context-pool.js | src/core/capture/ | Internal module (parallel context management) |

### CSS

| Script | Location | Flags |
|--------|----------|-------|
| filter-css.js | src/core/css/ | `--html`, `--css`, `--output`, `--aggressive-filter` |
| merge-css.js | src/core/css/ | `--input`, `--output` (multiple CSS files) |
| breakpoint-detector.js | src/core/css/ | `--css`, `--output` |
| computed-style-extractor.js | src/core/css/ | `--url`, `--output` |
| css-chunker.js | src/core/css/ | Internal module (streaming large files) |

### HTML

| Script | Location | Flags |
|--------|----------|-------|
| html-extractor.js | src/core/html/ | `--url`, `--output` |
| semantic-enhancer.js | src/core/html/ | `--html`, `--output` |

### Media

| Script | Location | Flags |
|--------|----------|-------|
| extract-assets.js | src/core/media/ | `--url`, `--output` |
| video-capture.js | src/core/media/ | `--url`, `--output`, `--format`, `--duration` |
| asset-validator.js | src/core/media/ | Internal module (magic byte validation) |

### Analysis

| Script | Location | Flags |
|--------|----------|-------|
| dimension-extractor.js | src/core/dimension/ | `--url`, `--html`, `--output` |
| section-detector.js | src/core/section/ | `--html`, `--screenshots`, `--output` |
| content-counter.js | src/core/content/ | `--html`, `--output` |
| framework-detector.js | src/core/detection/ | `--url`, `--output` |
| page-readiness.js | src/core/page-prep/ | `--url` |

### Discovery

| Script | Location | Flags |
|--------|----------|-------|
| discover-pages.js | src/core/discovery/ | `--url`, `--max-pages`, `--output` |
| rewrite-links.js | src/core/links/ | `--html`, `--base-url`, `--output` |

### Animation

| Script | Location | Flags |
|--------|----------|-------|
| animation-extractor.js | src/core/animation/ | `--css`, `--output` |
| state-capture.js | src/core/animation/ | `--url`, `--output` |

### Verification

| Script | Location | Flags |
|--------|----------|-------|
| verify-menu.js | src/verification/ | `--html` |
| verify-header.js | src/verification/ | `--html` |
| verify-footer.js | src/verification/ | `--html` |
| verify-layout.js | src/verification/ | `--html`, `--css` |
| verify-slider.js | src/verification/ | `--html` |
| generate-audit-report.js | src/verification/ | `--output` |
| quality-scorer.js | src/verification/ | `--output` |

### Post-Processing

| Script | Location | Flags |
|--------|----------|-------|
| enhance-assets.js | src/post-process/ | `--input`, `--output` |
| fetch-images.js | src/post-process/ | `--html`, `--output` |
| inject-icons.js | src/post-process/ | `--html`, `--output` |
| inject-gosnap.js | src/post-process/ | `--html`, `--output` |

## Utilities

| Script | Location | Purpose |
|--------|----------|---------|
| playwright.js | src/utils/ | Playwright configuration |
| playwright-loader.js | src/utils/ | Browser instance loader |
| browser.js | src/utils/ | Browser detection (Chrome path) |
| env.js | src/utils/ | Environment variable loader |
| helpers.js | src/utils/ | Shared utility functions |
| log.js | src/utils/ | Logging utility |
| progress.js | src/utils/ | TTY-aware progress reporter |

## Shared Modules

| Module | Location | Purpose |
|--------|----------|---------|
| config.js | src/shared/ | Global configuration |
| error-codes.js | src/shared/ | Structured error catalog with suggestions |
| viewports.js | src/shared/ | Viewport definitions (desktop, tablet, mobile) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHROME_PATH` | No | Custom Chrome/Chromium path |
| `GEMINI_API_KEY` | No | For AI token extraction with `--ai` flag |
| `PLAYWRIGHT_BROWSERS_PATH` | No | Custom browser install path |
