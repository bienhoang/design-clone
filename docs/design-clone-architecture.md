# Design Clone Skill Architecture

Technical architecture of the design-clone skill for Claude Code.

## Overview

```
design-clone/
├── SKILL.md                 # Entry point
├── bin/                     # npm CLI tool
│   ├── cli.js
│   ├── commands/
│   └── utils/
├── src/
│   ├── core/                # Core scripts
│   ├── ai/                  # AI analysis
│   ├── verification/        # Verification scripts
│   ├── post-process/        # Post-processing
│   └── utils/               # Shared utilities
├── docs/                    # Documentation
├── templates/               # Output templates
└── tests/                   # Test files
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  /design:clone   │  │  /design:clone-px │                    │
│  └────────┬─────────┘  └────────┬─────────┘                     │
└───────────┼─────────────────────┼───────────────────────────────┘
            │                     │
            ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SKILL.md                                  │
│  - Activation triggers: clone, copy, replicate website          │
│  - Commands: design:clone, design:clone-px                      │
│  - References: progressive disclosure                            │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Core Scripts (src/)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ core/           │  │ core/           │  │ ai/             │ │
│  │ screenshot.js   │  │ filter-css.js   │  │ analyze-struct  │ │
│  └────────┬────────┘  └────────┬────────┘  │     .py         │ │
│           │                    │           └────────┬────────┘ │
└───────────┼────────────────────┼───────────────────┼───────────┘
            │                    │                   │
            ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   src/utils/ (Shared)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ browser.js  │  │   env.js    │  │   env.py    │             │
│  │  (facade)   │  │  (Node.js)  │  │  (Python)   │             │
│  └──────┬──────┘  └─────────────┘  └─────────────┘             │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Browser Provider Selection                  │   │
│  │  ┌─────────────────┐    ┌─────────────────────────┐    │   │
│  │  │ chrome-devtools │ OR │ puppeteer.js (standalone)│    │   │
│  │  │   (if exists)   │    │   (bundled fallback)    │    │   │
│  │  └─────────────────┘    └─────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome/Chromium                               │
│  Auto-detected paths:                                            │
│  - macOS: /Applications/Google Chrome.app/...                   │
│  - Linux: /usr/bin/google-chrome, /usr/bin/chromium             │
│  - Windows: C:\Program Files\Google\Chrome\...                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Browser Abstraction Layer

```
src/utils/
├── browser.js      # Facade - auto-selects provider
├── puppeteer.js    # Standalone Puppeteer wrapper
├── helpers.js      # CLI utilities (parseArgs, outputJSON)
├── env.js          # Node.js env resolution
└── env.py          # Python env resolution
```

**browser.js** - Facade pattern for browser automation:
```javascript
// Auto-detects chrome-devtools skill or falls back to standalone
async function initProvider() {
  if (fs.existsSync(CHROME_DEVTOOLS_PATH)) {
    browserModule = await import(CHROME_DEVTOOLS_PATH);
    providerName = 'chrome-devtools';
  } else {
    browserModule = await import('./puppeteer.js');
    providerName = 'standalone';
  }
}
```

**puppeteer.js** - Standalone browser wrapper:
- Cross-platform Chrome detection (macOS, Linux, Windows)
- Session persistence via WebSocket endpoint caching
- PID tracking for cleanup

### 2. Environment Resolution

Both Node.js and Python share same resolution order:

```
1. process.env / os.environ (already set)
2. .env in current working directory
3. .env in skill directory
4. .env in ~/.claude/skills/
5. .env in ~/.claude/
```

**Cross-platform support:**
- Windows: Uses `USERPROFILE` when `HOME` unavailable
- Python 3.9+: Uses `List[Path]` from typing module

### 3. Core Scripts

| Script | Location | Language | Purpose |
|--------|----------|----------|---------|
| screenshot.js | src/core/ | Node.js | Screenshot capture, HTML/CSS extraction |
| animation-extractor.js | src/core/ | Node.js | Extract @keyframes, transitions, animation properties |
| filter-css.js | src/core/ | Node.js | Remove unused CSS selectors |
| extract-assets.js | src/core/ | Node.js | Download images, fonts, icons |
| analyze-structure.py | src/ai/ | Python | Gemini AI structure analysis |
| extract-design-tokens.py | src/ai/ | Python | Color, typography, spacing extraction |
| verify-menu.js | src/verification/ | Node.js | Test responsive navigation |
| verify-layout.js | src/verification/ | Node.js | Verify layout consistency |

### 4. Post-Processing

```
src/post-process/
├── fetch-images.js     # Fetch and optimize images
├── inject-icons.js     # Replace icons with Font Awesome
└── enhance-assets.js   # Enhance extracted assets
```

### 5. Progressive Disclosure

SKILL.md kept concise. Detailed docs in docs/:

```
docs/
├── basic-clone.md       # design:clone workflow
├── pixel-perfect.md     # design:clone-px workflow
├── cli-reference.md     # All script options
├── design-clone-architecture.md  # This file
└── troubleshooting.md   # Common issues
```

### 6. CLI Tool

```
bin/
├── cli.js               # Entry point (bin: design-clone)
├── commands/
│   ├── init.js          # Install skill to ~/.claude/skills/
│   ├── verify.js        # Check installation status
│   └── help.js          # Usage information
└── utils/
    ├── copy.js          # Recursive file copy
    └── validate.js      # Environment checks
```

## Data Flow

### design:clone

```
URL → src/core/screenshot.js       → Screenshots (3 viewports)
                                   → source.html (cleaned)
                                   → source-raw.css
    → src/core/filter-css.js       → source.css (filtered)
    → src/core/animation-extractor → animations.css
                                   → animation-tokens.json
```

### design:clone-px

```
URL → src/core/screenshot.js           → Screenshots + HTML/CSS
    → src/core/filter-css.js           → Filtered CSS
    → src/core/animation-extractor     → animations.css, animation-tokens.json
    → src/core/extract-assets.js       → assets/ (images, fonts, icons)
    → src/ai/analyze-structure.py      → structure.md (AI analysis)
    → src/ai/extract-design-tokens.py  → tokens.json, tokens.css
    → src/verification/verify-menu.js  → Menu validation report
```

## Output Structure

```
cloned-design/
├── desktop.png              # 1920x1080
├── tablet.png               # 768x1024
├── mobile.png               # 375x812
├── source.html              # Cleaned HTML
├── source.css               # Filtered CSS
├── source-raw.css           # Original CSS
├── animations.css           # Extracted @keyframes definitions
├── animation-tokens.json    # Animation metadata (keyframes, transitions, timings)
├── structure.md             # AI analysis (optional)
├── tokens.json              # Design tokens
├── tokens.css               # CSS variables
└── assets/
    ├── images/
    ├── fonts/
    └── icons/
```

## Dependencies

### Node.js (package.json)
- `css-tree`: CSS parsing and filtering
- `puppeteer`: Browser automation (peerDep, optional)

### Python (requirements.txt)
- `google-genai`: Gemini AI for vision analysis

## Installation Methods

### npm (Recommended)
```bash
npm install -g design-clone
design-clone init
```

### Manual
```bash
cp -r design-clone ~/.claude/skills/design-clone
cd ~/.claude/skills/design-clone
npm install && pip install -r requirements.txt
```

## Security Considerations

1. **Path validation**: Prevents directory traversal
2. **CSS sanitization**: Removes XSS vectors (expression(), javascript:)
3. **Size limits**: 10MB max CSS input
4. **No secrets in output**: Scripts don't expose env vars
