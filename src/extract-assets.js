#!/usr/bin/env node
/**
 * Asset extraction for design-clone
 * Merges: extract-assets, extract-assets-downloader, extract-assets-page-scraper
 *
 * Usage: node extract-assets.js --url <url> --output <dir> [--verbose] [--timeout 30000]
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { getBrowser, getPage, closeBrowser, disconnectBrowser, parseArgs, outputJSON, outputError } from './utils.js';

// ── Constants ──────────────────────────────────────────────────────────────

const ASSET_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.avif'],
  fonts: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
};

const RATE_LIMIT = { maxConcurrent: 10, delayBetweenBatches: 50 };

// ── Downloader ─────────────────────────────────────────────────────────────

function getAssetType(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (ASSET_EXTENSIONS.fonts.includes(ext)) return 'fonts';
  if (ext === '.svg') return 'icons';
  if (ASSET_EXTENSIONS.images.includes(ext)) return 'images';
  return 'other';
}

function getSafeFilename(url) {
  try {
    const u = new URL(url);
    let fn = path.basename(u.pathname);
    if (u.search) { const h = Buffer.from(u.search).toString('base64').slice(0, 8); const ext = path.extname(fn); fn = `${path.basename(fn, ext)}-${h}${ext}`; }
    fn = fn.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!path.extname(fn)) fn += '.bin';
    return fn;
  } catch { return `asset-${Date.now()}.bin`; }
}

async function downloadFile(url, destPath, timeout = 30000, retries = 2) {
  const proto = url.startsWith('https') ? https : http;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const tid = setTimeout(() => reject(new Error('Download timeout')), timeout);
        const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': '*/*' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { clearTimeout(tid); downloadFile(res.headers.location, destPath, timeout, 0).then(resolve).catch(reject); return; }
          if (res.statusCode === 429) { clearTimeout(tid); const ms = Math.min(1000 * Math.pow(2, attempt), 8000); reject(new Error(`HTTP 429 (retry after ${ms}ms)`)); return; }
          if (res.statusCode !== 200) { clearTimeout(tid); reject(new Error(`HTTP ${res.statusCode}`)); return; }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', async () => { clearTimeout(tid); try { const buf = Buffer.concat(chunks); await fs.mkdir(path.dirname(destPath), { recursive: true }); await fs.writeFile(destPath, buf); resolve({ size: buf.length }); } catch (e) { reject(e); } });
          res.on('error', e => { clearTimeout(tid); reject(e); });
        });
        req.on('error', e => { clearTimeout(tid); reject(e); });
      });
      return { success: true };
    } catch (err) {
      if (attempt === retries) return { success: false, error: err.message };
      const delay = err.message.includes('429') ? parseInt(err.message.match(/(\d+)ms/)?.[1] || '2000') : 500 * (attempt + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function downloadBatch(downloads, verbose = false, options = {}) {
  const { maxConcurrent = RATE_LIMIT.maxConcurrent, delayBetween = RATE_LIMIT.delayBetweenBatches } = options;
  const results = { success: 0, failed: 0, skipped: 0, errors: [] };
  for (let i = 0; i < downloads.length; i += maxConcurrent) {
    const batch = downloads.slice(i, i + maxConcurrent);
    await Promise.all(batch.map(async ({ url, destPath, type }) => {
      try { await fs.access(destPath); results.skipped++; return; } catch { /* new file */ }
      const r = await downloadFile(url, destPath);
      if (r.success) { results.success++; if (verbose) console.error(`  + ${type}: ${path.basename(destPath)}`); }
      else { results.failed++; results.errors.push({ url, error: r.error }); }
    }));
    if (i + maxConcurrent < downloads.length) await new Promise(r => setTimeout(r, delayBetween));
  }
  return results;
}

// ── Page Scraper ───────────────────────────────────────────────────────────

function extractCssUrls(cssContent, baseUrl) {
  const urls = new Set();
  const bgRe = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  let m;
  while ((m = bgRe.exec(cssContent)) !== null) { if (!m[1].startsWith('data:')) try { urls.add(new URL(m[1], baseUrl).href); } catch { /* skip */ } }
  const fontRe = /@font-face\s*\{[^}]*src:\s*([^;]+)/gi;
  while ((m = fontRe.exec(cssContent)) !== null) {
    const urlRe = /url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
    let um; while ((um = urlRe.exec(m[1])) !== null) { if (!um[1].startsWith('data:')) try { urls.add(new URL(um[1], baseUrl).href); } catch { /* skip */ } }
  }
  return Array.from(urls);
}

async function extractAssetsFromPage(page, baseUrl) {
  return page.evaluate((url) => {
    const imgs = new Set(), cssUrls = [], inlineSvgs = [];
    document.querySelectorAll('img[src]').forEach(img => { const s = img.getAttribute('src'); if (s && !s.startsWith('data:')) try { imgs.add(new URL(s, url).href); } catch { /* skip */ } });
    document.querySelectorAll('[srcset]').forEach(el => { (el.getAttribute('srcset') || '').split(',').forEach(p => { const s = p.trim().split(/\s+/)[0]; if (s && !s.startsWith('data:')) try { imgs.add(new URL(s, url).href); } catch { /* skip */ } }); });
    document.querySelectorAll('[style*="background"]').forEach(el => { const m = el.getAttribute('style').match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i); if (m && !m[1].startsWith('data:')) try { imgs.add(new URL(m[1], url).href); } catch { /* skip */ } });
    document.querySelectorAll('link[rel*="icon"]').forEach(l => { const h = l.getAttribute('href'); if (h && !h.startsWith('data:')) try { imgs.add(new URL(h, url).href); } catch { /* skip */ } });
    document.querySelectorAll('svg').forEach((svg, i) => { if (svg.outerHTML.length < 50000) inlineSvgs.push({ id: svg.id || `inline-svg-${i}`, content: svg.outerHTML }); });
    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => { const h = l.getAttribute('href'); if (h) try { cssUrls.push(new URL(h, url).href); } catch { /* skip */ } });
    return { images: Array.from(imgs), cssUrls, inlineSvgs };
  }, baseUrl);
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function extractAssets(url, outputDir, options = {}) {
  const verbose = options.verbose || false;
  const assetsDir = path.join(outputDir, 'assets');
  await fs.mkdir(path.join(assetsDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(assetsDir, 'fonts'), { recursive: true });
  await fs.mkdir(path.join(assetsDir, 'icons'), { recursive: true });

  const browser = await getBrowser({ headless: options.headless !== false });
  const page = await getPage(browser);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  const pageAssets = await extractAssetsFromPage(page, url);

  // Collect CSS for font/bg extraction
  let allCss = await page.evaluate(() => Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n'));
  const srcCssPath = path.join(outputDir, 'source.css');
  try { allCss += '\n' + await fs.readFile(srcCssPath, 'utf-8'); } catch { /* ok */ }
  // Also try analysis subfolder
  try { allCss += '\n' + await fs.readFile(path.join(outputDir, 'analysis', 'source.css'), 'utf-8'); } catch { /* ok */ }

  const cssAssetUrls = extractCssUrls(allCss, url);
  const allUrls = new Set([...pageAssets.images, ...cssAssetUrls]);

  const downloads = [];
  const urlMapping = {};
  for (const u of allUrls) {
    const type = getAssetType(u);
    const fn = getSafeFilename(u);
    const dest = path.join(assetsDir, type === 'other' ? 'images' : type, fn);
    downloads.push({ url: u, destPath: dest, type });
    urlMapping[u] = path.relative(outputDir, dest);
  }

  if (verbose) console.error(`Found ${downloads.length} assets (${downloads.filter(d => d.type === 'images').length} images, ${downloads.filter(d => d.type === 'fonts').length} fonts, ${downloads.filter(d => d.type === 'icons').length} icons)`);

  const concurrency = options.concurrency || undefined;
  const dlResults = await downloadBatch(downloads, verbose, { maxConcurrent: concurrency });

  // Save inline SVGs
  let savedSvgs = 0;
  for (const svg of pageAssets.inlineSvgs) {
    try { await fs.writeFile(path.join(assetsDir, 'icons', `${svg.id.replace(/[^a-zA-Z0-9-_]/g, '_')}.svg`), svg.content, 'utf-8'); savedSvgs++; } catch { /* skip */ }
  }

  await fs.writeFile(path.join(assetsDir, 'url-mapping.json'), JSON.stringify(urlMapping, null, 2));

  if (options.close) await closeBrowser(); else await disconnectBrowser();

  return {
    success: true, assetsDir: path.resolve(assetsDir),
    stats: { total: downloads.length, downloaded: dlResults.success, failed: dlResults.failed, skipped: dlResults.skipped, inlineSvgs: savedSvgs },
    errors: dlResults.errors.length > 0 ? dlResults.errors.slice(0, 10) : undefined,
  };
}

// ── CLI Entry ──────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.basename(process.argv[1]) === 'extract-assets.js';
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) { outputError(new Error('--url is required')); }
  if (!args.output) { outputError(new Error('--output directory is required')); }
  try {
    const result = await extractAssets(args.url, args.output, { verbose: args.verbose === 'true', headless: args.headless !== 'false', close: args.close === 'true', concurrency: args.concurrency ? parseInt(args.concurrency) : undefined });
    outputJSON(result);
    process.exit(0);
  } catch (e) { outputError(e); }
}

export { extractCssUrls, extractAssetsFromPage, downloadFile, downloadBatch, getSafeFilename, getAssetType };
