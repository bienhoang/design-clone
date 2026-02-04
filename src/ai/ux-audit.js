#!/usr/bin/env node
/**
 * UX Audit Runner
 *
 * Analyzes website screenshots using Gemini Vision to assess UX quality.
 * Generates detailed reports with scores, issues, and recommendations.
 *
 * Usage:
 *   node ux-audit.js --screenshots <dir> [--output <dir>] [--verbose]
 *
 * Options:
 *   --screenshots  Directory containing viewport screenshots (desktop.png, tablet.png, mobile.png)
 *   --output       Output directory for report (default: same as screenshots)
 *   --verbose      Show detailed progress
 *   --url          Original URL (for report metadata)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// API key detection
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
};

// Score weights for aggregation
const VIEWPORT_WEIGHTS = {
  desktop: 0.4,
  tablet: 0.3,
  mobile: 0.3
};

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const options = {
    screenshots: null,
    output: null,
    verbose: false,
    url: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--screenshots' && args[i + 1]) {
      options.screenshots = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--url' && args[i + 1]) {
      options.url = args[++i];
    }
  }

  return options;
}

/**
 * Build viewport-specific UX audit prompt
 *
 * Note: This prompt mirrors src/ai/prompts/ux_audit.py for standalone JS execution.
 * The Python file is the canonical source for prompt content.
 */
function buildUXAuditPrompt(viewport) {
  const basePrompt = `Analyze this website screenshot for UX quality.

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
  "viewport": "${viewport}",
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
- minor: Polish improvements (61-80 score range issues)`;

  // Add viewport-specific context
  const viewportContext = {
    mobile: `

MOBILE-SPECIFIC CHECKS:
- Touch targets minimum 44x44px
- Thumb zone accessibility
- Single-column layout efficiency
- Mobile navigation pattern (hamburger/tab bar)
- Text readable without zooming
- Forms optimized for mobile input`,

    tablet: `

TABLET-SPECIFIC CHECKS:
- Two-column layout utilization
- Touch and mouse input support
- Landscape/portrait adaptability
- Sidebar vs content balance
- Split-view readiness`,

    desktop: `

DESKTOP-SPECIFIC CHECKS:
- Maximum content width (1200-1440px ideal)
- Multi-column layout efficiency
- Hover states and micro-interactions
- Keyboard navigation support
- Large screen real estate utilization`
  };

  return basePrompt + (viewportContext[viewport] || '');
}

/**
 * Analyze screenshot with Gemini Vision
 */
async function analyzeViewport(screenshotPath, viewport, verbose = false) {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not set',
      viewport
    };
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Read screenshot as base64
    const imageBuffer = await fs.readFile(screenshotPath);
    const base64 = imageBuffer.toString('base64');

    const prompt = buildUXAuditPrompt(viewport);

    if (verbose) console.error(`    Sending to Gemini...`);

    const response = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64
        }
      }
    ]);

    const text = response.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Could not parse Gemini response',
        viewport,
        raw: text
      };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      viewport,
      ...result
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      viewport
    };
  }
}

/**
 * Aggregate results from all viewports
 */
function aggregateResults(viewportResults) {
  const categories = ['visual_hierarchy', 'navigation', 'typography', 'spacing', 'interactivity', 'responsive'];

  const aggregated = {
    overall_scores: {},
    overall_ux_score: 0,
    accessibility_score: 0,
    viewport_breakdown: {},
    top_issues: [],
    prioritized_recommendations: []
  };

  // Calculate weighted averages
  let totalWeight = 0;
  let weightedUxScore = 0;
  let weightedAccessScore = 0;

  for (const [viewport, result] of Object.entries(viewportResults)) {
    if (!result.success) continue;

    const weight = VIEWPORT_WEIGHTS[viewport] || 0.33;
    totalWeight += weight;

    weightedUxScore += (result.overall_ux_score || 0) * weight;
    weightedAccessScore += (result.accessibility_score || 0) * weight;

    aggregated.viewport_breakdown[viewport] = result.overall_ux_score || 0;

    // Aggregate category scores
    for (const category of categories) {
      const score = result.scores?.[category] || 0;
      if (!aggregated.overall_scores[category]) {
        aggregated.overall_scores[category] = 0;
      }
      aggregated.overall_scores[category] += score * weight;
    }

    // Collect issues
    if (result.issues) {
      for (const issue of result.issues) {
        aggregated.top_issues.push({
          ...issue,
          viewports_affected: [viewport]
        });
      }
    }

    // Collect recommendations
    if (result.recommendations) {
      aggregated.prioritized_recommendations.push(...result.recommendations);
    }
  }

  // Normalize scores
  if (totalWeight > 0) {
    aggregated.overall_ux_score = Math.round(weightedUxScore / totalWeight);
    aggregated.accessibility_score = Math.round(weightedAccessScore / totalWeight);

    for (const category of categories) {
      aggregated.overall_scores[category] = Math.round(aggregated.overall_scores[category] / totalWeight);
    }
  }

  // Sort issues by severity
  const severityOrder = { critical: 0, major: 1, minor: 2 };
  aggregated.top_issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Deduplicate recommendations
  aggregated.prioritized_recommendations = [...new Set(aggregated.prioritized_recommendations)];

  return aggregated;
}

