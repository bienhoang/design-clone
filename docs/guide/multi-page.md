# Multi-Page Sites

Capture multi-viewport screenshots of entire websites for Claude Code vision.

## Command

```bash
/design:clone-site https://example.com
```

## Features

- **Auto-discovery** - Finds pages from navigation links
- **Multi-viewport screenshots** - Desktop, tablet, mobile captures per page
- **SPA support** - Handles React, Vue, Next.js sites
- **Progress reporting** - Real-time capture status

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
│   │   ├── index.png
│   │   ├── about.png
│   │   └── contact.png
│   ├── tablet/
│   │   └── ...
│   └── mobile/
│       └── ...
├── manifest.json           # Page metadata + screenshot paths
└── capture-results.json    # Detailed capture results
```

## manifest.json

Contains metadata about captured pages and screenshot paths:

```json
{
  "baseUrl": "https://example.com",
  "capturedAt": "2026-02-23T10:30:00Z",
  "pages": [
    {
      "path": "/",
      "name": "Home",
      "originalUrl": "https://example.com/",
      "screenshots": {
        "desktop": "analysis/desktop/index.png",
        "tablet": "analysis/tablet/index.png",
        "mobile": "analysis/mobile/index.png"
      }
    },
    {
      "path": "/about",
      "name": "About",
      "originalUrl": "https://example.com/about",
      "screenshots": { "..." : "..." }
    }
  ],
  "stats": {
    "totalPages": 3,
    "totalScreenshots": 9,
    "captureTimeMs": 12000
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
3. **Check screenshots** - Ensure all viewports rendered correctly
4. **Use Claude Code vision** - Feed screenshots to generate new HTML/CSS
