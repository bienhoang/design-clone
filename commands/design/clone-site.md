---
description: Clone multiple pages from a website with shared CSS and navigation
argument-hint: [url] [--max-pages N] [--ai]
---

Clone multiple pages from this website with shared CSS and working navigation:
<url>$ARGUMENTS</url>

## Required Skills (Priority Order)
1. **`chrome-devtools`** - Multi-viewport screenshot capture
2. **`ai-multimodal`** - Gemini Vision for design token extraction (with --ai flag)

## Pipeline Overview

```
URL -> Page Discovery -> Multi-page Capture -> CSS Filtering & Merge -> Link Rewriting -> [AI Tokens] -> Output
```

## Workflow

### STEP 1: Run Clone-Site Command

Use the design-clone CLI to clone multiple pages:

```bash
# Basic usage - auto-discovers pages from navigation
design-clone clone-site "$ARGUMENTS"

# With options
design-clone clone-site "$ARGUMENTS" --max-pages 5

# Specific pages
design-clone clone-site "$ARGUMENTS" --pages /,/about,/contact

# With AI design token extraction (requires GEMINI_API_KEY)
design-clone clone-site "$ARGUMENTS" --ai
```

### CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--pages <paths>` | auto | Comma-separated paths (e.g., /,/about,/contact) |
| `--max-pages <n>` | 10 | Maximum pages to auto-discover |
| `--viewports <list>` | desktop,tablet,mobile | Viewport list |
| `--yes` | false | Skip confirmation prompt |
| `--output <dir>` | ./cloned-designs/{timestamp}-{domain} | Custom output directory |
| `--ai` | false | Extract design tokens using Gemini AI |

### STEP 2: Process Flow (Automatic)

The command executes these steps automatically:

1. **Page Discovery** - Crawls navigation links, respects same-domain
2. **Multi-page Capture** - Screenshots + HTML/CSS for each page
3. **CSS Merge** - Combines filtered CSS with deduplication (15-30% reduction)
4. **Link Rewriting** - Updates internal links to local .html files
5. **Token Extraction** (if --ai) - Gemini Vision extracts design tokens
6. **Manifest Generation** - Creates manifest.json with page metadata

### Output Structure

```
cloned-designs/{timestamp}-{domain}/
├── analysis/           # Screenshots by viewport
│   ├── desktop/
│   │   ├── index.png
│   │   ├── about.png
│   │   └── contact.png
│   ├── tablet/
│   └── mobile/
├── html/               # Raw extracted HTML (source)
├── css/                # Per-page CSS (raw + filtered)
├── pages/              # HTML with rewritten links
│   ├── index.html      # Links to ../styles.css
│   ├── about.html
│   └── contact.html
├── styles.css          # Merged + deduplicated CSS
├── tokens.css          # Design tokens (if --ai)
├── design-tokens.json  # Token data (if --ai)
├── manifest.json       # Page metadata + mapping
└── capture-results.json
```

### STEP 3: Review & Edit

After cloning:

1. **Test navigation** - Open `pages/index.html` in browser
2. **Verify CSS** - Check that styles.css covers all pages
3. **Check screenshots** - Review analysis/ for visual reference
4. **Edit tokens** (if --ai) - Modify tokens.css to customize design

## Features

- **Auto-discovers pages** from navigation (SPA-aware)
- **Shared CSS** with deduplication (15-30% reduction)
- **Filtered CSS** - Uses per-page filtered CSS, not raw
- **Working internal links** - Rewrites to local .html files
- **Progress reporting** - Shows capture progress
- **Graceful errors** - Continues on individual page failures
- **AI tokens** (optional) - Gemini Vision design token extraction

## Environment Variables

```bash
# Optional: For AI token extraction with --ai flag
GEMINI_API_KEY=your-key
```

## Examples

```bash
# Clone with auto-discovery (up to 10 pages)
/design:clone-site https://example.com

# Clone specific pages only
/design:clone-site https://example.com --pages /,/about,/pricing

# Clone with AI token extraction
/design:clone-site https://example.com --ai --max-pages 5

# Clone to custom directory
/design:clone-site https://example.com --output ./my-clone
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Page fails to load | Continues with other pages, logs warning |
| No navigation found | Falls back to homepage only |
| CSS extraction fails | Uses raw CSS fallback |
| No GEMINI_API_KEY | Skips token extraction, logs hint |
| Python not found | Skips AI features, continues |