/**
 * Generate markdown report
 */
function generateReport(aggregated, viewportResults, url = null) {
  const timestamp = new Date().toISOString();

  let report = `# UX Audit Report

**Generated:** ${timestamp}
**URL:** ${url || 'N/A'}

## Overall Scores

| Metric | Score |
|--------|-------|
| Overall UX | ${aggregated.overall_ux_score}% |
| Accessibility | ${aggregated.accessibility_score}% |

## Category Breakdown

| Category | Score | Desktop | Tablet | Mobile |
|----------|-------|---------|--------|--------|
`;

  const categories = [
    { key: 'visual_hierarchy', name: 'Visual Hierarchy' },
    { key: 'navigation', name: 'Navigation' },
    { key: 'typography', name: 'Typography' },
    { key: 'spacing', name: 'Spacing' },
    { key: 'interactivity', name: 'Interactivity' },
    { key: 'responsive', name: 'Responsive' }
  ];

  for (const cat of categories) {
    const overall = aggregated.overall_scores[cat.key] || 0;
    const desktop = viewportResults.desktop?.scores?.[cat.key] || '-';
    const tablet = viewportResults.tablet?.scores?.[cat.key] || '-';
    const mobile = viewportResults.mobile?.scores?.[cat.key] || '-';
    const icon = overall >= 80 ? '✅' : overall >= 60 ? '⚠️' : '❌';

    report += `| ${cat.name} | ${icon} ${overall}% | ${desktop}% | ${tablet}% | ${mobile}% |\n`;
  }

  // Viewport breakdown
  report += `
## Viewport Scores

| Viewport | UX Score |
|----------|----------|
`;

  for (const [viewport, score] of Object.entries(aggregated.viewport_breakdown)) {
    const icon = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
    report += `| ${viewport.charAt(0).toUpperCase() + viewport.slice(1)} | ${icon} ${score}% |\n`;
  }

  // Issues
  if (aggregated.top_issues.length > 0) {
    report += `
## Issues Found

`;

    // Group by severity
    const critical = aggregated.top_issues.filter(i => i.severity === 'critical');
    const major = aggregated.top_issues.filter(i => i.severity === 'major');
    const minor = aggregated.top_issues.filter(i => i.severity === 'minor');

    if (critical.length > 0) {
      report += `### Critical Issues 🔴

`;
      for (const issue of critical) {
        report += `- **${issue.category}**: ${issue.issue}\n  - *Fix:* ${issue.fix}\n  - *Viewports:* ${issue.viewports_affected.join(', ')}\n\n`;
      }
    }

    if (major.length > 0) {
      report += `### Major Issues 🟠

`;
      for (const issue of major) {
        report += `- **${issue.category}**: ${issue.issue}\n  - *Fix:* ${issue.fix}\n  - *Viewports:* ${issue.viewports_affected.join(', ')}\n\n`;
      }
    }

    if (minor.length > 0) {
      report += `### Minor Issues 🟡

`;
      for (const issue of minor) {
        report += `- **${issue.category}**: ${issue.issue}\n  - *Fix:* ${issue.fix}\n  - *Viewports:* ${issue.viewports_affected.join(', ')}\n\n`;
      }
    }
  }

  // Recommendations
  if (aggregated.prioritized_recommendations.length > 0) {
    report += `## Recommendations

`;
    for (const rec of aggregated.prioritized_recommendations) {
      report += `- ${rec}\n`;
    }
  }

  report += `
---

*Report generated by design-clone UX Audit*
`;

  return report;
}

