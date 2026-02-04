# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-04

### Added
- **DOM Hierarchy Analysis** - Extract and analyze DOM tree structure for better AI understanding
  - `src/core/dom-tree-analyzer.js` - Hierarchical DOM structure extraction
  - Section context mapping to dimension extraction
  - DOM hierarchy integrated into screenshot pipeline
  - DOM hierarchy added to structure analysis prompts
- **Section-based Screenshot Analysis** - Detect and crop semantic sections for targeted analysis
  - `src/core/section-detector.js` - Detect semantic sections from DOM hierarchy
  - `src/core/section-cropper.js` - Crop screenshots into section images using Sharp
  - `--section-mode` flag for section-based token extraction
  - Sequential Gemini calls per section with result merging
- **UX Audit Integration** - AI-powered UX analysis via Gemini Vision
  - `src/ai/ux-audit.py` - Comprehensive UX audit with heuristic evaluation
- **Component Verification** - Automated component testing scripts
  - `src/verification/verify-components.js` - Component validation
- **WordPress Enhancement** - Improved semantic HTML extraction for WordPress sites
- **SPA Support** - Single Page Application detection and route discovery
  - `src/spa/framework-detector.js` - Detect React, Vue, Angular, Svelte frameworks
  - `src/spa/route-discoverers.js` - Discover SPA routes dynamically
  - `src/spa/app-state-snapshot.js` - Capture application state
  - SPA modules integrated into discover-pages.js

### Changed
- Landing page reorganized to `landing-page/` directory
- Logo assets moved to `assets/images/`

### Fixed
- `fix(playwright)`: Wrap page.evaluate args in single object for Playwright compatibility

## [2.0.1] - 2026-02-04

### Changed
- **Auto-install Playwright**: `design-clone init` now automatically installs Playwright and Chromium browser
- Updated validation to check Playwright instead of Puppeteer
- Updated verify command to show Playwright status
- Updated README troubleshooting for Playwright

### Fixed
- Warning message now correctly references Playwright instead of Puppeteer

## [2.0.0] - 2026-02-03

### Changed
- **BREAKING**: Migrated from Puppeteer to Playwright for browser automation
- Playwright is now a peer dependency (optional)
- All browser operations use Playwright API

### Added
- `src/utils/playwright.js` - Playwright wrapper with Chrome auto-detection
- Support for both `playwright` (bundled browsers) and `playwright-core` (system Chrome)

### Removed
- `src/utils/puppeteer.js` - Replaced by Playwright wrapper
- Direct Puppeteer dependency

## [1.2.0] - 2026-02-03

### Added
- **CSS Animation Extraction** - Extract @keyframes and transition properties from CSS
  - `animations.css` output with preserved keyframe definitions
  - `animation-tokens.json` with detailed animation metadata
  - Enabled by default with `--extract-css`
- **Hover State Capture** - Capture interactive element hover states
  - `hover-states/` directory with before/after screenshots
  - `hover.css` with generated :hover rules from style diffs
  - CSS-based and DOM-based interactive element detection
  - Enable with `--capture-hover` flag
- **Video Recording** - Record scroll preview videos (opt-in)
  - Native WebM output via Puppeteer screencast
  - Optional MP4/GIF conversion with ffmpeg
  - Configurable duration with `--video-duration`
  - Enable with `--video` flag

### New CLI Flags
- `--extract-animations` - Extract @keyframes and transitions (default: true with --extract-css)
- `--capture-hover` - Capture hover state screenshots and generate CSS
- `--video` - Record scroll preview video (increases capture time 3-5x)
- `--video-format` - Video output format: webm (default), mp4, gif
- `--video-duration` - Video recording duration in ms (default: 12000)

### New Modules
- `src/core/animation-extractor.js` - CSS animation/transition extraction via css-tree AST
- `src/core/state-capture.js` - Hover state detection and capture
- `src/core/video-capture.js` - Puppeteer screencast with optional ffmpeg conversion

### Dependencies
- Optional: `fluent-ffmpeg` and `@ffmpeg-installer/ffmpeg` for video format conversion

## [1.1.1] - 2026-02-03

### Fixed
- `design-clone init` now installs `/design:clone-site` slash command to `~/.claude/commands/`
- Updated success message to list all available slash commands

### Added
- `commands/design/clone-site.md` slash command file included in npm package

## [1.1.0] - 2026-02-03

### Added
- **clone-site command** - Clone multiple pages from a website with shared CSS
- **Filtered CSS merging** - Uses per-page filtered CSS instead of raw CSS for smaller output
- `--ai` flag for Gemini-powered design token extraction
- `cssFilesFiltered` tracking in multi-page-screenshot results
- `design-tokens.js` wrapper for Python token extraction script
- `tokens.css` injection in rewritten HTML pages
- Page discovery with automatic link crawling
- Link rewriting for local navigation between cloned pages

### Changed
- CSS links now use `../styles.css` path (pages in `pages/` subdirectory)
- Clone process now has 6 steps (added token extraction step)
- Help documentation updated with `--ai` flag

## [1.0.2] - 2026-02-03

### Fixed
- `verify.js` now checks correct file paths after project restructure (`src/core/`, `src/ai/`, `src/utils/`)
- Python installation now uses `pip3` and detects shared venv at `~/.claude/skills/.venv/`
- Skip pip install if `google-genai` already available
- Better error messages with manual installation instructions

### Changed
- Documentation paths updated: `references/` → `docs/`
- All script paths in docs updated to match new `src/` structure

## [1.0.0] - 2026-02-02

### Added
- Initial release
- Multi-viewport screenshot capture (desktop, tablet, mobile)
- HTML extraction with script removal
- CSS extraction with unused selector filtering
- Browser abstraction layer (chrome-devtools or standalone Puppeteer)
- Environment variable resolution with .env file support
- AI structure analysis via Gemini Vision API
- Design token extraction (colors, typography, spacing)
- Asset extraction (images, fonts, icons)
- Menu verification for responsive navigation
- CLI tool for easy installation (`design-clone init`)
- Cross-platform support (macOS, Linux, Windows)

### Features
- `design:clone` command for basic design capture
- `design:clone-px` command for pixel-perfect cloning
- Automatic Chrome/Chromium detection
- Fallback to bundled Puppeteer wrapper if chrome-devtools skill unavailable
- Python 3.9+ compatibility
- Node.js 18+ ESM support

### Documentation
- SKILL.md with progressive disclosure
- Reference docs for basic and pixel-perfect workflows
- CLI reference documentation
- Troubleshooting guide

## [Unreleased]

### Planned
- Figma export format
- Tailwind CSS class extraction
- Animation timeline recording
