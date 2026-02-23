/**
 * Output Quality Scorer
 *
 * Scores the quality of a design clone capture on 5 metrics (0-100 scale).
 * Auto-runs for clone-px mode, opt-in for basic clone.
 */

import fs from 'fs/promises';

const WEIGHTS = {
  cssCoverage: 0.30,
  assetCompleteness: 0.25,
  responsiveFidelity: 0.20,
  htmlSemantics: 0.15,
  accessibility: 0.10
};

const SEMANTIC_TAGS = new Set([
  'header', 'footer', 'nav', 'main', 'article', 'section', 'aside', 'figure', 'figcaption'
]);

function scoreCssCoverage(extraction) {
  if (!extraction?.css || !extraction?.filtered) return 0;
  const reduction = parseInt(extraction.filtered.reduction) || 0;
  const kept = 100 - reduction;
  if (kept >= 80) return 100;
  if (kept >= 50) return 80;
  return 60;
}

function scoreAssetCompleteness(stats) {
  if (!stats || stats.total === 0) return 100;
  const ratio = stats.downloaded / stats.total;
  return Math.round(ratio * 100);
}

function scoreResponsiveFidelity(screenshots) {
  if (!screenshots) return 0;
  const count = Array.isArray(screenshots) ? screenshots.length : 0;
  if (count >= 3) return 100;
  if (count >= 2) return 70;
  return 40;
}

function scoreHtmlSemantics(htmlContent) {
  if (!htmlContent) return 0;
  let found = 0;
  for (const tag of SEMANTIC_TAGS) {
    if (htmlContent.includes(`<${tag}`)) found++;
  }
  return Math.min(100, Math.round((found / SEMANTIC_TAGS.size) * 100));
}

function scoreAccessibility(htmlContent) {
  if (!htmlContent) return 0;
  let score = 0;
  const imgCount = (htmlContent.match(/<img/g) || []).length;
  const altCount = (htmlContent.match(/<img[^>]+alt=/g) || []).length;
  if (imgCount === 0) score += 50;
  else score += Math.round((altCount / imgCount) * 50);
  if (htmlContent.includes('<h1')) score += 25;
  if (/<html[^>]+lang=/.test(htmlContent)) score += 25;
  return Math.min(100, score);
}

/**
 * Score the quality of a design clone capture
 * @param {{ extraction: Object, screenshots: Array, assetStats: Object, outputDir: string }} params
 * @returns {Promise<{overall: number, metrics: Object, weights: Object, maxScore: number}>}
 */
export async function scoreCapture({ extraction, screenshots, assetStats, outputDir }) {
  let htmlContent = '';
  if (extraction?.html?.path) {
    try { htmlContent = await fs.readFile(extraction.html.path, 'utf-8'); } catch { /* ok */ }
  }

  const metrics = {
    cssCoverage: scoreCssCoverage(extraction),
    assetCompleteness: scoreAssetCompleteness(assetStats),
    responsiveFidelity: scoreResponsiveFidelity(screenshots),
    htmlSemantics: scoreHtmlSemantics(htmlContent),
    accessibility: scoreAccessibility(htmlContent)
  };

  const overall = Math.round(
    Object.entries(WEIGHTS).reduce(
      (sum, [key, weight]) => sum + (metrics[key] * weight), 0
    )
  );

  return { overall, metrics, weights: WEIGHTS, maxScore: 100 };
}
