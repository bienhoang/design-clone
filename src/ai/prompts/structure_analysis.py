"""
Structure Analysis Prompts

Prompts for analyzing website structure from screenshots using Gemini Vision.
"""

# Structure analysis prompt (basic - screenshot only)
STRUCTURE_PROMPT = """Analyze this website screenshot and describe the page structure in detail.

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

Be specific and detailed. This analysis will be used to generate HTML/CSS."""


# Enhanced prompt when HTML/CSS context is available
STRUCTURE_PROMPT_WITH_CONTEXT = """Analyze this website using the screenshot AND the provided source HTML/CSS.

You have access to:
1. A screenshot showing the visual design
2. The actual HTML structure of the page
3. The CSS rules used on the page

IMPORTANT: Use the actual HTML/CSS to provide ACCURATE information, not estimates.

## Source HTML Structure
```html
{html_snippet}
```

## Source CSS (key rules)
```css
{css_snippet}
```

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

CRITICAL: Extract EXACT values from the CSS where possible. Do not estimate."""


# Enhanced prompt when extracted dimensions are available (highest accuracy)
STRUCTURE_PROMPT_WITH_DIMENSIONS = """Analyze this website screenshot using the EXACT extracted dimensions below.

## CRITICAL INSTRUCTIONS
1. USE ONLY the exact values provided - DO NOT estimate or approximate
2. All measurements below are extracted from the actual DOM via getBoundingClientRect + getComputedStyle
3. When describing layout, reference these exact numbers
4. Section 5 MUST repeat these exact values verbatim

## EXACT EXTRACTED DIMENSIONS

### Layout
- Container max-width: {container_max_width}
- Section padding: {section_padding}
- Gap between elements: {gap}

### Cards
- Card width: {card_width}
- Card height: {card_height}
- Card padding: {card_padding}

### Typography (EXACT from source)
- H1 font-size: {h1}
- H2 font-size: {h2}
- H3 font-size: {h3}
- Body font-size: {body}

### Responsive Breakpoints
- Desktop: {desktop_breakpoint}
- Tablet: {tablet_breakpoint}
- Mobile: {mobile_breakpoint}

### Typography Scaling
- H1: {h1} → {h1_tablet} (tablet) → {h1_mobile} (mobile)
- H2: {h2} → {h2_tablet} (tablet) → {h2_mobile} (mobile)

---

Now output a markdown document following this structure.
IMPORTANT: In section 5, you MUST repeat the exact values above - do not change them.

# Page Structure Analysis

## 1. Header Section
- Logo: [describe position and layout]
- Navigation: [describe navigation structure]
- CTA Button: [if present]
- Mobile menu: [hamburger toggle if visible]

## 2. Hero Section
- Layout: [describe arrangement]
- Headline: font-size {h1} (EXACT), [describe style]
- Subheadline: [if present]
- Primary CTA: [button description]
- Background: [describe]

## 3. Content Sections
For each section describe:
- Section name/purpose
- Layout pattern using the EXACT gap value: {gap}
- Card dimensions: {card_width} x {card_height} (EXACT)
- Components within

## 4. Footer Section
- Layout: [describe]
- Content blocks

## 5. EXACT CSS Values (use these for generation - DO NOT MODIFY)
- Container max-width: {container_max_width}
- Section padding: {section_padding}
- Card dimensions: {card_width} x {card_height}
- Card padding: {card_padding}
- Gap: {gap}
- H1: {h1}
- H2: {h2}
- H3: {h3}
- Body: {body}
- Desktop breakpoint: {desktop_breakpoint}
- Tablet breakpoint: {tablet_breakpoint}
- Mobile breakpoint: {mobile_breakpoint}

## 6. Responsive Behavior
- At {tablet_breakpoint}: [describe layout changes]
- At {mobile_breakpoint}: [describe layout changes]
- Typography scales: H1 {h1} → {h1_tablet} → {h1_mobile}

## 7. BEM Class Suggestions
[Suggest semantic class names for main components]"""


