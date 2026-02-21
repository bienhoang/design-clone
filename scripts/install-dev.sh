#!/usr/bin/env bash
# install-dev.sh - Install design-clone as dev skill with -dev suffix
#
# Installs to:
#   ~/.claude/skills/design-clone-dev/     (skill files)
#   ~/.claude/commands/design-dev/          (slash commands as /design-dev:*)
#
# Usage:
#   ./scripts/install-dev.sh           # Install (skip if exists)
#   ./scripts/install-dev.sh --force   # Force reinstall
#   ./scripts/install-dev.sh --uninstall  # Remove dev installation

set -euo pipefail

# --- Config ---
SKILL_NAME="design-clone-dev"
COMMAND_PREFIX="design-dev"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_DEST="$HOME/.claude/skills/$SKILL_NAME"
COMMANDS_DEST="$HOME/.claude/commands/$COMMAND_PREFIX"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[dev]${NC} $*"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $*"; }
err()   { echo -e "${RED}  ✗${NC} $*"; }

# --- Uninstall ---
uninstall() {
  info "Uninstalling $SKILL_NAME..."

  if [[ -d "$SKILL_DEST" ]]; then
    rm -rf "$SKILL_DEST"
    ok "Removed $SKILL_DEST"
  else
    warn "Skill directory not found"
  fi

  if [[ -d "$COMMANDS_DEST" ]]; then
    rm -rf "$COMMANDS_DEST"
    ok "Removed $COMMANDS_DEST"
  else
    warn "Commands directory not found"
  fi

  echo ""
  ok "Uninstall complete"
  exit 0
}

# --- Parse args ---
FORCE=false
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=true ;;
    --uninstall|--remove) uninstall ;;
    --help|-h)
      echo "Usage: $0 [--force] [--uninstall]"
      echo ""
      echo "  --force      Overwrite existing installation"
      echo "  --uninstall  Remove dev installation"
      exit 0
      ;;
  esac
done

# --- Pre-flight ---
info "Installing $SKILL_NAME from $PROJECT_DIR"
echo ""

# Check existing
if [[ -d "$SKILL_DEST" && "$FORCE" != "true" ]]; then
  warn "Already installed at $SKILL_DEST"
  echo "  Use --force to overwrite"
  exit 0
fi

# --- Exclude patterns for rsync ---
EXCLUDES=(
  --exclude='node_modules'
  --exclude='.git'
  --exclude='__pycache__'
  --exclude='test-*.js'
  --exclude='test-*.py'
  --exclude='run-all-tests.js'
  --exclude='.DS_Store'
  --exclude='*.log'
  --exclude='cloned-designs'
  --exclude='test-output'
  --exclude='icons'
  --exclude='scripts/install-dev.sh'
  --exclude='plans'
  --exclude='prd'
  --exclude='landing-page'
)

# --- Step 1: Copy skill files ---
info "Copying skill files..."
mkdir -p "$SKILL_DEST"

if command -v rsync &>/dev/null; then
  rsync -a --delete "${EXCLUDES[@]}" "$PROJECT_DIR/" "$SKILL_DEST/"
else
  # Fallback: remove and copy
  [[ -d "$SKILL_DEST" ]] && rm -rf "$SKILL_DEST"
  cp -R "$PROJECT_DIR" "$SKILL_DEST"
  # Clean up excluded dirs
  rm -rf "$SKILL_DEST/node_modules" "$SKILL_DEST/.git" \
    "$SKILL_DEST/cloned-designs" "$SKILL_DEST/test-output" \
    "$SKILL_DEST/plans" "$SKILL_DEST/prd" "$SKILL_DEST/landing-page"
  find "$SKILL_DEST" -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
  find "$SKILL_DEST" -name '.DS_Store' -delete 2>/dev/null || true
fi
ok "Copied to $SKILL_DEST"

# --- Step 2: Patch SKILL.md name ---
info "Patching SKILL.md with dev suffix..."
SKILL_MD="$SKILL_DEST/SKILL.md"
if [[ -f "$SKILL_MD" ]]; then
  # Update name in frontmatter
  sed -i '' "s/^name: design-clone$/name: $SKILL_NAME/" "$SKILL_MD"
  ok "SKILL.md name → $SKILL_NAME"
fi

# --- Step 3: Copy & rename slash commands ---
info "Installing slash commands as /$COMMAND_PREFIX:*..."
COMMANDS_SOURCE="$PROJECT_DIR/commands/design"
mkdir -p "$COMMANDS_DEST"

if [[ -d "$COMMANDS_SOURCE" ]]; then
  for file in "$COMMANDS_SOURCE"/*.md; do
    [[ -f "$file" ]] || continue
    basename="$(basename "$file")"
    cp "$file" "$COMMANDS_DEST/$basename"
    cmd_name="${basename%.md}"
    ok "/$COMMAND_PREFIX:$cmd_name"
  done
else
  warn "No commands/design/ directory found"
fi

# --- Step 4: Install dependencies ---
info "Installing dependencies..."

# npm install
if [[ -f "$SKILL_DEST/package.json" ]]; then
  (cd "$SKILL_DEST" && npm install --omit=dev --silent 2>/dev/null) && ok "npm packages" || warn "npm install failed"
fi

# Check playwright
if node -e "require.resolve('playwright')" 2>/dev/null; then
  ok "Playwright (already available)"
else
  (cd "$SKILL_DEST" && npm install playwright --silent 2>/dev/null) && ok "Playwright installed" || warn "Playwright install failed"
fi

# --- Step 5: Create symlink for easy updates ---
LINK_FILE="$SKILL_DEST/.dev-source"
echo "$PROJECT_DIR" > "$LINK_FILE"
ok "Source reference: $LINK_FILE"

# --- Done ---
echo ""
echo -e "${GREEN}✓ $SKILL_NAME installed successfully!${NC}"
echo ""
echo "  Skill:    $SKILL_DEST"
echo "  Commands: $COMMANDS_DEST"
echo ""
echo "  Slash commands available:"
shopt -s nullglob
for file in "$COMMANDS_DEST"/*.md; do
  cmd_name="$(basename "${file%.md}")"
  echo "    /$COMMAND_PREFIX:$cmd_name"
done
shopt -u nullglob
echo ""
echo "  To uninstall: $0 --uninstall"
echo "  To reinstall: $0 --force"
