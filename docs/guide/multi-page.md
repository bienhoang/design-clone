# Multi-Page Sites

Clone entire websites with shared CSS and working navigation.

## Command

```bash
/design:clone-site https://example.com
```

## Features

- **Auto-discovery** - Finds pages from navigation links
- **Shared CSS** - Merges and deduplicates styles
- **Working links** - Rewrites internal navigation
- **SPA support** - Handles React, Vue, Next.js sites

## Basic Usage

### Auto-Discover Pages

```bash
design-clone clone-site https://example.com
```

The tool will:
1. Load the homepage
2. Find all navigation links
3. Show discovered pages for confirmation
4. Clone each page

### Specify Pages Manually

```bash
design-clone clone-site https://example.com --pages /,/about,/contact,/pricing
```

### Limit Page Count

```bash
design-clone clone-site https://example.com --max-pages 5
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--pages <paths>` | auto | Comma-separated paths |
| `--max-pages <n>` | 10 | Maximum pages to clone |
| `--viewports <list>` | all | desktop,tablet,mobile |
| `--yes` | false | Skip confirmation prompt |
| `--output <dir>` | auto | Custom output directory |

## Output Structure

```
cloned-designs/{timestamp}-{domain}/
├── analysis/
│   ├── desktop/
│   │   ├── home.png
│   │   ├── about.png
│   │   └── contact.png
│   ├── tablet/
│   │   └── ...
│   └── mobile/
│       └── ...
├── pages/
│   ├── index.html
│   ├── about.html
│   └── contact.html
├── styles.css          # Merged CSS
└── manifest.json       # Page metadata
```

## CSS Handling

### Deduplication

CSS from all pages is merged and deduplicated:

```css
/* Page 1 CSS */
.header { color: blue; }
.hero { padding: 20px; }

/* Page 2 CSS */
.header { color: blue; }  /* Duplicate - removed */
.about { margin: 10px; }
```

**Result:**
```css
.header { color: blue; }
.hero { padding: 20px; }
.about { margin: 10px; }
```

Typical reduction: **15-30%** smaller than combined CSS.

### Shared Styles

The merged `styles.css` is linked in all HTML files:

```html
<link rel="stylesheet" href="styles.css">
```

## Link Rewriting

Internal links are rewritten to work locally:

**Before:**
```html
<a href="https://example.com/about">About</a>
<a href="/contact">Contact</a>
```

**After:**
```html
<a href="about.html">About</a>
<a href="contact.html">Contact</a>
```

## manifest.json

Contains metadata about cloned pages:

```json
{
  "domain": "example.com",
  "timestamp": "2024-01-15T10:30:00Z",
  "pages": [
    {
      "path": "/",
      "file": "index.html",
      "title": "Home - Example",
      "screenshots": {
        "desktop": "analysis/desktop/home.png",
        "tablet": "analysis/tablet/home.png",
        "mobile": "analysis/mobile/home.png"
      }
    },
    {
      "path": "/about",
      "file": "about.html",
      "title": "About Us - Example",
      "screenshots": { ... }
    }
  ],
  "cssSize": {
    "original": 45000,
    "merged": 32000,
    "reduction": "29%"
  }
}
```

## SPA Detection

Design Clone automatically detects SPAs:

| Framework | Detection |
|-----------|-----------|
| React | `__REACT_DEVTOOLS_GLOBAL_HOOK__` |
| Vue | `__VUE__` |
| Next.js | `__NEXT_DATA__` |
| Nuxt | `__NUXT__` |
| Angular | `ng-version` attribute |
| Svelte | `__svelte` |

For SPAs, the tool:
1. Waits for hydration
2. Navigates via router
3. Waits for route transitions

## Error Handling

The tool continues on individual page failures:

```
Cloning 5 pages...
✓ / (index.html)
✓ /about (about.html)
✗ /old-page - 404 Not Found
✓ /contact (contact.html)
✓ /pricing (pricing.html)

Completed: 4/5 pages (1 failed)
```

## Best Practices

1. **Start with auto-discovery** - Usually finds all important pages
2. **Review manifest.json** - Verify all pages captured
3. **Check CSS reduction** - Confirms deduplication worked
4. **Test navigation** - Open index.html and click around
