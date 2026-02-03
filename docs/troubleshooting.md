# Troubleshooting

Common issues and solutions.

## Browser Issues

### Chrome/Chromium not found

**Error:** `Could not find Chrome`

**Solution:**
```bash
# macOS
brew install --cask google-chrome

# Ubuntu
sudo apt install chromium-browser

# Or set path manually
export CHROME_PATH="/path/to/chrome"
```

### Puppeteer launch fails

**Error:** `Failed to launch browser`

**Solutions:**
1. Install dependencies: `npm install puppeteer`
2. Linux: Install required libs: `apt install libnss3 libatk1.0-0 libatk-bridge2.0-0`
3. Run with `--no-sandbox` (Docker): Set `PUPPETEER_NO_SANDBOX=1`

## CSS Issues

### CORS-blocked stylesheets

**Symptom:** CSS extraction returns empty or partial styles.

**Solution:** Some sites block cross-origin stylesheet access. Use browser DevTools manually or try `--wait 3000` for dynamic CSS.

### CSS too large

**Error:** `CSS file exceeds 10MB limit`

**Solution:** filter-css.js has 10MB limit. Split manually or increase `MAX_CSS_INPUT_SIZE` in filter-css.js.

## Python Issues

### Module not found

**Error:** `ModuleNotFoundError: google.genai`

**Solution:**
```bash
pip install -r requirements.txt
# Or: pip install google-genai
```

### Wrong Python version

**Error:** `SyntaxError` on type hints

**Solution:** Requires Python 3.9+. Check: `python3 --version`

## Gemini API Issues

### API key not set

**Error:** `GEMINI_API_KEY not found`

**Solution:** Create `.env` file:
```bash
GEMINI_API_KEY=your-api-key-here
```

### Rate limit exceeded

**Error:** `429 Too Many Requests`

**Solution:** Wait 1 minute, or use `--model gemini-1.5-flash` for lower limits.

## Screenshot Issues

### Incomplete page capture

**Symptom:** Missing sections in screenshot.

**Solutions:**
1. Increase wait: `--wait 5000`
2. Use full page: `--full-page`
3. Check for lazy-loaded content

### Wrong viewport size

**Solution:** Specify custom viewports:
```bash
--viewports '[{"width":1440,"height":900,"name":"custom"}]'
```
