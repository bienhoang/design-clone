"""
UX Audit Prompts

Prompts for analyzing screenshots with Gemini Vision for UX quality assessment.
Evaluates visual hierarchy, navigation, typography, spacing, interactivity, and responsive design.
"""

# Main UX audit prompt
UX_AUDIT_PROMPT = """Analyze this website screenshot for UX quality.

Evaluate these categories (score 0-100 each):

1. VISUAL HIERARCHY
   - Primary content prominence
   - Clear scanning patterns (F/Z pattern)
   - Call-to-action visibility
   - Information grouping and prioritization
   - White space utilization

2. NAVIGATION
   - Tappable area size (44x44px minimum for mobile)
   - Current page indicator clarity
   - Menu discoverability
   - Breadcrumb/location awareness
   - Navigation consistency

3. TYPOGRAPHY
   - Body text size (16px+ recommended)
   - Line height (1.4-1.6 ideal)
   - Contrast ratio (WCAG AA: 4.5:1 for text)
   - Font hierarchy clarity
   - Readability at viewport size

4. SPACING
   - Consistent padding/margins
   - Element breathing room
   - Touch target spacing (8px minimum between)
   - Grid alignment
   - Section separation

5. INTERACTIVE ELEMENTS
   - Button affordance (looks clickable)
   - Link distinguishability
   - Focus state visibility
   - Hover state indication
   - Form field clarity

6. RESPONSIVE
   - Content reflow appropriateness
   - No horizontal scroll
   - Image scaling quality
   - Text truncation handling
   - Breakpoint transitions

Return ONLY valid JSON in this exact format:
{
  "viewport": "<mobile|tablet|desktop>",
  "scores": {
    "visual_hierarchy": <0-100>,
    "navigation": <0-100>,
    "typography": <0-100>,
    "spacing": <0-100>,
    "interactivity": <0-100>,
    "responsive": <0-100>
  },
  "overall_ux_score": <0-100>,
  "accessibility_score": <0-100>,
  "issues": [
    {
      "category": "<visual_hierarchy|navigation|typography|spacing|interactivity|responsive>",
      "severity": "<critical|major|minor>",
      "issue": "<concise description>",
      "fix": "<actionable suggestion>"
    }
  ],
  "recommendations": ["<actionable improvement item>"]
}

SEVERITY GUIDELINES:
- critical: Blocks user tasks or causes confusion (0-30 score range issues)
- major: Degrades experience significantly (31-60 score range issues)
- minor: Polish improvements (61-80 score range issues)

SCORING GUIDELINES:
- 90-100: Excellent, industry-leading UX
- 70-89: Good, meets modern standards
- 50-69: Adequate, room for improvement
- 30-49: Poor, significant issues
- 0-29: Critical, requires immediate attention"""


# Viewport-specific prompt suffix
VIEWPORT_CONTEXT = {
    'mobile': """
MOBILE-SPECIFIC CHECKS:
- Touch targets minimum 44x44px
- Thumb zone accessibility
- Single-column layout efficiency
- Mobile navigation pattern (hamburger/tab bar)
- Text readable without zooming
- Forms optimized for mobile input""",

    'tablet': """
TABLET-SPECIFIC CHECKS:
- Two-column layout utilization
- Touch and mouse input support
- Landscape/portrait adaptability
- Sidebar vs content balance
- Split-view readiness""",

    'desktop': """
DESKTOP-SPECIFIC CHECKS:
- Maximum content width (1200-1440px ideal)
- Multi-column layout efficiency
- Hover states and micro-interactions
- Keyboard navigation support
- Large screen real estate utilization"""
}


def build_ux_audit_prompt(viewport: str = 'desktop') -> str:
    """Build viewport-specific UX audit prompt.

    Args:
        viewport: 'mobile', 'tablet', or 'desktop'

    Returns:
        Complete prompt string with viewport-specific checks
    """
    base_prompt = UX_AUDIT_PROMPT

    viewport_lower = viewport.lower()
    if viewport_lower in VIEWPORT_CONTEXT:
        base_prompt += f"\n\n{VIEWPORT_CONTEXT[viewport_lower]}"

    return base_prompt


# Aggregation prompt for combining viewport results
AGGREGATION_PROMPT = """Combine these viewport-specific UX audit results into a final assessment.

Desktop results: {desktop_results}
Tablet results: {tablet_results}
Mobile results: {mobile_results}

Create a unified report that:
1. Averages scores across viewports (weighted: desktop 40%, tablet 30%, mobile 30%)
2. Prioritizes issues by severity and viewport impact
3. Consolidates duplicate issues
4. Ranks recommendations by impact

Return JSON:
{
  "overall_scores": {
    "visual_hierarchy": <weighted_avg>,
    "navigation": <weighted_avg>,
    "typography": <weighted_avg>,
    "spacing": <weighted_avg>,
    "interactivity": <weighted_avg>,
    "responsive": <weighted_avg>
  },
  "overall_ux_score": <weighted_avg>,
  "accessibility_score": <weighted_avg>,
  "viewport_breakdown": {
    "desktop": <ux_score>,
    "tablet": <ux_score>,
    "mobile": <ux_score>
  },
  "top_issues": [
    {
      "category": "<category>",
      "severity": "<severity>",
      "issue": "<description>",
      "fix": "<suggestion>",
      "viewports_affected": ["<viewport>"]
    }
  ],
  "prioritized_recommendations": ["<ranked by impact>"]
}"""


def build_aggregation_prompt(desktop: dict, tablet: dict, mobile: dict) -> str:
    """Build prompt for aggregating viewport results.

    Args:
        desktop: Desktop viewport audit results
        tablet: Tablet viewport audit results
        mobile: Mobile viewport audit results

    Returns:
        Aggregation prompt with results embedded
    """
    import json
    return AGGREGATION_PROMPT.format(
        desktop_results=json.dumps(desktop, indent=2) if desktop else "Not available",
        tablet_results=json.dumps(tablet, indent=2) if tablet else "Not available",
        mobile_results=json.dumps(mobile, indent=2) if mobile else "Not available"
    )
