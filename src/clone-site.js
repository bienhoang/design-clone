#!/usr/bin/env node
/**
 * Multi-page site cloner for design-clone
 * Merges: clone-site command, universal-discoverer, multi-page-screenshot,
 *         merge-css, merge-css-file-io, merge-css-atrule-processor,
 *         rewrite-links, rewrite-links-css-rewriter
 *
 * Usage: node clone-site.js <url> [--pages /,/about] [--max-pages 10] [--output dir]
 */

import fs from 'fs/promises';
import path from 'path';
import { getBrowser, getPage, closeBrowser, parseArgs as parseArgUtils, outputJSON, logInfo, logWarn } from './utils.js';
import { capture } from './capture.js';
import { sanitizeCss } from './filter-css.js';

let csstree;
try { csstree = await import('css-tree'); } catch { /* optional for CSS merge */ }

// ── URL Helpers ─────────────────────────────────────────────────────────────

export function normalizeUrl(baseUrl, href) {
  if (!href || /^(mailto:|tel:|javascript:|data:)/.test(href)) return null;
  try {
    const u = new URL(href, baseUrl);
    u.hash = '';
    let p = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.origin}${p}`;
  } catch { return null; }
}

export function isSameDomain(url, domain, includeSubdomains = false) {
  try {
    const h = new URL(url).hostname;
    if (h === domain) return true;
    return includeSubdomains && h.endsWith(`.${domain}`);
  } catch { return false; }
}

export function extractPageName(text, urlPath) {
  if (text?.trim()) return text.trim();
  if (!urlPath || urlPath === '/') return 'Home';
  const last = urlPath.split('/').filter(Boolean).pop() || 'Page';
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

// ── Page Discovery (universal discoverer inlined) ──────────────────────────

const SKIP_PATTERNS = [
  /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i,
  /^\/api\//, /^\/_next\//, /^\/_nuxt\//, /^\/static\//, /^\/assets\//,
];

async function discoverPages(page, baseUrl, maxPages = 10) {
  const origin = new URL(baseUrl).origin;

  // Inject history interception
  try {
    await page.evaluate(() => {
      if (window.__UNIVERSAL_INTERCEPTION_ACTIVE__) return;
      window.__UNIVERSAL_DISCOVERED_ROUTES__ = [];
      window.__UNIVERSAL_INTERCEPTION_ACTIVE__ = true;
      const origPush = history.pushState.bind(history);
      history.pushState = function(s, t, u) { if (u) window.__UNIVERSAL_DISCOVERED_ROUTES__.push(u.toString()); return origPush(s, t, u); };
      const origReplace = history.replaceState.bind(history);
      history.replaceState = function(s, t, u) { if (u) window.__UNIVERSAL_DISCOVERED_ROUTES__.push(u.toString()); return origReplace(s, t, u); };
      window.addEventListener('popstate', () => window.__UNIVERSAL_DISCOVERED_ROUTES__.push(window.location.pathname));
    });
  } catch { /* ok */ }

  // Scrape links
  const rawRoutes = await page.evaluate(({ origin }) => {
    const routes = [], seen = new Set();
    const skip = [/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i, /^\/api\//, /^\/_next\//, /^\/_nuxt\//, /^\/static\//, /^\/assets\//];
    function add(p, name, src) {
      if (!p || seen.has(p) || !p.startsWith('/')) return;
      if (skip.some(r => r.test(p))) return;
      seen.add(p); routes.push({ path: p, name: name || '', source: src });
    }

    // History interception
    if (window.__UNIVERSAL_DISCOVERED_ROUTES__) {
      window.__UNIVERSAL_DISCOVERED_ROUTES__.forEach(u => { try { add(new URL(u, origin).pathname, '', 'interception'); } catch { /* skip */ } });
    }

    // Nav links
    ['nav a[href]', 'header a[href]', '[role="navigation"] a[href]', '[class*="nav"] a[href]', '[class*="menu"] a[href]', 'footer a[href]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(l => { const h = l.getAttribute('href'); if (h?.startsWith('/')) add(h, l.textContent?.trim() || '', 'link-scrape'); });
    });

    // All internal links
    document.querySelectorAll('a[href^="/"]').forEach(l => {
      const h = l.getAttribute('href');
      if (h && !l.hasAttribute('download') && l.getAttribute('target') !== '_blank') add(h, l.textContent?.trim() || '', 'link-scrape');
    });

    return routes;
  }, { origin });

  // Try sitemap
  const sitemapRoutes = [];
  try {
    const sitemapXml = await page.evaluate(async (url) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); return r.ok ? await r.text() : null; } catch { return null; } }, `${origin}/sitemap.xml`);
    if (sitemapXml) {
      for (const m of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
        try { const u = new URL(m[1]); if (u.origin === origin) sitemapRoutes.push({ path: u.pathname, name: '', source: 'sitemap' }); } catch { /* skip */ }
      }
    }
  } catch { /* ok */ }

  // Deduplicate and limit
  const all = [...rawRoutes, ...sitemapRoutes];
  const seen = new Set();
  const deduped = [];
  for (const r of all) {
    const norm = r.path.replace(/\/+$/, '') || '/';
    if (seen.has(norm)) continue;
    seen.add(norm);
    const name = r.name || (norm === '/' ? 'Home' : norm.replace(/^\//, '').replace(/[-/]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    deduped.push({ path: norm, name, url: `${origin}${norm}` });
  }

  // Always include homepage
  if (!deduped.some(r => r.path === '/')) deduped.unshift({ path: '/', name: 'Home', url: `${origin}/` });

  return deduped.slice(0, maxPages);
}

// ── CSS Merge ──────────────────────────────────────────────────────────────

function getRuleHash(node) { return `${csstree.generate(node.prelude)}|${csstree.generate(node.block)}`; }

function mergeStylesheets(cssContents) {
  if (!csstree) return { css: cssContents.join('\n'), stats: {} };

  const seenRules = new Map(), seenFontFaces = new Map(), seenKeyframes = new Map();
  const imports = [], mediaGroups = new Map(), outputNodes = [];
  const stats = { inputRules: 0, outputRules: 0, duplicateRulesRemoved: 0, fontFacesDeduped: 0, keyframesDeduped: 0, mediaQueriesCombined: 0 };
  let charsetNode = null;

  for (const css of cssContents) {
    if (!css) continue;
    let ast;
    try { ast = csstree.parse(css, { parseRulePrelude: true, parseValue: false }); } catch { continue; }

    // At-rules
    csstree.walk(ast, { visit: 'Atrule', enter(node) {
      const name = node.name.toLowerCase();
      if (name === 'charset') { if (!charsetNode) charsetNode = node; return; }
      if (name === 'import') { imports.push(node); return; }
      if (name === 'font-face') {
        stats.inputRules++;
        let family = '', src = '';
        csstree.walk(node, { visit: 'Declaration', enter(d) { if (d.property === 'font-family') family = csstree.generate(d.value).replace(/["']/g, '').trim(); if (d.property === 'src') src = csstree.generate(d.value); } });
        const key = `${family}|${src}`;
        if (!seenFontFaces.has(key)) { seenFontFaces.set(key, node); outputNodes.push(node); } else stats.fontFacesDeduped++;
        return;
      }
      if (name === 'keyframes' || name === '-webkit-keyframes') {
        stats.inputRules++;
        const kfName = node.prelude ? csstree.generate(node.prelude).trim() : '';
        if (!seenKeyframes.has(kfName)) { seenKeyframes.set(kfName, node); outputNodes.push(node); } else stats.keyframesDeduped++;
        return;
      }
      if (name === 'media') {
        const cond = node.prelude ? csstree.generate(node.prelude) : '';
        if (cond) {
          if (!mediaGroups.has(cond)) mediaGroups.set(cond, []);
          csstree.walk(node.block, { visit: 'Rule', enter(rule) {
            stats.inputRules++;
            const h = getRuleHash(rule);
            const group = mediaGroups.get(cond);
            if (!group.some(r => r.hash === h)) group.push({ hash: h, node: rule }); else stats.duplicateRulesRemoved++;
          }});
        } else outputNodes.push(node);
        return;
      }
      outputNodes.push(node);
    }});

    // Top-level rules
    csstree.walk(ast, { visit: 'Rule', enter(node, item, list) {
      let parent = list; while (parent?.data) { if (parent.data.type === 'Atrule') return; parent = parent.parent; }
      stats.inputRules++;
      const h = getRuleHash(node);
      if (!seenRules.has(h)) { seenRules.set(h, node); outputNodes.push(node); } else stats.duplicateRulesRemoved++;
    }});
  }

  // Build output
  const out = { type: 'StyleSheet', children: new csstree.List() };
  if (charsetNode) out.children.push(charsetNode);
  for (const imp of imports) out.children.push(imp);
  for (const node of outputNodes) { out.children.push(node); stats.outputRules++; }
  for (const [cond, rules] of mediaGroups) {
    if (!rules.length) continue;
    stats.mediaQueriesCombined++;
    const block = { type: 'Block', children: new csstree.List() };
    for (const r of rules) { block.children.push(r.node); stats.outputRules++; }
    out.children.push({ type: 'Atrule', name: 'media', prelude: csstree.parse(cond, { context: 'mediaQueryList' }), block });
  }

  return { css: sanitizeCss(csstree.generate(out)), stats };
}

async function mergeCssFiles(cssFiles, outputPath) {
  const contents = [];
  for (const f of cssFiles) { try { contents.push(await fs.readFile(f, 'utf-8')); } catch { /* skip */ } }
  if (!contents.length) return { success: false };
  const { css, stats } = mergeStylesheets(contents);
  await fs.writeFile(outputPath, css, 'utf-8');
  return { success: true, path: path.resolve(outputPath), stats };
}

// ── Link Rewriting ─────────────────────────────────────────────────────────

function pathToFilename(urlPath) {
  if (!urlPath || urlPath === '/' || urlPath === '') return 'index.html';
  return urlPath.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').toLowerCase() + '.html';
}

function rewriteLinks(html, manifest, baseUrl) {
  const urlMap = new Map();
  for (const p of manifest.pages) {
    if (p.originalUrl) { urlMap.set(p.originalUrl, p.file); urlMap.set(p.originalUrl.replace(/\/$/, ''), p.file); }
    if (p.path) { urlMap.set(p.path, p.file); if (p.path !== '/') urlMap.set(p.path.replace(/\/$/, ''), p.file); }
  }

  let result = html;

  // Rewrite <a href> internal links
  result = result.replace(/(<a\s[^>]*href=["'])([^"']+)(["'][^>]*>)/gi, (match, pre, href, suf) => {
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return match;
    const fn = urlMap.get(href) || urlMap.get(href.replace(/\/$/, ''));
    if (fn) { const frag = href.match(/#[^#]*$/)?.[0] || ''; return `${pre}${fn}${frag}${suf}`; }
    return match;
  });

  // Rewrite CSS links to shared styles.css
  result = result.replace(/<link([^>]*?)href=["'][^"']*\.css["']([^>]*?)>/gi, (match, before, after) => {
    if (match.includes('rel="stylesheet"') || match.includes("rel='stylesheet'") || !match.includes('rel=')) {
      return `<link${before}href="../styles.css" rel="stylesheet"${after}>`;
    }
    return match;
  });

  // Deduplicate stylesheet links
  const seen = new Set();
  result = result.replace(/<link[^>]*href=["']\.\.\/styles\.css["'][^>]*>/gi, (match) => {
    if (seen.has('styles.css')) return '';
    seen.add('styles.css');
    return match;
  });

  return result;
}

// ── Main Clone Function ────────────────────────────────────────────────────

function generateOutputDir(url) {
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  return `./cloned-designs/${ts}-${domain}`;
}

export async function cloneSite(url, options = {}) {
  const startTime = Date.now();
  const { pages: manualPages, maxPages = 10, viewports = ['desktop', 'tablet', 'mobile'], output, dryRun = false } = options;

  new URL(url); // validate
  const outputDir = output || generateOutputDir(url);
  logInfo(`[clone-site] Target: ${url}, Output: ${outputDir}`);

  // Step 1: Discover pages
  logInfo('[1/4] Discovering pages...');
  let pageList;
  if (manualPages?.length) {
    pageList = manualPages.map(p => ({ path: p, name: p === '/' ? 'Home' : p.replace(/^\//, '').replace(/-/g, ' '), url: new URL(p, url).href }));
  } else {
    const browser = await getBrowser({ headless: true });
    const page = await getPage(browser);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    pageList = await discoverPages(page, url, maxPages);
    await closeBrowser();
  }

  logInfo(`Found ${pageList.length} pages`);
  for (const p of pageList) logInfo(`  - ${p.path} (${p.name})`);

  if (dryRun) return { success: true, dryRun: true, pages: pageList };

  // Step 2: Capture each page sequentially
  logInfo('[2/4] Capturing pages...');
  const capturedPages = [];
  const cssFiles = [];

  for (let i = 0; i < pageList.length; i++) {
    const pg = pageList[i];
    const pageDir = path.join(outputDir, 'pages', pathToFilename(pg.path).replace('.html', ''));
    logInfo(`  [${i + 1}/${pageList.length}] Capturing: ${pg.path}`);

    try {
      const result = await capture(pg.url, pageDir, { extractHtml: true, extractCss: true, filterUnused: true, viewports, headless: true, close: true });
      capturedPages.push({ ...pg, success: true, result, dir: pageDir });

      // Collect CSS files for merge
      if (result.extraction?.filtered?.path) cssFiles.push(result.extraction.filtered.path);
      else if (result.extraction?.css?.path) cssFiles.push(result.extraction.css.path);
    } catch (e) {
      logWarn(`  Failed: ${pg.path} - ${e.message}`);
      capturedPages.push({ ...pg, success: false, error: e.message });
    }
  }

  // Step 3: Merge CSS across pages
  logInfo('[3/4] Merging CSS...');
  let mergeResult = null;
  if (cssFiles.length > 0) {
    const mergedCssPath = path.join(outputDir, 'styles.css');
    mergeResult = await mergeCssFiles(cssFiles, mergedCssPath);
    if (mergeResult.success) logInfo(`  Merged ${cssFiles.length} CSS files`);
  }

  // Step 4: Write HTML files with rewritten links + manifest
  logInfo('[4/4] Generating output...');
  const manifest = {
    baseUrl: url, capturedAt: new Date().toISOString(),
    pages: capturedPages.filter(p => p.success).map(p => ({
      path: p.path, name: p.name, file: pathToFilename(p.path), originalUrl: p.url,
      screenshots: Object.fromEntries((p.result?.screenshots || []).map(s => [s.viewport, path.relative(outputDir, s.path)])),
    })),
    assets: { css: mergeResult?.success ? 'styles.css' : null },
  };

  // Copy HTML to output root with rewritten links
  for (const pg of capturedPages.filter(p => p.success)) {
    const htmlSrc = pg.result?.extraction?.html?.path;
    if (!htmlSrc) continue;
    const htmlDest = path.join(outputDir, 'pages', pathToFilename(pg.path));
    try {
      const html = await fs.readFile(htmlSrc, 'utf-8');
      await fs.mkdir(path.dirname(htmlDest), { recursive: true });
      await fs.writeFile(htmlDest, rewriteLinks(html, manifest, url));
    } catch { /* skip */ }
  }

  await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  logInfo(`[clone-site] Complete! ${capturedPages.filter(p => p.success).length}/${pageList.length} pages, ${(Date.now() - startTime) / 1000}s`);

  return { success: true, outputDir: path.resolve(outputDir), manifest, totalTimeMs: Date.now() - startTime };
}

// ── CLI Entry ──────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.basename(process.argv[1]) === 'clone-site.js';
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node clone-site.js <url> [--pages /,/about] [--max-pages 10] [--output dir] [--dry-run]');
    process.exit(0);
  }

  const parsed = parseArgUtils(args);
  const url = args.find(a => !a.startsWith('--') && a.startsWith('http')) || parsed.url;
  if (!url) { console.error('Error: URL is required'); process.exit(1); }

  cloneSite(url, {
    pages: parsed.pages?.split(',').map(p => p.trim()),
    maxPages: parsed['max-pages'] ? parseInt(parsed['max-pages']) : 10,
    output: parsed.output,
    dryRun: parsed['dry-run'] === 'true' || parsed['dry-run'] === true,
  })
    .then(r => { outputJSON(r); process.exit(0); })
    .catch(e => { console.error(`[ERROR] ${e.message}`); process.exit(1); });
}

export { discoverPages, mergeStylesheets, mergeCssFiles, rewriteLinks, pathToFilename };
