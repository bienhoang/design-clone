/**
 * Help command - display usage information
 */

export function help() {
  console.log(`
design-clone - Claude Code skill for website design cloning

Usage:
  design-clone init [options]       Install skill to ~/.claude/skills/
  design-clone verify               Check installation status
  design-clone update [options]     Update to latest version
  design-clone uninstall [options]  Remove skill installation
  design-clone help                 Show this help
  design-clone --version            Show version

Init Options:
  --force, -f    Overwrite existing installation
  --skip-deps    Skip dependency installation

Update Options:
  --force, -f    Reinstall even if already up to date
  --skip-deps    Skip dependency installation

Uninstall Options:
  --yes, -y      Skip confirmation prompt

Examples:
  design-clone init                     # Install skill
  design-clone init --force             # Reinstall, overwrite existing
  design-clone verify                   # Check if installed correctly
  design-clone update                   # Update to latest version
  design-clone uninstall                # Remove skill installation
  design-clone --version                # Show version

After installation:
  1. AI analysis is built-in via Claude Code vision (no API key needed)
  2. Use /design:clone or /design:clone-px in Claude Code
  3. Use /design:clone-site in Claude Code for multi-page cloning

For more info: https://github.com/bienhoang/design-clone
`);
}
