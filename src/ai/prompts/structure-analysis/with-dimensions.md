# Structure Analysis Prompt (With Extracted Dimensions)

Analyze this website screenshot using the EXACT extracted dimensions from `dimensions-summary.json` you read above.

## CRITICAL INSTRUCTIONS
1. USE ONLY the exact values from `dimensions-summary.json` - DO NOT estimate or approximate
2. All measurements were extracted from the actual DOM via getBoundingClientRect + getComputedStyle
3. When describing layout, reference these exact numbers
4. Section 5 MUST repeat these exact values verbatim

Use the following fields from `dimensions-summary.json`:
- `EXACT_DIMENSIONS.container_max_width` for container width
- `EXACT_DIMENSIONS.section_padding` for section padding
- `EXACT_DIMENSIONS.gap` for element gaps
- `EXACT_DIMENSIONS.card_dimensions.width/height/padding` for card measurements
- `EXACT_TYPOGRAPHY.h1/h2/h3/body` for font sizes
- `RESPONSIVE.desktop_breakpoint/tablet_breakpoint/mobile_breakpoint` for breakpoints
- `RESPONSIVE.typography_scaling` for responsive font scaling

---

Now output a markdown document following this structure.
IMPORTANT: In section 5, you MUST repeat the exact values from the JSON - do not change them.

# Page Structure Analysis

## 1. Header Section
- Logo: [describe position and layout]
- Navigation: [describe navigation structure]
- CTA Button: [if present]
- Mobile menu: [hamburger toggle if visible]

## 2. Hero Section
- Layout: [describe arrangement]
- Headline: font-size from EXACT_TYPOGRAPHY.h1 (EXACT), [describe style]
- Subheadline: [if present]
- Primary CTA: [button description]
- Background: [describe]

## 3. Content Sections
For each section describe:
- Section name/purpose
- Layout pattern using the EXACT gap value from EXACT_DIMENSIONS.gap
- Card dimensions from EXACT_DIMENSIONS.card_dimensions (EXACT)
- Components within

## 4. Footer Section
- Layout: [describe]
- Content blocks

## 5. EXACT CSS Values (use these for generation - DO NOT MODIFY)
Copy ALL values directly from `dimensions-summary.json`:
- Container max-width, section padding, card dimensions, card padding, gap
- H1, H2, H3, body font sizes
- Desktop, tablet, mobile breakpoints

## 6. Responsive Behavior
- At tablet breakpoint: [describe layout changes]
- At mobile breakpoint: [describe layout changes]
- Typography scales from RESPONSIVE.typography_scaling

## 7. BEM Class Suggestions
[Suggest semantic class names for main components]
