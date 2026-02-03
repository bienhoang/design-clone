# Design Clone Skill for Claude Code

Clone website designs with multi-viewport screenshots, HTML/CSS extraction, and Gemini AI analysis.

[![npm](https://img.shields.io/npm/v/design-clone-skill)](https://www.npmjs.com/package/design-clone-skill)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

## Features

- **Multi-viewport screenshots**: Desktop (1920px), Tablet (768px), Mobile (375px)
- **HTML/CSS extraction**: Clean source files with unused CSS removal
- **AI structure analysis**: Gemini Vision analyzes page layout (optional)
- **Asset extraction**: Downloads images, fonts, icons
- **Menu verification**: Tests responsive navigation functionality

## Installation

### Option 1: npm (Recommended)

```bash
npm install -g design-clone-skill
design-clone init
```

### Option 2: Manual

```bash
git clone https://github.com/user/design-clone-skill.git
cp -r design-clone-skill ~/.claude/skills/design-clone
cd ~/.claude/skills/design-clone
npm install
pip install -r requirements.txt
```

### Verify Installation

```bash
design-clone verify
```

## Quick Start

In Claude Code, use:

```
/design:clone https://example.com
```

For pixel-perfect clone with full asset extraction:

```
/design:clone-px https://example.com
```

## Commands

### design:clone

Basic design capture:
- Screenshots at 3 viewports (desktop, tablet, mobile)
- HTML extraction (scripts removed, cleaned)
- CSS extraction with unused selector removal

### design:clone-px

Full pixel-perfect clone:
- All basic clone features
- Asset extraction (images, fonts, icons)
- AI structure analysis (requires GEMINI_API_KEY)
- Menu verification
- Design token extraction

## Output Structure

```
cloned-design/
├── desktop.png           # 1920x1080 screenshot
├── tablet.png            # 768x1024 screenshot
├── mobile.png            # 375x812 screenshot
├── source.html           # Cleaned HTML
├── source.css            # Filtered CSS
├── source-raw.css        # Original CSS (unfiltered)
├── structure.md          # AI analysis (if GEMINI_API_KEY set)
├── tokens.json           # Extracted design tokens
└── assets/
    ├── images/
    ├── fonts/
    └── icons/
```

## Environment Variables

```bash
# Optional: enables AI structure analysis
GEMINI_API_KEY=your-api-key

# Add to ~/.claude/.env for persistent config
```

Get your API key at: https://aistudio.google.com/apikey

## Requirements

- Node.js 18+
- Python 3.9+ (for AI analysis)
- Chrome or Chromium (auto-detected)

## CLI Commands

```bash
design-clone init [--force]   # Install skill to ~/.claude/skills/
design-clone verify           # Check installation status
design-clone help             # Show usage help
```

## Troubleshooting

### Chrome not found

```bash
# macOS
brew install --cask google-chrome

# Ubuntu
sudo apt install chromium-browser

# Or set path manually
export CHROME_PATH="/path/to/chrome"
```

### Python dependencies fail

```bash
pip install google-genai
# Or with Python 3
pip3 install -r requirements.txt
```

### Puppeteer issues

```bash
# Install Puppeteer if not present
npm install puppeteer

# For Docker/CI environments
export PUPPETEER_NO_SANDBOX=1
```

See full troubleshooting guide: [docs/troubleshooting.md](docs/troubleshooting.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

## License

MIT - See [LICENSE](LICENSE)

## Credits

Built for use with [Claude Code](https://claude.ai/code) by Anthropic.
