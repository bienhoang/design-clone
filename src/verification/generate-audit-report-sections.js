/**
 * Audit Report Section Generators
 *
 * Pure functions for generating markdown table and section content
 * extracted from generate-audit-report.js to keep each file under 200 lines.
 */

import path from 'path';
import { generateCSSFixes } from './generate-audit-report-css-fixes.js';

// Re-export so callers only need this one module
export { generateCSSFixes };

// Status icons
export const STATUS_ICONS = {
  pass: '✅',
  warn: '⚠️',
  fail: '❌',
  info: 'ℹ️'
};

/**
 * Calculate component status from verification result
 * @param {Object|null} result
 * @returns {{status: string, icon: string, label: string}}
 */
export function getComponentStatus(result) {
  if (!result) return { status: 'skip', icon: STATUS_ICONS.info, label: 'Not tested' };
  const { summary } = result;
  if (!summary) return { status: 'skip', icon: STATUS_ICONS.info, label: 'No data' };
  if (summary.failed > 0) return { status: 'fail', icon: STATUS_ICONS.fail, label: `${summary.failed} failed` };
  if (summary.warnings?.length > 0) return { status: 'warn', icon: STATUS_ICONS.warn, label: `${summary.warnings.length} warnings` };
  return { status: 'pass', icon: STATUS_ICONS.pass, label: 'Passed' };
}

/**
 * Generate summary table markdown
 * @param {Object} results - Map of component name to result
 * @returns {string}
 */
export function generateSummaryTable(results) {
  let table = `| Component | Status | Tests | Details |\n|-----------|--------|-------|----------|\n`;
  for (const [component, result] of Object.entries(results)) {
    const status = getComponentStatus(result);
    const tests = result?.summary ? `${result.summary.passed}/${result.summary.totalTests}` : '-';
    const label = component.charAt(0).toUpperCase() + component.slice(1);
    table += `| ${label} | ${status.icon} ${status.label} | ${tests} | ${result?.url || '-'} |\n`;
  }
  return table;
}

/**
 * Generate responsive viewport breakdown table
 * @param {Object} results
 * @returns {string}
 */
export function generateViewportTable(results) {
  const viewports = ['mobile', 'tablet', 'desktop'];
  const components = Object.keys(results).filter(c => results[c]?.viewports);
  if (components.length === 0) return '';

  let table = `| Component | Mobile | Tablet | Desktop |\n|-----------|--------|--------|----------|\n`;
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
 * Generate a markdown section for a single component
 * @param {string} component
 * @param {Object|null} result
 * @returns {string}
 */
export function generateComponentSection(component, result) {
  const label = component.charAt(0).toUpperCase() + component.slice(1);
  if (!result) return `### ${label}\n\n${STATUS_ICONS.info} Not tested\n\n---\n\n`;

  const status = getComponentStatus(result);
  let section = `### ${label} ${status.icon}\n\n`;

  if (component === 'slider' && result.sliderLibrary) {
    section += `**Library:** ${result.sliderLibrary}\n\n`;
  }

  if (result.viewports) {
    for (const [viewport, vpResult] of Object.entries(result.viewports)) {
      const vpLabel = viewport.charAt(0).toUpperCase() + viewport.slice(1);
      section += `#### ${vpLabel} (${vpResult.dimensions?.width}x${vpResult.dimensions?.height})\n\n`;

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

      if (vpResult.warnings?.length > 0) {
        section += '\n**Warnings:**\n';
        for (const warning of vpResult.warnings) {
          section += `- ${STATUS_ICONS.warn} ${warning}\n`;
        }
      }
      section += '\n';
    }
  }

  if (result.screenshots?.length > 0) {
    section += `#### Screenshots\n\n| Viewport | Screenshot |\n|----------|------------|\n`;
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
 * Generate the full markdown audit report string
 * @param {Object} results
 * @param {string|undefined} url
 * @returns {string}
 */
export function generateMarkdownReport(results, url) {
  const timestamp = new Date().toISOString();
  let report = `# Component Audit Report\n\n**Generated:** ${timestamp}\n**URL:** ${url || 'N/A'}\n\n`;
  report += `## Summary\n\n${generateSummaryTable(results)}\n`;
  report += `## Responsive Breakdown\n\n${generateViewportTable(results)}\n`;
  report += `## Component Details\n\n`;
  for (const [component, result] of Object.entries(results)) {
    report += generateComponentSection(component, result);
  }
  report += generateCSSFixes(results);
  report += `---\n\n*Report generated by design-clone verification suite*\n`;
  return report;
}
