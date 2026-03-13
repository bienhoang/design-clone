#!/usr/bin/env node
/**
 * CSS filtering pipeline for design-clone
 * Merges: filter-css, selector-matcher, html-analyzer, dead-code, css-chunker
 *
 * Usage: node filter-css.js --html source.html --css source-raw.css --output source.css [--verbose] [--aggressive-filter]
 */

import fs from 'fs/promises';
import path from 'path';
import { parseArgs, SIZE_LIMITS, createError } from './utils.js';

let csstree;
try { csstree = await import('css-tree'); }
catch { console.error(JSON.stringify({ success: false, error: 'css-tree not installed. Run: npm install css-tree' })); process.exit(1); }

// ── HTML Analysis ──────────────────────────────────────────────────────────

const ALWAYS_KEEP_PATTERNS = [/^html$/i, /^body$/i, /^\*$/, /^:root$/i];

const CSS_INJECTION_PATTERNS = [
  /expression\s*\(/gi, /-moz-binding\s*:/gi, /url\s*\(\s*["']?javascript:/gi,
  /url\s*\(\s*["']?data:text\/html/gi, /behavior\s*:/gi, /@import\s+["']?javascript:/gi,
];

export function analyzeHtml(html) {
  const tags = new Set(), ids = new Set(), classes = new Set(), attributes = new Set();

  for (const m of html.matchAll(/<([a-z][a-z0-9]*)/gi)) tags.add(m[1].toLowerCase());
  for (const m of html.matchAll(/\bid=["']([^"']+)["']/gi)) ids.add(m[1]);
  for (const m of html.matchAll(/\bclass=["']([^"']+)["']/gi)) {
    m[1].split(/\s+/).forEach(c => { if (c.trim()) classes.add(c.trim()); });
  }
  for (const m of html.matchAll(/\s(data-[a-z0-9-]+)/gi)) attributes.add(m[1].toLowerCase());

  const commonAttrs = ['href','src','type','name','value','disabled','checked','selected',
    'readonly','required','placeholder','role','aria-hidden','aria-label','aria-expanded','target','rel'];
  commonAttrs.forEach(attr => {
    if (html.includes(attr + '=') || html.includes(attr + ' ') || html.includes(attr + '>')) attributes.add(attr);
  });

  return { tags, ids, classes, attributes };
}

export function validatePath(filePath, allowedDir = process.cwd()) {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);
  if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
    throw new Error(`Path "${filePath}" is outside allowed directory "${allowedDir}"`);
  }
  return resolved;
}

export function sanitizeCss(css) {
  let s = css;
  for (const p of CSS_INJECTION_PATTERNS) s = s.replace(p, '/* [sanitized] */');
  return s;
}

// ── Selector Matching ──────────────────────────────────────────────────────

function selectorMatches(selectorAst, htmlAnalysis) {
  const { tags, ids, classes } = htmlAnalysis;
  let matches = true, hasSpecific = false;

  csstree.walk(selectorAst, {
    enter(node) {
      switch (node.type) {
        case 'TypeSelector':
          hasSpecific = true;
          if (node.name !== '*' && !tags.has(node.name.toLowerCase())) matches = false;
          break;
        case 'IdSelector':
          hasSpecific = true;
          if (!ids.has(node.name)) matches = false;
          break;
        case 'ClassSelector':
          hasSpecific = true;
          if (!classes.has(node.name)) matches = false;
          break;
        case 'AttributeSelector':
          hasSpecific = true;
          break;
      }
    }
  });

  return hasSpecific ? matches : true;
}

function selectorListMatches(selectorList, htmlAnalysis) {
  let any = false;
  csstree.walk(selectorList, { visit: 'Selector', enter(node) { if (selectorMatches(node, htmlAnalysis)) any = true; } });
  return any;
}

function shouldAlwaysKeep(text) { return ALWAYS_KEEP_PATTERNS.some(p => p.test(text.trim())); }

// ── Dead Code Removal ──────────────────────────────────────────────────────

function removeEmptyMediaQueries(ast) {
  const empty = [];
  csstree.walk(ast, { visit: 'Atrule', enter(node, item, list) {
    if (node.name === 'media' && node.block) {
      let has = false;
      csstree.walk(node.block, { visit: 'Rule', enter() { has = true; } });
      if (!has) empty.push({ item, list });
    }
  }});
  for (const { item, list } of empty) if (list) list.remove(item);
  return empty.length;
}

function removeOrphanKeyframes(ast) {
  const used = new Set();
  csstree.walk(ast, { visit: 'Declaration', enter(node) {
    if (node.property === 'animation-name' || node.property === 'animation') {
      for (const n of csstree.generate(node.value).split(/[\s,]+/)) {
        if (n && n !== 'none' && n !== 'initial' && n !== 'inherit') used.add(n);
      }
    }
  }});
  const orphans = [];
  csstree.walk(ast, { visit: 'Atrule', enter(node, item, list) {
    if (node.name === 'keyframes' && node.prelude) {
      if (!used.has(csstree.generate(node.prelude).trim())) orphans.push({ item, list });
    }
  }});
  for (const { item, list } of orphans) if (list) list.remove(item);
  return orphans.length;
}

function removeUnusedCustomProps(ast) {
  const usedVars = new Set();
  csstree.walk(ast, { visit: 'Function', enter(node) {
    if (node.name === 'var' && node.children?.first) {
      const name = csstree.generate(node.children.first);
      if (name.startsWith('--')) usedVars.add(name);
    }
  }});
  const unused = [];
  csstree.walk(ast, { visit: 'Declaration', enter(node, item, list) {
    if (node.property.startsWith('--') && !usedVars.has(node.property)) unused.push({ item, list });
  }});
  for (const { item, list } of unused) if (list) list.remove(item);
  return unused.length;
}

function runDeadCodePass(ast) {
  return {
    emptyMediaRemoved: removeEmptyMediaQueries(ast),
    orphanKeyframesRemoved: removeOrphanKeyframes(ast),
    unusedCustomPropsRemoved: removeUnusedCustomProps(ast),
  };
}

// ── CSS Chunker ────────────────────────────────────────────────────────────

function splitCssAtTopLevel(cssString, targetSize = 1024 * 1024) {
  const chunks = [];
  let depth = 0, chunkStart = 0, lastClose = 0;
  let inSQ = false, inDQ = false, inComment = false;

  for (let i = 0; i < cssString.length; i++) {
    const ch = cssString[i], prev = i > 0 ? cssString[i - 1] : '';

    if (!inSQ && !inDQ) {
      if (!inComment && ch === '/' && cssString[i + 1] === '*') { inComment = true; i++; continue; }
      if (inComment && ch === '*' && cssString[i + 1] === '/') { inComment = false; i++; continue; }
    }
    if (inComment) continue;
    if (!inDQ && ch === "'" && prev !== '\\') { inSQ = !inSQ; continue; }
    if (!inSQ && ch === '"' && prev !== '\\') { inDQ = !inDQ; continue; }
    if (inSQ || inDQ) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        lastClose = i + 1;
        if (lastClose - chunkStart >= targetSize) {
          chunks.push(cssString.slice(chunkStart, lastClose));
          chunkStart = lastClose;
        }
      }
    }
  }
  if (chunkStart < cssString.length) chunks.push(cssString.slice(chunkStart));
  return chunks;
}

async function processChunks(chunks, parseAndFilter) {
  const results = [], stats = { totalRules: 0, keptRules: 0, removedRules: 0 };
  for (const chunk of chunks) {
    try {
      const r = await parseAndFilter(chunk);
      results.push(r.css);
      stats.totalRules += r.stats.totalRules || 0;
      stats.keptRules += r.stats.keptRules || 0;
      stats.removedRules += r.stats.removedRules || 0;
    } catch { results.push(chunk); }
  }
  return { css: results.join('\n'), stats };
}

// ── Filter CSS Rules (AST walk) ────────────────────────────────────────────

async function filterCssRules(cssAst, htmlAnalysis, verbose, aggressive) {
  const stats = { totalRules: 0, keptRules: 0, removedRules: 0, atRules: 0, mediaQueries: 0 };
  const toRemove = [];

  csstree.walk(cssAst, { visit: 'Rule', enter(node, item, list) {
    stats.totalRules++;
    if (node.prelude?.type === 'SelectorList') {
      const text = csstree.generate(node.prelude);
      if (shouldAlwaysKeep(text)) { stats.keptRules++; return; }
      if (!selectorListMatches(node.prelude, htmlAnalysis)) { toRemove.push({ item, list }); stats.removedRules++; }
      else stats.keptRules++;
    } else stats.keptRules++;
  }});

  for (const { item, list } of toRemove) if (list) list.remove(item);

  csstree.walk(cssAst, { visit: 'Atrule', enter(node) {
    stats.atRules++;
    if (node.name === 'media') stats.mediaQueries++;
  }});

  let deadCode = null;
  if (aggressive) deadCode = runDeadCodePass(cssAst);

  if (verbose) {
    console.error(`[CSS Filter] Rules: ${stats.totalRules} total, ${stats.keptRules} kept, ${stats.removedRules} removed`);
    console.error(`[CSS Filter] At-rules: ${stats.atRules} (${stats.mediaQueries} @media)`);
    if (deadCode) console.error(`[CSS Filter] Dead code: ${deadCode.emptyMediaRemoved} empty @media, ${deadCode.orphanKeyframesRemoved} orphan @keyframes, ${deadCode.unusedCustomPropsRemoved} unused vars`);
  }

  return { ...stats, deadCode };
}

// ── Main Filter Function ───────────────────────────────────────────────────

export async function filterCssFile(htmlPath, cssPath, outputPath, verbose = false, allowedDir = null, aggressiveFilter = false) {
  const startTime = Date.now();
  const rHtml = allowedDir ? validatePath(htmlPath, allowedDir) : path.resolve(htmlPath);
  const rCss = allowedDir ? validatePath(cssPath, allowedDir) : path.resolve(cssPath);
  const rOut = allowedDir ? validatePath(outputPath, allowedDir) : path.resolve(outputPath);

  const [html, css] = await Promise.all([fs.readFile(rHtml, 'utf-8'), fs.readFile(rCss, 'utf-8')]);
  const inputSize = Buffer.byteLength(css, 'utf-8');

  if (inputSize > SIZE_LIMITS.MAX_CSS_INPUT) {
    throw createError('CSS_SIZE_EXCEEDED', { file: rCss, size: `${(inputSize / 1024 / 1024).toFixed(1)}MB`, limit: `${SIZE_LIMITS.MAX_CSS_INPUT / 1024 / 1024}MB` });
  }

  if (verbose) console.error(`[CSS Filter] Input: ${(inputSize / 1024).toFixed(1)}KB`);

  const htmlAnalysis = analyzeHtml(html);
  if (verbose) console.error(`[CSS Filter] HTML: ${htmlAnalysis.tags.size} tags, ${htmlAnalysis.ids.size} IDs, ${htmlAnalysis.classes.size} classes`);

  let filteredCss, stats;

  // Chunked processing for large CSS
  if (inputSize > (SIZE_LIMITS.CSS_CHUNK_THRESHOLD || 2 * 1024 * 1024)) {
    if (verbose) console.error(`[CSS Filter] Large CSS — using chunked processing`);
    try {
      const chunks = splitCssAtTopLevel(css);
      const result = await processChunks(chunks, async (chunk) => {
        const ast = csstree.parse(chunk, { parseRulePrelude: true, parseValue: false });
        const s = await filterCssRules(ast, htmlAnalysis, false, false);
        return { css: csstree.generate(ast), stats: s };
      });
      filteredCss = sanitizeCss(result.css);
      stats = result.stats;
    } catch (e) {
      if (verbose) console.error(`[CSS Filter] Chunked failed, falling back: ${e.message}`);
      filteredCss = null;
    }
  }

  // Standard full-parse path
  if (!filteredCss) {
    let ast;
    try { ast = csstree.parse(css, { parseRulePrelude: true, parseValue: false }); }
    catch {
      try { ast = csstree.parse(css, { parseRulePrelude: false, parseValue: false }); }
      catch (e) { throw createError('CSS_PARSE_FAILED', { parseError: e.message }); }
    }
    stats = await filterCssRules(ast, htmlAnalysis, verbose, !!aggressiveFilter);
    filteredCss = sanitizeCss(csstree.generate(ast));
  }

  const outputSize = Buffer.byteLength(filteredCss, 'utf-8');
  await fs.writeFile(rOut, filteredCss, 'utf-8');

  const duration = Date.now() - startTime;
  const reduction = Math.round((1 - outputSize / inputSize) * 100);

  if (verbose) console.error(`[CSS Filter] Output: ${(outputSize / 1024).toFixed(1)}KB, reduction: ${reduction}%, duration: ${duration}ms`);

  return {
    success: true,
    input: { html: rHtml, css: rCss, cssSize: inputSize },
    output: { path: rOut, size: outputSize },
    htmlAnalysis: { tags: htmlAnalysis.tags.size, ids: htmlAnalysis.ids.size, classes: htmlAnalysis.classes.size },
    stats: { ...stats, reduction: `${reduction}%`, durationMs: duration },
  };
}

// ── CLI Entry ──────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.basename(process.argv[1]) === 'filter-css.js';
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.html || !args.css || !args.output) {
    console.error('Usage: node filter-css.js --html source.html --css source-raw.css --output source.css [--verbose] [--aggressive-filter]');
    process.exit(1);
  }
  try {
    const aggressive = args['aggressive-filter'] === 'true' || args['aggressive-filter'] === true;
    const result = await filterCssFile(args.html, args.css, args.output, args.verbose === 'true' || args.verbose === true, null, aggressive);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }, null, 2));
    process.exit(1);
  }
}
