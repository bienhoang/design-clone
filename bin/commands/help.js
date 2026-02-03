/**
 * Help command - display usage information
 */

export function help() {
  console.log(`
design-clone - Claude Code skill for website design cloning

Usage:
  design-clone init [options]   Install skill to ~/.claude/skills/
  design-clone verify           Check installation status
  design-clone clone-site <url> Clone multiple pages from a website
  design-clone help             Show this help

Init Options:
  --force, -f    Overwrite existing installation
  --skip-deps    Skip dependency installation

Clone-site Options:
  --pages <paths>     Comma-separated paths (e.g., /,/about,/contact)
  --max-pages <n>     Maximum pages to auto-discover (default: 10)
  --viewports <list>  Viewport list (default: desktop,tablet,mobile)
  --yes               Skip confirmation prompt
  --output <dir>      Custom output directory
  --ai                Extract design tokens using Gemini AI (requires GEMINI_API_KEY)

Examples:
  design-clone init                     # Install skill
  design-clone init --force             # Reinstall, overwrite existing
  design-clone verify                   # Check if installed correctly
  design-clone clone-site https://example.com
  design-clone clone-site https://example.com --max-pages 5
  design-clone clone-site https://example.com --pages /,/about,/contact

After installation:
  1. Set GEMINI_API_KEY in ~/.claude/.env (optional, for AI analysis)
  2. Use /design:clone or /design:clone-px in Claude Code

For more info: https://github.com/bienhoang/design-clone
`);
}
