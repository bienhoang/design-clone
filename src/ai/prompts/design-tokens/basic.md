# Design Token Extraction Prompt (Basic)

Analyze these website screenshots (desktop, tablet, mobile) and extract design tokens.

Return ONLY valid JSON in this exact format:

```json
{
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "text": {
      "primary": "#hex",
      "secondary": "#hex",
      "muted": "#hex"
    },
    "border": "#hex"
  },
  "typography": {
    "fontFamily": {
      "heading": "Font Name, sans-serif",
      "body": "Font Name, sans-serif"
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
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "6": "24px",
    "8": "32px",
    "12": "48px",
    "16": "64px"
  },
  "borderRadius": {
    "sm": "4px",
    "md": "8px",
    "lg": "16px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.1)",
    "lg": "0 10px 15px rgba(0,0,0,0.1)"
  },
  "notes": []
}
```

RULES:
1. Use exact 6-digit hex codes (#RRGGBB), not color names
2. Identify Google Fonts: Inter, Roboto, Open Sans, Poppins, Montserrat, Lato, Nunito, Raleway, Playfair Display, Merriweather
3. If font unknown, use reasonable fallback (sans-serif or serif)
4. Extract observed values; use sensible defaults if unclear
5. Detect spacing patterns (8px grid common)
6. Add any observations or accessibility concerns to notes array
