# Script Reference

All available scripts and their purposes.

## Core Scripts

Located in `src/core/`

### screenshot.js

Capture multi-viewport screenshots.

```bash
node src/core/capture/screenshot.js --url <url> --output <dir>
```

**Capabilities:**
- Desktop/tablet/mobile viewports
- Full page capture
- HTML/CSS extraction
- Hover state capture
- Video recording

### filter-css.js

Filter unused CSS selectors.

```bash
node src/core/css/filter-css.js --html <file> --css <file> --output <file>
```

**Process:**
1. Parse HTML DOM
2. Build selector usage map
3. Filter unused rules
4. Preserve @keyframes, @font-face

### extract-assets.js

Download images, fonts, icons.

```bash
node src/core/media/extract-assets.js --url <url> --output <dir>
```

**Assets extracted:**
- Images (png, jpg, svg, webp, gif)
- Fonts (woff2, woff, ttf, otf)
- Icons (favicon, apple-touch-icon)

### animation-extractor.js

Extract CSS animations and transitions.

```bash
node src/core/animation/animation-extractor.js --css <file> --output <dir>
```

**Output:**
- `animations.css` - @keyframes rules
- `animation-tokens.json` - Animation metadata

### state-capture.js

Capture element hover states.

```bash
node src/core/animation/state-capture.js --url <url> --output <dir>
```

**Output:**
- Before/after screenshots
- Style diff JSON
- Generated :hover CSS

### video-capture.js

Record scroll preview video.

```bash
node src/core/media/video-capture.js --url <url> --output <dir>
```

**Formats:** WebM, MP4, GIF

### design-tokens.js

Extract design tokens from CSS.

```bash
node src/core/design-tokens.js --css <file> --output <file>
```

**Tokens extracted:**
- Colors
- Typography
- Spacing
- Border radius
- Shadows

### merge-css.js (dormant)

Merge multiple CSS files with deduplication. Not used by current pipelines.

```bash
node src/core/css/merge-css.js --input <files> --output <file>
```

### rewrite-links.js (dormant)

Rewrite internal links for local navigation. Not used by current pipelines.

```bash
node src/core/links/rewrite-links.js --html <file> --output <file> --base <url>
```

### discover-pages.js

Discover navigation links from a page.

```bash
node src/core/discovery/discover-pages.js --url <url>
```

**Detects:**
- Navigation menu links
- Footer links
- Sitemap links

### multi-page-screenshot.js

Capture screenshots for multiple pages.

```bash
node src/core/capture/multi-page-screenshot.js --urls <file> --output <dir>
```

## AI Scripts

Located in `src/ai/`

### analyze-structure.py

AI-powered page structure analysis.

```bash
python src/ai/analyze-structure.py -s <screenshot> -o <dir>
```

**Requires:** `GEMINI_API_KEY`

**Output:** `structure.md`

### extract-design-tokens.py

AI-powered design token extraction.

```bash
python src/ai/extract-design-tokens.py -s <screenshot> -o <dir>
```

**Requires:** `GEMINI_API_KEY`

**Output:** `tokens.json`

### ux-audit.js

UX audit using Gemini Vision.

```bash
node src/ai/ux-audit.js --screenshot <file> --output <dir>
```

## Verification Scripts

Located in `src/verification/`

### verify-menu.js

Validate navigation structure.

```bash
node src/verification/verify-menu.js --html <file>
```

**Checks:**
- Navigation presence
- Link validity
- Mobile menu
- Accessibility

### verify-layout.js

Verify layout consistency.

```bash
node src/verification/verify-layout.js --html <file> --css <file>
```

**Checks:**
- Grid/flex usage
- Responsive rules
- Spacing consistency

### verify-header.js

Validate header component.

```bash
node src/verification/verify-header.js --html <file>
```

### verify-footer.js

Validate footer component.

```bash
node src/verification/verify-footer.js --html <file>
```

### verify-slider.js

Validate slider/carousel components.

```bash
node src/verification/verify-slider.js --html <file>
```

### generate-audit-report.js

Generate comprehensive audit report.

```bash
node src/verification/generate-audit-report.js --input <dir> --output <file>
```

## Post-Processing Scripts

Located in `src/post-process/`

### fetch-images.js

Download and optimize images.

```bash
node src/post-process/fetch-images.js --html <file> --output <dir>
```

### inject-icons.js

Replace icons with Font Awesome.

```bash
node src/post-process/inject-icons.js --html <file> --output <file>
```

### enhance-assets.js

Enhance extracted assets.

```bash
node src/post-process/enhance-assets.js --input <dir>
```

## Utility Scripts

Located in `src/utils/`

### browser.js

Browser management utilities.

```javascript
import { launchBrowser, closeBrowser } from './utils/browser.js'
```

### playwright.js

Playwright-specific utilities.

```javascript
import { createPage, waitForContent } from './utils/playwright.js'
```

### env.js

Environment variable handling.

```javascript
import { getEnv, requireEnv } from './utils/env.js'
```

### helpers.js

General helper functions.

```javascript
import { slugify, formatDate, ensureDir } from './utils/helpers.js'
```

## Route Discoverers

Located in `src/route-discoverers/`

Framework-specific page discovery:

| File | Framework |
|------|-----------|
| `react-discoverer.js` | React |
| `next-discoverer.js` | Next.js |
| `vue-discoverer.js` | Vue.js |
| `nuxt-discoverer.js` | Nuxt |
| `angular-discoverer.js` | Angular |
| `svelte-discoverer.js` | Svelte |
| `astro-discoverer.js` | Astro |
| `universal-discoverer.js` | Generic |

## Running Scripts

### Via npm

```bash
npm run screenshot -- --url https://example.com --output ./out
npm run filter-css -- --html ./out/source.html --css ./out/source-raw.css
```

### Via node

```bash
node src/core/capture/screenshot.js --url https://example.com --output ./out
```

### Via Python

```bash
python src/ai/analyze-structure.py -s ./out/desktop.png -o ./out
```
