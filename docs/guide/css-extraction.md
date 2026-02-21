# CSS Extraction

How Design Clone extracts and filters CSS.

## Overview

CSS extraction involves:
1. Collecting all stylesheets from the page
2. Inlining external CSS
3. Parsing and filtering unused rules
4. Extracting animations separately

## Basic Extraction

Include CSS extraction with screenshots:

```bash
node src/core/capture/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --extract-css
```

Creates:
- `source-raw.css` - All collected CSS
- `animations.css` - Extracted @keyframes (if any)

## CSS Filtering

Remove unused selectors:

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css
```

### How Filtering Works

1. Parse HTML to find all elements
2. Build selector usage map
3. Filter CSS rules:
   - Keep rules matching HTML elements
   - Keep @keyframes and @font-face
   - Keep :root and universal rules
   - Remove unused class selectors

### Example

**HTML:**
```html
<div class="header">
  <nav class="nav"></nav>
</div>
```

**Raw CSS:**
```css
.header { color: blue; }
.nav { display: flex; }
.footer { color: gray; }    /* Unused */
.sidebar { width: 200px; }  /* Unused */
```

**Filtered CSS:**
```css
.header { color: blue; }
.nav { display: flex; }
```

## Animation Extraction

Animations are extracted separately:

### @keyframes

```css
/* animations.css */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); }
  to { transform: translateY(0); }
}
```

### Animation Tokens

```json
{
  "keyframes": [
    {
      "name": "fadeIn",
      "frames": ["from", "to"],
      "properties": ["opacity"]
    }
  ],
  "transitions": [
    {
      "property": "all",
      "duration": "0.3s",
      "timing": "ease-in-out"
    }
  ]
}
```

## CSS Sources

Design Clone collects CSS from:

| Source | Priority | Notes |
|--------|----------|-------|
| `<link rel="stylesheet">` | 1 | External stylesheets |
| `<style>` tags | 2 | Embedded styles |
| Inline styles | 3 | Extracted to classes |
| Computed styles | 4 | Fallback for dynamic |

## Handling Modern CSS

### CSS Variables

Variables are preserved:

```css
:root {
  --primary: #2563eb;
  --spacing: 1rem;
}

.button {
  background: var(--primary);
  padding: var(--spacing);
}
```

### CSS Grid & Flexbox

Layout properties fully supported:

```css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
```

### @media Queries

Media queries preserved with their rules:

```css
@media (max-width: 768px) {
  .header {
    flex-direction: column;
  }
}
```

## Optimization Tips

### 1. Compare File Sizes

```bash
ls -la ./output/*.css
# source-raw.css: 45KB
# source.css: 28KB (38% smaller)
```

### 2. Validate Filtered CSS

Open source.html in browser and verify styling matches original.

### 3. Check for Missing Styles

If elements look wrong:
1. Compare raw vs filtered CSS
2. Look for complex selectors
3. Check for JavaScript-added classes

## Advanced Options

### Keep All Media Queries

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css \
  --keep-media
```

### Include Print Styles

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css \
  --include-print
```

### Debug Mode

See which selectors were removed:

```bash
node src/core/css/filter-css.js \
  --html ./output/source.html \
  --css ./output/source-raw.css \
  --output ./output/source.css \
  --debug
```

Output:
```
Keeping: .header (used 1 time)
Keeping: .nav (used 1 time)
Removing: .footer (unused)
Removing: .sidebar (unused)
...
Removed 247 unused selectors
```

## Troubleshooting

### Missing Styles After Filtering

Some selectors may be falsely removed:

1. **Dynamic classes** - Added by JavaScript
2. **Pseudo-selectors** - `:before`, `:after`
3. **Complex selectors** - May not match

Solution: Use raw CSS as reference.

### @import Not Resolved

External @import statements need network access:

```css
/* May not be resolved */
@import url('https://fonts.googleapis.com/css2?family=Inter');
```

Workaround: Extract assets to download fonts.
