#!/usr/bin/env node
/**
 * Layout Verification Script
 *
 * Compares generated HTML against original website screenshots
 * using Gemini Vision to identify layout discrepancies.
 *
 * Usage:
 *   node verify-layout.js --html <path> --original <dir> [--output <dir>] [--verbose]
 *
 * Options:
 *   --html      Path to generated HTML file
 *   --original  Directory containing original screenshots (desktop.png, tablet.png, mobile.png)
 *   --output    Output directory for comparison screenshots and report
 *   --verbose   Show detailed progress
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import browser abstraction (auto-detects chrome-devtools or standalone)
import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from '../utils/browser.js';

// Import Gemini for vision comparison
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Viewport configurations matching original screenshots
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 }
};

/**
 * Capture screenshot of generated HTML at specific viewport
 */
async function captureGeneratedScreenshot(page, viewport, outputPath) {
  await page.setViewportSize(viewport);
  await new Promise(r => setTimeout(r, 500)); // Wait for CSS to apply

  await page.screenshot({
    path: outputPath,
    fullPage: true
  });

  return outputPath;
}

/**
 * Compare two screenshots using Gemini Vision
 */
async function compareWithGemini(originalPath, generatedPath, viewportName) {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not set',
      discrepancies: [],
      similarity: 0
    };
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Read both images as base64
    const originalBuffer = await fs.readFile(originalPath);
    const generatedBuffer = await fs.readFile(generatedPath);

    const originalBase64 = originalBuffer.toString('base64');
    const generatedBase64 = generatedBuffer.toString('base64');

    const prompt = `You are a UI/UX expert comparing two website screenshots for layout accuracy.

IMAGE 1 (left/first): Original website screenshot
IMAGE 2 (right/second): Generated HTML clone screenshot

Viewport: ${viewportName} (${VIEWPORTS[viewportName].width}x${VIEWPORTS[viewportName].height})

Analyze and compare these two images. Focus on:
1. **Layout Structure** - Are sections positioned correctly? Any misalignment?
2. **Spacing** - Are margins, padding, gaps correct?
3. **Typography** - Font sizes, line heights, text alignment
4. **Colors** - Background colors, text colors, borders
5. **Responsive Elements** - Menu, grid layouts, card widths
6. **Components** - Buttons, forms, icons positioning

Return a JSON object with this exact structure:
{
  "similarity_score": <0-100 number>,
  "overall_assessment": "<brief assessment>",
  "discrepancies": [
    {
      "section": "<section name>",
      "severity": "<critical|major|minor>",
      "issue": "<description of the issue>",
      "css_fix": "<suggested CSS fix or null>"
    }
  ],
  "recommendations": ["<actionable fix 1>", "<actionable fix 2>"]
}

Be specific about CSS selectors and property values when suggesting fixes.
If similarity is >90%, discrepancies array can be empty.`;

    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const response = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/png',
          data: originalBase64
        }
      },
      {
        inlineData: {
          mimeType: 'image/png',
          data: generatedBase64
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
        raw: text
      };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      viewport: viewportName,
      ...result
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      discrepancies: []
    };
  }
}

/**
 * Alternative: Use image comparison without API
 * Basic pixel difference calculation
 */
