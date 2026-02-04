# Screenshot Capture

Comprehensive guide to screenshot capture features.

## Basic Capture

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output
```

Creates screenshots at three viewports:
- `desktop.png` - 1920×1080
- `tablet.png` - 768×1024
- `mobile.png` - 375×812

## Viewport Sizes

| Viewport | Width | Height | Device |
|----------|-------|--------|--------|
| desktop | 1920px | 1080px | Standard monitor |
| tablet | 768px | 1024px | iPad portrait |
| mobile | 375px | 812px | iPhone X/11/12 |

### Custom Viewports

Capture specific viewports only:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --viewports desktop,mobile
```

## Full Page Screenshots

Capture the entire scrollable page:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --full-page
```

This scrolls through the page and stitches screenshots together.

## Wait Strategies

### Fixed Wait

Wait a specific duration for content to load:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait 3000
```

### Network Idle

Wait until network requests settle:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait-until networkidle
```

### DOM Content Loaded

Wait for DOM to be ready:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait-until domcontentloaded
```

## Handling Dynamic Content

### Lazy-Loaded Images

The screenshot tool automatically:
1. Scrolls the page to trigger lazy loading
2. Waits for images to load
3. Scrolls back to top
4. Takes screenshot

### JavaScript Rendering

For SPAs and JavaScript-heavy sites:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait 5000 \
  --wait-until networkidle
```

## Cookie Handling

### Accept Cookie Banners

Automatically clicks common cookie accept buttons:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --accept-cookies
```

### Custom Cookie Actions

The tool looks for buttons matching:
- "Accept all"
- "Accept cookies"
- "I agree"
- "Got it"

## Authentication

For sites requiring login:

```bash
# Save authentication state
node src/core/screenshot.js \
  --url "https://example.com/login" \
  --output ./auth \
  --save-storage ./auth-state.json

# Use saved state
node src/core/screenshot.js \
  --url "https://example.com/dashboard" \
  --output ./output \
  --storage ./auth-state.json
```

## Screenshot Quality

### High DPI

Capture at 2x resolution:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --scale 2
```

### Format

Default is PNG. For JPEG:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --format jpeg \
  --quality 90
```

## Troubleshooting

### Blank Screenshots

1. **Content not loaded** - Increase wait time
2. **JavaScript error** - Check browser console
3. **Lazy loading** - Enable `--full-page` first

### Missing Elements

Some elements may be:
- Hidden by CSS at certain viewports
- Loaded via JavaScript
- Behind cookie banners

Try:
```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait 5000 \
  --accept-cookies
```

### Timeout Errors

Increase timeout for slow sites:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --timeout 60000
```

## Script Reference

Full options:

```bash
node src/core/screenshot.js \
  --url <url>              # Target URL (required)
  --output <dir>           # Output directory (required)
  --viewports <list>       # Viewports to capture
  --full-page              # Full page screenshot
  --wait <ms>              # Wait duration
  --wait-until <event>     # Wait event
  --timeout <ms>           # Navigation timeout
  --accept-cookies         # Auto-accept cookies
  --scale <n>              # Device scale factor
  --format <type>          # png or jpeg
  --quality <n>            # JPEG quality (0-100)
  --extract-html           # Also extract HTML
  --extract-css            # Also extract CSS
  --capture-hover          # Capture hover states
```
