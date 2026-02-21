# UX Audit Prompt (Desktop Viewport)

Analyze this website screenshot for UX quality.

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
```json
{
  "viewport": "desktop",
  "scores": {
    "visual_hierarchy": 0,
    "navigation": 0,
    "typography": 0,
    "spacing": 0,
    "interactivity": 0,
    "responsive": 0
  },
  "overall_ux_score": 0,
  "accessibility_score": 0,
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
```

SEVERITY GUIDELINES:
- critical: Blocks user tasks or causes confusion (0-30 score range issues)
- major: Degrades experience significantly (31-60 score range issues)
- minor: Polish improvements (61-80 score range issues)

SCORING GUIDELINES:
- 90-100: Excellent, industry-leading UX
- 70-89: Good, meets modern standards
- 50-69: Adequate, room for improvement
- 30-49: Poor, significant issues
- 0-29: Critical, requires immediate attention

DESKTOP-SPECIFIC CHECKS:
- Maximum content width (1200-1440px ideal)
- Multi-column layout efficiency
- Hover states and micro-interactions
- Keyboard navigation support
- Large screen real estate utilization
