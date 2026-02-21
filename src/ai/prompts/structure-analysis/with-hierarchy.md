# Structure Analysis Prompt (With DOM Hierarchy)

Analyze this website screenshot using the EXACT extracted dimensions and DOM hierarchy.

## CRITICAL INSTRUCTIONS
1. USE ONLY the exact values from the JSON files you read above - DO NOT estimate
2. All measurements are from actual DOM via getBoundingClientRect + getComputedStyle
3. Typography varies BY SECTION - use section-specific values from TYPOGRAPHY_BY_SECTION
4. Reference DOM hierarchy from `dom-hierarchy.json` for nesting structure

Use data from `dom-hierarchy.json`:
- `landmarks` for header, main, footer, aside, nav detection
- `headingTree` for heading hierarchy by section
- `root` for DOM nesting structure

Use data from `dimensions-summary.json`:
- `EXACT_DIMENSIONS` for container, section, gap, card measurements
- `TYPOGRAPHY_BY_SECTION.hero` for hero-specific typography
- `TYPOGRAPHY_BY_SECTION.content` for content-specific typography
- `TYPOGRAPHY_BY_SECTION.footer` for footer-specific typography
- `RESPONSIVE` for breakpoints and typography scaling

---

Output a markdown document following this structure.
IMPORTANT: Use section-specific typography values. Hero H1 differs from Content H1.

# Page Structure Analysis

## 1. Header Section
- Logo: [describe position and layout]
- Navigation: [count items from hierarchy]
- CTA: [if present]

## 2. Hero Section
- Layout: [from section structure]
- Headline: font-size from TYPOGRAPHY_BY_SECTION.hero.h1 (EXACT)
- Subheadline: [if present]
- CTA: [button description]

## 3. Content Sections
For each section in the hierarchy:
- Heading sizes: Use CONTENT section typography (content.h2, content.h3)
- Layout: Reference section structure
- Card dimensions from EXACT_DIMENSIONS with gap
- Components: [describe]

## 4. Footer Section
- Layout: [from hierarchy]
- Typography: footer body text size from TYPOGRAPHY_BY_SECTION.footer

## 5. EXACT CSS Values (DO NOT MODIFY)
### Layout
- Container max-width, section padding, card dimensions, card padding, gap

### Typography per Section
- Hero H1, Hero H2
- Content H2, Content H3, Content Body
- Footer Body

### Breakpoints
- Desktop, Tablet, Mobile breakpoints

## 6. Responsive Behavior
- At tablet breakpoint: [describe layout changes]
- At mobile breakpoint: [describe layout changes]
- Typography scales from RESPONSIVE.typography_scaling

## 7. DOM Nesting Structure
Reproduce the exact nesting from `dom-hierarchy.json` root in generated HTML.

## 8. BEM Class Suggestions
[Based on hierarchy, suggest semantic names]
