#!/usr/bin/env python3
"""
Extract design tokens from website screenshots using Gemini Vision API.

Usage:
  python extract-design-tokens.py --screenshots ./analysis --output ./output
  python extract-design-tokens.py -s ./analysis -o ./out --css source.css

Options:
  --screenshots   Directory containing desktop.png, tablet.png, mobile.png
  --output        Output directory for design-tokens.json and tokens.css
  --css           Path to filtered CSS file for exact token extraction (optional)
  --model         Gemini model (default: gemini-2.5-flash)
  --verbose       Enable verbose output

Output:
  - design-tokens.json: Machine-readable tokens
  - tokens.css: CSS custom properties

When CSS provided, extracts EXACT colors/fonts from source instead of estimating.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Add src directory to path for local imports
SCRIPT_DIR = Path(__file__).parent.resolve()
SRC_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SRC_DIR))

# Import local env resolver (portable)
try:
    from utils.env import resolve_env, load_env
    load_env()  # Load .env files on startup
except ImportError:
    # Fallback: simple env getter
    def resolve_env(key, default=None):
        return os.environ.get(key, default)

# Check for google-genai dependency
try:
    from google import genai
    from google.genai import types
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "google-genai not installed",
        "hint": "Run: pip install google-genai"
    }, indent=2))
    sys.exit(1)

# Import prompts from extracted module
from prompts.design_tokens import build_extraction_prompt


# Default tokens (fallback)
DEFAULT_TOKENS = {
    "colors": {
        "primary": "#2563eb",
        "secondary": "#64748b",
        "accent": "#f59e0b",
        "background": "#ffffff",
        "surface": "#f8fafc",
        "text": {
            "primary": "#0f172a",
            "secondary": "#475569",
            "muted": "#94a3b8"
        },
        "border": "#e2e8f0"
    },
    "typography": {
        "fontFamily": {
            "heading": "Inter, sans-serif",
            "body": "Inter, sans-serif"
        },
        "fontSize": {
            "xs": "12px",
            "sm": "14px",
            "base": "16px",
            "lg": "18px",
            "xl": "20px",
            "2xl": "24px",
            "3xl": "30px",
            "4xl": "36px"
        },
        "fontWeight": {
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    },
    "spacing": {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
        "16": "64px"
    },
    "borderRadius": {
        "sm": "4px",
        "md": "8px",
        "lg": "16px",
        "full": "9999px"
    },
    "shadows": {
        "sm": "0 1px 2px rgba(0,0,0,0.05)",
        "md": "0 4px 6px rgba(0,0,0,0.1)",
        "lg": "0 10px 15px rgba(0,0,0,0.1)"
    },
    "notes": ["Using default tokens - extraction failed or was not performed"]
}


def get_api_key() -> Optional[str]:
    """Get Gemini API key from environment (supports GEMINI_API_KEY or GOOGLE_API_KEY)."""
    return resolve_env('GEMINI_API_KEY') or resolve_env('GOOGLE_API_KEY')


def validate_hex_color(color: str) -> bool:
    """Validate hex color format."""
    return bool(re.match(r'^#[0-9A-Fa-f]{6}$', color))


def validate_tokens(tokens: Dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate extracted tokens, return (is_valid, errors)."""
    errors = []

    # Check colors
    if 'colors' in tokens:
        colors = tokens['colors']
        for key in ['primary', 'secondary', 'accent', 'background', 'surface', 'border']:
            if key in colors and not validate_hex_color(colors[key]):
                errors.append(f"Invalid hex color: colors.{key} = {colors[key]}")

        if 'text' in colors:
            for key in ['primary', 'secondary', 'muted']:
                if key in colors['text'] and not validate_hex_color(colors['text'][key]):
                    errors.append(f"Invalid hex color: colors.text.{key} = {colors['text'][key]}")

    return len(errors) == 0, errors


