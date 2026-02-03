# Basic Clone Workflow

Quick website design capture with screenshots and source extraction.

## When to Use

- Quick design reference/inspiration
- Simple single-page sites
- Initial exploration before pixel-perfect clone

## Steps

### 1. Capture Screenshots + Extract Source

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./cloned-design \
  --extract-html \
  --extract-css
```

### 2. Filter Unused CSS (Optional)

```bash
node src/core/filter-css.js \
  --html ./cloned-design/source.html \
  --css ./cloned-design/source-raw.css \
  --output ./cloned-design/source.css
```

## Output Files

| File | Description |
|------|-------------|
| desktop.png | 1920x1080 viewport screenshot |
| tablet.png | 768x1024 viewport screenshot |
| mobile.png | 375x812 viewport screenshot |
| source.html | Cleaned HTML (inline styles removed) |
| source-raw.css | All extracted CSS (unfiltered) |
| source.css | Filtered CSS (after filter-css.js) |

## Common Options

```bash
# Custom viewports
--viewports '[{"width":1440,"height":900,"name":"laptop"}]'

# Full page capture
--full-page

# Wait for animations
--wait 3000

# Skip HTML extraction
--extract-html false
```

## Tips

- Add `--wait 2000` for sites with loading animations
- Use `--full-page` for long scrolling pages
- Check `source.html` for missing sections before pixel-perfect
