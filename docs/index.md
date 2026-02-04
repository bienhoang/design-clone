---
layout: home

hero:
  name: "Design Clone"
  text: "Clone Website Designs with AI"
  tagline: Multi-viewport screenshots, HTML/CSS extraction, and Gemini AI analysis for Claude Code
  image:
    src: /logo.svg
    alt: Design Clone
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/bienhoang/design-clone

features:
  - icon: 📸
    title: Multi-Viewport Screenshots
    details: Capture pixel-perfect screenshots at desktop (1920px), tablet (768px), and mobile (375px) viewports.

  - icon: 🎨
    title: HTML/CSS Extraction
    details: Extract clean source HTML with scripts removed and filtered CSS with unused selectors eliminated.

  - icon: 🤖
    title: AI Structure Analysis
    details: Optional Gemini Vision integration analyzes page layout and extracts design tokens automatically.

  - icon: 🖼️
    title: Asset Extraction
    details: Download all images, fonts, and icons from the target website for complete design recreation.

  - icon: ✨
    title: Hover State Capture
    details: Capture interactive element states and generate corresponding :hover CSS rules.

  - icon: 🎬
    title: Video Recording
    details: Record scroll preview videos in WebM, MP4, or GIF format for animation documentation.
---

## Quick Start

Install globally via npm:

```bash
npm install -g design-clone
design-clone init
```

Then use in Claude Code:

```bash
# Basic design clone
/design:clone https://example.com

# Pixel-perfect clone with assets
/design:clone-px https://example.com

# Multi-page site clone
/design:clone-site https://example.com
```

## Why Design Clone?

Design Clone is built specifically for [Claude Code](https://claude.ai/code) workflows, providing:

- **Fast iteration** - Clone designs in seconds, not hours
- **Clean output** - No cruft, just the CSS and HTML you need
- **AI-powered** - Optional Gemini analysis for design tokens
- **Japanese principles** - Built-in Ma, Kanso, Shibui, Seijaku design philosophy
