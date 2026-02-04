import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Design Clone",
  description: "Clone website designs with multi-viewport screenshots, HTML/CSS extraction, and AI analysis",

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/cli' },
      { text: 'Changelog', link: 'https://github.com/bienhoang/design-clone/blob/main/CHANGELOG.md' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Design Clone?', link: '/guide/what-is-design-clone' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Basic Clone', link: '/guide/basic-clone' },
            { text: 'Pixel-Perfect Clone', link: '/guide/pixel-perfect' },
            { text: 'Multi-Page Sites', link: '/guide/multi-page' },
          ]
        },
        {
          text: 'Features',
          items: [
            { text: 'Screenshot Capture', link: '/guide/screenshots' },
            { text: 'CSS Extraction', link: '/guide/css-extraction' },
            { text: 'Asset Extraction', link: '/guide/assets' },
            { text: 'Hover States', link: '/guide/hover-states' },
            { text: 'Video Recording', link: '/guide/video' },
            { text: 'AI Analysis', link: '/guide/ai-analysis' },
          ]
        },
        {
          text: 'Design Principles',
          items: [
            { text: 'Japanese Design', link: '/guide/japanese-design' },
            { text: 'Quality Checklist', link: '/guide/quality-checklist' },
          ]
        },
        {
          text: 'Help',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'Reference',
          items: [
            { text: 'CLI Commands', link: '/api/cli' },
            { text: 'Script Reference', link: '/api/scripts' },
            { text: 'Configuration', link: '/api/configuration' },
            { text: 'Output Structure', link: '/api/output' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/bienhoang/design-clone' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/design-clone' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/bienhoang/design-clone/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
