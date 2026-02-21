/**
 * Content Counter
 *
 * Parse page DOM to extract exact content counts for:
 * - Grid items, list items, cards
 * - Navigation links
 * - Sections/containers
 * - Images, buttons, forms
 *
 * Outputs content-counts.json for use in structure analysis.
 */

import { domCountingFn } from './content-counter-dom.js';

/**
 * Count content items in page DOM
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<object>} Content counts
 */
export async function extractContentCounts(page) {
  return await page.evaluate(domCountingFn);
}

/**
 * Generate concise content summary for prompt injection
 * @param {object} counts - Content counts from extractContentCounts
 * @returns {string} Summary text
 */
export function generateContentSummary(counts) {
  const lines = [
    '## EXACT CONTENT COUNTS (from DOM parsing)',
    ''
  ];

  // Sections
  lines.push(`### Sections: ${counts.sections.total} total`);
  counts.sections.details.slice(0, 10).forEach(s => {
    lines.push(`- ${s.selector}: ${s.childCount} children${s.visible ? '' : ' (hidden)'}`);
  });
  lines.push('');

  // Grids with item counts
  lines.push(`### Grid/Flex Containers: ${counts.grids.total} total`);
  counts.grids.details.slice(0, 15).forEach(g => {
    const visibilityNote = g.hiddenItems > 0 ? ` (+${g.hiddenItems} hidden)` : '';
    lines.push(`- ${g.selector}: ${g.visibleItems} visible items${visibilityNote}`);
  });
  lines.push('');

  // Repeated items
  if (Object.keys(counts.repeatedItems.byType).length > 0) {
    lines.push('### Repeated Items:');
    Object.entries(counts.repeatedItems.byType).forEach(([type, data]) => {
      const hiddenNote = data.hidden > 0 ? ` (+${data.hidden} hidden)` : '';
      lines.push(`- ${type}: ${data.visible} visible${hiddenNote}`);
    });
    lines.push('');
  }

  // Links and media
  lines.push('### Navigation & Media:');
  lines.push(`- Header links: ${counts.navigation.headerLinks}`);
  lines.push(`- Footer links: ${counts.navigation.footerLinks}`);
  lines.push(`- Images: ${counts.media.images}`);
  lines.push(`- SVG icons: ${counts.media.svgIcons}`);
  lines.push('');

  // Critical instruction
  lines.push('### GENERATION INSTRUCTION:');
  lines.push('When generating HTML, use EXACTLY these item counts:');
  Object.entries(counts.summary.recommendedItemCounts).forEach(([selector, count]) => {
    lines.push(`- ${selector}: ${count} items`);
  });

  return lines.join('\n');
}
