/**
 * AI Summary Generator for Dimension Output
 *
 * Generates a compact (<5KB) AI-friendly summary from full component-dimensions.json.
 * Includes section-aware typography, exact measurements, and responsive breakpoints.
 */

/**
 * Infer section padding from container data.
 * @param {Array} containers
 * @returns {string} e.g. "64px 0"
 */
function inferSectionPadding(containers) {
  if (!containers || containers.length === 0) return '64px 0';
  const paddings = containers.slice(0, 5).map(c => ({
    v: c.paddingTop || c.paddingBottom || 64,
    h: c.paddingLeft || c.paddingRight || 0
  }));
  const avgV = Math.round(paddings.reduce((s, p) => s + p.v, 0) / paddings.length);
  const avgH = Math.round(paddings.reduce((s, p) => s + p.h, 0) / paddings.length);
  return `${avgV}px ${avgH}px`;
}

/**
 * Infer card dimensions from card pattern data.
 * @param {Array} cards
 * @returns {{ width: string, height: string, padding: string }}
 */
function inferCardDimensions(cards) {
  if (!cards || cards.length === 0) {
    return { width: 'auto', height: 'auto', padding: '24px' };
  }
  const first = cards[0].avgDimensions || cards[0];
  return {
    width:   first.width  ? first.width + 'px'  : 'auto',
    height:  first.height > 0 ? first.height + 'px' : 'auto',
    padding: (first.paddingTop || first.padding || 24) + 'px'
  };
}

/**
 * Convert typographyBySection to AI-friendly format with px units.
 * Uses desktop size first, then tablet, then mobile.
 * @param {Object} typographyBySection
 * @returns {Object}
 */
function inferTypographyBySection(typographyBySection) {
  const result = {};
  for (const [section, tags] of Object.entries(typographyBySection || {})) {
    if (!tags || Object.keys(tags).length === 0) continue;
    result[section] = {};
    for (const [tag, sizes] of Object.entries(tags)) {
      const size = sizes.desktop || sizes.tablet || sizes.mobile || 0;
      if (size > 0) result[section][tag] = size + 'px';
    }
    if (Object.keys(result[section]).length === 0) delete result[section];
  }
  return result;
}

/**
 * Generate AI-friendly summary (compact, <5KB).
 * Includes section-aware typography for accurate reconstruction.
 * @param {Object} fullOutput - Full component-dimensions.json
 * @returns {Object} Compact summary for AI prompts
 */
export function generateAISummary(fullOutput) {
  const { viewports, summary } = fullOutput;
  const desktop = viewports.desktop || {};

  return {
    _comment: 'USE THESE EXACT VALUES - DO NOT ESTIMATE',
    EXACT_DIMENSIONS: {
      container_max_width: summary.maxContainerWidth + 'px',
      section_padding:     inferSectionPadding(desktop.containers),
      card_dimensions:     inferCardDimensions(desktop.cards),
      gap:                 summary.commonGap + 'px'
    },
    EXACT_TYPOGRAPHY: {
      h1:   (summary.typography.h1.desktop   || 48) + 'px',
      h2:   (summary.typography.h2.desktop   || 36) + 'px',
      h3:   (summary.typography.h3.desktop   || 24) + 'px',
      body: (summary.typography.body.desktop || 16) + 'px'
    },
    TYPOGRAPHY_BY_SECTION: inferTypographyBySection(summary.typographyBySection),
    SECTIONS: {
      hero:    summary.sections?.hero    || { found: false },
      content: summary.sections?.content || { found: false },
      header:  summary.sections?.header  || { found: false },
      footer:  summary.sections?.footer  || { found: false },
      sidebar: summary.sections?.sidebar || { found: false }
    },
    RESPONSIVE: {
      desktop_breakpoint: summary.breakpoints.desktop + 'px',
      tablet_breakpoint:  summary.breakpoints.tablet  + 'px',
      mobile_breakpoint:  summary.breakpoints.mobile  + 'px',
      typography_scaling: {
        h1: {
          desktop: (summary.typography.h1.desktop || 48) + 'px',
          tablet:  (summary.typography.h1.tablet  || 36) + 'px',
          mobile:  (summary.typography.h1.mobile  || 28) + 'px'
        },
        h2: {
          desktop: (summary.typography.h2.desktop || 36) + 'px',
          tablet:  (summary.typography.h2.tablet  || 28) + 'px',
          mobile:  (summary.typography.h2.mobile  || 24) + 'px'
        }
      }
    }
  };
}
