# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Video/animation capture support
- Interactive element detection
- Figma export format
- Tailwind CSS class extraction
