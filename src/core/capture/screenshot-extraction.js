/**
 * Screenshot Extraction
 *
 * HTML, CSS, and animation extraction pipeline used during multi-viewport
 * screenshot capture. Handles content counting, semantic enhancement,
 * CSS filtering, and animation token generation.
 *
 * @module screenshot-extraction
 */

import path from 'path';
import fs from 'fs/promises';

import { filterCssFile } from '../css/filter-css.js';
import { extractCleanHtml, extractAndEnhanceHtml, JS_FRAMEWORK_PATTERNS, MAX_HTML_SIZE } from '../html/html-extractor.js';
import { extractContentCounts, generateContentSummary } from '../content/content-counter.js';
import { extractAllCss, MAX_CSS_SIZE } from '../css/css-extractor.js';
import { extractAnimations, generateAnimationsCss, generateAnimationTokens } from '../animation/animation-extractor.js';
import { logInfo, logWarn, isTTY } from '../../utils/log.js';
import { createProgress } from '../../utils/progress.js';

/** Extract and write content counts (grids, repeated items) to output dir. */
export async function runContentCounting(page, output) {
  const contentCounts = await extractContentCounts(page);
  const countsPath = path.join(output, 'content-counts.json');
  await fs.writeFile(countsPath, JSON.stringify(contentCounts, null, 2), 'utf-8');
  const contentSummary = generateContentSummary(contentCounts);
  const summaryPath = path.join(output, 'content-summary.md');
  await fs.writeFile(summaryPath, contentSummary, 'utf-8');
  logInfo(`Content counts: ${contentCounts.grids.total} grids, ${contentCounts.repeatedItems.total} items`);
  return { path: path.resolve(countsPath), summaryPath: path.resolve(summaryPath), summary: contentCounts.summary };
}

/** Extract and write page HTML (with optional semantic enhancement). */
export async function runHtmlExtraction(page, output, enhanceSemantic) {
  const htmlResult = enhanceSemantic
    ? await extractAndEnhanceHtml(page, { enhanceSemantic: true })
    : await extractCleanHtml(page, JS_FRAMEWORK_PATTERNS);
  const html = htmlResult.html;
  const htmlSize = Buffer.byteLength(html, 'utf-8');
  if (htmlSize > MAX_HTML_SIZE) throw new Error(`HTML size exceeds ${MAX_HTML_SIZE / 1024 / 1024}MB limit`);
  const htmlPath = path.join(output, 'source.html');
  await fs.writeFile(htmlPath, html, 'utf-8');
  return { path: path.resolve(htmlPath), size: htmlSize, elementCount: htmlResult.elementCount, semanticEnhanced: enhanceSemantic, semanticStats: htmlResult.semanticStats || null, warnings: htmlResult.warnings || [] };
}

/** Extract and write all page CSS (inline + linked stylesheets). */
export async function runCssExtraction(page, url, output) {
  const cssData = await extractAllCss(page, url);
  const rawCss = cssData.cssBlocks.map(b => `/* Source: ${b.source} */\n${b.css}`).join('\n\n');
  const cssSize = Buffer.byteLength(rawCss, 'utf-8');

  if (cssSize > MAX_CSS_SIZE) {
    throw new Error(`CSS size exceeds ${MAX_CSS_SIZE / 1024 / 1024}MB limit`);
  }

  const rawCssPath = path.join(output, 'source-raw.css');
  await fs.writeFile(rawCssPath, rawCss, 'utf-8');
  if (Object.keys(cssData.computedStyles).length > 0) {
    await fs.writeFile(path.join(output, 'computed-styles.json'), JSON.stringify(cssData.computedStyles, null, 2));
  }
  return { path: path.resolve(rawCssPath), size: cssSize, blocks: cssData.cssBlocks.length, totalRules: cssData.totalRules, corsBlocked: cssData.corsBlocked, computedStyles: cssData.computedStyles, warnings: cssData.warnings || [] };
}

/** Filter CSS against HTML to remove unused selectors. */
export async function runCssFiltering(htmlPath, cssPath, output, aggressiveFilter = false) {
  const filteredCssPath = path.join(output, 'source.css');
  const fr = await filterCssFile(htmlPath, cssPath, filteredCssPath, false, output, aggressiveFilter);
  logInfo(`CSS filtered: ${fr.stats.reduction} reduction`);
  return { path: fr.output.path, size: fr.output.size, reduction: fr.stats.reduction, stats: { totalRules: fr.stats.totalRules, keptRules: fr.stats.keptRules, removedRules: fr.stats.removedRules } };
}

