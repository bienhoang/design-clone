/**
 * Audit Report CSS Fix Suggestions
 *
 * Analyzes verification results and generates CSS fix suggestions.
 * Extracted from generate-audit-report-sections.js to keep files under 200 lines.
 */

/**
 * Generate CSS fixes section markdown from all component results
 * @param {Object} results - Map of component name to verification result
 * @returns {string} Markdown section or empty string if no fixes
 */
export function generateCSSFixes(results) {
  const fixes = [];

  for (const [component, result] of Object.entries(results)) {
    if (!result?.viewports) continue;

    for (const [viewport, vpResult] of Object.entries(result.viewports)) {
      if (component === 'footer') {
        const positionTest = vpResult.tests?.find(t => t.name === 'Footer at page bottom');
        if (positionTest && !positionTest.passed) {
          fixes.push({
            component, viewport,
            issue: 'Footer not at page bottom',
            suggestion: `/* Ensure footer sticks to bottom */\nfooter {\n  margin-top: auto;\n}\nbody {\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n}`
          });
        }
      }

      if (vpResult.warnings) {
        for (const warning of vpResult.warnings) {
          if (warning.includes('z-index')) {
            fixes.push({
              component, viewport,
              issue: warning,
              suggestion: `/* Increase header z-index */\nheader, .header, [role="banner"] {\n  z-index: 1000;\n}`
            });
          }
        }
      }
    }
  }

  if (fixes.length === 0) return '';

  let section = `## Suggested CSS Fixes\n\n`;
  for (const fix of fixes) {
    section += `### ${fix.component} (${fix.viewport})\n\n**Issue:** ${fix.issue}\n\n\`\`\`css\n${fix.suggestion}\n\`\`\`\n\n`;
  }
  return section;
}
