/**
 * CSS Chunker for Streaming Processing
 *
 * Splits large CSS files at top-level block boundaries for independent
 * processing. Never splits inside nested {} blocks to preserve rule integrity.
 */

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Split CSS at top-level closing braces into chunks.
 * Preserves complete rule blocks - never splits inside {} nesting.
 * @param {string} cssString - Raw CSS content
 * @param {number} targetSize - Target chunk size in bytes
 * @returns {string[]} CSS chunks
 */
export function splitCssAtTopLevel(cssString, targetSize = DEFAULT_CHUNK_SIZE) {
  const chunks = [];
  let depth = 0;
  let chunkStart = 0;
  let lastTopLevelClose = 0;

  for (let i = 0; i < cssString.length; i++) {
    const ch = cssString[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        lastTopLevelClose = i + 1;
        if (lastTopLevelClose - chunkStart >= targetSize) {
          chunks.push(cssString.slice(chunkStart, lastTopLevelClose));
          chunkStart = lastTopLevelClose;
        }
      }
    }
  }

  // Remainder
  if (chunkStart < cssString.length) {
    chunks.push(cssString.slice(chunkStart));
  }

  return chunks;
}

/**
 * Process CSS chunks independently, merge results.
 * On per-chunk failure, keeps original chunk content (conservative).
 * @param {string[]} chunks - CSS chunks
 * @param {function} parseAndFilter - Function that parses and filters a CSS string
 * @returns {{ css: string, stats: { totalRules: number, keptRules: number, removedRules: number } }}
 */
export async function processChunks(chunks, parseAndFilter) {
  const results = [];
  const mergedStats = { totalRules: 0, keptRules: 0, removedRules: 0 };

  for (const chunk of chunks) {
    try {
      const result = await parseAndFilter(chunk);
      results.push(result.css);
      mergedStats.totalRules += result.stats.totalRules || 0;
      mergedStats.keptRules += result.stats.keptRules || 0;
      mergedStats.removedRules += result.stats.removedRules || 0;
    } catch {
      // On chunk failure, keep original chunk (conservative)
      results.push(chunk);
    }
  }

  return { css: results.join('\n'), stats: mergedStats };
}
