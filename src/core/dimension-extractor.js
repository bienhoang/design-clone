/**
 * Component Dimension Extractor
 *
 * Extract exact pixel dimensions from page elements using
 * getBoundingClientRect and getComputedStyle.
 */

/**
 * Extract component dimensions from page
 * @param {Page} page - Playwright page
 * @param {string} viewportName - 'desktop', 'tablet', or 'mobile'
 * @returns {Promise<Object>} Dimension data for this viewport
 */
export async function extractComponentDimensions(page, viewportName) {
  return await page.evaluate((vpName) => {
    const results = {
      viewport: vpName,
      extractedAt: new Date().toISOString(),
      containers: [],
      cards: [],
      typography: [],
      buttons: [],
      images: []
    };

    // Helper: extract dimensions from element
    function extractDimensions(el) {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        absoluteX: Math.round(rect.x + window.scrollX),
        absoluteY: Math.round(rect.y + window.scrollY),
        paddingTop: parseFloat(computed.paddingTop) || 0,
        paddingRight: parseFloat(computed.paddingRight) || 0,
        paddingBottom: parseFloat(computed.paddingBottom) || 0,
        paddingLeft: parseFloat(computed.paddingLeft) || 0,
        marginTop: parseFloat(computed.marginTop) || 0,
        marginRight: parseFloat(computed.marginRight) || 0,
        marginBottom: parseFloat(computed.marginBottom) || 0,
        marginLeft: parseFloat(computed.marginLeft) || 0,
        display: computed.display,
        position: computed.position,
        flexDirection: computed.flexDirection !== 'row' ? computed.flexDirection : undefined,
        justifyContent: computed.justifyContent !== 'normal' ? computed.justifyContent : undefined,
        alignItems: computed.alignItems !== 'normal' ? computed.alignItems : undefined,
        gap: parseFloat(computed.gap) || 0,
        gridTemplateColumns: computed.gridTemplateColumns !== 'none' ? computed.gridTemplateColumns : undefined,
        gridTemplateRows: computed.gridTemplateRows !== 'none' ? computed.gridTemplateRows : undefined,
        backgroundColor: computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computed.backgroundColor : undefined,
        borderRadius: computed.borderRadius !== '0px' ? computed.borderRadius : undefined,
        boxShadow: computed.boxShadow !== 'none' ? computed.boxShadow : undefined,
        fontSize: parseFloat(computed.fontSize) || 0,
        fontWeight: computed.fontWeight,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing !== 'normal' ? computed.letterSpacing : undefined,
        color: computed.color
      };
    }

    // Helper: clean object by removing undefined/null values
    function cleanObject(obj) {
      return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== 0 && v !== '')
      );
    }

    /**
     * Section Detection Configuration
     * These thresholds determine how elements are classified into page sections.
     * Semantic tags (<header>, <footer>, etc.) always take priority over position.
     * Position-based detection is used as fallback for non-semantic elements.
     */
    const HERO_THRESHOLD = 0.25;    // Elements in top 25% with height >300px → hero
    const FOOTER_THRESHOLD = 0.85;  // Elements below 85% of page height → footer
    const SIDEBAR_MAX_WIDTH = 400;  // Max px width for fixed/sticky sidebar detection

    // Page dimensions for section context
    const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const pageWidth = document.documentElement.clientWidth;

    /**
     * Detect section context for an element.
     *
     * Priority order (per validation decision):
     * 1. Semantic HTML tags: <header>, <footer>, <aside>, <nav> (highest priority)
     * 2. Ancestor semantic tags: element inside <header>, <footer>, etc.
     * 3. Position-based heuristics: hero (top 25%), footer (bottom 15%)
     * 4. Layout-based: fixed/sticky narrow elements → sidebar
     * 5. Default: 'content'
     *
     * @param {Element} el - DOM element to classify
     * @returns {string} Section context: 'header' | 'hero' | 'content' | 'sidebar' | 'footer' | 'nav'
     */
    function detectSection(el) {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);
      const yRatio = (rect.y + window.scrollY) / pageHeight;

      // Semantic tags have priority (per validation decision)
      const tag = el.tagName.toLowerCase();
      if (tag === 'header' || el.closest('header')) return 'header';
      if (tag === 'footer' || el.closest('footer')) return 'footer';
      if (tag === 'aside' || el.closest('aside')) return 'sidebar';
      if (tag === 'nav' || el.closest('nav')) return 'nav';

      // Hero detection (large element in top 25%)
      if (yRatio < HERO_THRESHOLD && rect.height > 300) return 'hero';

      // Footer detection (bottom 15%)
      if (yRatio > FOOTER_THRESHOLD) return 'footer';

      // Sidebar detection (narrow fixed/sticky)
      if ((computed.position === 'fixed' || computed.position === 'sticky') && rect.width < SIDEBAR_MAX_WIDTH) {
        return 'sidebar';
      }

      return 'content';
    }

    // 1. Extract containers
    const containerSelectors = [
      'section', 'main', 'article', 'header', 'footer',
      '[role="main"]', '[role="region"]',
      'div[class*="container"]', 'div[class*="wrapper"]',
      'div[class*="section"]', 'div[class*="content"]',
      'div[class*="grid"]', 'div[class*="card"]'
    ];

    const seenContainers = new Set();
    containerSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seenContainers.has(el)) return;
          const rect = el.getBoundingClientRect();
          if (rect.width < 100 || rect.height < 50) return;

          const children = Array.from(el.children).filter(c => {
            const cr = c.getBoundingClientRect();
            return cr.width > 50 && cr.height > 30;
          });

          if (children.length >= 2) {
            seenContainers.add(el);
            const dims = extractDimensions(el);
            dims.selector = el.className
              ? `.${el.className.split(' ').filter(c => c && !c.includes(':')).slice(0, 2).join('.')}`
              : el.tagName.toLowerCase();
            dims.childCount = children.length;
            dims.section = detectSection(el);  // Add section context

            if (children.length >= 2 && (dims.display === 'flex' || dims.display === 'grid')) {
              const firstRect = children[0].getBoundingClientRect();
              const secondRect = children[1].getBoundingClientRect();
              const calculatedGap = Math.round(
                dims.flexDirection === 'column'
                  ? secondRect.top - firstRect.bottom
                  : secondRect.left - firstRect.right
              );
              if (calculatedGap > 0 && calculatedGap < 200) {
                dims.calculatedGap = calculatedGap;
              }
            }

            results.containers.push(cleanObject(dims));
          }
        });
      } catch (e) { /* ignore */ }
    });

    // 2. Extract typography (grouped by section context)
    const typographySelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
    typographySelectors.forEach(tag => {
      try {
        const elements = document.querySelectorAll(tag);
        if (elements.length === 0) return;

        const bySection = {};  // Group by section

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.width < 50 || rect.height < 10) continue;

          const section = detectSection(el);
          const dims = extractDimensions(el);

          // Create section group if not exists
          if (!bySection[section]) bySection[section] = [];

          // Add to section group (limit 2 per section per tag for token efficiency)
          if (bySection[section].length < 2) {
            bySection[section].push({
              selector: tag,
              section,
              fontSize: dims.fontSize,
              fontWeight: dims.fontWeight,
              lineHeight: dims.lineHeight,
              letterSpacing: dims.letterSpacing,
              color: dims.color,
              marginTop: dims.marginTop,
              marginBottom: dims.marginBottom,
              textSample: el.textContent?.trim().slice(0, 40),
              y: Math.round(rect.y + window.scrollY)
            });
          }
        }

        // Flatten section groups into typography array
        for (const items of Object.values(bySection)) {
          results.typography.push(...items);
        }
      } catch (e) { /* ignore */ }
    });

    // Sort typography by position for consistent output
    results.typography.sort((a, b) => a.y - b.y);

    // 3. Extract buttons
    const buttonSelectors = [
      'button', 'a[class*="btn"]', 'a[class*="button"]',
      '[role="button"]', 'input[type="submit"]'
    ];
    const seenButtons = new Set();
    buttonSelectors.forEach(selector => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (seenButtons.has(el)) return;
          const rect = el.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 20) return;
          if (results.buttons.length >= 10) return;

          seenButtons.add(el);
          const dims = extractDimensions(el);
          results.buttons.push({
            width: dims.width,
            height: dims.height,
            paddingTop: dims.paddingTop,
            paddingRight: dims.paddingRight,
            paddingBottom: dims.paddingBottom,
            paddingLeft: dims.paddingLeft,
            fontSize: dims.fontSize,
            fontWeight: dims.fontWeight,
            borderRadius: dims.borderRadius,
            backgroundColor: dims.backgroundColor,
            color: dims.color,
            text: el.textContent?.trim().slice(0, 30)
          });
        });
      } catch (e) { /* ignore */ }
    });

    // 4. Extract images
    try {
      document.querySelectorAll('img').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 80) return;
        if (results.images.length >= 15) return;

        results.images.push({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          aspectRatio: (rect.width / rect.height).toFixed(2),
          x: Math.round(rect.x),
          y: Math.round(rect.y + window.scrollY)
        });
      });
    } catch (e) { /* ignore */ }

    // 5. Card pattern detection
    function calculateSimilarity(a, b) {
      const widthSim = 1 - Math.abs(a.width - b.width) / Math.max(a.width, b.width, 1);
      const heightSim = 1 - Math.abs(a.height - b.height) / Math.max(a.height, b.height, 1);
      const marginA = a.marginTop + a.marginBottom;
      const marginB = b.marginTop + b.marginBottom;
      const marginSim = 1 - Math.abs(marginA - marginB) / Math.max(marginA, marginB, 1);
      const radiusSim = a.borderRadius === b.borderRadius ? 1 : 0.5;
      return (widthSim * 0.4) + (heightSim * 0.3) + (marginSim * 0.15) + (radiusSim * 0.15);
    }

    function detectLayoutType(elements) {
      if (elements.length < 2) return 'single';
      const yPositions = elements.map(el => el.y);
      const xPositions = elements.map(el => el.x);
      const yVariance = Math.max(...yPositions) - Math.min(...yPositions);
      const xVariance = Math.max(...xPositions) - Math.min(...xPositions);
      const avgHeight = elements.reduce((s, el) => s + el.height, 0) / elements.length;
      const avgWidth = elements.reduce((s, el) => s + el.width, 0) / elements.length;

      if (yVariance < avgHeight * 0.3 && xVariance > avgWidth) return 'row';
      if (xVariance < avgWidth * 0.3 && yVariance > avgHeight) return 'column';
      return 'grid';
    }

    function calculateGap(elements, layout) {
      if (elements.length < 2) return 0;
      const sorted = layout === 'column'
        ? [...elements].sort((a, b) => a.y - b.y)
        : [...elements].sort((a, b) => a.x - b.x);

      let totalGap = 0, gapCount = 0;
      for (let i = 1; i < sorted.length; i++) {
        const gap = layout === 'column'
          ? sorted[i].y - (sorted[i-1].y + sorted[i-1].height)
          : sorted[i].x - (sorted[i-1].x + sorted[i-1].width);
        if (gap > 0 && gap < 200) { totalGap += gap; gapCount++; }
      }
      return gapCount > 0 ? Math.round(totalGap / gapCount) : 0;
    }

    let cardGroupId = 0;
    results.containers.forEach(container => {
      if (container.childCount >= 2) {
        try {
          const parent = document.querySelector(container.selector);
          if (!parent) return;

          const children = Array.from(parent.children).filter(c => {
            const cr = c.getBoundingClientRect();
            return cr.width > 80 && cr.height > 60;
          });

          if (children.length >= 2) {
            const childDims = children.map(c => {
              const cr = c.getBoundingClientRect();
              const cs = window.getComputedStyle(c);
              return {
                width: Math.round(cr.width),
                height: Math.round(cr.height),
                x: Math.round(cr.x),
                y: Math.round(cr.y),
                paddingTop: parseFloat(cs.paddingTop) || 0,
                paddingRight: parseFloat(cs.paddingRight) || 0,
                paddingBottom: parseFloat(cs.paddingBottom) || 0,
                paddingLeft: parseFloat(cs.paddingLeft) || 0,
                marginTop: parseFloat(cs.marginTop) || 0,
                marginBottom: parseFloat(cs.marginBottom) || 0,
                borderRadius: cs.borderRadius,
                boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : undefined,
                backgroundColor: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined
              };
            });

            const used = new Set();
            const groups = [];

            for (let i = 0; i < childDims.length; i++) {
              if (used.has(i)) continue;
              const group = [childDims[i]];
              used.add(i);

              for (let j = i + 1; j < childDims.length; j++) {
                if (used.has(j)) continue;
                if (calculateSimilarity(childDims[i], childDims[j]) >= 0.70) {
                  group.push(childDims[j]);
                  used.add(j);
                }
              }

              if (group.length >= 2) groups.push(group);
            }

            groups.forEach(group => {
              const avg = (arr, key) => Math.round(arr.reduce((s, el) => s + (el[key] || 0), 0) / arr.length);
              const layout = detectLayoutType(group);
              const gap = calculateGap(group, layout);

              results.cards.push({
                id: `card-group-${++cardGroupId}`,
                parentSelector: container.selector,
                count: group.length,
                layout,
                gap,
                avgDimensions: {
                  width: avg(group, 'width'),
                  height: avg(group, 'height'),
                  paddingTop: avg(group, 'paddingTop'),
                  paddingRight: avg(group, 'paddingRight'),
                  paddingBottom: avg(group, 'paddingBottom'),
                  paddingLeft: avg(group, 'paddingLeft')
                },
                borderRadius: group[0].borderRadius !== '0px' ? group[0].borderRadius : undefined,
                boxShadow: group[0].boxShadow,
                backgroundColor: group[0].backgroundColor
              });
            });
          }
        } catch (e) { /* ignore */ }
      }
    });

    // 6. Grid layouts
    results.gridLayouts = [];
    results.containers.forEach(container => {
      if (container.display === 'grid' || container.display === 'flex') {
        try {
          const parent = document.querySelector(container.selector);
          if (!parent) return;
          const computed = window.getComputedStyle(parent);
          const children = parent.children;

          if (children.length >= 2) {
            if (computed.display === 'grid') {
              const columns = computed.gridTemplateColumns;
              const colCount = columns && columns !== 'none'
                ? columns.split(' ').filter(c => c && c !== 'none').length
                : Math.ceil(children.length / 2);

              results.gridLayouts.push({
                selector: container.selector,
                display: 'grid',
                columns: colCount,
                rows: Math.ceil(children.length / colCount),
                columnGap: parseFloat(computed.columnGap) || parseFloat(computed.gap) || 0,
                rowGap: parseFloat(computed.rowGap) || parseFloat(computed.gap) || 0,
                childCount: children.length
              });
            } else if (computed.display === 'flex') {
              results.gridLayouts.push({
                selector: container.selector,
                display: 'flex',
                flexDirection: computed.flexDirection,
                flexWrap: computed.flexWrap,
                gap: parseFloat(computed.gap) || container.calculatedGap || 0,
                childCount: children.length
              });
            }
          }
        } catch (e) { /* ignore */ }
      }
    });

    return results;
  }, viewportName);
}
