# Video Recording

Record scroll preview videos for animation documentation.

## Overview

Video recording captures:
- Page scroll animation
- CSS transitions during scroll
- Lazy-loaded content appearing
- Sticky/fixed element behavior

## Enable Video Recording

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video
```

Creates `preview.webm` by default.

## Output Formats

### WebM (Default)

Native Playwright format, no dependencies:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video
```

### MP4

Requires FFmpeg:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-format mp4
```

### GIF

Requires FFmpeg:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-format gif
```

## FFmpeg Setup

For MP4/GIF conversion:

```bash
# Install via npm
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg

# Or system install
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg

# Windows
choco install ffmpeg
```

## Options

### Duration

Default is 12 seconds:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-duration 8000
```

### Viewport

Record specific viewport:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-viewport desktop
```

### Quality

For MP4 output:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-format mp4 \
  --video-quality high
```

Quality levels:
- `low` - Fast encoding, smaller file
- `medium` - Balanced (default)
- `high` - Best quality, larger file

## Recording Process

1. **Load page** - Wait for content
2. **Scroll to bottom** - Smooth scroll
3. **Pause** - Capture end state
4. **Scroll to top** - Return journey
5. **Convert** - To requested format

## Use Cases

### Document Animations

Capture scroll-triggered animations:
- Fade-in effects
- Parallax backgrounds
- Sticky headers
- Progress indicators

### Lazy Loading Demo

Show how images load:
- Placeholder → real image
- Skeleton screens
- Progressive loading

### Responsive Behavior

Record at different viewports:

```bash
# Desktop
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-viewport desktop

# Mobile
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-viewport mobile
```

## File Sizes

Typical output sizes for 12-second videos:

| Format | Quality | Size |
|--------|---------|------|
| WebM | default | 2-5 MB |
| MP4 | medium | 3-8 MB |
| MP4 | high | 8-15 MB |
| GIF | default | 5-20 MB |

## Performance Note

Video recording significantly increases capture time:

| Feature | Time |
|---------|------|
| Screenshots only | ~5s |
| Screenshots + video | ~20s |

Use `--video` only when needed.

## Troubleshooting

### WebM Not Playing

Some browsers may not support WebM. Convert to MP4:

```bash
ffmpeg -i preview.webm -c:v libx264 preview.mp4
```

### FFmpeg Not Found

Ensure FFmpeg is in PATH or install via npm:

```bash
npm install @ffmpeg-installer/ffmpeg
```

### Video Too Long/Short

Adjust duration:

```bash
# Shorter (6 seconds)
--video-duration 6000

# Longer (20 seconds)
--video-duration 20000
```

### Choppy Recording

For smoother recording:

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-fps 30
```

## Advanced Usage

### Custom Scroll Speed

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --scroll-speed slow
```

Speeds: `slow`, `medium`, `fast`

### Include Audio

For sites with audio (experimental):

```bash
node src/core/screenshot.js \
  --url "https://example.com" \
  --output ./output \
  --video \
  --video-audio
```
