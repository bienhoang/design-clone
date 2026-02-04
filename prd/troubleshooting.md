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

### Playwright launch fails

**Error:** `Failed to launch browser`

**Solutions:**
1. Install Playwright: `npm install playwright` (includes bundled browsers)
   - Or lighter: `npm install playwright-core` (requires Chrome installed)
2. Verify Chrome is installed or use full `playwright` package
3. Docker: Already includes `--no-sandbox` flag automatically

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

## clone-site Issues

### No pages discovered

**Symptom:** Only homepage cloned, other pages not found.

**Causes:**
- Site uses JS-rendered navigation (React/Vue/Angular)
- Navigation not in standard selectors (header nav, footer nav)

**Solutions:**
```bash
# Specify pages manually
design-clone clone-site https://example.com --pages /,/about,/contact,/services

# Increase max pages if hitting limit
design-clone clone-site https://example.com --max-pages 20
```

### Links not working in cloned pages

**Symptom:** Internal links point to original URLs.

**Causes:**
- Page not in discovered list
- HTML file not found for rewriting

**Solutions:**
1. Check `manifest.json` for page list
2. Ensure all pages captured successfully (check `capture-results.json`)
3. Re-run with manual `--pages` flag including missing pages

### CSS broken on some pages

**Symptom:** Styling differs between cloned pages.

**Causes:**
- Page-specific CSS not merged
- CSS extraction failed for some pages

**Solutions:**
1. Check `css/` folder for per-page CSS files
2. Review merge stats in output
3. Try with fewer pages to isolate issue

### Timeout during capture

**Error:** `Navigation timeout`

**Causes:**
- Large pages
- Slow server
- Too many pages

**Solutions:**
```bash
# Reduce pages
design-clone clone-site https://example.com --max-pages 5

# Use specific viewports only
design-clone clone-site https://example.com --viewports desktop
```

### Memory issues

**Symptom:** Process crashes or hangs.

**Solutions:**
1. Reduce `--max-pages` to 5 or fewer
2. Clone in batches
3. Close other applications
