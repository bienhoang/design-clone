# Getting Started

Get up and running with Design Clone in under 5 minutes.

## Prerequisites

Before installing, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org)
- **Python 3.9+** - For AI analysis features
- **Chrome or Chromium** - For screenshot capture

## Installation

### Option 1: npm (Recommended)

```bash
npm install -g design-clone
design-clone init
```

The `init` command installs the skill to `~/.claude/skills/design-clone`.

### Option 2: Manual Installation

```bash
git clone https://github.com/bienhoang/design-clone.git
cp -r design-clone ~/.claude/skills/design-clone
cd ~/.claude/skills/design-clone
npm install
pip install -r requirements.txt
```

### Verify Installation

```bash
design-clone verify
```

Expected output:
```
✓ Node.js 18+ found
✓ Python 3.9+ found
✓ Chrome/Chromium found
✓ Playwright ready
✓ Skill installed at ~/.claude/skills/design-clone
```

## Your First Clone

Open Claude Code and run:

```bash
/design:clone https://example.com
```

This will create:

```
cloned-design/
├── desktop.png    # 1920×1080 screenshot
├── tablet.png     # 768×1024 screenshot
├── mobile.png     # 375×812 screenshot
├── source.html    # Cleaned HTML
└── source.css     # Filtered CSS
```

## Enable AI Analysis (Optional)

For AI-powered structure analysis:

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

2. Add to your environment:
   ```bash
   # Add to ~/.claude/.env
   GEMINI_API_KEY=your-key-here
   ```

3. Run pixel-perfect clone:
   ```bash
   /design:clone-px https://example.com
   ```

This adds:
- `structure.md` - AI analysis of page layout
- `tokens.json` - Extracted design tokens

## Next Steps

- [Basic Clone Guide](/guide/basic-clone) - Learn the basic workflow
- [Pixel-Perfect Clone](/guide/pixel-perfect) - Full feature walkthrough
- [CLI Reference](/api/cli) - All available commands