def merge_with_defaults(tokens: Dict[str, Any]) -> Dict[str, Any]:
    """Merge extracted tokens with defaults for missing values."""
    def deep_merge(base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    return deep_merge(DEFAULT_TOKENS.copy(), tokens)


def generate_tokens_css(tokens: Dict[str, Any]) -> str:
    """Generate tokens.css from design tokens."""
    lines = [
        "/* Design Tokens - Auto-generated */",
        "/* Edit values below to customize the design */",
        "",
        ":root {",
        "  /* Colors */",
    ]

    colors = tokens.get('colors', {})
    lines.append(f"  --color-primary: {colors.get('primary', '#2563eb')};")
    lines.append(f"  --color-secondary: {colors.get('secondary', '#64748b')};")
    lines.append(f"  --color-accent: {colors.get('accent', '#f59e0b')};")
    lines.append(f"  --color-background: {colors.get('background', '#ffffff')};")
    lines.append(f"  --color-surface: {colors.get('surface', '#f8fafc')};")

    text_colors = colors.get('text', {})
    lines.append(f"  --color-text-primary: {text_colors.get('primary', '#0f172a')};")
    lines.append(f"  --color-text-secondary: {text_colors.get('secondary', '#475569')};")
    lines.append(f"  --color-text-muted: {text_colors.get('muted', '#94a3b8')};")
    lines.append(f"  --color-border: {colors.get('border', '#e2e8f0')};")

    lines.append("")
    lines.append("  /* Typography */")

    typography = tokens.get('typography', {})
    font_family = typography.get('fontFamily', {})
    lines.append(f"  --font-heading: {font_family.get('heading', 'Inter, sans-serif')};")
    lines.append(f"  --font-body: {font_family.get('body', 'Inter, sans-serif')};")

    font_sizes = typography.get('fontSize', {})
    for key in ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']:
        default = DEFAULT_TOKENS['typography']['fontSize'].get(key, '16px')
        lines.append(f"  --font-size-{key}: {font_sizes.get(key, default)};")

    font_weights = typography.get('fontWeight', {})
    for key in ['normal', 'medium', 'semibold', 'bold']:
        default = DEFAULT_TOKENS['typography']['fontWeight'].get(key, 400)
        lines.append(f"  --font-weight-{key}: {font_weights.get(key, default)};")

    line_heights = typography.get('lineHeight', {})
    for key in ['tight', 'normal', 'relaxed']:
        default = DEFAULT_TOKENS['typography']['lineHeight'].get(key, 1.5)
        lines.append(f"  --line-height-{key}: {line_heights.get(key, default)};")

    lines.append("")
    lines.append("  /* Spacing */")

    spacing = tokens.get('spacing', {})
    for key in ['1', '2', '3', '4', '6', '8', '12', '16']:
        default = DEFAULT_TOKENS['spacing'].get(key, '16px')
        lines.append(f"  --space-{key}: {spacing.get(key, default)};")

    lines.append("")
    lines.append("  /* Border Radius */")

    border_radius = tokens.get('borderRadius', {})
    for key in ['sm', 'md', 'lg', 'full']:
        default = DEFAULT_TOKENS['borderRadius'].get(key, '8px')
        lines.append(f"  --radius-{key}: {border_radius.get(key, default)};")

    lines.append("")
    lines.append("  /* Shadows */")

    shadows = tokens.get('shadows', {})
    for key in ['sm', 'md', 'lg']:
        default = DEFAULT_TOKENS['shadows'].get(key, '0 1px 2px rgba(0,0,0,0.05)')
        lines.append(f"  --shadow-{key}: {shadows.get(key, default)};")

    lines.append("}")
    lines.append("")

    return "\n".join(lines)


def extract_tokens(
    screenshots_dir: str,
    css_path: str = None,
    model: str = "gemini-2.5-flash",
    verbose: bool = False
) -> Dict[str, Any]:
    """Extract design tokens from screenshots using Gemini Vision.

    Args:
        screenshots_dir: Directory containing screenshots
        css_path: Optional path to filtered CSS (improves accuracy)
        model: Gemini model to use
        verbose: Enable verbose output

    Returns:
        Design tokens dictionary
    """

    api_key = get_api_key()
    if not api_key:
        if verbose:
            print("Warning: GEMINI_API_KEY not found, using default tokens")
        return DEFAULT_TOKENS.copy()

    # Load CSS if provided
    css_content = None
    if css_path and Path(css_path).exists():
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
        if verbose:
            print(f"Loaded CSS: {len(css_content)} chars")

    # Build prompt with context
    prompt = build_extraction_prompt(css_content)

    if verbose and css_content:
        print("Using enhanced prompt with CSS context")

    # Find screenshots
    screenshots_path = Path(screenshots_dir)
    desktop = screenshots_path / "desktop.png"
    tablet = screenshots_path / "tablet.png"
    mobile = screenshots_path / "mobile.png"

    # Check which files exist
    available_images = []
    for img in [desktop, tablet, mobile]:
        if img.exists():
            available_images.append(img)
            if verbose:
                print(f"Found: {img}")

    if not available_images:
        if verbose:
            print("Warning: No screenshots found, using default tokens")
        return DEFAULT_TOKENS.copy()

    try:
        # Initialize client
        client = genai.Client(api_key=api_key)

        # Build content with images
        content = [prompt]

        for img_path in available_images:
            with open(img_path, 'rb') as f:
                img_bytes = f.read()
            content.append(
                types.Part.from_bytes(data=img_bytes, mime_type='image/png')
            )

        if verbose:
            print(f"Sending {len(available_images)} images to {model}...")

        # Request structured JSON output
        config = types.GenerateContentConfig(
            response_mime_type='application/json'
        )

        response = client.models.generate_content(
            model=model,
            contents=content,
            config=config
        )

        # Parse response
        if hasattr(response, 'text') and response.text:
            tokens = json.loads(response.text)

            # Validate
            is_valid, errors = validate_tokens(tokens)
            if not is_valid:
                if verbose:
                    print(f"Validation warnings: {errors}")
                tokens['notes'] = tokens.get('notes', []) + errors

            # Merge with defaults for missing values
            tokens = merge_with_defaults(tokens)

            if verbose:
                print("Tokens extracted successfully")

            return tokens
        else:
            if verbose:
                print("Warning: Empty response, using default tokens")
            return DEFAULT_TOKENS.copy()

    except Exception as e:
        if verbose:
            print(f"Error during extraction: {e}")

        # Return defaults with error note
        tokens = DEFAULT_TOKENS.copy()
        tokens['notes'] = [f"Extraction failed: {str(e)}"]
        return tokens


def main():
    parser = argparse.ArgumentParser(
        description="Extract design tokens from screenshots using Gemini Vision"
    )
    parser.add_argument(
        '--screenshots', '-s',
        required=True,
        help='Directory containing screenshots (desktop.png, tablet.png, mobile.png)'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output directory for design-tokens.json and tokens.css'
    )
    parser.add_argument(
        '--css',
        default=None,
        help='Path to filtered CSS file for exact token extraction (optional)'
    )
    parser.add_argument(
        '--model', '-m',
        default='gemini-2.5-flash',
        help='Gemini model to use (default: gemini-2.5-flash)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    # Create output directory
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)

    # Extract tokens
    tokens = extract_tokens(
        screenshots_dir=args.screenshots,
        css_path=args.css,
        model=args.model,
        verbose=args.verbose
    )

    # Save design-tokens.json
    json_path = output_path / "design-tokens.json"
    with open(json_path, 'w') as f:
        json.dump(tokens, f, indent=2)

    if args.verbose:
        print(f"Saved: {json_path}")

    # Generate and save tokens.css
    css_content = generate_tokens_css(tokens)
    css_path = output_path / "tokens.css"
    with open(css_path, 'w') as f:
        f.write(css_content)

    if args.verbose:
        print(f"Saved: {css_path}")

    # Output result as JSON
    result = {
        "success": True,
        "tokens_json": str(json_path),
        "tokens_css": str(css_path),
        "model": args.model,
        "notes": tokens.get('notes', [])
    }

    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
