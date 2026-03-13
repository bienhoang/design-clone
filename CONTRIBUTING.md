# Contributing to Design Clone Skill

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/bienhoang/design-clone.git
   cd design-clone
   ```
3. Install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```

## Development

### Project Structure

```
design-clone/
├── bin/                         # CLI entry point
│   ├── cli.js                   # Main CLI router
│   ├── commands/                # CLI commands (init, help, update, uninstall)
│   └── utils/                   # CLI utilities (paths.js, version.js)
├── src/
│   ├── utils.js                 # Shared utilities, browser management, constants
│   ├── capture.js               # Screenshot pipeline + HTML/CSS extraction
│   ├── filter-css.js            # CSS filtering + dead code removal
│   ├── extract-assets.js        # Asset extraction (images, fonts, icons)
│   ├── clone-site.js            # Multi-page clone + route discovery + CSS merge
│   └── ai/                      # AI analysis prompt templates
│       └── prompts/             # Markdown prompts for Claude Code vision
├── commands/design/             # Slash command definitions
├── docs/                        # Documentation
├── templates/                   # HTML/CSS base templates
└── tests/                       # Test suite (6 suites, 54 tests)
```

### Running Tests

```bash
npm test
# Or run individual test files
node tests/run-all-tests.js
```

### Testing Changes Locally

```bash
# Link package locally
npm link

# Test installation
design-clone init --force
design-clone verify
```

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Follow existing code style
3. Add tests for new features
4. Update documentation if needed
5. Keep commits focused and atomic

### Commit Message Format

```
type(scope): description

feat(cli): add --verbose flag to init command
fix(screenshot): handle CORS-blocked stylesheets
docs(readme): add Windows installation steps
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Reporting Issues

Include:
- Operating system and version
- Node.js version (`node --version`)
- Python version (`python3 --version`)
- Steps to reproduce
- Error messages or screenshots

## Code of Conduct

Be respectful and constructive. We're all here to build something useful.

## Questions?

Open an issue with the `question` label.
