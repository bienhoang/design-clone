# Basic Clone

The basic clone workflow captures screenshots and extracts HTML/CSS without full asset extraction.

## Command

```bash
/design:clone https://example.com
```

## What It Does

1. **Screenshots** - Captures at 3 viewports
2. **HTML Extraction** - Cleans and extracts source HTML
3. **CSS Extraction** - Extracts and filters CSS rules

## Step-by-Step Workflow

### Step 1: Capture Screenshots + HTML/CSS

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --extract-html \
  --extract-css
```

This creates:
- `desktop.png` (1920×1080)
- `tablet.png` (768×1024)
- `mobile.png` (375×812)
- `source.html` (cleaned HTML)
- `source-raw.css` (original CSS)

### Step 2: Filter Unused CSS

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

Creates `source.css` with only used selectors.

## Output Files

```
cloned-design/
├── desktop.png       # Desktop screenshot
├── tablet.png        # Tablet screenshot
├── mobile.png        # Mobile screenshot
├── source.html       # Cleaned HTML (no scripts)
├── source.css        # Filtered CSS (unused removed)
└── source-raw.css    # Original extracted CSS
```

## HTML Cleaning

The extracted HTML is cleaned automatically:

- `<script>` tags removed
- Inline event handlers removed (`onclick`, etc.)
- Data attributes preserved
- Structure maintained

Before:
```html
<div onclick="doSomething()" data-id="123">
  <script>alert('hi')</script>
  Content
</div>
```

After:
```html
<div data-id="123">
  Content
</div>
```

## CSS Filtering

CSS filtering removes unused selectors:

**Before** (source-raw.css):
```css
.header { ... }
.footer { ... }
.unused-class { ... }  /* Not in HTML */
.also-unused { ... }   /* Not in HTML */
```

**After** (source.css):
```css
.header { ... }
.footer { ... }
```

Typical reduction: **30-50%** smaller files.

## Options

### Full Page Screenshot

Capture the entire scrollable page:

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --full-page
```

### Custom Viewports

Specify which viewports to capture:

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --viewports desktop,mobile
```

Available: `desktop`, `tablet`, `mobile`

### Wait for Dynamic Content

Wait for JavaScript-rendered content:

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --wait 3000
```

## Best Practices

1. **Check the screenshots first** - Verify all content loaded correctly
2. **Review source.html** - Ensure important elements captured
3. **Compare CSS sizes** - Check filtering worked (raw vs filtered)
4. **Test responsiveness** - View HTML at different sizes

## Next Steps

For full asset extraction and AI analysis, see [Pixel-Perfect Clone](/guide/pixel-perfect).
