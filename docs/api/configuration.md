# Configuration

Configure Design Clone behavior via environment variables and options.

## Environment Variables

### Required for AI Features

```bash
# Gemini API key for AI analysis
GEMINI_API_KEY=your-api-key-here
```

Get your key at [Google AI Studio](https://aistudio.google.com/apikey).

### Optional Configuration

```bash
# Custom Chrome path
CHROME_PATH=/path/to/chrome

# Custom Playwright browser location
PLAYWRIGHT_BROWSERS_PATH=/custom/path

# Debug mode
DEBUG=design-clone:*
```

## Configuration Files

### .env File

Create `.env` in project root or `~/.claude/.env`:

```bash
# AI Features
GEMINI_API_KEY=your-api-key

# Browser
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# Debugging
DEBUG=false
```

### .env.example

Reference configuration:

```bash
# Design Clone Configuration

# Required for AI analysis features
# Get your key at: https://aistudio.google.com/apikey
GEMINI_API_KEY=

# Optional: Custom Chrome path
# CHROME_PATH=/path/to/chrome

# Optional: Custom browser storage
# PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers

# Optional: Enable debug output
# DEBUG=design-clone:*
```

## Default Settings

### Viewport Sizes

| Viewport | Width | Height |
|----------|-------|--------|
| desktop | 1920 | 1080 |
| tablet | 768 | 1024 |
| mobile | 375 | 812 |

### Timeouts

| Operation | Default | Max |
|-----------|---------|-----|
| Navigation | 30000ms | 60000ms |
| Screenshot | 10000ms | 30000ms |
| Asset download | 10000ms | 30000ms |

### Output Directories

| Type | Default |
|------|---------|
| Single page | `./cloned-design` |
| Multi-page | `./cloned-designs/{timestamp}-{domain}` |
| Assets | `./output/assets` |

## Script Options Reference

### screenshot.js

```javascript
const defaults = {
  viewports: ['desktop', 'tablet', 'mobile'],
  fullPage: false,
  wait: 0,
  waitUntil: 'networkidle',
  timeout: 30000,
  extractHtml: true,
  extractCss: true,
  captureHover: false,
  video: false,
  videoFormat: 'webm',
  videoDuration: 12000
}
```

### filter-css.js

```javascript
const defaults = {
  keepMedia: true,
  includePrint: false,
  preserveKeyframes: true,
  preserveFontFace: true,
  debug: false
}
```

### extract-assets.js

```javascript
const defaults = {
  types: ['images', 'fonts', 'icons'],
  minSize: 0,
  maxSize: 10 * 1024 * 1024, // 10MB
  concurrency: 3,
  timeout: 10000
}
```

## Per-Command Configuration

### Clone Command

```bash
design-clone clone <url> \
  --output ./output \
  --viewports desktop,mobile \
  --full-page \
  --wait 2000
```

### Clone-px Command

```bash
design-clone clone-px <url> \
  --output ./output \
  --no-analyze \
  --no-tokens
```

### Clone-site Command

```bash
design-clone clone-site <url> \
  --pages /,/about,/contact \
  --max-pages 20 \
  --yes
```

## Browser Configuration

### Use System Chrome

```bash
# macOS
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Linux
export CHROME_PATH="/usr/bin/google-chrome"

# Windows
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Use Playwright Chromium

```bash
# Install
npx playwright install chromium

# Set path (optional)
export PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright
```

### Docker/CI Configuration

```bash
# Use shared browser path
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers

# Install with system dependencies
npx playwright install chromium --with-deps
```

## Proxy Configuration

### HTTP Proxy

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
```

### In Script

```bash
node src/core/screenshot.js \
  --url https://example.com \
  --output ./output \
  --proxy http://proxy.example.com:8080
```

## Debug Configuration

### Enable Debug Output

```bash
# All debug output
DEBUG=design-clone:* node src/core/screenshot.js ...

# Specific modules
DEBUG=design-clone:screenshot node src/core/screenshot.js ...
DEBUG=design-clone:css node src/core/filter-css.js ...
```

### Verbose Mode

```bash
design-clone clone https://example.com --verbose
```

### Keep Temporary Files

```bash
design-clone clone https://example.com --keep-temp
```

## Feature Flags

### Disable Features

```bash
# Skip AI analysis
design-clone clone-px https://example.com --no-analyze

# Skip token extraction
design-clone clone-px https://example.com --no-tokens

# Skip verification
design-clone clone-px https://example.com --no-verify
```

### Enable Experimental

```bash
# Enable video recording
design-clone clone https://example.com --video

# Enable hover capture
design-clone clone https://example.com --capture-hover
```
