# Pixel-Perfect Clone

The pixel-perfect workflow includes full asset extraction, AI analysis, and verification.

## Command

```bash
/design:clone-px https://example.com
```

## Complete Workflow

### Step 1: Capture + Extract

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --extract-html \
  --extract-css \
  --capture-hover true \
  --full-page
```

### Step 2: Filter CSS

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

### Step 3: Extract Assets

```bash
node src/core/media/extract-assets.js \
  --url "https://example.com" \
  --output ./output
```

Downloads:
- Images (PNG, JPG, SVG, WebP)
- Fonts (WOFF, WOFF2, TTF)
- Icons (favicons, SVG icons)

### Step 4: AI Structure Analysis

Requires `GEMINI_API_KEY`:

```bash
python src/ai/analyze-structure.py \
  -s ./output/desktop.png \
  -o ./output \
  --html ./output/source.html \
  --css ./output/source.css
```

Creates `structure.md` with:
- Page section breakdown
- Component hierarchy
- Layout patterns

### Step 5: Extract Design Tokens

```bash
python src/ai/extract-design-tokens.py \
  -s ./output/desktop.png \
  -o ./output
```

Creates `tokens.json` with:
- Color palette
- Typography scales
- Spacing values
- Border radii

### Step 6: Verify Menu

```bash
node src/verification/verify-menu.js \
  --html ./output/source.html
```

Validates:
- Navigation structure
- Link validity
- Mobile menu presence

## Output Structure

```
cloned-design/
├── desktop.png              # Full page desktop screenshot
├── tablet.png               # Tablet screenshot
├── mobile.png               # Mobile screenshot
├── source.html              # Cleaned HTML
├── source.css               # Filtered CSS
├── source-raw.css           # Original CSS
├── animations.css           # Extracted @keyframes
├── animation-tokens.json    # Animation metadata
├── hover.css                # Generated :hover rules
├── structure.md             # AI analysis
├── tokens.json              # Design tokens
├── hover-states/            # Hover captures
│   ├── hover-1-normal.png
│   ├── hover-1-hover.png
│   └── hover-diff.json
└── assets/
    ├── images/              # Downloaded images
    ├── fonts/               # Downloaded fonts
    └── icons/               # Downloaded icons
```

## AI Analysis Output

### structure.md Example

```markdown
# Page Structure Analysis

## Hero Section
- Full-width container
- Background image with overlay
- Centered text content
- CTA button with gradient

## Navigation
- Fixed position header
- Logo left, menu right
- Mobile hamburger at 768px
- Dropdown on hover

## Features Grid
- 3-column layout (desktop)
- 2-column (tablet)
- 1-column (mobile)
- Card components with icons
```

### tokens.json Example

```json
{
  "colors": {
    "primary": "#2563eb",
    "secondary": "#64748b",
    "background": "#ffffff",
    "text": "#1e293b"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "h1": "48px/1.2",
    "body": "16px/1.6"
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "32px"
  }
}
```

## Options Reference

| Option | Description |
|--------|-------------|
| `--full-page` | Capture entire scrollable page |
| `--capture-hover` | Capture hover states |
| `--wait <ms>` | Wait for dynamic content |
| `--viewports <list>` | Specific viewports |

## Best Practices

1. **Set GEMINI_API_KEY** - Required for AI features
2. **Use full-page** - Captures complete design
3. **Enable hover capture** - Documents interactions
4. **Run verification** - Ensures quality output

## Troubleshooting

### AI Analysis Fails

```bash
# Check API key is set
echo $GEMINI_API_KEY

# Test API connection
python -c "import google.generativeai as genai; print(genai.configure(api_key='$GEMINI_API_KEY'))"
```

### Asset Download Fails

Some sites block automated downloads. Try:

```bash
# Add user agent
node src/core/media/extract-assets.js \
  --url "https://example.com" \
  --output ./output \
  --user-agent "Mozilla/5.0..."
```

### Large Pages Timeout

Increase timeout:

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --timeout 60000
```
