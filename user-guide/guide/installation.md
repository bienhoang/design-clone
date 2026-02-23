# Installation

Complete installation guide for Design Clone.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18.0.0 | 20.x LTS |
| Python | 3.9 | 3.11+ |
| RAM | 2GB | 4GB+ |
| Disk | 500MB | 1GB+ |

## npm Installation

The easiest way to install:

```bash
npm install -g design-clone
design-clone init
```

### What `init` Does

1. Creates `~/.claude/skills/design-clone/` directory
2. Copies skill files to the directory
3. Installs Node.js dependencies
4. Installs Python dependencies
5. Installs Playwright browsers

### Force Reinstall

To reinstall over an existing installation:

```bash
design-clone init --force
```

## Manual Installation

For more control over the installation:

```bash
# Clone the repository
git clone https://github.com/bienhoang/design-clone.git

# Copy to Claude skills directory
cp -r design-clone ~/.claude/skills/design-clone

# Navigate to skill directory
cd ~/.claude/skills/design-clone

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
npx playwright install chromium
```

## Browser Setup

Design Clone uses Playwright with Chromium. If you encounter browser issues:

### Install Playwright Browsers

```bash
npx playwright install chromium
```

### Use System Chrome

If you prefer using system Chrome:

```bash
# macOS
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Linux
export CHROME_PATH="/usr/bin/google-chrome"

# Windows
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Docker/CI Environments

For headless environments:

```bash
# Set custom browser path
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers

# Install with dependencies
npx playwright install chromium --with-deps
```

## Python Dependencies

Required Python packages:

```
google-generativeai>=0.3.0
pillow>=10.0.0
```

Install with:

```bash
pip install -r requirements.txt
# Or with Python 3 explicitly
pip3 install -r requirements.txt
```

## Verification

After installation, verify everything works:

```bash
design-clone verify
```

### Expected Output

```
Design Clone Installation Check
===============================
✓ Node.js: v20.11.0 (>=18 required)
✓ Python: 3.11.4 (>=3.9 required)
✓ Chrome: Found at /Applications/Google Chrome.app
✓ Playwright: Installed with Chromium
✓ Skill: ~/.claude/skills/design-clone
✓ Dependencies: All installed

Ready to clone designs!
```

### Troubleshooting Verification

If verification fails, see [Troubleshooting](/guide/troubleshooting).

## Environment Variables

Optional configuration via environment variables:

```bash
# ~/.claude/.env or shell profile

# AI analysis (optional)
GEMINI_API_KEY=your-api-key

# Custom Chrome path (optional)
CHROME_PATH=/path/to/chrome

# Playwright browser location (optional)
PLAYWRIGHT_BROWSERS_PATH=/custom/path
```

## Updating

### npm

```bash
npm update -g design-clone
design-clone init --force
```

### Manual

```bash
cd ~/.claude/skills/design-clone
git pull
npm install
pip install -r requirements.txt
```

## Uninstalling

### npm

```bash
npm uninstall -g design-clone
rm -rf ~/.claude/skills/design-clone
```

### Manual

```bash
rm -rf ~/.claude/skills/design-clone
```
