#!/usr/bin/env node
/**
 * Audit Report Generator
 *
 * Aggregates verification results from header, footer, slider, menu, and layout
 * verifiers into a consolidated markdown report with:
 * - Summary table with pass/warn/fail status
 * - Component sections with side-by-side screenshots
 * - Responsive breakpoint analysis
 * - CSS fix suggestions
 *
 * Usage:
 *   node generate-audit-report.js --dir <results-dir> [--output <report-path>]
 *
 * Options:
 *   --dir       Directory containing verification JSON results
 *   --output    Output path for markdown report (default: component-audit.md)
 *   --verbose   Show detailed progress
 */

import fs from 'fs/promises';
import path from 'path';
import { parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Component types and their result files
const COMPONENT_FILES = {
  header: 'header-results.json',
  footer: 'footer-results.json',
  slider: 'slider-results.json',
  menu: 'menu-results.json',
  layout: 'layout-results.json'
};

// Status icons
const STATUS_ICONS = {
  pass: '✅',
  warn: '⚠️',
  fail: '❌',
  info: 'ℹ️'
};

/**
 * Load verification results from directory
 */
async function loadVerificationResults(dir) {
  const results = {};

  for (const [component, filename] of Object.entries(COMPONENT_FILES)) {
    const filePath = path.join(dir, filename);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      results[component] = JSON.parse(content);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Warning: Failed to load ${filename}: ${err.message}`);
      }
      results[component] = null;
    }
  }

  return results;
}

/**
 * Calculate component status
 */
function getComponentStatus(result) {
  if (!result) return { status: 'skip', icon: STATUS_ICONS.info, label: 'Not tested' };

  const { summary } = result;
  if (!summary) return { status: 'skip', icon: STATUS_ICONS.info, label: 'No data' };

  if (summary.failed > 0) {
    return { status: 'fail', icon: STATUS_ICONS.fail, label: `${summary.failed} failed` };
  }
  if (summary.warnings?.length > 0) {
    return { status: 'warn', icon: STATUS_ICONS.warn, label: `${summary.warnings.length} warnings` };
  }
  return { status: 'pass', icon: STATUS_ICONS.pass, label: 'Passed' };
}

/**
 * Generate summary table
 */
function generateSummaryTable(results) {
  let table = `| Component | Status | Tests | Details |
|-----------|--------|-------|---------|
`;

  for (const [component, result] of Object.entries(results)) {
    const status = getComponentStatus(result);
    const tests = result?.summary
      ? `${result.summary.passed}/${result.summary.totalTests}`
      : '-';
    table += `| ${component.charAt(0).toUpperCase() + component.slice(1)} | ${status.icon} ${status.label} | ${tests} | ${result?.url || '-'} |\n`;
  }

  return table;
}

/**
 * Generate viewport breakdown table
 */
function generateViewportTable(results) {
  const viewports = ['mobile', 'tablet', 'desktop'];
  const components = Object.keys(results).filter(c => results[c]?.viewports);

  if (components.length === 0) return '';

  let table = `| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
`;

  for (const component of components) {
    const result = results[component];
    const row = [component.charAt(0).toUpperCase() + component.slice(1)];

    for (const vp of viewports) {
      const vpResult = result.viewports?.[vp];
      if (vpResult) {
        const icon = vpResult.failed > 0 ? STATUS_ICONS.fail
          : vpResult.warnings?.length > 0 ? STATUS_ICONS.warn
          : STATUS_ICONS.pass;
        row.push(`${icon} ${vpResult.passed}/${vpResult.tests?.length || 0}`);
      } else {
        row.push('-');
      }
    }

    table += `| ${row.join(' | ')} |\n`;
  }

  return table;
}

/**
 * Generate component section
 */
function generateComponentSection(component, result) {
  if (!result) {
    return `### ${component.charAt(0).toUpperCase() + component.slice(1)}

${STATUS_ICONS.info} Not tested

---

`;
  }

  const status = getComponentStatus(result);
  let section = `### ${component.charAt(0).toUpperCase() + component.slice(1)} ${status.icon}

`;

  // Add component-specific info
  if (component === 'slider' && result.sliderLibrary) {
    section += `**Library:** ${result.sliderLibrary}\n\n`;
  }

  // Test results by viewport
  if (result.viewports) {
    for (const [viewport, vpResult] of Object.entries(result.viewports)) {
      section += `#### ${viewport.charAt(0).toUpperCase() + viewport.slice(1)} (${vpResult.dimensions?.width}x${vpResult.dimensions?.height})\n\n`;

      // List tests
      if (vpResult.tests?.length > 0) {
        for (const test of vpResult.tests) {
          const icon = test.passed ? STATUS_ICONS.pass : STATUS_ICONS.fail;
          section += `- ${icon} **${test.name}**`;
          if (test.selector) section += ` - \`${test.selector}\``;
          if (test.count !== undefined) section += ` (${test.count} found)`;
          if (test.note) section += ` - ${test.note}`;
          if (test.error) section += ` - ⚠️ ${test.error}`;
          section += '\n';
        }
      }

      // Warnings
      if (vpResult.warnings?.length > 0) {
        section += '\n**Warnings:**\n';
        for (const warning of vpResult.warnings) {
          section += `- ${STATUS_ICONS.warn} ${warning}\n`;
        }
      }

      section += '\n';
    }
  }

  // Screenshots
  if (result.screenshots?.length > 0) {
    section += `#### Screenshots\n\n`;
    section += `| Viewport | Screenshot |\n|----------|------------|\n`;
    for (const screenshot of result.screenshots) {
      const name = path.basename(screenshot);
      const viewport = name.replace(/^[a-z]+-test-/, '').replace('.png', '');
      section += `| ${viewport} | [${name}](${screenshot}) |\n`;
    }
    section += '\n';
  }

  section += '---\n\n';
  return section;
}

