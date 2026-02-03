# CLI Reference

All script options and parameters.

## screenshot.js

Core screenshot and extraction tool.

```bash
node src/core/screenshot.js [options]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| --url | string | required | Target URL |
| --output | string | required | Output directory |
| --viewports | string | all | Comma-separated: desktop,tablet,mobile |
| --full-page | bool | true | Capture full page height |
| --max-size | number | 5 | Max file size in MB before compression |
| --headless | bool | false | Run in headless mode (desktop always uses headless) |
| --scroll-delay | number | 1500 | Pause time in ms between scroll steps for lazy content |
| --close | bool | false | Close browser after capture (false keeps session) |
| --extract-html | bool | false | Extract cleaned HTML |
| --extract-css | bool | false | Extract all CSS from page |
| --extract-animations | bool | true* | Extract @keyframes and transitions (enabled with --extract-css) |
| --filter-unused | bool | true | Filter CSS to remove unused selectors |
| --verbose | bool | false | Verbose logging |

*Default true when --extract-css is enabled, can be disabled with `--extract-animations false`

**Output**: JSON with screenshot paths and metadata. Includes `browserRestarts` count tracking for stability monitoring.

## filter-css.js

Remove unused CSS selectors.

```bash
node src/core/filter-css.js --html FILE --css FILE --output FILE [--verbose]
```

| Option | Required | Description |
|--------|----------|-------------|
| --html | yes | Source HTML file |
| --css | yes | Raw CSS file |
| --output | yes | Filtered CSS output |
| --verbose | no | Show stats |

## analyze-structure.py

AI structure analysis with Gemini.

```bash
python src/ai/analyze-structure.py -s SCREENSHOT -o OUTPUT [options]
```

| Option | Required | Description |
|--------|----------|-------------|
| -s, --screenshot | yes | Desktop screenshot |
| -o, --output | yes | Output directory |
| --html | no | Source HTML (improves accuracy) |
| --css | no | Source CSS (improves accuracy) |
| --model | no | Gemini model (default: gemini-2.5-flash) |
| -v, --verbose | no | Verbose output |

## extract-design-tokens.py

Extract colors, typography, spacing.

```bash
python src/ai/extract-design-tokens.py -s SCREENSHOT -o OUTPUT [options]
```

Same options as analyze-structure.py.

## extract-assets.js

Download images, fonts, icons.

```bash
node src/core/extract-assets.js --url URL --output DIR
```

## verify-menu.js

Validate navigation structure.

```bash
node src/verification/verify-menu.js --html FILE
```

## verify-layout.js

Verify layout consistency.

```bash
node src/verification/verify-layout.js --html FILE
```
