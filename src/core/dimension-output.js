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
 * Build cross-viewport summary for AI consumption.
 * Includes section-aware typography and container data.
 *
 * @param {Object} viewports - Viewport data keyed by name (desktop, tablet, mobile)
 * @returns {Object} Summary with:
 *   - maxContainerWidth: Largest container width across all viewports
 *   - commonGap: Average gap from card patterns
 *   - breakpoints: Viewport width breakpoints
 *   - typography: Flat h1/h2/h3/body sizes by viewport (backward compat)
 *   - typographyBySection: Typography grouped by section context (hero h1 != content h1)
 *   - cardPatterns: Card group statistics
 *   - sections: Section detection summary (found flag + width/containerWidth)
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
    // Flat typography for backward compatibility
    typography: { h1: {}, h2: {}, h3: {}, body: {} },
    // NEW: Typography by section context
    typographyBySection: {
      hero: {},
      content: {},
      header: {},
      footer: {},
      sidebar: {}
    },
    cardPatterns: { totalGroups: 0, avgCardSize: null },
    // NEW: Section summary
    sections: {
      hero: { found: false, containerWidth: null },
      content: { found: false, containerWidth: null },
      header: { found: false, containerWidth: null },
      footer: { found: false, containerWidth: null },
      sidebar: { found: false, width: null }
    }
  };

  for (const [vpName, vpData] of Object.entries(viewports)) {
    if (!vpData) continue;

    // Container section mapping
    if (vpData.containers) {
      for (const container of vpData.containers) {
        if (container.width > summary.maxContainerWidth) {
          summary.maxContainerWidth = container.width;
        }
        // Track section widths
        const section = container.section || 'content';
        if (summary.sections[section]) {
          summary.sections[section].found = true;
          // Sidebar uses 'width' field, others use 'containerWidth'
          if (section === 'sidebar') {
            if (!summary.sections[section].width ||
                container.width > summary.sections[section].width) {
              summary.sections[section].width = container.width;
            }
          } else {
            if (!summary.sections[section].containerWidth ||
                container.width > summary.sections[section].containerWidth) {
              summary.sections[section].containerWidth = container.width;
            }
          }
        }
      }
    }

    // Typography by section
    if (vpData.typography) {
      for (const typo of vpData.typography) {
        const tag = typo.selector?.toLowerCase();
        const section = typo.section || 'content';

        // Flat typography (backward compat) - take first found
        if (tag === 'h1' && !summary.typography.h1[vpName]) summary.typography.h1[vpName] = typo.fontSize;
        if (tag === 'h2' && !summary.typography.h2[vpName]) summary.typography.h2[vpName] = typo.fontSize;
        if (tag === 'h3' && !summary.typography.h3[vpName]) summary.typography.h3[vpName] = typo.fontSize;
        if (tag === 'p' && !summary.typography.body[vpName]) summary.typography.body[vpName] = typo.fontSize;

        // Typography by section
        if (!summary.typographyBySection[section]) {
          summary.typographyBySection[section] = {};
        }
        if (!summary.typographyBySection[section][tag]) {
          summary.typographyBySection[section][tag] = {};
        }
        // Take first found per section/tag/viewport
        if (!summary.typographyBySection[section][tag][vpName]) {
          summary.typographyBySection[section][tag][vpName] = typo.fontSize;
        }
      }
    }

    // Card patterns (unchanged)
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
 * Includes section-aware typography for accurate reconstruction
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

  /**
   * Convert typographyBySection to AI-friendly format with px units
   */
  function inferTypographyBySection(typographyBySection) {
    const result = {};
    for (const [section, tags] of Object.entries(typographyBySection || {})) {
      if (!tags || Object.keys(tags).length === 0) continue;
      result[section] = {};
      for (const [tag, sizes] of Object.entries(tags)) {
        // Use desktop first, then tablet, then mobile
        const size = sizes.desktop || sizes.tablet || sizes.mobile || 0;
        if (size > 0) {
          result[section][tag] = size + "px";
        }
      }
      // Remove empty sections
      if (Object.keys(result[section]).length === 0) {
        delete result[section];
      }
    }
    return result;
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
    // NEW: Section-aware typography (hero h1 != content h1)
    TYPOGRAPHY_BY_SECTION: inferTypographyBySection(summary.typographyBySection),
    // NEW: Section info
    SECTIONS: {
      hero: summary.sections?.hero || { found: false },
      content: summary.sections?.content || { found: false },
      header: summary.sections?.header || { found: false },
      footer: summary.sections?.footer || { found: false },
      sidebar: summary.sections?.sidebar || { found: false }
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
