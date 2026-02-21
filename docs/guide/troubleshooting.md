# Troubleshooting

Common issues and solutions for Design Clone.

## Installation Issues

### Chrome Not Found

**Error:**
```
Error: Chrome executable not found
```

**Solutions:**

```bash
# macOS - Install Chrome
brew install --cask google-chrome

# Ubuntu - Install Chromium
sudo apt install chromium-browser

# Set custom path
export CHROME_PATH="/path/to/chrome"
```

### Python Dependencies Fail

**Error:**
```
ModuleNotFoundError: No module named 'google.generativeai'
```

**Solutions:**

```bash
# Install with pip
pip install google-generativeai

# Or with pip3
pip3 install -r requirements.txt

# Or with specific Python version
python3 -m pip install -r requirements.txt
```

### Playwright Issues

**Error:**
```
Error: browserType.launch: Executable doesn't exist
```

**Solutions:**

```bash
# Install Playwright browsers
npx playwright install chromium

# With system dependencies (Linux)
npx playwright install chromium --with-deps

# For Docker/CI
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers
npx playwright install chromium
```

### Node Version Too Low

**Error:**
```
SyntaxError: Unexpected token '??='
```

**Solution:**
```bash
# Update Node.js to 18+
nvm install 18
nvm use 18
```

## Screenshot Issues

### Blank Screenshots

**Causes:**
- Content not loaded yet
- JavaScript rendering required
- Cookie consent blocking

**Solutions:**

```bash
# Increase wait time
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait 5000

# Wait for network idle
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait-until networkidle

# Accept cookies
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --accept-cookies
```

### Missing Content

**Causes:**
- Lazy-loaded images
- Infinite scroll
- Dynamic content

**Solutions:**

```bash
# Use full-page capture
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --full-page

# Longer wait
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait 10000
```

### Timeout Errors

**Error:**
```
TimeoutError: Navigation timeout of 30000ms exceeded
```

**Solution:**

```bash
# Increase timeout
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --timeout 60000
```

## CSS Issues

### CSS Not Extracted

**Causes:**
- CORS blocking external stylesheets
- CSS loaded via JavaScript

**Solutions:**

```bash
# Use raw CSS if filtered is empty
# source-raw.css contains unfiltered CSS
```

### Too Much CSS Removed

**Causes:**
- Dynamic class names
- JavaScript-added classes
- Complex selectors

**Solutions:**

```bash
# Use debug mode to see what's removed
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css \
  --debug

# Or use raw CSS directly
cp output/source-raw.css output/source.css
```

### @import Not Resolved

**Cause:**
External @import statements need network access.

**Solution:**
Use asset extraction to download fonts:

```bash
node src/core/media/extract-assets.js \
  --url "https://example.com" \
  --output ./output \
  --type fonts
```

## AI Analysis Issues

### API Key Invalid

**Error:**
```
Error: API key not valid. Please pass a valid API key.
```

**Solutions:**

1. Verify key at [AI Studio](https://aistudio.google.com/apikey)
2. Check for extra spaces/newlines
3. Regenerate if compromised

```bash
# Test API key
python -c "
import google.generativeai as genai
import os
genai.configure(api_key=os.environ['GEMINI_API_KEY'])
print('OK')
"
```

### Rate Limited

**Error:**
```
Error: 429 Resource has been exhausted
```

**Solutions:**

1. Wait and retry (free tier limits)
2. Upgrade to paid tier
3. Reduce analysis frequency

### Image Too Large

**Error:**
```
Error: Image size exceeds the maximum allowed size
```

**Solution:**
Crop or resize screenshot before analysis:

```bash
# Resize with ImageMagick
convert output/desktop.png -resize 50% output/desktop-small.png
```

## Asset Extraction Issues

### 403 Forbidden

**Cause:**
Site blocks automated downloads.

**Solutions:**

```bash
# Add user agent
node src/core/media/extract-assets.js \
  --url "https://example.com" \
  --output ./output \
  --user-agent "Mozilla/5.0..."
```

### Large Files Timeout

**Solution:**

```bash
# Increase timeout
node src/core/media/extract-assets.js \
  --url "https://example.com" \
  --output ./output \
  --timeout 60000
```

### Missing Fonts

**Cause:**
Fonts may be:
- Loaded from different domain
- Behind authentication
- Protected by CORS

**Solution:**
Manually download from font service or use fallbacks.

## Multi-Page Issues

### Pages Not Discovered

**Cause:**
- JavaScript navigation
- Dynamic menus
- Authentication required

**Solution:**

```bash
# Specify pages manually
design-clone clone-site https://example.com \
  --pages /,/about,/contact,/blog
```

### Links Not Working

**Cause:**
External links or special protocols.

**Solution:**
Check manifest.json for link mapping.

## Performance Issues

### High Memory Usage

**Causes:**
- Multiple viewports
- Large pages
- Video recording

**Solutions:**

```bash
# Capture one viewport at a time
--viewports desktop

# Skip video
# Don't use --video

# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" node ...
```

### Slow Capture

**Causes:**
- Slow network
- Heavy pages
- Video recording

**Solutions:**

```bash
# Skip non-essential features
--no-capture-hover
# Don't use --video
--viewports desktop
```

## Getting Help

If issues persist:

1. Check [GitHub Issues](https://github.com/bienhoang/design-clone/issues)
2. Run with debug: `DEBUG=design-clone:* node ...`
3. Include error output when reporting
