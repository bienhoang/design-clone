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
import { parseArgs, outputJSON, outputError } from '../utils/helpers.js';
import { generateMarkdownReport } from './generate-audit-report-sections.js';

// Component types and their result files
const COMPONENT_FILES = {
  header: 'header-results.json',
  footer: 'footer-results.json',
  slider: 'slider-results.json',
  menu: 'menu-results.json',
  layout: 'layout-results.json'
};

/**
 * Load verification results from directory
 * @param {string} dir
 * @returns {Promise<Object>} Map of component name to parsed result or null
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

    const results = await loadVerificationResults(args.dir);
    const url = Object.values(results).find(r => r?.url)?.url;

    const loadedCount = Object.values(results).filter(r => r !== null).length;
    if (verbose) console.error(`  Loaded ${loadedCount}/${Object.keys(COMPONENT_FILES).length} component results`);

    const report = generateMarkdownReport(results, url);

    await fs.writeFile(outputPath, report, 'utf-8');
    if (verbose) console.error(`  ✓ Report written to ${outputPath}`);

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
      summary: { components: loadedCount, totalTests, passed: totalPassed, failed: totalFailed, warnings: totalWarnings }
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
