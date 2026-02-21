# Design Token Extraction Prompt (With CSS Context)

Extract design tokens from the provided CSS and screenshots.

You have access to:
1. Screenshots showing the visual design
2. The actual CSS from `source.css` you read above

CRITICAL: Extract EXACT values from the CSS. Do not estimate colors or fonts.

---

Based on the CSS above, return ONLY valid JSON:

```json
{
  "colors": {
    "primary": "[exact hex from CSS, look for primary/brand colors]",
    "secondary": "[exact hex from CSS]",
    "accent": "[exact hex for accent/highlight colors]",
    "background": "[exact hex, usually body background]",
    "surface": "[exact hex for cards/sections]",
    "text": {
      "primary": "[exact hex, usually body color]",
      "secondary": "[exact hex for muted text]",
      "muted": "[exact hex for very light text]"
    },
    "border": "[exact hex for borders]"
  },
  "typography": {
    "fontFamily": {
      "heading": "[exact font-family from CSS h1-h6 rules]",
      "body": "[exact font-family from CSS body rule]"
    },
    "fontSize": {
      "xs": "[smallest font-size from CSS]",
      "sm": "[small font-size]",
      "base": "[body font-size]",
      "lg": "[larger font-size]",
      "xl": "[heading font-size]",
      "2xl": "[h3 font-size]",
      "3xl": "[h2 font-size]",
      "4xl": "[h1 font-size]"
    },
    "fontWeight": {
      "normal": "[normal weight from CSS]",
      "medium": "[medium weight]",
      "semibold": "[semibold weight]",
      "bold": "[bold weight from CSS]"
    },
    "lineHeight": {
      "tight": "[tight line-height, usually 1.2-1.3]",
      "normal": "[normal line-height, usually 1.5-1.6]",
      "relaxed": "[relaxed line-height, usually 1.7-1.8]"
    }
  },
  "spacing": {
    "1": "[4px or smallest spacing]",
    "2": "[8px]",
    "3": "[12px]",
    "4": "[16px - common padding]",
    "6": "[24px]",
    "8": "[32px]",
    "12": "[48px - section padding]",
    "16": "[64px - large section padding]"
  },
  "borderRadius": {
    "sm": "[small radius from CSS]",
    "md": "[medium radius]",
    "lg": "[large radius]",
    "full": "9999px"
  },
  "shadows": {
    "sm": "[small shadow from CSS box-shadow]",
    "md": "[medium shadow]",
    "lg": "[large shadow]"
  },
  "notes": ["List exact CSS custom properties/variables if found", "Note any @import URLs"]
}
```

RULES:
1. Extract EXACT hex codes from CSS, not approximate
2. Copy font-family values exactly as written
3. Extract actual px/rem values, convert rem to px if needed (1rem = 16px)
4. Look for CSS custom properties (--color-*, --font-*, --space-*)
5. If a value isn't in CSS, use screenshot to estimate
