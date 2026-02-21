/**
 * Page Asset Scraper
 *
 * Extracts asset URLs from a live Playwright page (images, inline SVGs,
 * CSS stylesheet links) and from raw CSS content (background URLs, font-face).
 */

import { URL } from 'url';

/**
 * Parse CSS text for asset URLs (background images + font-face src).
 * @param {string} cssContent
 * @param {string} baseUrl
 * @returns {string[]} Absolute asset URLs
 */
export function extractCssUrls(cssContent, baseUrl) {
  const urls = new Set();

  const bgPattern = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  let match;
  while ((match = bgPattern.exec(cssContent)) !== null) {
    const url = match[1];
    if (!url.startsWith('data:')) {
      try { urls.add(new URL(url, baseUrl).href); } catch { /* ignore */ }
    }
  }

  const fontPattern = /@font-face\s*\{[^}]*src:\s*([^;]+)/gi;
  while ((match = fontPattern.exec(cssContent)) !== null) {
    const srcValue = match[1];
    const urlPattern = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(srcValue)) !== null) {
      const url = urlMatch[1];
      if (!url.startsWith('data:')) {
        try { urls.add(new URL(url, baseUrl).href); } catch { /* ignore */ }
      }
    }
  }

  return Array.from(urls);
}

/**
 * Extract all asset URLs and inline SVGs from a Playwright page.
 * @param {import('playwright').Page} page
 * @param {string} baseUrl
 * @returns {Promise<{ images: string[], cssUrls: string[], inlineSvgs: Array<{id: string, content: string}> }>}
 */
export async function extractAssetsFromPage(page, baseUrl) {
  return await page.evaluate((url) => {
    const imageSet = new Set();
    const cssUrls = [];

    // img[src]
    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        try { imageSet.add(new URL(src, url).href); } catch { /* ignore */ }
      }
    });

    // srcset
    document.querySelectorAll('[srcset]').forEach(el => {
      const srcset = el.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach(part => {
          const src = part.trim().split(/\s+/)[0];
          if (src && !src.startsWith('data:')) {
            try { imageSet.add(new URL(src, url).href); } catch { /* ignore */ }
          }
        });
      }
    });

    // Inline background images
    document.querySelectorAll('[style*="background"]').forEach(el => {
      const style = el.getAttribute('style');
      const urlMatch = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
      if (urlMatch && !urlMatch[1].startsWith('data:')) {
        try { imageSet.add(new URL(urlMatch[1], url).href); } catch { /* ignore */ }
      }
    });

    // Favicon and touch icons
    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('data:')) {
        try { imageSet.add(new URL(href, url).href); } catch { /* ignore */ }
      }
    });

    // Inline SVGs
    const inlineSvgs = [];
    document.querySelectorAll('svg').forEach((svg, index) => {
      const svgContent = svg.outerHTML;
      if (svgContent.length < 50000) {
        inlineSvgs.push({
          id: svg.id || `inline-svg-${index}`,
          content: svgContent
        });
      }
    });

    // External CSS stylesheets (for font extraction)
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        try { cssUrls.push(new URL(href, url).href); } catch { /* ignore */ }
      }
    });

    return { images: Array.from(imageSet), cssUrls, inlineSvgs };
  }, baseUrl);
}
