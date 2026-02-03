"""
Design Token Extraction Prompts

Prompts for extracting design tokens from screenshots using Gemini Vision.
"""

# Design token extraction prompt (basic - screenshot only)
EXTRACTION_PROMPT = """Analyze these website screenshots (desktop, tablet, mobile) and extract design tokens.

Return ONLY valid JSON in this exact format:

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

RULES:
1. Use exact 6-digit hex codes (#RRGGBB), not color names
2. Identify Google Fonts: Inter, Roboto, Open Sans, Poppins, Montserrat, Lato, Nunito, Raleway, Playfair Display, Merriweather
3. If font unknown, use reasonable fallback (sans-serif or serif)
4. Extract observed values; use sensible defaults if unclear
5. Detect spacing patterns (8px grid common)
6. Add any observations or accessibility concerns to notes array"""


# Enhanced prompt when CSS context is available
EXTRACTION_PROMPT_WITH_CSS = """Extract design tokens from the provided CSS and screenshots.

You have access to:
1. Screenshots showing the visual design
2. The actual CSS used on the page

CRITICAL: Extract EXACT values from the CSS. Do not estimate colors or fonts.

## Source CSS
```css
{css_content}
```

---

Based on the CSS above, return ONLY valid JSON:

{{
  "colors": {{
    "primary": "[exact hex from CSS, look for primary/brand colors]",
    "secondary": "[exact hex from CSS]",
    "accent": "[exact hex for accent/highlight colors]",
    "background": "[exact hex, usually body background]",
    "surface": "[exact hex for cards/sections]",
    "text": {{
      "primary": "[exact hex, usually body color]",
      "secondary": "[exact hex for muted text]",
      "muted": "[exact hex for very light text]"
    }},
    "border": "[exact hex for borders]"
  }},
  "typography": {{
    "fontFamily": {{
      "heading": "[exact font-family from CSS h1-h6 rules]",
      "body": "[exact font-family from CSS body rule]"
    }},
    "fontSize": {{
      "xs": "[smallest font-size from CSS]",
      "sm": "[small font-size]",
      "base": "[body font-size]",
      "lg": "[larger font-size]",
      "xl": "[heading font-size]",
      "2xl": "[h3 font-size]",
      "3xl": "[h2 font-size]",
      "4xl": "[h1 font-size]"
    }},
    "fontWeight": {{
      "normal": [normal weight from CSS],
      "medium": [medium weight],
      "semibold": [semibold weight],
      "bold": [bold weight from CSS]
    }},
    "lineHeight": {{
      "tight": [tight line-height, usually 1.2-1.3],
      "normal": [normal line-height, usually 1.5-1.6],
      "relaxed": [relaxed line-height, usually 1.7-1.8]
    }}
  }},
  "spacing": {{
    "1": "[4px or smallest spacing]",
    "2": "[8px]",
    "3": "[12px]",
    "4": "[16px - common padding]",
    "6": "[24px]",
    "8": "[32px]",
    "12": "[48px - section padding]",
    "16": "[64px - large section padding]"
  }},
  "borderRadius": {{
    "sm": "[small radius from CSS]",
    "md": "[medium radius]",
    "lg": "[large radius]",
    "full": "9999px"
  }},
  "shadows": {{
    "sm": "[small shadow from CSS box-shadow]",
    "md": "[medium shadow]",
    "lg": "[large shadow]"
  }},
  "notes": ["List exact CSS custom properties/variables if found", "Note any @import URLs"]
}}

RULES:
1. Extract EXACT hex codes from CSS, not approximate
2. Copy font-family values exactly as written
3. Extract actual px/rem values, convert rem to px if needed (1rem = 16px)
4. Look for CSS custom properties (--color-*, --font-*, --space-*)
5. If a value isn't in CSS, use screenshot to estimate"""


def build_extraction_prompt(css_content: str = None) -> str:
    """Build prompt with or without CSS context."""
    if css_content:
        # Truncate if too long (15KB limit)
        css_snippet = css_content[:15000] if len(css_content) > 15000 else css_content
        return EXTRACTION_PROMPT_WITH_CSS.format(css_content=css_snippet)
    return EXTRACTION_PROMPT
