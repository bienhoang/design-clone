#!/usr/bin/env node
/**
 * Single-session capture pipeline for design-clone
 * Merges: screenshot*, css-extractor, breakpoint-detector, computed-style-extractor,
 *         html-extractor, html-extractor-inline-styler, cookie-handler, lazy-loader,
 *         page-readiness, state-capture, state-capture-detection
 *
 * Usage: node capture.js --url <url> --output <dir> [options]
 *
 * Options:
 *   --url, --output, --viewports, --full-page, --max-size, --headless,
 *   --scroll-delay, --close, --extract-html, --extract-css, --filter-unused,
 *   --capture-hover, --detect-breakpoints, --extract-computed, --aggressive-filter
 */

import path from 'path';
import fs from 'fs/promises';
import {
  getBrowser, getPage, closeBrowser, disconnectBrowser,
  parseArgs, outputJSON, outputError, logInfo, logWarn, isTTY,
  createProgress, VIEWPORTS, VIEWPORTS_HD, TIMING, SIZE_LIMITS, createError
} from './utils.js';
import { filterCssFile } from './filter-css.js';

// ── Optional dependencies ──────────────────────────────────────────────────

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }

let csstree = null;
try { csstree = await import('css-tree'); } catch { /* optional for hover detection */ }

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SCROLL_DELAY = 1500;
const LAZY_LOAD_MAX_ITERATIONS = 15;
const MAX_HTML_SIZE = 10 * 1024 * 1024;
const MAX_CSS_SIZE = 10 * 1024 * 1024;
const MAX_HOVER_ELEMENTS = 50;
const HOVER_SETTLE_DELAY = 100;

const JS_FRAMEWORK_PATTERNS = [
  /^data-react/i, /^data-vue/i, /^data-ng/i, /^ng-/i,
  /^data-svelte/i, /^x-/i, /^hx-/i, /^v-/i,
  /^data-alpine/i, /^wire:/i, /^@/,
];

const COOKIE_SELECTORS = [
  '[aria-label*="accept" i]', 'button[class*="accept" i]', 'button[id*="accept" i]',
  '#onetrust-accept-btn-handler', '.cc-accept', '.cookie-accept',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '.cookie-banner button:first-of-type', '.cookie-consent button:first-of-type',
];

const COOKIE_REMOVE_SELECTORS = [
  '[class*="cookie-banner"]', '[class*="cookie-consent"]', '[class*="cookie-notice"]',
  '[id*="cookie-banner"]', '[id*="cookie-consent"]', '#onetrust-banner-sdk', '.cc-banner', '[class*="gdpr"]',
];

const LOADING_SELECTORS = ['.loading', '[class*="loading"]', '[class*="spinner"]', '[class*="skeleton"]', '[class*="placeholder"]'];
const CONTENT_SELECTORS = ['main', 'article', '[role="main"]', 'header nav a'];

const LAYOUT_PROPERTIES = {
  display: ['display','flexDirection','flexWrap','justifyContent','alignItems','alignContent','gap','rowGap','columnGap'],
  grid: ['gridTemplateColumns','gridTemplateRows','gridGap','gridAutoFlow'],
  position: ['position','top','right','bottom','left','zIndex'],
  sizing: ['width','height','minWidth','maxWidth','minHeight','maxHeight'],
  box: ['boxSizing','overflow','overflowX','overflowY','borderWidth','borderStyle'],
  visual: ['color','backgroundColor','fontFamily','fontSize','fontWeight','lineHeight','padding','margin','borderRadius'],
};
const ALL_PROPERTIES = Object.values(LAYOUT_PROPERTIES).flat();
const INLINE_LAYOUT_PROPS = [...LAYOUT_PROPERTIES.display, ...LAYOUT_PROPERTIES.grid, ...LAYOUT_PROPERTIES.position, ...LAYOUT_PROPERTIES.sizing, 'boxSizing', 'overflow'];
const CRITICAL_DISPLAY = ['flex', 'inline-flex', 'grid', 'inline-grid'];
const CRITICAL_POSITION = ['absolute', 'fixed'];

const INTERACTIVE_SELECTORS = ['button:not(:disabled)', 'a[href]', '[role="button"]', '[role="link"]', 'input[type="submit"]', '.btn', '.button', '.card', '.nav-link'];
const HOVER_STYLE_PROPS = ['backgroundColor','color','transform','boxShadow','borderColor','opacity','scale','filter','textDecoration','outline'];

// ── Inline Styler (serialized into browser) ────────────────────────────────

