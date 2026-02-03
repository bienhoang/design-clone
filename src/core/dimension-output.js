/**
 * Dimension Output Builder
 *
 * Build and format component dimension output for JSON files.
 * Includes sanitization, cross-viewport summary, and AI-friendly format.
 */

// Default viewport configurations
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1 },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2 }
};

/**
 * Build final component-dimensions.json output with proper schema
 * @param {Object} allViewportDimensions - Dimensions from all viewports
 * @param {string} url - Source URL
 * @returns {Object} Final JSON structure
 */
export function buildDimensionsOutput(allViewportDimensions, url) {
  const output = {
    meta: {
      version: "1.0",
      extractedAt: new Date().toISOString(),
      url: url,
      tool: "design-clone/screenshot.js"
    },
    viewports: {},
    summary: {}
  };

  for (const [vpName, vpData] of Object.entries(allViewportDimensions)) {
    output.viewports[vpName] = sanitizeViewportData(vpData, vpName);
  }

  output.summary = buildCrossViewportSummary(output.viewports);
  return output;
}

/**
 * Sanitize viewport data for JSON output
 */
export function sanitizeViewportData(data, vpName) {
  if (!data) return {};

  const clean = JSON.parse(JSON.stringify(data));
  clean.width = VIEWPORTS[vpName]?.width || 0;
  clean.height = VIEWPORTS[vpName]?.height || 0;

  function roundNumbers(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'number') {
        obj[key] = Math.round(obj[key]);
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach(item => roundNumbers(item));
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        roundNumbers(obj[key]);
      }
    }
    return obj;
  }

  function truncateStrings(obj, maxLen = 80) {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].length > maxLen) {
        obj[key] = obj[key].slice(0, maxLen) + '...';
      } else if (Array.isArray(obj[key])) {
        obj[key].forEach(item => truncateStrings(item, maxLen));
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        truncateStrings(obj[key], maxLen);
      }
    }
    return obj;
  }

  // Limit array sizes for token efficiency
  if (clean.containers && clean.containers.length > 15) {
    clean.containers = clean.containers.slice(0, 15);
  }
  if (clean.images && clean.images.length > 10) {
    clean.images = clean.images.slice(0, 10);
  }
  if (clean.buttons && clean.buttons.length > 10) {
    clean.buttons = clean.buttons.slice(0, 10);
  }

  return truncateStrings(roundNumbers(clean));
}

/**
 * Build cross-viewport summary for AI consumption
 */
export function buildCrossViewportSummary(viewports) {
  const summary = {
    maxContainerWidth: 0,
    commonGap: 0,
    breakpoints: {
      desktop: VIEWPORTS.desktop.width,
      tablet: VIEWPORTS.tablet.width,
      mobile: VIEWPORTS.mobile.width
    },
    typography: { h1: {}, h2: {}, h3: {}, body: {} },
    cardPatterns: { totalGroups: 0, avgCardSize: null }
  };

  for (const [vpName, vpData] of Object.entries(viewports)) {
    if (!vpData) continue;

    if (vpData.containers) {
      for (const container of vpData.containers) {
        if (container.width > summary.maxContainerWidth) {
          summary.maxContainerWidth = container.width;
        }
      }
    }

    if (vpData.typography) {
      for (const typo of vpData.typography) {
        const tag = typo.selector?.toLowerCase();
        if (tag === 'h1') summary.typography.h1[vpName] = typo.fontSize;
        if (tag === 'h2') summary.typography.h2[vpName] = typo.fontSize;
        if (tag === 'h3') summary.typography.h3[vpName] = typo.fontSize;
        if (tag === 'p') summary.typography.body[vpName] = typo.fontSize;
      }
    }

    if (vpData.cards && vpData.cards.length > 0) {
      summary.cardPatterns.totalGroups += vpData.cards.length;
      if (vpName === 'desktop' && vpData.cards[0]?.avgDimensions) {
        summary.cardPatterns.avgCardSize = vpData.cards[0].avgDimensions;
      }

      const gaps = vpData.cards.map(g => g.gap).filter(g => g > 0);
      if (gaps.length > 0) {
        summary.commonGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }
    }
  }

  return summary;
}

/**
 * Generate AI-friendly summary (compact, <5KB)
 * @param {Object} fullOutput - Full component-dimensions.json
 * @returns {Object} Compact summary for AI prompts
 */
export function generateAISummary(fullOutput) {
  const { viewports, summary } = fullOutput;
  const desktop = viewports.desktop || {};

  function inferSectionPadding(containers) {
    if (!containers || containers.length === 0) return "64px 0";
    const paddings = containers.slice(0, 5).map(c => ({
      v: c.paddingTop || c.paddingBottom || 64,
      h: c.paddingLeft || c.paddingRight || 0
    }));
    const avgV = Math.round(paddings.reduce((s, p) => s + p.v, 0) / paddings.length);
    const avgH = Math.round(paddings.reduce((s, p) => s + p.h, 0) / paddings.length);
    return `${avgV}px ${avgH}px`;
  }

  function inferCardDimensions(cards) {
    if (!cards || cards.length === 0) {
      return { width: "auto", height: "auto", padding: "24px" };
    }
    const first = cards[0].avgDimensions || cards[0];
    return {
      width: first.width ? first.width + "px" : "auto",
      height: first.height > 0 ? first.height + "px" : "auto",
      padding: (first.paddingTop || first.padding || 24) + "px"
    };
  }

  return {
    _comment: "USE THESE EXACT VALUES - DO NOT ESTIMATE",
    EXACT_DIMENSIONS: {
      container_max_width: summary.maxContainerWidth + "px",
      section_padding: inferSectionPadding(desktop.containers),
      card_dimensions: inferCardDimensions(desktop.cards),
      gap: summary.commonGap + "px"
    },
    EXACT_TYPOGRAPHY: {
      h1: (summary.typography.h1.desktop || 48) + "px",
      h2: (summary.typography.h2.desktop || 36) + "px",
      h3: (summary.typography.h3.desktop || 24) + "px",
      body: (summary.typography.body.desktop || 16) + "px"
    },
    RESPONSIVE: {
      desktop_breakpoint: summary.breakpoints.desktop + "px",
      tablet_breakpoint: summary.breakpoints.tablet + "px",
      mobile_breakpoint: summary.breakpoints.mobile + "px",
      typography_scaling: {
        h1: {
          desktop: (summary.typography.h1.desktop || 48) + "px",
          tablet: (summary.typography.h1.tablet || 36) + "px",
          mobile: (summary.typography.h1.mobile || 28) + "px"
        },
        h2: {
          desktop: (summary.typography.h2.desktop || 36) + "px",
          tablet: (summary.typography.h2.tablet || 28) + "px",
          mobile: (summary.typography.h2.mobile || 24) + "px"
        }
      }
    }
  };
}