# Enhanced prompt when DOM hierarchy is available (highest accuracy)
STRUCTURE_PROMPT_WITH_HIERARCHY = """Analyze this website screenshot using the EXACT extracted dimensions and DOM hierarchy below.

## CRITICAL INSTRUCTIONS
1. USE ONLY the exact values provided - DO NOT estimate
2. All measurements are from actual DOM via getBoundingClientRect + getComputedStyle
3. Typography varies BY SECTION - use section-specific values
4. Reference DOM hierarchy for nesting structure

## EXTRACTED DOM HIERARCHY

### Landmarks Found
- Header: {header_found}
- Main content: {main_found}
- Footer: {footer_found}
- Sidebars: {sidebar_count}
- Nav elements: {nav_count}

### Heading Hierarchy (by section)
{heading_hierarchy}

### Section Structure
{section_structure}

## EXACT DIMENSIONS

### Container Layout
- Max container width: {container_max_width}
- Section padding: {section_padding}
- Element gap: {gap}

### Cards
- Card width: {card_width}
- Card height: {card_height}
- Card padding: {card_padding}

### Typography BY SECTION (use these exact values per context)

#### Hero Section
- H1: {hero_h1}
- H2: {hero_h2}
- Body: {hero_body}

#### Content Section
- H2: {content_h2}
- H3: {content_h3}
- Body: {content_body}

#### Footer Section
- Body: {footer_body}

### Responsive Breakpoints
- Desktop: {desktop_breakpoint}
- Tablet: {tablet_breakpoint}
- Mobile: {mobile_breakpoint}

### Typography Scaling
- H1: {hero_h1} → {h1_tablet} (tablet) → {h1_mobile} (mobile)
- H2: {content_h2} → {h2_tablet} (tablet) → {h2_mobile} (mobile)

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
- Headline: font-size {hero_h1} (EXACT)
- Subheadline: [if present]
- CTA: [button description]

## 3. Content Sections
For each section in the hierarchy:
- Heading sizes: Use CONTENT section typography ({content_h2}, {content_h3})
- Layout: Reference section structure
- Card dimensions: {card_width} x {card_height} with gap {gap}
- Components: [describe]

## 4. Footer Section
- Layout: [from hierarchy]
- Typography: {footer_body} body text

## 5. EXACT CSS Values (DO NOT MODIFY)
### Layout
- Container max-width: {container_max_width}
- Section padding: {section_padding}
- Card dimensions: {card_width} x {card_height}
- Card padding: {card_padding}
- Gap: {gap}

### Typography per Section
- Hero H1: {hero_h1}
- Hero H2: {hero_h2}
- Content H2: {content_h2}
- Content H3: {content_h3}
- Content Body: {content_body}
- Footer Body: {footer_body}

### Breakpoints
- Desktop: {desktop_breakpoint}
- Tablet: {tablet_breakpoint}
- Mobile: {mobile_breakpoint}

## 6. Responsive Behavior
- At {tablet_breakpoint}: [describe layout changes]
- At {mobile_breakpoint}: [describe layout changes]
- Typography scales: H1 {hero_h1} → {h1_tablet} → {h1_mobile}

## 7. DOM Nesting Structure
Reproduce this exact nesting in generated HTML:
{dom_nesting}

## 8. BEM Class Suggestions
[Based on hierarchy, suggest semantic names]"""


def format_heading_hierarchy(heading_tree: list) -> str:
    """Format heading tree for prompt.

    Args:
        heading_tree: List of heading objects with level, section, text

    Returns:
        Formatted string showing heading hierarchy
    """
    if not heading_tree:
        return "No headings detected"

    lines = []
    for h in heading_tree[:10]:  # Limit for token efficiency
        indent = '  ' * (h.get('level', 1) - 1)
        section = h.get('section', 'content')
        text = h.get('text', '')[:30] if h.get('text') else ''
        lines.append(f"{indent}- H{h.get('level', 1)} ({section}): \"{text}...\"")

    return '\n'.join(lines)


def format_section_structure(landmarks: dict, sections: dict) -> str:
    """Format section structure for prompt.

    Args:
        landmarks: W3C landmarks from DOM hierarchy
        sections: Section info from dimensions

    Returns:
        Formatted string showing section structure
    """
    lines = []

    if landmarks.get('header'):
        lines.append("- Header: Present (semantic <header>)")
    if sections.get('hero', {}).get('found'):
        width = sections['hero'].get('containerWidth', 'unknown')
        lines.append(f"- Hero: Present (container width: {width}px)")
    if landmarks.get('main'):
        lines.append("- Main: Present (semantic <main>)")
    if sections.get('content', {}).get('found'):
        width = sections['content'].get('containerWidth', 'unknown')
        lines.append(f"- Content: Present (container width: {width}px)")
    if landmarks.get('aside'):
        lines.append(f"- Sidebars: {len(landmarks['aside'])} detected")
    if landmarks.get('footer'):
        lines.append("- Footer: Present (semantic <footer>)")

    return '\n'.join(lines) if lines else "No sections detected"