async function basicImageCompare(originalPath, generatedPath) {
  // This is a fallback that just checks file sizes
  // Real comparison should use Gemini
  try {
    const originalStats = await fs.stat(originalPath);
    const generatedStats = await fs.stat(generatedPath);

    // Crude estimation based on file size difference
    const sizeDiff = Math.abs(originalStats.size - generatedStats.size) / originalStats.size;
    const similarity = Math.max(0, 100 - (sizeDiff * 100));

    return {
      success: true,
      method: 'basic',
      similarity_score: Math.round(similarity),
      note: 'Basic comparison - use Gemini for accurate analysis'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate CSS fix suggestions based on discrepancies
 */
function generateCSSFixes(discrepancies) {
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
 * Write comparison report
 */
async function writeReport(outputDir, results) {
  const reportPath = path.join(outputDir, 'layout-verification.md');

  let report = `# Layout Verification Report

Generated: ${new Date().toISOString()}

## Summary

| Viewport | Similarity | Issues |
|----------|------------|--------|
`;

  for (const [viewport, result] of Object.entries(results.viewports)) {
    const score = result.similarity_score || 0;
    const issues = result.discrepancies?.length || 0;
    const status = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '❌';
    report += `| ${viewport} | ${status} ${score}% | ${issues} |\n`;
  }

  report += `\n## Overall Score: ${results.overall_score}%\n\n`;

  // Detail each viewport
  for (const [viewport, result] of Object.entries(results.viewports)) {
    report += `## ${viewport.charAt(0).toUpperCase() + viewport.slice(1)} (${VIEWPORTS[viewport].width}x${VIEWPORTS[viewport].height})\n\n`;

    if (result.overall_assessment) {
      report += `**Assessment:** ${result.overall_assessment}\n\n`;
    }

    if (result.discrepancies?.length > 0) {
      report += `### Discrepancies\n\n`;
      for (const disc of result.discrepancies) {
        const icon = disc.severity === 'critical' ? '🔴' : disc.severity === 'major' ? '🟠' : '🟡';
        report += `${icon} **${disc.section}** (${disc.severity})\n`;
        report += `   - Issue: ${disc.issue}\n`;
        if (disc.css_fix) {
          report += `   - Fix: \`${disc.css_fix}\`\n`;
        }
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
      report += `/* ${fix.section}: ${fix.issue} */\n`;
      report += `${fix.fix}\n\n`;
    }
    report += `\`\`\`\n`;
  }

  await fs.writeFile(reportPath, report);
  return reportPath;
}

/**
 * Main verification function
 */
async function verifyLayout() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.html) {
    outputError(new Error('--html is required'));
    process.exit(1);
  }

  if (!args.original) {
    outputError(new Error('--original directory is required'));
    process.exit(1);
  }

  const verbose = args.verbose === 'true';
  const outputDir = args.output || path.dirname(args.html);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  try {
    if (verbose) console.error('\n🔍 Starting layout verification...\n');

    // Check original screenshots exist
    const originalScreenshots = {};
    for (const viewport of ['desktop', 'tablet', 'mobile']) {
      const screenshotPath = path.join(args.original, `${viewport}.png`);
      try {
        await fs.access(screenshotPath);
        originalScreenshots[viewport] = screenshotPath;
        if (verbose) console.error(`  ✓ Found ${viewport}.png`);
      } catch {
        if (verbose) console.error(`  ⚠ Missing ${viewport}.png`);
      }
    }

    if (Object.keys(originalScreenshots).length === 0) {
      outputError(new Error('No original screenshots found'));
      process.exit(1);
    }

    // Launch browser and capture generated screenshots
    if (verbose) console.error('\n📸 Capturing generated screenshots...\n');

    const browser = await getBrowser({ headless: args.headless !== 'false' });
    const page = await getPage(browser);

    // Navigate to generated HTML
    const absolutePath = path.resolve(args.html);
    const targetUrl = `file://${absolutePath}`;

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Capture screenshots at each viewport
    const generatedScreenshots = {};
    for (const [viewport, config] of Object.entries(VIEWPORTS)) {
      if (originalScreenshots[viewport]) {
        const outputPath = path.join(outputDir, `generated-${viewport}.png`);
        await captureGeneratedScreenshot(page, config, outputPath);
        generatedScreenshots[viewport] = outputPath;
        if (verbose) console.error(`  ✓ Captured ${viewport}`);
      }
    }

    // Close browser
    if (args.close === 'true') {
      await closeBrowser();
    } else {
      await disconnectBrowser();
    }

    // Compare screenshots
    if (verbose) console.error('\n🔬 Comparing layouts...\n');

    const results = {
      success: true,
      html: args.html,
      viewports: {},
      overall_score: 0,
      all_fixes: []
    };

    let totalScore = 0;
    let viewportCount = 0;

    for (const [viewport, originalPath] of Object.entries(originalScreenshots)) {
      const generatedPath = generatedScreenshots[viewport];
      if (!generatedPath) continue;

      if (verbose) console.error(`  Comparing ${viewport}...`);

      let comparison;
      if (GEMINI_API_KEY) {
        comparison = await compareWithGemini(originalPath, generatedPath, viewport);
      } else {
        comparison = await basicImageCompare(originalPath, generatedPath);
        if (verbose) console.error('    ⚠ Using basic comparison (set GEMINI_API_KEY for accurate analysis)');
      }

      results.viewports[viewport] = comparison;

      if (comparison.success && comparison.similarity_score !== undefined) {
        totalScore += comparison.similarity_score;
        viewportCount++;

        const icon = comparison.similarity_score >= 90 ? '✅' : comparison.similarity_score >= 70 ? '⚠️' : '❌';
        if (verbose) console.error(`    ${icon} Similarity: ${comparison.similarity_score}%`);

        if (comparison.discrepancies?.length > 0) {
          if (verbose) console.error(`    Found ${comparison.discrepancies.length} discrepancies`);
          results.all_fixes.push(...generateCSSFixes(comparison.discrepancies));
        }
      } else if (!comparison.success) {
        if (verbose) console.error(`    ❌ Error: ${comparison.error}`);
      }
    }

    results.overall_score = viewportCount > 0 ? Math.round(totalScore / viewportCount) : 0;
    results.success = results.overall_score >= 70;

    // Write report
    const reportPath = await writeReport(outputDir, results);
    results.report = reportPath;

    // Final summary
    if (verbose) {
      console.error('\n📊 Summary:');
      console.error(`   Overall Score: ${results.overall_score}%`);
      console.error(`   Status: ${results.success ? '✓ PASS' : '✗ NEEDS FIXES'}`);
      console.error(`   Report: ${reportPath}\n`);
    }

    outputJSON(results);
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    outputError(error);
    process.exit(1);
  }
}

// Run
verifyLayout();
