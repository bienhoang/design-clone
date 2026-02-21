# Design Token Extraction Prompt (Section-Specific With CSS)

Analyze the section screenshot you are currently viewing, using the CSS context you read above.

Extract design tokens visible in THIS section. Use EXACT values from CSS when possible.

Return ONLY valid JSON:

```json
{
  "colors": {
    "background": "#exact-hex from CSS or screenshot",
    "text": "#exact-hex for text color",
    "heading": "#exact-hex for heading color",
    "accent": "#exact-hex for accent/CTA",
    "border": "#exact-hex if borders visible"
  },
  "typography": {
    "fontFamily": "exact font-family from CSS",
    "headingSize": "exact font-size for headings",
    "bodySize": "exact body font-size",
    "fontWeight": {
      "heading": "exact weight from CSS",
      "body": "exact weight from CSS"
    }
  },
  "spacing": {
    "sectionPadding": "exact padding from CSS",
    "elementGap": "exact gap/margin",
    "containerPadding": "exact container padding"
  },
  "borderRadius": "exact radius from CSS or null",
  "shadow": "exact box-shadow from CSS or null",
  "notes": ["list any CSS custom properties found"]
}
```

RULES:
1. Extract EXACT hex codes from CSS
2. Use null for values not visible in this section
3. Note any CSS variables (--color-*, --space-*)