def format_dom_nesting(root: dict, max_depth: int = 4) -> str:
    """Format simplified DOM nesting for prompt.

    Args:
        root: Root node from DOM hierarchy
        max_depth: Maximum depth to traverse

    Returns:
        Formatted string showing DOM nesting structure
    """
    if not root:
        return "No DOM structure available"

    lines = []

    def walk(node, depth):
        if depth > max_depth or not node:
            return
        if not node.get('role'):
            # Skip non-semantic nodes in output
            for child in node.get('children', [])[:5]:
                walk(child, depth)
            return

        indent = '  ' * depth
        tag = node.get('tagName', 'div')
        role = node.get('role', '')
        lines.append(f"{indent}<{tag}> <!-- {role} -->")

        for child in node.get('children', [])[:5]:  # Limit children
            walk(child, depth + 1)

    walk(root, 0)
    return '\n'.join(lines[:30])  # Limit total lines


def build_hierarchy_prompt(dimensions: dict, hierarchy: dict) -> str:
    """Build prompt with DOM hierarchy context.

    Args:
        dimensions: Extracted dimensions summary
        hierarchy: DOM hierarchy data

    Returns:
        Formatted prompt string with hierarchy context
    """
    exact = dimensions.get('EXACT_DIMENSIONS', {})
    typo = dimensions.get('EXACT_TYPOGRAPHY', {})
    typo_by_section = dimensions.get('TYPOGRAPHY_BY_SECTION', {})
    resp = dimensions.get('RESPONSIVE', {})
    sections = dimensions.get('SECTIONS', {})
    card = exact.get('card_dimensions', {})
    scaling = resp.get('typography_scaling', {})

    # Extract hierarchy data
    landmarks = hierarchy.get('landmarks', {})
    heading_tree = hierarchy.get('headingTree', [])

    # Format heading hierarchy
    heading_hierarchy = format_heading_hierarchy(heading_tree)

    # Format section structure
    section_structure = format_section_structure(landmarks, sections)

    # Format DOM nesting (simplified)
    dom_nesting = format_dom_nesting(hierarchy.get('root'))

    # Get section-specific typography
    hero_typo = typo_by_section.get('hero', {})
    content_typo = typo_by_section.get('content', {})
    footer_typo = typo_by_section.get('footer', {})

    return STRUCTURE_PROMPT_WITH_HIERARCHY.format(
        # Landmarks
        header_found='Yes' if landmarks.get('header') else 'No',
        main_found='Yes' if landmarks.get('main') else 'No',
        footer_found='Yes' if landmarks.get('footer') else 'No',
        sidebar_count=len(landmarks.get('aside', [])),
        nav_count=len(landmarks.get('nav', [])),

        # Heading hierarchy
        heading_hierarchy=heading_hierarchy,
        section_structure=section_structure,

        # Dimensions
        container_max_width=exact.get('container_max_width', '1200px'),
        section_padding=exact.get('section_padding', '64px 0'),
        gap=exact.get('gap', '24px'),
        card_width=card.get('width', '380px') if isinstance(card, dict) else '380px',
        card_height=card.get('height', 'auto') if isinstance(card, dict) else 'auto',
        card_padding=card.get('padding', '24px') if isinstance(card, dict) else '24px',

        # Typography by section
        hero_h1=hero_typo.get('h1', typo.get('h1', '64px')),
        hero_h2=hero_typo.get('h2', typo.get('h2', '48px')),
        hero_body=hero_typo.get('p', typo.get('body', '18px')),
        content_h2=content_typo.get('h2', typo.get('h2', '32px')),
        content_h3=content_typo.get('h3', typo.get('h3', '24px')),
        content_body=content_typo.get('p', typo.get('body', '16px')),
        footer_body=footer_typo.get('p', '14px'),

        # Breakpoints
        desktop_breakpoint=resp.get('desktop_breakpoint', '1440px'),
        tablet_breakpoint=resp.get('tablet_breakpoint', '768px'),
        mobile_breakpoint=resp.get('mobile_breakpoint', '375px'),

        # Typography scaling
        h1_tablet=scaling.get('h1', {}).get('tablet', '36px') if isinstance(scaling.get('h1'), dict) else '36px',
        h1_mobile=scaling.get('h1', {}).get('mobile', '28px') if isinstance(scaling.get('h1'), dict) else '28px',
        h2_tablet=scaling.get('h2', {}).get('tablet', '28px') if isinstance(scaling.get('h2'), dict) else '28px',
        h2_mobile=scaling.get('h2', {}).get('mobile', '24px') if isinstance(scaling.get('h2'), dict) else '24px',

        # DOM nesting
        dom_nesting=dom_nesting
    )


