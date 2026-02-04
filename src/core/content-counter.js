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

/**
 * Count content items in page DOM
 * @param {Page} page - Playwright page
 * @returns {Promise<object>} Content counts
 */
export async function extractContentCounts(page) {
  return await page.evaluate(() => {
    const counts = {
      extractedAt: new Date().toISOString(),

      // Section counts
      sections: {
        total: 0,
        withBackground: 0,
        details: []
      },

      // Grid/List containers
      grids: {
        total: 0,
        details: []
      },

      // Repeated items (cards, list items)
      repeatedItems: {
        total: 0,
        byType: {}
      },

      // Navigation
      navigation: {
        headerLinks: 0,
        footerLinks: 0,
        allLinks: 0
      },

      // Media
      media: {
        images: 0,
        videos: 0,
        svgIcons: 0
      },

      // Interactive
      interactive: {
        buttons: 0,
        inputs: 0,
        forms: 0
      }
    };

    // Helper: check if element is visible (not hidden)
    const isVisible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             !el.hasAttribute('hidden');
    };

    // Helper: get meaningful class name for element
    const getSelector = (el) => {
      if (el.id) return `#${el.id}`;
      const classes = [...el.classList].filter(c =>
        !c.match(/^(js-|is-|has-|data-)/) &&
        c.length > 2
      ).slice(0, 3).join('.');
      return classes ? `.${classes}` : el.tagName.toLowerCase();
    };

    // 1. Count sections (major containers with padding/background)
    const sectionSelectors = [
      'section',
      '[class*="section"]',
      '[class*="py-lg"]', '[class*="py-xl"]', '[class*="py-2xl"]',
      '[class*="py-md"]',
      '[class*="bg-background"]',
      '[class*="bg-white"]',
      '[class*="bg-gray"]'
    ];

    const sectionElements = new Set();
    const MAX_SECTION_DETAILS = 30;

    sectionSelectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (sectionElements.size >= MAX_SECTION_DETAILS) return;

          // Check if element has significant height and width (major section)
          const rect = el.getBoundingClientRect();
          const isSignificant = rect.height > 100 && rect.width > 200;

          // Count elements that are either:
          // 1. Direct children of body/main/root
          // 2. Have section-like characteristics (padding, bg, significant size)
          const parent = el.parentElement;
          const isTopLevel = parent?.tagName === 'BODY' ||
                            parent?.tagName === 'MAIN' ||
                            parent?.id === 'root' ||
                            parent?.id === '__next' ||
                            parent?.classList.contains('container');

          if (isTopLevel || (isSignificant && isVisible(el))) {
            sectionElements.add(el);
          }
        });
      } catch (e) { /* invalid selector */ }
    });

    sectionElements.forEach(el => {
      const style = getComputedStyle(el);
      const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                    style.backgroundColor !== 'transparent';
      counts.sections.total++;
      if (hasBg) counts.sections.withBackground++;

      counts.sections.details.push({
        selector: getSelector(el),
        visible: isVisible(el),
        hasBackground: hasBg,
        childCount: el.children.length
      });
    });

    // 2. Count grid/flex containers and their items
    // Only target meaningful containers (not trivial wrappers)
    const gridSelectors = [
      '[class*="grid"]',
      '[style*="display: grid"]'
    ];

    // Separate flex selectors - more selective
    const flexSelectors = [
      '[class*="flex"][class*="gap"]',
      '[class*="flex"][class*="wrap"]',
      '[class*="flex"][class*="col"]'
    ];

    const processedGrids = new Set();
    const MIN_ITEMS_FOR_GRID = 2;  // Only count containers with 2+ items
    const MAX_GRID_DETAILS = 50;   // Limit output size

    [...gridSelectors, ...flexSelectors].forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (processedGrids.has(el)) return;
          if (counts.grids.details.length >= MAX_GRID_DETAILS) return;

          const style = getComputedStyle(el);
          if (style.display === 'grid' || style.display === 'flex' ||
              style.display === 'inline-grid' || style.display === 'inline-flex') {
            processedGrids.add(el);

            // Count direct children (grid items)
            const items = [...el.children].filter(child =>
              child.tagName !== 'SCRIPT' &&
              child.tagName !== 'STYLE'
            );

            // Skip containers with fewer than MIN_ITEMS
            if (items.length < MIN_ITEMS_FOR_GRID) return;

            // Count visible vs hidden
            const visibleItems = items.filter(isVisible);
            const hiddenItems = items.filter(i => !isVisible(i));

            // Only count if has meaningful visible items
            if (visibleItems.length >= MIN_ITEMS_FOR_GRID) {
              counts.grids.total++;
              counts.grids.details.push({
                selector: getSelector(el),
                display: style.display,
                totalItems: items.length,
                visibleItems: visibleItems.length,
                hiddenItems: hiddenItems.length,
                gridCols: style.gridTemplateColumns || null,
                visible: isVisible(el)
              });
            }
          }
        });
      } catch (e) { /* invalid selector */ }
    });

    // 3. Count repeated items (cards, list items, etc.)
    const repeatPatterns = [
      { name: 'cards', selectors: ['[class*="card"]', '[class*="Card"]'] },
      { name: 'listItems', selectors: ['li', '[class*="item"]', '[class*="Item"]'] },
      { name: 'services', selectors: ['[class*="service"]', '[class*="Service"]'] },
      { name: 'features', selectors: ['[class*="feature"]', '[class*="Feature"]'] },
      { name: 'testimonials', selectors: ['[class*="testimonial"]', '[class*="review"]'] },
      { name: 'teamMembers', selectors: ['[class*="team"]', '[class*="member"]', '[class*="person"]'] },
      { name: 'faqItems', selectors: ['[class*="faq"]', '[class*="accordion"]', 'details'] },
      { name: 'pricingCards', selectors: ['[class*="pricing"]', '[class*="plan"]'] },
      { name: 'blogPosts', selectors: ['[class*="post"]', '[class*="article"]', 'article'] },
      { name: 'products', selectors: ['[class*="product"]', '[class*="Product"]'] },
      { name: 'categories', selectors: ['[class*="category"]', '[class*="Category"]'] }
    ];

    repeatPatterns.forEach(({ name, selectors }) => {
      let totalCount = 0;
      let visibleCount = 0;

      selectors.forEach(sel => {
        try {
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => {
            totalCount++;
            if (isVisible(el)) visibleCount++;
          });
        } catch (e) { /* invalid selector */ }
      });

      if (totalCount > 0) {
        counts.repeatedItems.byType[name] = {
          total: totalCount,
          visible: visibleCount,
          hidden: totalCount - visibleCount
        };
        counts.repeatedItems.total += totalCount;
      }
    });

    // 4. Count navigation links
    const header = document.querySelector('header, [class*="header"], nav');
    const footer = document.querySelector('footer, [class*="footer"]');

    if (header) {
      counts.navigation.headerLinks = header.querySelectorAll('a').length;
    }
    if (footer) {
      counts.navigation.footerLinks = footer.querySelectorAll('a').length;
    }
    counts.navigation.allLinks = document.querySelectorAll('a').length;

    // 5. Count media elements
    counts.media.images = document.querySelectorAll('img, picture').length;
    counts.media.videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
    counts.media.svgIcons = document.querySelectorAll('svg').length;

    // 6. Count interactive elements
    counts.interactive.buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').length;
    counts.interactive.inputs = document.querySelectorAll('input, textarea, select').length;
    counts.interactive.forms = document.querySelectorAll('form').length;

    // 7. Calculate summary
    counts.summary = {
      majorSections: counts.sections.total,
      gridContainers: counts.grids.total,
      totalRepeatedItems: counts.repeatedItems.total,
      totalLinks: counts.navigation.allLinks,
      totalImages: counts.media.images,
      totalButtons: counts.interactive.buttons,

      // Provide estimates for generation
      recommendedItemCounts: {}
    };

    // Calculate recommended item counts per grid
    counts.grids.details.forEach((grid, idx) => {
      if (grid.visibleItems >= 3) {
        counts.summary.recommendedItemCounts[grid.selector] = grid.visibleItems;
      }
    });

    // Add repeated items recommendations
    Object.entries(counts.repeatedItems.byType).forEach(([type, data]) => {
      if (data.visible >= 2) {
        counts.summary.recommendedItemCounts[type] = data.visible;
      }
    });

    return counts;
  });
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
