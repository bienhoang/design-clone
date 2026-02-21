# Design Token Extraction Prompt (Section-Specific)

Analyze the section screenshot you are currently viewing and extract design tokens.

Focus on elements visible in THIS section only:
- Background colors and gradients
- Text colors (headings, body, links)
- Typography (font family, sizes, weights)
- Spacing patterns (padding, margins, gaps)
- Border radius and shadows
- Any accent or highlight colors

Return ONLY valid JSON:

```json
{
  "colors": {
    "background": "#hex or null if transparent",
    "text": "#hex for main text",
    "heading": "#hex for headings",
    "accent": "#hex for buttons/links/highlights",
    "border": "#hex if borders visible"
  },
  "typography": {
    "fontFamily": "observed font or best guess",
    "headingSize": "largest heading size in px",
    "bodySize": "body text size in px",
    "fontWeight": {
      "heading": 700,
      "body": 400
    }
  },
  "spacing": {
    "sectionPadding": "vertical padding estimate",
    "elementGap": "gap between elements",
    "containerPadding": "horizontal padding"
  },
  "borderRadius": "observed radius or null",
  "shadow": "observed shadow or null",
  "notes": ["observations about this section"]
}
```

RULES:
1. Use exact 6-digit hex codes (#RRGGBB)
2. If a value is not visible/applicable, use null
3. Focus only on what's visible in this section image
4. Add section-specific observations to notes
