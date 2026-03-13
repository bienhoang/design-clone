# Troubleshooting

## Common Issues

### Browser Launch Fails

**Symptoms:** `BROWSER_LAUNCH_FAILED` error, "Cannot find Chrome" message.

**Fixes:**
```bash
# Install Playwright browsers
npx playwright install chromium

# Or set Chrome path manually
export CHROME_PATH="/path/to/chrome"

# macOS
brew install --cask google-chrome

# Ubuntu/Debian
sudo apt install chromium-browser

# Docker/CI
export PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers
npx playwright install chromium
```

### CSS Extraction Empty

**Symptoms:** source-raw.css is empty or very small.

**Causes:** CORS blocks external stylesheets, site uses CSS-in-JS.

**Fixes:**
- Use `--extract-computed true` to capture JS-applied styles
- Check if stylesheets are on different domains (CORS restriction)
- Try with `--full-page true` to ensure all lazy-loaded styles are captured

### Screenshots Blank or Incomplete

**Symptoms:** White screenshots, missing content, partial renders.

**Causes:** SPA not fully rendered, JavaScript-heavy page, lazy loading.

**Fixes:**
- capture.js handles cookie banners, lazy loading, and page readiness automatically
- Ensure page doesn't require authentication
- Try with `--full-page true` flag

### Asset Download 429 Errors

**Symptoms:** Images/fonts fail to download, rate limiting errors.

**Causes:** Server rate limiting on asset requests.

**Fixes:**
- extract-assets.js includes exponential backoff by default
- Reduce concurrency: `--concurrency 3`
- Some CDNs block automated requests; check asset URLs manually

### Large CSS Files Timeout

**Symptoms:** CSS processing hangs or fails on large stylesheets (>10MB).

**Causes:** CSS file too large for single-pass processing.

**Fixes:**
- Use `--aggressive-filter true` flag for aggressive dead code removal
- filter-css.js automatically chunks large files (>2MB threshold)
- Consider filtering only the CSS needed for the specific page

### Hover States Not Captured

**Symptoms:** hover-states/ directory empty, hover.css missing.

**Causes:** No interactive elements detected, page uses JavaScript-only hover effects.

**Fixes:**
- Ensure `--capture-hover true` flag is set
- Check that page has standard CSS :hover selectors

## Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `CSS_SIZE_EXCEEDED` | CSS file > 50MB | Use `--aggressive-filter` |
| `CSS_PARSE_FAILED` | Invalid/malformed CSS | Check source site CSS validity |
| `CSS_CORS_BLOCKED` | Cross-origin stylesheet blocked | Use `--extract-computed` |
| `HTML_EXTRACTION_FAILED` | DOM serialization error | Retry; check page fully loads |
| `ASSET_DOWNLOAD_FAILED` | Image/font download error | Check network; assets may be protected |
| `BROWSER_LAUNCH_FAILED` | Can't start browser | Run `npx playwright install chromium` |
| `NAV_TIMEOUT` | Page navigation timeout | Increase timeout; verify URL is reachable |
| `FILE_IO_FAILED` | File system error | Check disk space and permissions |
| `DISCOVERY_FAILED` | Page discovery error | Use `--pages` flag for manual page list |
| `SCREENSHOT_FAILED` | Screenshot capture error | Check browser; try without `--full-page` |
| `INVALID_ARGS` | Bad CLI arguments | Run script with `--help` |

## Debug Tips

- **`--dry-run`** — Preview page discovery without capturing (clone-site)
- **`--verbose`** — Enable verbose output for detailed logging
- **Playwright debug** — Set `PWDEBUG=1` to open browser inspector during capture
