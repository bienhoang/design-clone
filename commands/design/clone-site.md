---
description: Clone multiple pages from a website with shared CSS and navigation
argument-hint: [url] [--max-pages N]
---

Clone multiple pages from this website with shared CSS and working navigation:
<url>$ARGUMENTS</url>

## Required Skills (Priority Order)
1. **`chrome-devtools`** - Multi-viewport screenshot capture

## Pipeline Overview

```
URL -> Page Discovery -> Multi-page Capture -> CSS Merge & Dedup -> Link Rewriting -> Output
```

## Workflow

### STEP 1: Run Clone-Site

```bash
# Basic usage - auto-discovers pages from navigation
node ~/.claude/skills/design-clone/src/clone-site.js \
  --url "$ARGUMENTS" \
  --output ./cloned-designs

# With options
node ~/.claude/skills/design-clone/src/clone-site.js \
  --url "$ARGUMENTS" \
  --output ./cloned-designs \
  --max-pages 5

# Specific pages
node ~/.claude/skills/design-clone/src/clone-site.js \
  --url "$ARGUMENTS" \
  --output ./cloned-designs \
  --pages /,/about,/contact

# With breakpoint detection and aggressive CSS filtering
node ~/.claude/skills/design-clone/src/clone-site.js \
  --url "$ARGUMENTS" \
  --output ./cloned-designs \
  --detect-breakpoints true \
  --aggressive-filter true

# Preview discovery without capture
node ~/.claude/skills/design-clone/src/clone-site.js \
  --url "$ARGUMENTS" \
  --dry-run true
```

### CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--url <url>` | required | Target URL |
| `--pages <paths>` | auto | Comma-separated paths (e.g., /,/about,/contact) |
| `--max-pages <n>` | 10 | Maximum pages to auto-discover |
| `--output <dir>` | ./cloned-designs | Output directory |
| `--detect-breakpoints` | false | Auto-detect CSS breakpoints from media queries |
| `--aggressive-filter` | false | Two-pass CSS dead code removal on merged CSS |
| `--dry-run` | false | Preview discovered pages without capture |
| `--verbose` | false | Enable verbose logging |

### STEP 2: Process Flow (Automatic)

The command executes these steps automatically:

1. **Page Discovery** - Crawls navigation links via nav scraping + history interception + sitemap
2. **Sequential Capture** - Screenshots + HTML/CSS for each page using capture.js
3. **CSS Merge** - Combines filtered CSS with AST-level deduplication
4. **Link Rewriting** - Updates internal links to local .html files
5. **Manifest Generation** - Creates manifest.json with page metadata

### STEP 3: Review & Edit

After cloning:

1. **Test navigation** - Open pages/index.html in browser
2. **Verify CSS** - Check that styles.css covers all pages
3. **Check screenshots** - Review analysis/ for visual reference

## Output Structure

```
cloned-designs/
├── index/              # Per-page capture directories
│   ├── desktop.png
│   ├── tablet.png
│   ├── mobile.png
│   ├── source.html
│   └── source.css
├── about/
│   └── ...
├── pages/              # HTML with rewritten links
│   ├── index.html
│   ├── about.html
│   └── contact.html
├── styles.css          # Merged + deduplicated CSS
└── manifest.json       # Page metadata + mapping
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Page fails to load | Continues with other pages, logs warning |
| No navigation found | Falls back to homepage only |
| CSS extraction fails | Uses raw CSS fallback |

## Examples

```bash
# Clone with auto-discovery (up to 10 pages)
/design:clone-site https://example.com

# Clone specific pages only
/design:clone-site https://example.com --pages /,/about,/pricing

# Clone with full optimization
/design:clone-site https://example.com --aggressive-filter true --detect-breakpoints true
```
