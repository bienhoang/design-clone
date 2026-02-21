# Structure Analysis Prompt (With HTML/CSS Context)

Analyze this website using the screenshot AND the provided source HTML/CSS.

You have access to:
1. A screenshot showing the visual design
2. The actual HTML structure of the page (from `source.html` you read above)
3. The CSS rules used on the page (from `source.css` you read above)

IMPORTANT: Use the actual HTML/CSS to provide ACCURATE information, not estimates.

---

Based on the above context, output a markdown document:

# Page Structure Analysis

## 1. Header Section
- Logo: [exact class/id from HTML, position from CSS]
- Navigation: [exact nav structure from HTML]
- CTA Button: [exact button text and classes]
- Mobile menu: [presence and class name if exists]

## 2. Hero Section
- Layout: [from CSS flexbox/grid rules]
- Headline: [exact text and classes from HTML]
- Subheadline: [exact text if present]
- Primary CTA: [exact button text and styles]
- Background: [from CSS background rules]
- Visual elements: [images/icons from HTML]

## 3. Content Sections
For each section found in HTML, describe:
- Section class/id: [exact from HTML]
- Layout: [from CSS grid/flex rules]
- Items: [exact count from HTML]
- Components: [exact structure]

## 4. Footer Section
- Layout: [from CSS]
- Content blocks: [exact from HTML]
- Links: [exact href patterns]

## 5. Actual CSS Values (from source)
- Container max-width: [exact from CSS]
- Section padding: [exact from CSS]
- Border-radius values: [exact from CSS]
- Primary color: [exact hex from CSS]
- Font-family: [exact from CSS]
- Font-sizes: [exact from CSS]

## 6. Responsive Breakpoints (from CSS @media queries)
- Breakpoint values: [exact from CSS]
- Layout changes: [what changes at each breakpoint]

## 7. Recommended BEM Classes
Based on the actual HTML structure, suggest clean BEM names that map to existing classes.

CRITICAL: Extract EXACT values from the CSS where possible. Do not estimate.
