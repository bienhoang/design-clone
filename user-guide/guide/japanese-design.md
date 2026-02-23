# Japanese Design Principles

Design Clone incorporates traditional Japanese aesthetic principles.

## The Four Principles

### Ma (間) - Negative Space

**Meaning**: The void between elements; breathing room.

**Application**:
- Generous padding and margins
- Whitespace as a design element
- Letting content breathe

```css
/* Ma in CSS */
.section {
  padding: 80px 0;
}

.card {
  padding: 32px;
}

.text-content {
  max-width: 65ch;
  line-height: 1.75;
}
```

### Kanso (簡素) - Simplicity

**Meaning**: Elimination of clutter and non-essentials.

**Application**:
- Limited color palette (2-3 colors)
- Clean typography hierarchy
- Essential elements only

```css
/* Kanso in CSS */
:root {
  --color-primary: #2563eb;
  --color-text: #1e293b;
  --color-muted: #64748b;
}

body {
  font-family: system-ui, sans-serif;
}

h1, h2, h3 {
  font-weight: 600;
}
```

### Shibui (渋い) - Subtle Elegance

**Meaning**: Understated beauty; refined simplicity.

**Application**:
- Soft shadows instead of hard borders
- Gentle color transitions
- Subtle hover effects

```css
/* Shibui in CSS */
.card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06),
              0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.06),
              0 2px 4px rgba(0, 0, 0, 0.04);
}

.button {
  transition: transform 0.15s ease;
}

.button:hover {
  transform: translateY(-1px);
}
```

### Seijaku (静寂) - Tranquility

**Meaning**: Peace and calm; visual harmony.

**Application**:
- Calm, muted colors
- Balanced layouts
- Consistent visual rhythm

```css
/* Seijaku in CSS */
:root {
  --bg-primary: #fafafa;
  --bg-secondary: #f5f5f5;
  --text-primary: #262626;
  --text-secondary: #737373;
}

.container {
  display: grid;
  gap: 24px;
}

.rhythm > * + * {
  margin-top: 1.5rem;
}
```

## Applying the Principles

### Color Palette

Japanese-inspired colors tend to be:
- Muted rather than vibrant
- Natural rather than artificial
- Harmonious rather than contrasting

```css
/* Japanese-inspired palette */
:root {
  /* Base */
  --white: #fafaf9;
  --black: #1c1917;

  /* Stone */
  --stone-100: #f5f5f4;
  --stone-200: #e7e5e4;
  --stone-500: #78716c;
  --stone-800: #292524;

  /* Accent - subtle blue */
  --accent: #60a5fa;
  --accent-muted: #93c5fd;
}
```

### Typography

Clean, readable typography:

```css
body {
  font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  letter-spacing: 0.01em;
}

h1 {
  font-size: 2.25rem;
  font-weight: 500;
  letter-spacing: -0.02em;
}
```

### Spacing Scale

Consistent, harmonious spacing:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
}
```

## Implementation in Design Clone

Design Clone generates CSS following these principles:

### Automatic Cleanup

- Removes excessive decorations
- Simplifies color usage
- Standardizes spacing

### Generated Tokens

When AI analysis runs, tokens follow these principles:

```json
{
  "spacing": {
    "unit": 8,
    "scale": [0, 4, 8, 12, 16, 24, 32, 48, 64]
  },
  "colors": {
    "approach": "muted",
    "maxColors": 5
  },
  "typography": {
    "scale": "modular",
    "ratio": 1.25
  }
}
```

## Examples

### Before (Cluttered)

```css
.card {
  background: linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb);
  border: 3px solid #ff6b6b;
  box-shadow: 0 10px 40px rgba(255, 107, 107, 0.5);
  border-radius: 20px;
  padding: 15px 23px 18px 21px;
}
```

### After (Japanese Principles)

```css
.card {
  background: #fafaf9;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 24px;
}
```

## Resources

- [Wabi-Sabi for Web Design](https://alistapart.com/article/wabi-sabi-for-web-design/)
- [Japanese Aesthetics](https://en.wikipedia.org/wiki/Japanese_aesthetics)
- [Ma (negative space)](https://en.wikipedia.org/wiki/Ma_(negative_space))
