# CLI Commands

Complete reference for Design Clone CLI commands.

## Installation Commands

### design-clone init

Install the skill to Claude's skill directory.

```bash
design-clone init [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing installation |

**Example:**
```bash
design-clone init --force
```

### design-clone verify

Check installation status.

```bash
design-clone verify
```

**Output:**
```
Design Clone Installation Check
===============================
✓ Node.js: v20.11.0
✓ Python: 3.11.4
✓ Chrome: Found
✓ Playwright: Installed
✓ Skill: ~/.claude/skills/design-clone
✓ Dependencies: All installed
```

### design-clone help

Show usage information.

```bash
design-clone help
```

## Clone Commands

### design-clone clone

Clone a single page design.

```bash
design-clone clone <url> [options]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--output <dir>` | `./cloned-design` | Output directory |
| `--viewports <list>` | `desktop,tablet,mobile` | Viewports to capture |
| `--full-page` | `false` | Full page screenshots |
| `--extract-html` | `true` | Extract HTML |
| `--extract-css` | `true` | Extract CSS |
| `--capture-hover` | `false` | Capture hover states |
| `--wait <ms>` | `0` | Wait before capture |

**Example:**
```bash
design-clone clone https://example.com --output ./my-clone --full-page
```

### design-clone clone-px

Pixel-perfect clone with full asset extraction.

```bash
design-clone clone-px <url> [options]
```

**Options:**
All options from `clone` plus:

| Option | Default | Description |
|--------|---------|-------------|
| `--extract-assets` | `true` | Download images, fonts, icons |
| `--analyze` | `true` | AI structure analysis |
| `--tokens` | `true` | Extract design tokens |
| `--verify` | `true` | Run verification scripts |

**Example:**
```bash
design-clone clone-px https://example.com --output ./pixel-perfect
```

### design-clone clone-site

Clone multiple pages from a website.

```bash
design-clone clone-site <url> [options]
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--pages <paths>` | auto-discover | Comma-separated paths |
| `--max-pages <n>` | `10` | Maximum pages |
| `--output <dir>` | auto | Output directory |
| `--yes` | `false` | Skip confirmation |

**Example:**
```bash
design-clone clone-site https://example.com --pages /,/about,/contact
```

## Claude Code Commands

These commands are used within Claude Code:

### /design:clone

Basic design clone command.

```
/design:clone https://example.com
```

### /design:clone-px

Pixel-perfect clone command.

```
/design:clone-px https://example.com
```

### /design:clone-site

Multi-page clone command.

```
/design:clone-site https://example.com
```

## Script Commands

Run individual scripts directly:

### Screenshot

```bash
node src/core/screenshot.js \
  --url <url> \
  --output <dir> \
  [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--viewports <list>` | Viewports to capture |
| `--full-page` | Full page screenshot |
| `--wait <ms>` | Wait duration |
| `--wait-until <event>` | Wait event |
| `--timeout <ms>` | Navigation timeout |
| `--extract-html` | Extract HTML |
| `--extract-css` | Extract CSS |
| `--capture-hover` | Capture hover states |
| `--video` | Record video |
| `--video-format <fmt>` | webm, mp4, gif |
| `--video-duration <ms>` | Video duration |

### Filter CSS

```bash
node src/core/filter-css.js \
  --html <path> \
  --css <path> \
  --output <path>
```

**Options:**
| Option | Description |
|--------|-------------|
| `--keep-media` | Keep all media queries |
| `--include-print` | Include print styles |
| `--debug` | Show removed selectors |

### Extract Assets

```bash
node src/core/extract-assets.js \
  --url <url> \
  --output <dir>
```

**Options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | images, fonts, icons, or all |
| `--min-size <bytes>` | Minimum file size |
| `--max-size <bytes>` | Maximum file size |
| `--concurrency <n>` | Parallel downloads |

### AI Analysis

```bash
python src/ai/analyze-structure.py \
  -s <screenshot> \
  -o <output-dir> \
  --html <html-file> \
  --css <css-file>
```

### Extract Tokens

```bash
python src/ai/extract-design-tokens.py \
  -s <screenshot> \
  -o <output-dir>
```

**Options:**
| Option | Description |
|--------|-------------|
| `--format <fmt>` | json, css, tailwind |

### Verify Menu

```bash
node src/verification/verify-menu.js \
  --html <path>
```

### Verify Layout

```bash
node src/verification/verify-layout.js \
  --html <path> \
  --css <path>
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | API key for AI analysis |
| `CHROME_PATH` | Custom Chrome executable path |
| `PLAYWRIGHT_BROWSERS_PATH` | Custom browser location |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Network error |
| 4 | File system error |
| 5 | Browser error |
