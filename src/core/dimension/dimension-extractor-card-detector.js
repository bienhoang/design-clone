/**
 * Card Pattern and Grid Layout Detector
 *
 * Browser-side functions (run inside page.evaluate) that detect repeating
 * card groups and grid/flex layout patterns from extracted container data.
 * These are injected into the page context via dimension-extractor.js.
 */

/**
 * Calculate visual similarity score between two card elements.
 * Weights: width 40%, height 30%, margin 15%, border-radius 15%.
 * @param {{ width, height, marginTop, marginBottom, borderRadius }} a
 * @param {{ width, height, marginTop, marginBottom, borderRadius }} b
 * @returns {number} 0–1 similarity score
 */
export function calculateSimilarity(a, b) {
  const widthSim  = 1 - Math.abs(a.width - b.width) / Math.max(a.width, b.width, 1);
  const heightSim = 1 - Math.abs(a.height - b.height) / Math.max(a.height, b.height, 1);
  const marginA   = a.marginTop + a.marginBottom;
  const marginB   = b.marginTop + b.marginBottom;
  const marginSim = 1 - Math.abs(marginA - marginB) / Math.max(marginA, marginB, 1);
  const radiusSim = a.borderRadius === b.borderRadius ? 1 : 0.5;
  return (widthSim * 0.4) + (heightSim * 0.3) + (marginSim * 0.15) + (radiusSim * 0.15);
}

/**
 * Detect layout type from a group of elements.
 * @param {Array<{ x, y, width, height }>} elements
 * @returns {'row'|'column'|'grid'|'single'}
 */
export function detectLayoutType(elements) {
  if (elements.length < 2) return 'single';
  const yPositions = elements.map(el => el.y);
  const xPositions = elements.map(el => el.x);
  const yVariance  = Math.max(...yPositions) - Math.min(...yPositions);
  const xVariance  = Math.max(...xPositions) - Math.min(...xPositions);
  const avgHeight  = elements.reduce((s, el) => s + el.height, 0) / elements.length;
  const avgWidth   = elements.reduce((s, el) => s + el.width, 0) / elements.length;

  if (yVariance < avgHeight * 0.3 && xVariance > avgWidth) return 'row';
  if (xVariance < avgWidth * 0.3 && yVariance > avgHeight) return 'column';
  return 'grid';
}

/**
 * Calculate average gap between elements based on layout direction.
 * @param {Array<{ x, y, width, height }>} elements
 * @param {'row'|'column'|'grid'} layout
 * @returns {number} Average gap in px
 */
export function calculateGap(elements, layout) {
  if (elements.length < 2) return 0;
  const sorted = layout === 'column'
    ? [...elements].sort((a, b) => a.y - b.y)
    : [...elements].sort((a, b) => a.x - b.x);

  let totalGap = 0, gapCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = layout === 'column'
      ? sorted[i].y - (sorted[i - 1].y + sorted[i - 1].height)
      : sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width);
    if (gap > 0 && gap < 200) { totalGap += gap; gapCount++; }
  }
  return gapCount > 0 ? Math.round(totalGap / gapCount) : 0;
}

/**
 * Return serializable card/grid detector functions as source strings.
 * These are injected into page.evaluate so they run in browser context.
 *
 * Usage in page.evaluate:
 *   const { calculateSimilarity, detectLayoutType, calculateGap } = injected;
 *
 * @returns {{ calculateSimilarity: string, detectLayoutType: string, calculateGap: string }}
 */
export function getCardDetectorSources() {
  return {
    calculateSimilarity: calculateSimilarity.toString(),
    detectLayoutType: detectLayoutType.toString(),
    calculateGap: calculateGap.toString()
  };
}
