# What is Design Clone?

Design Clone is a Claude Code skill for cloning website designs through multi-viewport screenshots, HTML/CSS extraction, and optional AI analysis.

## The Problem

When recreating or analyzing website designs, developers typically need to:

1. Take screenshots at multiple viewport sizes manually
2. Use browser DevTools to extract and filter CSS
3. Download assets one by one
4. Manually identify design patterns and tokens

This process is tedious and error-prone.

## The Solution

Design Clone automates the entire workflow:

```bash
/design:clone-px https://example.com
```

This single command:
- Captures screenshots at 3 viewport sizes
- Extracts and filters HTML/CSS
- Downloads all assets (images, fonts, icons)
- Analyzes structure with AI (optional)
- Extracts design tokens

## Key Features

### Multi-Viewport Screenshots

Captures at standard breakpoints:
- **Desktop**: 1920×1080px
- **Tablet**: 768×1024px
- **Mobile**: 375×812px

### CSS Filtering

Removes unused CSS rules by:
1. Parsing extracted HTML
2. Analyzing which selectors are actually used
3. Filtering out dead code

Typical reduction: 30-50% smaller CSS files.

### AI Analysis

With `GEMINI_API_KEY` configured:
- Identifies page sections automatically
- Extracts color palette
- Documents typography hierarchy
- Maps spacing patterns

### Design Principles

Built with Japanese design philosophy:

| Principle | Meaning | Application |
|-----------|---------|-------------|
| Ma (間) | Negative space | Generous whitespace |
| Kanso (簡素) | Simplicity | Clean typography |
| Shibui (渋い) | Elegant restraint | Subtle shadows |
| Seijaku (静寂) | Tranquility | Calm colors |

## Use Cases

- **Design Recreation**: Clone a design to rebuild in a different framework
- **Design Documentation**: Generate comprehensive design system docs
- **Competitive Analysis**: Understand how competitors structure their UIs
- **Learning**: Study professional designs in detail
- **Archival**: Preserve website designs before they change

## Requirements

- Node.js 18+
- Python 3.9+ (for AI analysis)
- Chrome/Chromium browser
