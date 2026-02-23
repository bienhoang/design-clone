# AI Analysis

Gemini Vision integration for structure analysis and design token extraction.

## Overview

AI analysis provides:
- **Structure Analysis** - Page layout and component hierarchy
- **Design Tokens** - Colors, typography, spacing values

Requires `GEMINI_API_KEY` environment variable.

## Setup

### Get API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create new API key
3. Copy the key

### Configure

Add to environment:

```bash
# Option 1: Shell profile (~/.zshrc or ~/.bashrc)
export GEMINI_API_KEY="your-api-key-here"

# Option 2: Claude config (~/.claude/.env)
GEMINI_API_KEY=your-api-key-here
```

### Verify

```bash
# Test API connection
python -c "
import google.generativeai as genai
import os
genai.configure(api_key=os.environ['GEMINI_API_KEY'])
print('API configured successfully')
"
```

## Structure Analysis

### Run Analysis

```bash
python src/ai/analyze-structure.py \
  -s ./output/desktop.png \
  -o ./output \
  --html ./output/source.html \
  --css ./output/source.css
```

### Output: structure.md

```markdown
# Page Structure Analysis

## Overview
Modern SaaS landing page with hero section, features grid,
testimonials, and CTA. Uses dark theme with blue accents.

## Sections

### 1. Navigation (Fixed)
- Logo: Left-aligned
- Menu: Right-aligned, 5 items
- CTA Button: "Get Started"
- Mobile: Hamburger menu at 768px

### 2. Hero Section
- Layout: Two-column (text left, image right)
- Headline: Large, bold, gradient text
- Subheadline: Muted gray, max-width 600px
- CTAs: Primary + Secondary buttons
- Image: Dashboard mockup with shadow

### 3. Features Grid
- Layout: 3-column grid (2 on tablet, 1 on mobile)
- Cards: Icon, heading, description
- Spacing: 32px gap
- Icons: Duotone style, brand color

### 4. Testimonials
- Layout: Carousel with dots
- Card: Avatar, quote, name, title
- Style: Bordered cards, subtle shadow

### 5. CTA Section
- Background: Gradient (brand colors)
- Content: Centered, white text
- Button: Large, white with brand text

### 6. Footer
- Layout: 4-column grid
- Sections: Product, Company, Resources, Legal
- Bottom: Copyright, social links
```

## Design Token Extraction

### Run Extraction

```bash
python src/ai/extract-design-tokens.py \
  -s ./output/desktop.png \
  -o ./output
```

### Output: tokens.json

```json
{
  "colors": {
    "primary": {
      "50": "#eff6ff",
      "100": "#dbeafe",
      "500": "#3b82f6",
      "600": "#2563eb",
      "700": "#1d4ed8"
    },
    "neutral": {
      "50": "#f8fafc",
      "100": "#f1f5f9",
      "500": "#64748b",
      "900": "#0f172a"
    },
    "semantic": {
      "success": "#22c55e",
      "warning": "#f59e0b",
      "error": "#ef4444"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": "Inter, system-ui, sans-serif",
      "mono": "Fira Code, monospace"
    },
    "fontSize": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px"
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.25,
      "normal": 1.5,
      "relaxed": 1.75
    }
  },
  "spacing": {
    "0": "0",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px"
  },
  "borderRadius": {
    "none": "0",
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.1)",
    "lg": "0 10px 15px rgba(0,0,0,0.1)",
    "xl": "0 20px 25px rgba(0,0,0,0.15)"
  }
}
```

## Combined Analysis

Run both in pixel-perfect workflow:

```bash
/design:clone-px https://example.com
```

This automatically runs:
1. Screenshot capture
2. HTML/CSS extraction
3. Asset extraction
4. Structure analysis
5. Token extraction

## Options

### Analysis Options

```bash
python src/ai/analyze-structure.py \
  -s ./output/desktop.png \
  -o ./output \
  --detail high          # Analysis detail level
  --sections             # Focus on sections only
  --components           # Focus on components
```

### Token Options

```bash
python src/ai/extract-design-tokens.py \
  -s ./output/desktop.png \
  -o ./output \
  --format css           # Output as CSS variables
  --format tailwind      # Output as Tailwind config
```

## Troubleshooting

### API Key Invalid

```
Error: API key not valid
```

1. Verify key at AI Studio
2. Check for extra spaces
3. Regenerate if needed

### Rate Limited

```
Error: Resource exhausted
```

Gemini has rate limits. Wait and retry, or use paid tier.

### Image Too Large

```
Error: Image size exceeds limit
```

Reduce screenshot size or crop to specific section.

### Analysis Inaccurate

AI analysis is best-effort. For better results:
1. Use clear, uncluttered designs
2. Capture full-page screenshots
3. Ensure good contrast
