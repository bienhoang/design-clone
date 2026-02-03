/**
 * Help command - display usage information
 */

export function help() {
  console.log(`
design-clone - Claude Code skill for website design cloning

Usage:
  design-clone init [options]   Install skill to ~/.claude/skills/
  design-clone verify           Check installation status
  design-clone help             Show this help

Options:
  --force, -f    Overwrite existing installation
  --skip-deps    Skip dependency installation

Examples:
  design-clone init              # Install skill
  design-clone init --force      # Reinstall, overwrite existing
  design-clone verify            # Check if installed correctly

After installation:
  1. Set GEMINI_API_KEY in ~/.claude/.env (optional, for AI analysis)
  2. Use /design:clone or /design:clone-px in Claude Code

For more info: https://github.com/bienhoang/design-clone
`);
}
