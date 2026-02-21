# UX Audit Aggregation Prompt

Combine the viewport-specific UX audit results you produced above into a final assessment.

Using the desktop, tablet, and mobile audit JSON results from your prior analysis steps, create a unified report that:

1. Averages scores across viewports (weighted: desktop 40%, tablet 30%, mobile 30%)
2. Prioritizes issues by severity and viewport impact
3. Consolidates duplicate issues
4. Ranks recommendations by impact

Return ONLY valid JSON:

```json
{
  "overall_scores": {
    "visual_hierarchy": 0,
    "navigation": 0,
    "typography": 0,
    "spacing": 0,
    "interactivity": 0,
    "responsive": 0
  },
  "overall_ux_score": 0,
  "accessibility_score": 0,
  "viewport_breakdown": {
    "desktop": 0,
    "tablet": 0,
    "mobile": 0
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
}
```