/** Extract animation keyframes, transitions, and tokens from CSS file. */
export async function runAnimationExtraction(cssFilePath, output) {
  const rawCss = await fs.readFile(cssFilePath, 'utf-8');
  const animData = await extractAnimations(rawCss);
  if (animData.error) throw new Error(animData.error);

  const animPath = path.join(output, 'animations.css');
  await fs.writeFile(animPath, generateAnimationsCss(animData), 'utf-8');
  const animTokens = generateAnimationTokens(animData);
  const animTokensPath = path.join(output, 'animation-tokens.json');
  await fs.writeFile(animTokensPath, JSON.stringify({ keyframes: animData.keyframes, transitions: animData.transitions, animatedElements: animData.animatedElements, summary: animTokens }, null, 2), 'utf-8');
  logInfo(`Animations: ${animTokens.keyframeCount} keyframes, ${animTokens.transitions} transitions`);
  return { path: path.resolve(animPath), tokensPath: path.resolve(animTokensPath), keyframeCount: animTokens.keyframeCount, transitionCount: animTokens.transitions, animatedElementCount: animTokens.animatedElements, tokens: animTokens };
}

/**
 * Run the full extraction pipeline: content counts, HTML, CSS, filter, animations.
 * @param {import('playwright').Page} page
 * @param {string} url - Page URL
 * @param {string} output - Output directory
 * @param {{extractHtml, extractCss, filterUnused, enhanceSemantic, extractAnimations: boolean}} opts
 * @returns {Promise<Object>} extraction object with html/css/filtered/animations/warnings
 */
export async function runExtractionPipeline(page, url, output, opts) {
  const { extractHtml, extractCss, filterUnused, enhanceSemantic, extractAnimations: extractAnimsFlag } = opts;
  const extraction = { html: null, css: null, warnings: [] };
  const extractionWarnings = [];

  const progress = createProgress();
  const stepCount = [extractHtml && 'content', extractHtml && 'html', extractCss && 'css', filterUnused && 'filter', extractAnimsFlag && 'animations'].filter(Boolean).length;
  progress.start(stepCount, 'Extraction pipeline');

  // Content counts (before HTML cleanup)
  if (extractHtml) {
    progress.step('Content counting');
    try {
      extraction.contentCounts = await runContentCounting(page, output);
    } catch (error) {
      extractionWarnings.push(`Content counting failed: ${error.message}`);
    }
  }

  if (extractHtml) {
    progress.step('HTML extraction');
    try {
      const r = await runHtmlExtraction(page, output, enhanceSemantic);
      const { warnings, ...htmlData } = r;
      extraction.html = htmlData;
      if (warnings.length > 0) extractionWarnings.push(...warnings);
    } catch (error) {
      extraction.html = { error: error.message, failed: true };
      extractionWarnings.push(`HTML extraction failed: ${error.message}`);
    }
  }

  if (extractCss) {
    progress.step('CSS extraction');
    try {
      const r = await runCssExtraction(page, url, output);
      const { warnings, ...cssData } = r;
      extraction.css = cssData;
      if (warnings.length > 0) extractionWarnings.push(...warnings);
      if (r.corsBlocked.length > 0) extractionWarnings.push(`${r.corsBlocked.length} CORS-blocked stylesheets`);
    } catch (error) {
      extraction.css = { error: error.message, failed: true };
      extractionWarnings.push(`CSS extraction failed: ${error.message}`);
    }
  }

  if (filterUnused && extraction?.html?.path && extraction?.css?.path &&
      !extraction.html.failed && !extraction.css.failed) {
    progress.step('CSS filtering');
    try {
      extraction.filtered = await runCssFiltering(extraction.html.path, extraction.css.path, output, opts.aggressiveFilter);
    } catch (error) {
      extraction.filtered = { error: error.message, failed: true };
      extractionWarnings.push(`CSS filtering failed: ${error.message}`);
    }
  }

  // Computed style gap-fill (opt-in via --extract-computed)
  if (opts.extractComputed && extraction?.filtered?.path && !extraction.filtered.failed) {
    try {
      const { extractComputedGapFill } = await import('../css/computed-style-extractor.js');
      const filteredCss = await fs.readFile(extraction.filtered.path, 'utf-8');
      const computed = await extractComputedGapFill(page, filteredCss);
      const computedPath = path.join(output, 'computed-gap.css');
      await fs.writeFile(computedPath, computed.css, 'utf-8');
      extraction.computedGap = { path: path.resolve(computedPath), ...computed.stats };
      logInfo(`Computed gap-fill: ${computed.rules} rules for ${computed.stats.elementsAnalyzed} elements`);
    } catch (error) {
      extraction.computedGap = { error: error.message, failed: true };
      extractionWarnings.push(`Computed style extraction failed: ${error.message}`);
    }
  }

  if (extractCss && extractAnimsFlag && extraction?.css?.path && !extraction.css.failed) {
    progress.step('Animation extraction');
    try {
      extraction.animations = await runAnimationExtraction(extraction.css.path, output);
    } catch (error) {
      extraction.animations = { error: error.message, failed: true };
      extractionWarnings.push(`Animation extraction failed: ${error.message}`);
    }
  }

  progress.complete(`${stepCount} steps completed`);

  extraction.warnings = extractionWarnings;
  if (extractionWarnings.length > 0) {
    extractionWarnings.forEach(w => logWarn(w));
  }
  return extraction;
}