def build_structure_prompt(
    html_content: str = None,
    css_content: str = None,
    dimensions: dict = None,
    content_summary: str = None,
    hierarchy: dict = None
) -> str:
    """Build the appropriate prompt based on available context.

    Priority:
    1. With hierarchy + dimensions (most accurate - full DOM context)
    2. With dimensions (accurate - uses exact extracted values)
    3. With HTML/CSS (accurate - extracts from source)
    4. Screenshot only (least accurate - estimates)

    Args:
        html_content: Source HTML (optional)
        css_content: Source CSS (optional)
        dimensions: Extracted dimensions summary (optional)
        content_summary: Content counts markdown (optional)
        hierarchy: DOM hierarchy data (optional)

    Returns:
        Appropriate prompt string based on available context
    """

    # Helper to append content summary
    def append_content_counts(prompt: str) -> str:
        if content_summary:
            return prompt + "\n\n---\n\n" + content_summary + "\n\nIMPORTANT: Use the EXACT item counts above when describing sections. Do NOT estimate."
        return prompt

    # Priority 1: Use hierarchy + dimensions if available (highest accuracy)
    if hierarchy and dimensions:
        return append_content_counts(build_hierarchy_prompt(dimensions, hierarchy))

    # Priority 2: Use dimensions if available
    if dimensions:
        exact = dimensions.get('EXACT_DIMENSIONS', {})
        typo = dimensions.get('EXACT_TYPOGRAPHY', {})
        resp = dimensions.get('RESPONSIVE', {})
        card = exact.get('card_dimensions', {})
        scaling = resp.get('typography_scaling', {})

        return append_content_counts(STRUCTURE_PROMPT_WITH_DIMENSIONS.format(
            container_max_width=exact.get('container_max_width', '1200px'),
            section_padding=exact.get('section_padding', '64px 0'),
            gap=exact.get('gap', '24px'),
            card_width=card.get('width', '380px') if isinstance(card, dict) else '380px',
            card_height=card.get('height', 'auto') if isinstance(card, dict) else 'auto',
            card_padding=card.get('padding', '24px') if isinstance(card, dict) else '24px',
            h1=typo.get('h1', '48px'),
            h2=typo.get('h2', '36px'),
            h3=typo.get('h3', '28px'),
            body=typo.get('body', '16px'),
            desktop_breakpoint=resp.get('desktop_breakpoint', '1440px'),
            tablet_breakpoint=resp.get('tablet_breakpoint', '768px'),
            mobile_breakpoint=resp.get('mobile_breakpoint', '375px'),
            h1_tablet=scaling.get('h1', {}).get('tablet', '36px') if isinstance(scaling.get('h1'), dict) else '36px',
            h1_mobile=scaling.get('h1', {}).get('mobile', '28px') if isinstance(scaling.get('h1'), dict) else '28px',
            h2_tablet=scaling.get('h2', {}).get('tablet', '28px') if isinstance(scaling.get('h2'), dict) else '28px',
            h2_mobile=scaling.get('h2', {}).get('mobile', '24px') if isinstance(scaling.get('h2'), dict) else '24px'
        ))

    # Priority 2: Use HTML/CSS if available
    if html_content and css_content:
        # Truncate for token limits - Gemini 2.5 Flash supports 1M tokens (~4MB)
        # Using 100KB each to capture full page structure while staying well within limits
        html_snippet = html_content[:100000] if len(html_content) > 100000 else html_content
        css_snippet = css_content[:100000] if len(css_content) > 100000 else css_content

        return append_content_counts(STRUCTURE_PROMPT_WITH_CONTEXT.format(
            html_snippet=html_snippet,
            css_snippet=css_snippet
        ))

    # Priority 3: Screenshot only (fallback)
    return append_content_counts(STRUCTURE_PROMPT)