/**
 * Run UX audit on screenshots
 * @param {Object} screenshotPaths - { desktop: path, tablet: path, mobile: path }
 * @param {Object} options - { output, verbose, url }
 */
export async function runUXAudit(screenshotPaths, options = {}) {
  const { output, verbose = false, url = null } = options;

  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not set. Set environment variable to enable UX audit.'
    };
  }

  const viewportResults = {};

  // Analyze each viewport
  for (const [viewport, screenshotPath] of Object.entries(screenshotPaths)) {
    if (!screenshotPath) continue;

    try {
      await fs.access(screenshotPath);
    } catch {
      if (verbose) console.error(`  ⚠ Missing ${viewport} screenshot`);
      continue;
    }

    if (verbose) console.error(`  Analyzing ${viewport}...`);

    const result = await analyzeViewport(screenshotPath, viewport, verbose);
    viewportResults[viewport] = result;

    if (result.success) {
      if (verbose) console.error(`    ✓ UX Score: ${result.overall_ux_score}%`);
    } else {
      if (verbose) console.error(`    ✗ Error: ${result.error}`);
    }
  }

  // Check if we have any results
  const successfulResults = Object.values(viewportResults).filter(r => r.success);
  if (successfulResults.length === 0) {
    return {
      success: false,
      error: 'No viewport analysis succeeded',
      viewportResults
    };
  }

  // Aggregate results
  const aggregated = aggregateResults(viewportResults);

  // Generate report
  const report = generateReport(aggregated, viewportResults, url);

  // Write report if output specified
  let reportPath = null;
  if (output) {
    await fs.mkdir(output, { recursive: true });
    reportPath = path.join(output, 'ux-audit.md');
    await fs.writeFile(reportPath, report);

    // Also save JSON results
    const jsonPath = path.join(output, 'ux-audit.json');
    await fs.writeFile(jsonPath, JSON.stringify({
      aggregated,
      viewportResults,
      url,
      timestamp: new Date().toISOString()
    }, null, 2));
  }

  return {
    success: true,
    aggregated,
    viewportResults,
    report,
    reportPath,
    summary: {
      uxScore: aggregated.overall_ux_score,
      accessibilityScore: aggregated.accessibility_score,
      issueCount: aggregated.top_issues.length,
      criticalCount: aggregated.top_issues.filter(i => i.severity === 'critical').length
    }
  };
}

/**
 * CLI entry point
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.screenshots) {
    console.error('Usage: node ux-audit.js --screenshots <dir> [--output <dir>] [--verbose] [--url <url>]');
    console.error('\nError: --screenshots is required');
    process.exit(1);
  }

  const verbose = args.verbose;
  const outputDir = args.output || args.screenshots;

  if (verbose) console.error('\n🔍 Starting UX Audit...\n');

  // Find screenshots
  const screenshotPaths = {};
  for (const viewport of ['desktop', 'tablet', 'mobile']) {
    const screenshotPath = path.join(args.screenshots, `${viewport}.png`);
    try {
      await fs.access(screenshotPath);
      screenshotPaths[viewport] = screenshotPath;
      if (verbose) console.error(`  ✓ Found ${viewport}.png`);
    } catch {
      if (verbose) console.error(`  ⚠ Missing ${viewport}.png`);
    }
  }

  if (Object.keys(screenshotPaths).length === 0) {
    console.error('Error: No screenshots found in directory');
    process.exit(1);
  }

  // Run audit
  const result = await runUXAudit(screenshotPaths, {
    output: outputDir,
    verbose,
    url: args.url
  });

  if (!result.success) {
    console.error(`\n❌ UX Audit failed: ${result.error}`);
    process.exit(1);
  }

  if (verbose) {
    console.error('\n📊 Summary:');
    console.error(`   UX Score: ${result.summary.uxScore}%`);
    console.error(`   Accessibility: ${result.summary.accessibilityScore}%`);
    console.error(`   Issues: ${result.summary.issueCount} (${result.summary.criticalCount} critical)`);
    if (result.reportPath) {
      console.error(`   Report: ${result.reportPath}`);
    }
    console.error();
  }

  // Output JSON to stdout
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// Run if called directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