function computeAndApplyInlineStyles(liveDocument, clonedDoc, inlineProps, criticalDisplay, criticalPosition) {
  const warnings = [], inlineStyles = [];
  let inlinedCount = 0;

  liveDocument.querySelectorAll('*').forEach((liveEl, idx) => {
    const style = getComputedStyle(liveEl);
    if (!criticalDisplay.includes(style.display) && !criticalPosition.includes(style.position)) return;
    const props = [];
    inlineProps.forEach(prop => {
      const val = style[prop];
      if (val && val !== 'auto' && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'static' && val !== 'visible' && val !== 'content-box') {
        props.push(`${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${val}`);
      }
    });
    if (!props.some(p => p.startsWith('display:'))) props.unshift(`display: ${style.display}`);
    if (props.length > 0) inlineStyles.push({ idx, style: props.join('; ') });
  });

  const clonedElements = clonedDoc.querySelectorAll('*');
  inlineStyles.forEach(({ idx, style }) => {
    if (!clonedElements[idx]) return;
    const existing = clonedElements[idx].getAttribute('style') || '';
    clonedElements[idx].setAttribute('style', existing ? `${existing}; ${style}` : style);
    inlinedCount++;
  });
  if (inlinedCount > 100) warnings.push(`Inlined ${inlinedCount} critical elements`);
  return { inlinedCount, warnings };
}

// ── Page Preparation ───────────────────────────────────────────────────────

async function dismissCookieBanner(page) {
  for (const sel of COOKIE_SELECTORS) {
    try { const el = await page.$(sel); if (el) { await el.click(); await new Promise(r => setTimeout(r, 500)); return { method: 'click', selector: sel }; } } catch { continue; }
  }
  const removed = await page.evaluate((sels) => { let c = 0; for (const s of sels) document.querySelectorAll(s).forEach(el => { el.remove(); c++; }); return c; }, COOKIE_REMOVE_SELECTORS);
  return removed > 0 ? { method: 'remove', count: removed } : { method: 'none' };
}

async function waitForFontsLoaded(page, timeout = 5000) {
  try { await page.evaluate(async (t) => { if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, t))]); }, timeout); } catch { /* ok */ }
}

async function waitForStylesStable(page, stableMs = 500, timeout = 5000) {
  try {
    await page.evaluate(async ({ stable, max }) => new Promise(resolve => {
      let lastChange = Date.now();
      const obs = new MutationObserver(muts => { for (const m of muts) if (m.target.tagName === 'STYLE' || m.target.tagName === 'LINK' || m.addedNodes.length > 0) lastChange = Date.now(); });
      obs.observe(document.head, { childList: true, subtree: true, characterData: true });
      const start = Date.now();
      const iv = setInterval(() => { if (Date.now() - lastChange >= stable || Date.now() - start >= max) { clearInterval(iv); obs.disconnect(); resolve(); } }, 100);
    }), { stable: stableMs, max: timeout });
  } catch { /* ok */ }
}

