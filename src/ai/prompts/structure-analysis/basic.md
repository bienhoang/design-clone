# Structure Analysis Prompt (Basic)

Analyze this website screenshot and describe the page structure in detail.

Output a markdown document with the following sections:

# Page Structure Analysis

## 1. Header Section
- Logo: [position, size, type (text/image)]
- Navigation: [number of items, layout (horizontal/vertical)]
- CTA Button: [text, position, style]
- Mobile menu: [hamburger icon visible?]

## 2. Hero Section
- Layout: [centered/left-aligned/split]
- Headline: [estimated font size, weight, color]
- Subheadline: [if present, describe]
- Primary CTA: [button text, style]
- Secondary CTA: [if present]
- Background: [solid color/gradient/image]
- Visual elements: [images, illustrations, icons]

## 3. Content Sections
For each distinct section, describe:
- Section name/purpose: [features, testimonials, pricing, etc.]
- Layout pattern: [grid columns, cards, alternating left-right]
- Number of items: [e.g., 3 feature cards, 4 testimonials]
- Key components: [icons, images, headings, descriptions]

## 4. Footer Section
- Layout: [columns, stacked]
- Content blocks: [logo, links, social, newsletter]
- Copyright: [position, content]

## 5. Global Patterns
- Container max-width: [estimated px]
- Section padding: [estimated vertical spacing]
- Card/component style: [shadows, borders, rounded corners]
- Color scheme: [light/dark mode, accent colors]
- Typography style: [modern/classic, serif/sans-serif]

## 6. Responsive Hints
- Mobile-friendly indicators
- Collapsible elements
- Stack vs grid on small screens

## 7. BEM Class Suggestions
Suggest semantic BEM class names for main components:
- header, header__logo, header__nav, header__cta
- hero, hero__title, hero__subtitle, hero__cta
- section--features, feature-card, feature-card__icon
- footer, footer__links, footer__social

Be specific and detailed. This analysis will be used to generate HTML/CSS.
