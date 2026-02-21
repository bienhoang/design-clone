/**
 * Inline Style Injector for HTML Extraction
 *
 * Computes and inlines critical layout styles (flex, grid, absolute, fixed)
 * onto cloned DOM elements during HTML extraction to preserve visual layout
 * without relying on external stylesheets.
 *
 * Designed to run inside page.evaluate — all functions are serialized as
 * source strings and reconstructed in the browser context.
 */

/**
 * Compute inline styles for critical elements and apply them to the cloned doc.
 * Called inside page.evaluate with the live document and cloned doc in scope.
 *
 * @param {Document} liveDocument - The live page document (for getComputedStyle)
 * @param {Document} clonedDoc - The cloned document to mutate
 * @param {string[]} inlineProps - CSS property names (camelCase) to inline
 * @param {string[]} criticalDisplay - Display values that trigger inlining (e.g. 'flex')
 * @param {string[]} criticalPosition - Position values that trigger inlining (e.g. 'fixed')
 * @returns {{ inlinedCount: number, warnings: string[] }}
 */
export function computeAndApplyInlineStyles(
  liveDocument, clonedDoc, inlineProps, criticalDisplay, criticalPosition
) {
  const warnings    = [];
  const inlineStyles = [];
  let inlinedCount  = 0;

  liveDocument.querySelectorAll('*').forEach((liveEl, idx) => {
    const style    = getComputedStyle(liveEl);
    const display  = style.display;
    const position = style.position;

    if (!criticalDisplay.includes(display) && !criticalPosition.includes(position)) return;

    const props = [];
    inlineProps.forEach(prop => {
      const val = style[prop];
      if (val && val !== 'auto' && val !== 'none' && val !== 'normal' &&
          val !== '0px' && val !== 'static' && val !== 'visible' &&
          val !== 'content-box') {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        props.push(`${cssProp}: ${val}`);
      }
    });

    // Always include display for critical elements
    if (!props.some(p => p.startsWith('display:'))) {
      props.unshift(`display: ${display}`);
    }

    if (props.length > 0) inlineStyles.push({ idx, style: props.join('; ') });
  });

  // Apply to cloned doc by index
  const clonedElements = clonedDoc.querySelectorAll('*');
  inlineStyles.forEach(({ idx, style }) => {
    if (!clonedElements[idx]) return;
    const existing = clonedElements[idx].getAttribute('style') || '';
    clonedElements[idx].setAttribute('style', existing ? `${existing}; ${style}` : style);
    inlinedCount++;
  });

  if (inlinedCount > 100) {
    warnings.push(`Inlined ${inlinedCount} critical elements`);
  }

  return { inlinedCount, warnings };
}
