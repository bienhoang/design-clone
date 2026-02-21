/**
 * Layout Verification Report Generator
 *
 * Markdown report writing and CSS fix suggestion utilities
 * extracted from verify-layout.js to keep each file under 200 lines.
 */

import fs from 'fs/promises';
import path from 'path';
import { VIEWPORTS_HD as VIEWPORTS } from '../shared/viewports.js';

/**
 * Generate CSS fix suggestions from discrepancy objects
 * @param {Array} discrepancies
 * @returns {Array<{section: string, severity: string, issue: string, fix: string}>}
 */
export function generateCSSFixes(discrepancies) {
  const fixes = [];
  for (const disc of discrepancies) {
    if (disc.css_fix) {
      fixes.push({
        section: disc.section,
        severity: disc.severity,
        issue: disc.issue,
        fix: disc.css_fix
      });
    }
  }
  return fixes;
}

/**
 * Write a markdown comparison report to outputDir/layout-verification.md
 * @param {string} outputDir
 * @param {Object} results - Verification results object with viewports map
 * @returns {Promise<string>} Path to written report
 */
export async function writeReport(outputDir, results) {
  const reportPath = path.join(outputDir, 'layout-verification.md');

  let report = `# Layout Verification Report\n\nGenerated: ${new Date().toISOString()}\n\n## Summary\n\n`;
  report += `| Viewport | Similarity | Issues |\n|----------|------------|--------|\n`;

  for (const [viewport, result] of Object.entries(results.viewports)) {
    const score = result.similarity_score || 0;
    const issues = result.discrepancies?.length || 0;
    const status = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '❌';
    report += `| ${viewport} | ${status} ${score}% | ${issues} |\n`;
  }

  report += `\n## Overall Score: ${results.overall_score}%\n\n`;

  for (const [viewport, result] of Object.entries(results.viewports)) {
    const vp = VIEWPORTS[viewport];
    report += `## ${viewport.charAt(0).toUpperCase() + viewport.slice(1)} (${vp.width}x${vp.height})\n\n`;

    if (result.overall_assessment) {
      report += `**Assessment:** ${result.overall_assessment}\n\n`;
    }

    if (result.discrepancies?.length > 0) {
      report += `### Discrepancies\n\n`;
      for (const disc of result.discrepancies) {
        const icon = disc.severity === 'critical' ? '🔴' : disc.severity === 'major' ? '🟠' : '🟡';
        report += `${icon} **${disc.section}** (${disc.severity})\n`;
        report += `   - Issue: ${disc.issue}\n`;
        if (disc.css_fix) report += `   - Fix: \`${disc.css_fix}\`\n`;
        report += '\n';
      }
    } else {
      report += `✅ No significant discrepancies found.\n\n`;
    }

    if (result.recommendations?.length > 0) {
      report += `### Recommendations\n\n`;
      for (const rec of result.recommendations) {
        report += `- ${rec}\n`;
      }
      report += '\n';
    }
  }

  // Consolidated CSS fixes
  const allFixes = [];
  for (const result of Object.values(results.viewports)) {
    if (result.discrepancies) {
      allFixes.push(...generateCSSFixes(result.discrepancies));
    }
  }

  if (allFixes.length > 0) {
    report += `## Suggested CSS Fixes\n\n\`\`\`css\n`;
    for (const fix of allFixes) {
      report += `/* ${fix.section}: ${fix.issue} */\n${fix.fix}\n\n`;
    }
    report += `\`\`\`\n`;
  }

  await fs.writeFile(reportPath, report);
  return reportPath;
}