/**
 * Generate CSS fixes section
 */
function generateCSSFixes(results) {
  const fixes = [];

  // Collect issues that might need CSS fixes
  for (const [component, result] of Object.entries(results)) {
    if (!result?.viewports) continue;

    for (const [viewport, vpResult] of Object.entries(result.viewports)) {
      // Check for layout issues
      if (component === 'header' && vpResult.headerHeight) {
        // Height consistency check already done in verify-header
      }

      if (component === 'footer') {
        const positionTest = vpResult.tests?.find(t => t.name === 'Footer at page bottom');
        if (positionTest && !positionTest.passed) {
          fixes.push({
            component,
            viewport,
            issue: 'Footer not at page bottom',
            suggestion: `/* Ensure footer sticks to bottom */
footer {
  margin-top: auto;
}
body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}`
          });
        }
      }

      // Check warnings
      if (vpResult.warnings) {
        for (const warning of vpResult.warnings) {
          if (warning.includes('z-index')) {
            fixes.push({
              component,
              viewport,
              issue: warning,
              suggestion: `/* Increase header z-index */
header, .header, [role="banner"] {
  z-index: 1000;
}`
            });
          }
        }
      }
    }
  }

  if (fixes.length === 0) return '';

  let section = `## Suggested CSS Fixes

`;

  for (const fix of fixes) {
    section += `### ${fix.component} (${fix.viewport})

**Issue:** ${fix.issue}

\`\`\`css
${fix.suggestion}
\`\`\`

`;
  }

  return section;
}

/**
 * Generate full markdown report
 */
function generateMarkdownReport(results, url) {
  const timestamp = new Date().toISOString();

  let report = `# Component Audit Report

**Generated:** ${timestamp}
**URL:** ${url || 'N/A'}

## Summary

${generateSummaryTable(results)}

## Responsive Breakdown

${generateViewportTable(results)}

## Component Details

`;

  // Add each component section
  for (const [component, result] of Object.entries(results)) {
    report += generateComponentSection(component, result);
  }

  // Add CSS fixes if any
  report += generateCSSFixes(results);

  // Footer
  report += `---

*Report generated by design-clone verification suite*
`;

  return report;
}

/**
 * Main function
 */
async function generateAuditReport() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dir) {
    outputError(new Error('--dir is required'));
    process.exit(1);
  }

  const verbose = args.verbose === 'true';
  const outputPath = args.output || path.join(args.dir, 'component-audit.md');

  try {
    if (verbose) console.error(`\n📊 Generating audit report from ${args.dir}\n`);

    // Load all verification results
    const results = await loadVerificationResults(args.dir);

    // Get URL from first available result
    const url = Object.values(results).find(r => r?.url)?.url;

    // Count loaded components
    const loadedCount = Object.values(results).filter(r => r !== null).length;
    if (verbose) console.error(`  Loaded ${loadedCount}/${Object.keys(COMPONENT_FILES).length} component results`);

    // Generate report
    const report = generateMarkdownReport(results, url);

    // Write report
    await fs.writeFile(outputPath, report, 'utf-8');
    if (verbose) console.error(`  ✓ Report written to ${outputPath}`);

    // Calculate overall stats
    let totalTests = 0, totalPassed = 0, totalFailed = 0, totalWarnings = 0;
    for (const result of Object.values(results)) {
      if (result?.summary) {
        totalTests += result.summary.totalTests || 0;
        totalPassed += result.summary.passed || 0;
        totalFailed += result.summary.failed || 0;
        totalWarnings += result.summary.warnings?.length || 0;
      }
    }

    const output = {
      success: totalFailed === 0,
      reportPath: outputPath,
      url,
      summary: {
        components: loadedCount,
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        warnings: totalWarnings
      }
    };

    if (verbose) {
      console.error('\n📋 Report Summary:');
      console.error(`   Components: ${loadedCount}`);
      console.error(`   Tests: ${totalPassed}/${totalTests} passed`);
      console.error(`   Failures: ${totalFailed}`);
      console.error(`   Warnings: ${totalWarnings}`);
      console.error(`   Status: ${output.success ? '✓ PASS' : '✗ ISSUES FOUND'}\n`);
    }

    outputJSON(output);
    process.exit(output.success ? 0 : 1);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

generateAuditReport();
