/**
 * DOM content counting logic executed inside page.evaluate.
 *
 * Exports a single serializable function string (domCountingScript) that
 * is passed into page.evaluate() by content-counter.js. Keeping it separate
 * allows the browser-side counting logic to be maintained independently of
 * the Node.js orchestration and summary-generation code.
 *
 * All code inside the function runs in browser context — no imports allowed.
 */

/**
 * Browser-side DOM counting function.
 * Returns structured content counts for sections, grids, repeated items,
 * navigation, media, and interactive elements.
 *
 * @returns {Object} content counts
 */
export function domCountingFn() {
  const counts = {
    extractedAt: new Date().toISOString(),
    sections: { total: 0, withBackground: 0, details: [] },
    grids: { total: 0, details: [] },
    repeatedItems: { total: 0, byType: {} },
    navigation: { headerLinks: 0, footerLinks: 0, allLinks: 0 },
    media: { images: 0, videos: 0, svgIcons: 0 },
    interactive: { buttons: 0, inputs: 0, forms: 0 }
  };

  const isVisible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           !el.hasAttribute('hidden');
  };

  const getSelector = (el) => {
    if (el.id) return `#${el.id}`;
    const classes = [...el.classList].filter(c =>
      !c.match(/^(js-|is-|has-|data-)/) && c.length > 2
    ).slice(0, 3).join('.');
    return classes ? `.${classes}` : el.tagName.toLowerCase();
  };

  // 1. Count sections
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
        const rect = el.getBoundingClientRect();
        const isSignificant = rect.height > 100 && rect.width > 200;
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

  // 2. Count grid/flex containers
  const gridSelectors = ['[class*="grid"]', '[style*="display: grid"]'];
  const flexSelectors = [
    '[class*="flex"][class*="gap"]',
    '[class*="flex"][class*="wrap"]',
    '[class*="flex"][class*="col"]'
  ];

  const processedGrids = new Set();
  const MIN_ITEMS_FOR_GRID = 2;
  const MAX_GRID_DETAILS = 50;

  [...gridSelectors, ...flexSelectors].forEach(sel => {
    try {
      document.querySelectorAll(sel).forEach(el => {
        if (processedGrids.has(el)) return;
        if (counts.grids.details.length >= MAX_GRID_DETAILS) return;

        const style = getComputedStyle(el);
        if (style.display === 'grid' || style.display === 'flex' ||
            style.display === 'inline-grid' || style.display === 'inline-flex') {
          processedGrids.add(el);
          const items = [...el.children].filter(child =>
            child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE'
          );
          if (items.length < MIN_ITEMS_FOR_GRID) return;
          const visibleItems = items.filter(isVisible);
          const hiddenItems = items.filter(i => !isVisible(i));
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

  // 3. Count repeated items
  const repeatPatterns = [
    { name: 'cards',        selectors: ['[class*="card"]', '[class*="Card"]'] },
    { name: 'listItems',    selectors: ['li', '[class*="item"]', '[class*="Item"]'] },
    { name: 'services',     selectors: ['[class*="service"]', '[class*="Service"]'] },
    { name: 'features',     selectors: ['[class*="feature"]', '[class*="Feature"]'] },
    { name: 'testimonials', selectors: ['[class*="testimonial"]', '[class*="review"]'] },
    { name: 'teamMembers',  selectors: ['[class*="team"]', '[class*="member"]', '[class*="person"]'] },
    { name: 'faqItems',     selectors: ['[class*="faq"]', '[class*="accordion"]', 'details'] },
    { name: 'pricingCards', selectors: ['[class*="pricing"]', '[class*="plan"]'] },
    { name: 'blogPosts',    selectors: ['[class*="post"]', '[class*="article"]', 'article'] },
    { name: 'products',     selectors: ['[class*="product"]', '[class*="Product"]'] },
    { name: 'categories',   selectors: ['[class*="category"]', '[class*="Category"]'] }
  ];

  repeatPatterns.forEach(({ name, selectors }) => {
    let total = 0, visible = 0;
    selectors.forEach(sel => {
      try { document.querySelectorAll(sel).forEach(el => { total++; if (isVisible(el)) visible++; }); }
      catch (e) { /* invalid selector */ }
    });
    if (total > 0) {
      counts.repeatedItems.byType[name] = { total, visible, hidden: total - visible };
      counts.repeatedItems.total += total;
    }
  });

  // 4. Navigation
  const hdr = document.querySelector('header, [class*="header"], nav');
  const ftr = document.querySelector('footer, [class*="footer"]');
  if (hdr) counts.navigation.headerLinks = hdr.querySelectorAll('a').length;
  if (ftr) counts.navigation.footerLinks = ftr.querySelectorAll('a').length;
  counts.navigation.allLinks = document.querySelectorAll('a').length;

  // 5. Media & interactive
  counts.media.images = document.querySelectorAll('img, picture').length;
  counts.media.videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
  counts.media.svgIcons = document.querySelectorAll('svg').length;
  counts.interactive.buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').length;
  counts.interactive.inputs = document.querySelectorAll('input, textarea, select').length;
  counts.interactive.forms = document.querySelectorAll('form').length;

  // 6. Summary
  counts.summary = {
    majorSections: counts.sections.total, gridContainers: counts.grids.total,
    totalRepeatedItems: counts.repeatedItems.total, totalLinks: counts.navigation.allLinks,
    totalImages: counts.media.images, totalButtons: counts.interactive.buttons,
    recommendedItemCounts: {}
  };
  counts.grids.details.forEach(g => { if (g.visibleItems >= 3) counts.summary.recommendedItemCounts[g.selector] = g.visibleItems; });
  Object.entries(counts.repeatedItems.byType).forEach(([t, d]) => { if (d.visible >= 2) counts.summary.recommendedItemCounts[t] = d.visible; });

  return counts;
}