async function waitForDomStable(page, threshold = 800, timeout = 10000) {
  let lastCount = 0, stableTime = 0;
  const start = Date.now();
  while (stableTime < threshold && (Date.now() - start) < timeout) {
    const count = await page.evaluate(() => document.querySelectorAll('*').length);
    stableTime = count === lastCount ? stableTime + 100 : 0;
    lastCount = count;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function waitForPageReady(page, timeout = 45000) {
  const start = Date.now();
  const initial = await page.evaluate(() => document.querySelectorAll('*').length);
  const min = Math.max(100, initial * 2);
  while (Date.now() - start < timeout) {
    const result = await page.evaluate(({ ls, cs, minEl }) => {
      const count = document.querySelectorAll('*').length;
      const gone = ls.every(s => { const el = document.querySelector(s); if (!el) return true; const st = getComputedStyle(el); return st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0'; });
      const content = cs.some(s => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none'; });
      return { ready: (gone && count >= minEl) || content || count >= minEl };
    }, { ls: LOADING_SELECTORS, cs: CONTENT_SELECTORS, minEl: min });
    if (result.ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
  await waitForDomStable(page, 300);
  await waitForFontsLoaded(page);
  await waitForStylesStable(page, 300, 3000);
  await new Promise(r => setTimeout(r, 2000));
}

async function forceLazyImages(page) {
  return page.evaluate(async () => {
    const stats = { forced: 0, dataSrc: 0, eager: 0 };
    for (const img of document.querySelectorAll('img')) {
      if (img.loading === 'lazy') { img.loading = 'eager'; stats.eager++; }
      const ds = img.dataset.src || img.dataset.lazySrc || img.getAttribute('data-lazy-src');
      if (ds && !img.src) { img.src = ds; stats.dataSrc++; }
      img.scrollIntoView({ block: 'center', behavior: 'instant' }); stats.forced++;
    }
    document.querySelectorAll('[data-bg], [data-background]').forEach(el => { const u = el.dataset.bg || el.dataset.background; if (u) el.style.backgroundImage = `url(${u})`; });
    return stats;
  });
}

async function forceAnimatedElementsVisible(page) {
  return page.evaluate(() => {
    let c = 0;
    document.querySelectorAll('[class*="appear"], [class*="fade"], [class*="animate"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top + window.scrollY > 500) { const s = getComputedStyle(el); if (s.opacity === '0' || parseFloat(s.opacity) < 0.5) { el.style.setProperty('opacity','1','important'); el.style.setProperty('visibility','visible','important'); c++; } }
    });
    return { forcedCount: c };
  });
}

async function triggerLazyLoad(page, maxIter = 20, scrollDelay = 1500) {
  return page.evaluate(async ({ maxIter, pauseMs }) => {
    const vh = window.innerHeight, step = vh * 0.5;
    let pos = 0, iters = 0;
    while (pos < document.body.scrollHeight && iters < maxIter) { window.scrollTo({ top: pos, behavior: 'instant' }); await new Promise(r => setTimeout(r, pauseMs)); pos += step; iters++; }
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); await new Promise(r => setTimeout(r, 1000));
    pos = document.body.scrollHeight;
    while (pos > 0) { pos -= step; window.scrollTo({ top: Math.max(0, pos), behavior: 'instant' }); await new Promise(r => setTimeout(r, 300)); }
    window.scrollTo({ top: 0, behavior: 'instant' }); await new Promise(r => setTimeout(r, 1500));
    if (window.scrollY !== 0) { window.scrollTo({ top: 0, behavior: 'instant' }); await new Promise(r => setTimeout(r, 500)); }
    return { scrolled: iters, height: document.body.scrollHeight, stableAt: iters };
  }, { maxIter, pauseMs: scrollDelay });
}

async function waitForAllImages(page, timeout = 20000) {
  const stats = await page.evaluate(async (maxWait) => {
    const start = Date.now(), imgs = Array.from(document.querySelectorAll('img')), pending = imgs.filter(i => i.src && !i.complete);
    if (!pending.length) return { loaded: imgs.length, pending: 0, timedOut: false };
    await Promise.all(pending.map(img => new Promise(r => { if (img.complete) return r(true); const ck = () => { if (img.complete || Date.now() - start > maxWait) r(img.complete); else setTimeout(ck, 100); }; img.onload = () => r(true); img.onerror = () => r(false); setTimeout(ck, 100); })));
    const still = imgs.filter(i => i.src && !i.complete).length;
    return { loaded: imgs.length - still, pending: still, timedOut: Date.now() - start >= maxWait };
  }, timeout);
  try { await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 10000) }); } catch { /* ok */ }
  await new Promise(r => setTimeout(r, 1500));
  return stats;
}

// ── Extraction ─────────────────────────────────────────────────────────────

async function extractHtml(page) {
  const inlineStylerSrc = computeAndApplyInlineStyles.toString();
  return page.evaluate(({ patterns, inlineProps, critDisplay, critPos, stylerSrc }) => {
    const warnings = [];
    const count = document.querySelectorAll('*').length;
    if (count > 50000) warnings.push(`Large DOM: ${count} elements`);
    const doc = document.documentElement.cloneNode(true);
    doc.querySelectorAll('script, noscript').forEach(el => el.remove());
    doc.querySelectorAll('svg script, svg a[href^="javascript:"]').forEach(el => el.remove());
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => { const h = l.getAttribute('href') || ''; if (h.startsWith('javascript:') || h.startsWith('data:')) l.remove(); });
    doc.querySelectorAll('style').forEach(s => { if ((s.textContent || '').match(/@import\s+url\s*\(\s*['"]?(javascript|data):/i)) s.remove(); });
    const pats = patterns.map(p => new RegExp(p.source, p.flags));
    doc.querySelectorAll('*').forEach(el => { [...el.attributes].forEach(a => { if (a.name.startsWith('on')) el.removeAttribute(a.name); if (pats.some(p => p.test(a.name))) el.removeAttribute(a.name); }); });
    // eslint-disable-next-line no-new-func
    const fn = new Function('return (' + stylerSrc + ')')();
    const { inlinedCount, warnings: sw } = fn(document, doc, inlineProps, critDisplay, critPos);
    warnings.push(...sw);
    doc.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
    doc.querySelectorAll('style:empty').forEach(el => el.remove());
    const rc = (n) => { [...n.childNodes].forEach(c => { if (c.nodeType === 8) c.remove(); else if (c.nodeType === 1) rc(c); }); }; rc(doc);
    const html = '<!DOCTYPE html>\n<html lang="' + (document.documentElement.lang || 'en') + '">\n' + doc.innerHTML + '\n</html>';
    return { html, warnings, elementCount: count, inlinedCount };
  }, { patterns: JS_FRAMEWORK_PATTERNS.map(r => ({ source: r.source, flags: r.flags })), inlineProps: INLINE_LAYOUT_PROPS, critDisplay: CRITICAL_DISPLAY, critPos: CRITICAL_POSITION, stylerSrc: inlineStylerSrc });
}

async function extractCss(page, baseUrl) {
  return page.evaluate(({ url, allProps }) => {
    const cssBlocks = [], corsBlocked = [], warnings = [];
    for (const sheet of document.styleSheets) {
      try {
        const src = sheet.href || 'inline';
        const rules = Array.from(sheet.cssRules || sheet.rules || []).map(r => r.cssText);
        if (rules.length > 0) {
          const resolved = src === 'inline' ? 'inline' : new URL(src, url).href;
          if (rules.length > 5000) warnings.push(`Large stylesheet: ${rules.length} rules from ${resolved}`);
          cssBlocks.push({ source: resolved, css: rules.join('\n'), ruleCount: rules.length });
        }
      } catch { if (sheet.href) corsBlocked.push(sheet.href); }
    }
    const baseSels = ['body','header','nav','main','footer','section','article','h1','h2','h3','h4','h5','h6','p','a','button','input','select','textarea'];
    const cc = {}; document.querySelectorAll('[class]').forEach(el => el.classList.forEach(c => { cc[c] = (cc[c] || 0) + 1; }));
    const topCls = Object.entries(cc).sort((a,b) => b[1]-a[1]).slice(0,10).map(([c]) => `.${c}`);
    const keySels = [...baseSels, ...topCls];
    const computed = {};
    keySels.forEach(sel => { try { const el = document.querySelector(sel); if (el) { const st = getComputedStyle(el); const s = {}; allProps.forEach(p => { const v = st[p]; if (p === 'display') s[p] = v; else if (v && v !== 'none' && v !== 'auto' && v !== 'normal' && v !== '0px' && v !== 'static') s[p] = v; }); computed[sel] = s; } } catch { /* skip */ } });
    return { cssBlocks, corsBlocked, computedStyles: computed, totalRules: cssBlocks.reduce((s,b) => s + b.ruleCount, 0), warnings };
  }, { url: baseUrl, allProps: ALL_PROPERTIES });
}

// ── Breakpoint Detection ───────────────────────────────────────────────────

function detectBreakpoints(cssContent) {
  const re = /\(\s*(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|em|rem)\s*\)/g;
  const mediaRe = /@media\s*([^{]+)\{/g;
  const widths = new Set(), queries = [];
  let m;
  while ((m = mediaRe.exec(cssContent)) !== null) {
    const q = m[1].trim();
    let wm; re.lastIndex = 0;
    while ((wm = re.exec(q)) !== null) {
      let px = parseFloat(wm[1]);
      if (wm[2] === 'em' || wm[2] === 'rem') px = Math.round(px * 16);
      if (px >= 320 && px <= 2560) { widths.add(px); queries.push({ query: q, width: px }); }
    }
  }
  return { breakpoints: [...widths].sort((a,b) => a-b).slice(0, 6), mediaQueries: queries };
}

function mergeBreakpointsWithFixed(detected) {
  const all = [...new Set([1440, ...detected])].sort((a,b) => b-a).slice(0, 6);
  const result = {};
  for (const w of all) {
    const existing = Object.entries(VIEWPORTS).find(([,v]) => v.width === w);
    result[existing ? existing[0] : `bp-${w}`] = { width: w, height: Math.round(w * 0.625), deviceScaleFactor: 1 };
  }
  return result;
}

// ── Computed Style Gap-Fill ────────────────────────────────────────────────

const COMPUTED_KEY_PROPS = ['display','position','margin','padding','width','height','font-size','font-weight','font-family','color','background-color','border','border-radius','flex-direction','justify-content','align-items','gap','grid-template-columns','overflow','text-align','line-height','text-decoration','opacity','z-index','box-shadow','transform'];

async function extractComputedGapFill(page, existingCss) {
  const elStyles = await page.evaluate(({ maxEls, props }) => {
    const visible = [...document.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < window.innerHeight * 2; }).slice(0, maxEls);
    return visible.map(el => {
      const cs = window.getComputedStyle(el), tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string' ? `.${[...el.classList].join('.')}` : '';
      const id = el.id ? `#${el.id}` : '';
      const styles = {}; for (const p of props) { const v = cs.getPropertyValue(p); if (v) styles[p] = v; }
      return { tag, selector: id || (tag + cls) || tag, styles };
    });
  }, { maxEls: 1000, props: COMPUTED_KEY_PROPS });

  const merged = new Map();
  for (const el of elStyles) {
    const gaps = {};
    let hasGap = false;
    for (const [p, v] of Object.entries(el.styles)) {
      if (!existingCss.includes(v)) { gaps[p] = v; hasGap = true; }
    }
    if (hasGap) {
      const existing = merged.get(el.selector);
      if (existing) Object.assign(existing, gaps); else merged.set(el.selector, gaps);
    }
  }

  const rules = [...merged.entries()];
  const css = rules.map(([sel, props]) => `${sel} {\n${Object.entries(props).map(([k,v]) => `  ${k}: ${v};`).join('\n')}\n}`).join('\n\n');
  return { css, rules: rules.length, stats: { elementsAnalyzed: elStyles.length, gapRulesGenerated: rules.length } };
}

// ── Hover State Capture ────────────────────────────────────────────────────

function isValidSelector(s) { return s && typeof s === 'string' && s.trim().length > 0 && s.length <= 500 && !/[<>{}]/.test(s); }

function extractHoverSelectorsFromCss(cssString) {
  const set = new Set();
  if (!csstree || !cssString) return set;
  try {
    const ast = csstree.parse(cssString, { parseRulePrelude: true });
    csstree.walk(ast, { visit: 'Rule', enter(node) {
      if (!node.prelude) return;
      const text = csstree.generate(node.prelude);
      if (text.includes(':hover')) { const base = text.replace(/:hover/g, '').replace(/\s+/g, ' ').trim(); if (base && isValidSelector(base)) set.add(base); }
    }});
  } catch { /* skip */ }
  return set;
}

async function detectInteractiveElementsFromDom(page) {
  return page.evaluate(({ selectors, maxScan, maxDepth }) => {
    function getSel(el) {
      if (el.id) return '#' + el.id;
      const p = []; let cur = el;
      while (cur && cur.nodeType === 1 && p.length < maxDepth) {
        let s = cur.tagName.toLowerCase();
        if (cur.className && typeof cur.className === 'string') { const cls = cur.className.trim().split(/\s+/).slice(0,2).filter(Boolean); if (cls.length) s += '.' + cls.join('.'); }
        const sibs = cur.parentNode?.children || []; const same = Array.from(sibs).filter(x => x.tagName === cur.tagName);
        if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(cur) + 1) + ')';
        p.unshift(s); cur = cur.parentElement;
      }
      return p.join(' > ');
    }
    const results = [], seen = new Set(); let total = 0;
    for (const sel of selectors) { if (total >= maxScan) break; try { for (const el of document.querySelectorAll(sel)) { if (total >= maxScan) break; total++; if (!el.offsetParent && el.tagName !== 'BODY') continue; const u = getSel(el); if (!seen.has(u)) { seen.add(u); results.push({ selector: u, tag: el.tagName.toLowerCase() }); } } } catch { /* skip */ } }
    for (const el of document.querySelectorAll('*')) { if (total >= maxScan) break; total++; if (!el.offsetParent && el.tagName !== 'BODY') continue; const st = getComputedStyle(el); if (st.transition && st.transition !== 'all 0s ease 0s' && st.transition !== 'none' && !st.transition.startsWith('none')) { const u = getSel(el); if (!seen.has(u)) { seen.add(u); results.push({ selector: u, tag: el.tagName.toLowerCase(), hasTransition: true }); } } }
    return results;
  }, { selectors: INTERACTIVE_SELECTORS, maxScan: 200, maxDepth: 3 });
}

async function captureAllHoverStates(page, cssString, outputDir) {
  const hoverDir = path.join(outputDir, 'hover-states');
  await fs.mkdir(hoverDir, { recursive: true });
  const hoverSels = extractHoverSelectorsFromCss(cssString);
  const domEls = await detectInteractiveElementsFromDom(page);
  const combined = Array.from(new Set([...hoverSels, ...domEls.map(e => e.selector).filter(isValidSelector)])).slice(0, MAX_HOVER_ELEMENTS);

  const elements = [];
  let captured = 0;

  for (let i = 0; i < combined.length; i++) {
    const sel = combined[i];
    const r = { selector: sel, success: false, styleDiff: {} };
    try {
      const loc = page.locator(sel);
      if (!(await loc.isVisible().catch(() => false))) continue;
      const box = await loc.boundingBox();
      if (!box) continue;
      const clip = { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: box.width + 40, height: box.height + 40 };

      const before = await page.evaluate(({ s, props }) => { const el = document.querySelector(s); if (!el) return null; const st = getComputedStyle(el); const r = {}; for (const p of props) r[p] = st[p]; return r; }, { s: sel, props: HOVER_STYLE_PROPS });
      await page.screenshot({ path: path.join(hoverDir, `hover-${i}-normal.png`), clip });
      r.normalScreenshot = path.join(hoverDir, `hover-${i}-normal.png`);

      await loc.hover();
      await new Promise(r => setTimeout(r, HOVER_SETTLE_DELAY));

      const after = await page.evaluate(({ s, props }) => { const el = document.querySelector(s); if (!el) return null; const st = getComputedStyle(el); const r = {}; for (const p of props) r[p] = st[p]; return r; }, { s: sel, props: HOVER_STYLE_PROPS });
      await page.screenshot({ path: path.join(hoverDir, `hover-${i}-hover.png`), clip });
      r.hoverScreenshot = path.join(hoverDir, `hover-${i}-hover.png`);

      if (before && after) { for (const [p, v] of Object.entries(before)) { if (after[p] !== v) r.styleDiff[p] = { from: v, to: after[p] }; } }
      await page.mouse.move(0, 0);
      await new Promise(r => setTimeout(r, 50));
      r.success = Object.keys(r.styleDiff).length > 0;
      if (r.success) captured++;
    } catch (e) { r.error = e.message; }
    elements.push(r);
  }

  const summaryPath = path.join(hoverDir, 'hover-diff.json');
  await fs.writeFile(summaryPath, JSON.stringify({ detected: combined.length, captured, elements: elements.filter(e => e.success).map(r => ({ selector: r.selector, styleDiff: r.styleDiff })) }, null, 2));

  // Generate hover.css
  const successful = elements.filter(r => r.success && Object.keys(r.styleDiff).length > 0);
  if (successful.length > 0) {
    const lines = ['/* Generated :hover Styles */\n'];
    for (const r of successful) {
      lines.push(`${r.selector}:hover {`);
      for (const [p, d] of Object.entries(r.styleDiff)) lines.push(`  ${p.replace(/([A-Z])/g,'-$1').toLowerCase()}: ${d.to};`);
      lines.push('}\n');
    }
    await fs.writeFile(path.join(outputDir, 'hover.css'), lines.join('\n'));
  }

  return { directory: hoverDir, detected: combined.length, captured, summaryPath, generatedCss: successful.length > 0 ? path.join(outputDir, 'hover.css') : null, elements };
}

// ── Image Compression ──────────────────────────────────────────────────────

async function compressIfNeeded(filePath, maxSizeMB = 5) {
  const stats = await fs.stat(filePath);
  if (stats.size <= maxSizeMB * 1024 * 1024 || !sharp) return { compressed: false, originalSize: stats.size, finalSize: stats.size };
  try {
    const buf = await fs.readFile(filePath);
    const meta = await sharp(buf).metadata();
    let out = await sharp(buf).resize(Math.round(meta.width * 0.85)).png({ quality: 80, compressionLevel: 9 }).toBuffer();
    if (out.length > maxSizeMB * 1024 * 1024) out = await sharp(buf).resize(Math.round(meta.width * 0.7)).png({ quality: 70, compressionLevel: 9 }).toBuffer();
    await fs.writeFile(filePath, out);
    return { compressed: true, originalSize: stats.size, finalSize: out.length };
  } catch (e) { return { compressed: false, originalSize: stats.size, finalSize: stats.size, error: e.message }; }
}

// ── Viewport Capture ───────────────────────────────────────────────────────

async function captureViewport(page, viewport, outputPath, opts = {}) {
  const { fullPage = true, maxSize = 5, scrollDelay = DEFAULT_SCROLL_DELAY, viewportMap = VIEWPORTS } = opts;

  await page.setViewportSize(viewportMap[viewport]);
  await new Promise(r => setTimeout(r, TIMING.VIEWPORT_SETTLE_DELAY));
  await waitForDomStable(page, 300, 5000);
  await waitForFontsLoaded(page, 3000);
  await waitForStylesStable(page, 200, 2000);

  await forceLazyImages(page);
  const scrollInfo = await triggerLazyLoad(page, LAZY_LOAD_MAX_ITERATIONS, scrollDelay);
  await forceLazyImages(page);
  const imageStats = await waitForAllImages(page, 15000);

  try { await page.waitForLoadState('networkidle', { timeout: TIMING.NETWORK_IDLE_TIMEOUT }); } catch { /* ok */ }
  await new Promise(r => setTimeout(r, 2000));
  await waitForDomStable(page, 300, 3000);
  await waitForFontsLoaded(page, 2000);
  await forceAnimatedElementsVisible(page);
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
  await new Promise(r => setTimeout(r, 500));

  await page.screenshot({ path: outputPath, type: 'png', fullPage });
  const compression = await compressIfNeeded(outputPath, maxSize);

  return { viewport, path: path.resolve(outputPath), dimensions: viewportMap[viewport], scrollInfo, imageStats, size: compression.finalSize, compressed: compression.compressed };
}

// ── CLI Arg Parsing ────────────────────────────────────────────────────────

function parseScreenshotArgs(argv) {
  const args = parseArgs(argv);
  if (!args.url) { outputError(new Error('--url is required')); }
  if (!args.output) { outputError(new Error('--output directory is required')); }
  const vps = args.viewports ? args.viewports.split(',').map(v => v.trim().toLowerCase()) : ['desktop', 'tablet', 'mobile'];
  for (const vp of vps) { if (!VIEWPORTS[vp]) { outputError(new Error(`Invalid viewport: ${vp}`)); } }
  return {
    url: args.url, output: args.output, viewports: vps,
    fullPage: args['full-page'] !== 'false', maxSize: args['max-size'] ? parseFloat(args['max-size']) : 5,
    scrollDelay: args['scroll-delay'] ? parseInt(args['scroll-delay'], 10) : DEFAULT_SCROLL_DELAY,
    extractHtml: args['extract-html'] === 'true', extractCss: args['extract-css'] === 'true',
    filterUnused: args['filter-unused'] !== 'false', captureHover: args['capture-hover'] === 'true',
    detectBreakpoints: args['detect-breakpoints'] === 'true', extractComputed: args['extract-computed'] === 'true',
    aggressiveFilter: args['aggressive-filter'], headless: args.headless !== 'false', close: args.close === 'true',
  };
}

// ── Main Capture Function ──────────────────────────────────────────────────

export async function capture(url, outputDir, options = {}) {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await getBrowser({ headless: options.headless !== false });
  const page = await getPage(browser);

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3000));
  const cookieResult = await dismissCookieBanner(page);
  await waitForPageReady(page);

  const result = { url, outputDir: path.resolve(outputDir), cookieHandling: cookieResult, extraction: { html: null, css: null, warnings: [] }, screenshots: [] };
  const warnings = [];

  // HTML extraction
  if (options.extractHtml) {
    try {
      const hr = await extractHtml(page);
      const htmlSize = Buffer.byteLength(hr.html, 'utf-8');
      if (htmlSize > MAX_HTML_SIZE) throw new Error(`HTML exceeds ${MAX_HTML_SIZE / 1024 / 1024}MB`);
      const htmlPath = path.join(outputDir, 'source.html');
      await fs.writeFile(htmlPath, hr.html, 'utf-8');
      result.extraction.html = { path: path.resolve(htmlPath), size: htmlSize, elementCount: hr.elementCount };
      if (hr.warnings.length) warnings.push(...hr.warnings);
    } catch (e) { result.extraction.html = { error: e.message, failed: true }; warnings.push(`HTML: ${e.message}`); }
  }

  // CSS extraction
  if (options.extractCss) {
    try {
      const cr = await extractCss(page, url);
      const rawCss = cr.cssBlocks.map(b => `/* Source: ${b.source} */\n${b.css}`).join('\n\n');
      const cssSize = Buffer.byteLength(rawCss, 'utf-8');
      if (cssSize > MAX_CSS_SIZE) throw new Error(`CSS exceeds ${MAX_CSS_SIZE / 1024 / 1024}MB`);
      const rawPath = path.join(outputDir, 'source-raw.css');
      await fs.writeFile(rawPath, rawCss, 'utf-8');
      if (Object.keys(cr.computedStyles).length > 0) await fs.writeFile(path.join(outputDir, 'computed-styles.json'), JSON.stringify(cr.computedStyles, null, 2));
      result.extraction.css = { path: path.resolve(rawPath), size: cssSize, blocks: cr.cssBlocks.length, totalRules: cr.totalRules, corsBlocked: cr.corsBlocked };
      if (cr.warnings.length) warnings.push(...cr.warnings);
      if (cr.corsBlocked.length) warnings.push(`${cr.corsBlocked.length} CORS-blocked stylesheets`);
    } catch (e) { result.extraction.css = { error: e.message, failed: true }; warnings.push(`CSS: ${e.message}`); }
  }

  // CSS filtering
  if (options.filterUnused !== false && result.extraction.html?.path && result.extraction.css?.path && !result.extraction.html.failed && !result.extraction.css.failed) {
    try {
      const filteredPath = path.join(outputDir, 'source.css');
      const fr = await filterCssFile(result.extraction.html.path, result.extraction.css.path, filteredPath, false, outputDir, options.aggressiveFilter);
      result.extraction.filtered = { path: fr.output.path, size: fr.output.size, reduction: fr.stats.reduction, stats: { totalRules: fr.stats.totalRules, keptRules: fr.stats.keptRules, removedRules: fr.stats.removedRules } };
      logInfo(`CSS filtered: ${fr.stats.reduction} reduction`);
    } catch (e) { result.extraction.filtered = { error: e.message, failed: true }; warnings.push(`Filter: ${e.message}`); }
  }

  // Computed style gap-fill
  if (options.extractComputed && result.extraction.filtered?.path && !result.extraction.filtered.failed) {
    try {
      const filteredCss = await fs.readFile(result.extraction.filtered.path, 'utf-8');
      const computed = await extractComputedGapFill(page, filteredCss);
      const computedPath = path.join(outputDir, 'computed-gap.css');
      await fs.writeFile(computedPath, computed.css, 'utf-8');
      result.extraction.computedGap = { path: path.resolve(computedPath), ...computed.stats };
    } catch (e) { warnings.push(`Computed gap: ${e.message}`); }
  }

  // Breakpoint detection
  let localViewports = { ...VIEWPORTS };
  let requestedViewports = options.viewports || ['desktop', 'tablet', 'mobile'];

  if (options.detectBreakpoints && result.extraction.css?.path && !result.extraction.css.failed) {
    try {
      const rawCss = await fs.readFile(result.extraction.css.path, 'utf-8');
      const bp = detectBreakpoints(rawCss);
      await fs.writeFile(path.join(outputDir, 'breakpoints.json'), JSON.stringify(bp, null, 2));
      if (bp.breakpoints.length > 0) {
        const merged = mergeBreakpointsWithFixed(bp.breakpoints);
        requestedViewports = Object.keys(merged);
        for (const [name, cfg] of Object.entries(merged)) { if (!localViewports[name]) localViewports[name] = cfg; }
      }
      result.breakpoints = bp;
    } catch { /* optional */ }
  }

  // Per-viewport screenshots
  const vpProgress = createProgress();
  vpProgress.start(requestedViewports.length, 'Viewport capture');
  for (const vp of requestedViewports) {
    vpProgress.step(`Capturing ${vp}`, `${localViewports[vp]?.width || '?'}px`);
    result.screenshots.push(await captureViewport(page, vp, path.join(outputDir, `${vp}.png`), { fullPage: options.fullPage, maxSize: options.maxSize, scrollDelay: options.scrollDelay, viewportMap: localViewports }));
  }
  vpProgress.complete(`${result.screenshots.length} viewports captured`);

  // Hover states
  if (options.captureHover) {
    try {
      const cssStr = result.extraction.css?.path ? await fs.readFile(result.extraction.css.path, 'utf-8') : null;
      const hr = await captureAllHoverStates(page, cssStr, outputDir);
      result.hoverStates = { directory: hr.directory, detected: hr.detected, captured: hr.captured, summaryPath: hr.summaryPath, generatedCss: hr.generatedCss };
      logInfo(`Hover states: ${hr.captured}/${hr.detected} captured`);
    } catch (e) { result.hoverStates = { error: e.message }; warnings.push(`Hover: ${e.message}`); }
  }

  result.extraction.warnings = warnings;
  result.totalSize = result.screenshots.reduce((s, x) => s + x.size, 0);
  result.capturedAt = new Date().toISOString();
  result.success = true;
  return result;
}

// ── CLI Entry ──────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.basename(process.argv[1]) === 'capture.js';
if (isMain) {
  const opts = parseScreenshotArgs(process.argv.slice(2));
  try {
    const result = await capture(opts.url, opts.output, opts);
    outputJSON(result);
    if (opts.close) await closeBrowser(); else await disconnectBrowser();
    process.exit(0);
  } catch (e) {
    outputError(e);
  } finally {
    try { await closeBrowser(); } catch { /* ok */ }
  }
}

// ── Exports ────────────────────────────────────────────────────────────────

export { captureViewport, parseScreenshotArgs, compressIfNeeded, dismissCookieBanner, waitForPageReady, extractHtml, extractCss, detectBreakpoints, mergeBreakpointsWithFixed, captureAllHoverStates };
