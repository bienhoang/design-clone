# CLI Reference

## Main Commands

### design-clone init [--force]

Install skill to `~/.claude/skills/design-clone`. Use `--force` to overwrite existing installation.

### design-clone verify

Check installation status: Node.js version, Playwright browsers, skill files.

### design-clone update [--force]

Update to latest version from npm. `--force` skips version check.

### design-clone uninstall [--yes]

Remove skill installation. `--yes` skips confirmation.

### design-clone help

Show usage help with all available commands.

### design-clone --version

Show installed version.

## Slash Commands (Claude Code)

| Command | Description |
|---------|-------------|
| `/design:clone <url>` | Basic single-page clone |
| `/design:clone-px <url>` | Pixel-perfect clone with full extraction |
| `/design:clone-site <url>` | Multi-page clone with shared CSS |

## Core Scripts

### src/capture.js — Screenshot Pipeline

```bash
node src/capture.js --url <url> --output <dir> [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--url` | required | Target URL |
| `--output` | required | Output directory |
| `--extract-html` | false | Extract page HTML |
| `--extract-css` | false | Extract + filter CSS |
| `--capture-hover` | false | Capture hover state screenshots |
| `--full-page` | false | Full-page screenshots |
| `--detect-breakpoints` | false | Auto-detect CSS breakpoints from @media queries |
| `--extract-computed` | false | Extract JS-applied computed styles |
| `--aggressive-filter` | false | Two-pass CSS dead code removal |

**Output:** desktop.png, tablet.png, mobile.png, source.html, source-raw.css, source.css, hover-states/, hover.css, breakpoints.json, computed-gap.css

### src/filter-css.js — CSS Filtering

```bash
node src/filter-css.js --html <file> --css <file> --output <file> [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--html` | required | HTML file for selector analysis |
| `--css` | required | CSS file to filter |
| `--output` | required | Output filtered CSS path |
| `--verbose` | false | Show filtering stats |
| `--aggressive-filter` | false | Remove dead @media, @keyframes, unused vars |

### src/extract-assets.js — Asset Extraction

```bash
node src/extract-assets.js --url <url> --output <dir> [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--url` | required | Target URL |
| `--output` | required | Output directory |
| `--verbose` | false | Show download progress |
| `--concurrency` | 10 | Max concurrent downloads |

**Output:** assets/images/, assets/fonts/, assets/icons/, assets/url-mapping.json

### src/clone-site.js — Multi-Page Clone

```bash
node src/clone-site.js --url <url> [flags]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--url` | required | Target URL |
| `--pages` | auto | Comma-separated paths (e.g., /,/about,/contact) |
| `--max-pages` | 10 | Maximum pages to auto-discover |
| `--output` | ./cloned-designs | Output directory |
| `--detect-breakpoints` | false | Auto-detect CSS breakpoints |
| `--aggressive-filter` | false | Two-pass CSS dead code removal on merged CSS |
| `--dry-run` | false | Preview discovered pages without capture |
| `--verbose` | false | Enable verbose logging |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHROME_PATH` | No | Custom Chrome/Chromium path |
| `PLAYWRIGHT_BROWSERS_PATH` | No | Custom browser install path |
