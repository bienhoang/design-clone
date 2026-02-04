# Hover States

Capture interactive element states and generate hover CSS.

## Overview

Hover state capture:
1. Identifies interactive elements
2. Captures normal state screenshot
3. Triggers hover
4. Captures hover state screenshot
5. Computes CSS differences
6. Generates `:hover` rules

## Enable Hover Capture

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --capture-hover
```

## Output Files

```
output/
├── hover.css              # Generated :hover rules
├── hover-states/
│   ├── hover-1-normal.png # Button normal state
│   ├── hover-1-hover.png  # Button hover state
│   ├── hover-2-normal.png # Link normal state
│   ├── hover-2-hover.png  # Link hover state
│   └── hover-diff.json    # Style differences
```

## Element Detection

### Automatic Detection

Interactive elements detected:
- `<button>` elements
- `<a>` links
- `[role="button"]`
- Elements with `:hover` in CSS
- Elements with `cursor: pointer`

### Detection Methods

1. **CSS-based** - Parses existing `:hover` selectors
2. **DOM-based** - Queries interactive elements

## Generated CSS

### Example Output

```css
/* hover.css */
.btn-primary:hover {
  background-color: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.nav-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.card:hover {
  transform: scale(1.02);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### Properties Captured

| Property | Captured |
|----------|----------|
| `background-color` | Yes |
| `color` | Yes |
| `transform` | Yes |
| `box-shadow` | Yes |
| `opacity` | Yes |
| `border-color` | Yes |
| `text-decoration` | Yes |

## hover-diff.json

Contains detailed style differences:

```json
{
  "elements": [
    {
      "selector": ".btn-primary",
      "tagName": "button",
      "text": "Get Started",
      "screenshots": {
        "normal": "hover-1-normal.png",
        "hover": "hover-1-hover.png"
      },
      "changes": {
        "backgroundColor": {
          "from": "#2563eb",
          "to": "#1d4ed8"
        },
        "transform": {
          "from": "none",
          "to": "translateY(-2px)"
        }
      }
    }
  ],
  "totalElements": 12,
  "elementsWithChanges": 8
}
```

## Options

### Limit Elements

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --capture-hover \
  --hover-limit 10
```

### Specific Selectors

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --capture-hover \
  --hover-selectors ".btn,.card,.nav-link"
```

### Skip Screenshots

Generate CSS only without screenshots:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --capture-hover \
  --hover-no-screenshots
```

## Best Practices

### 1. Combine with Full CSS

Include hover.css after main stylesheet:

```html
<link rel="stylesheet" href="source.css">
<link rel="stylesheet" href="hover.css">
```

### 2. Review Generated CSS

Not all captured changes may be intentional. Review and clean up:

```css
/* May need adjustment */
.link:hover {
  outline: 2px solid blue; /* Browser focus, not design */
}
```

### 3. Test Transitions

Add transitions for smooth effects:

```css
.btn-primary {
  transition: all 0.2s ease-in-out;
}
```

## Limitations

### Not Captured

- `:focus` states (separate mechanism)
- `:active` states (click, not hover)
- Complex CSS animations on hover
- Pseudo-elements (::before, ::after)

### Browser Differences

Hover states may vary between browsers. Design Clone uses Chromium.

## Troubleshooting

### No Hover Changes Detected

1. Element may use JavaScript for hover
2. CSS may use descendant selectors
3. Element may have `pointer-events: none`

### Screenshots Not Matching

Some hover effects have delays:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --capture-hover \
  --hover-delay 500
```

### Missing Elements

Increase detection scope:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --capture-hover \
  --hover-all-clickable
```
